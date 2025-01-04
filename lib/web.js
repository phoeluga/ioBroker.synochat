/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint -W061 */

"use strict";

const { threadId } = require("worker_threads");

const matchHtmlRegExp = /["'&<>]/;
function escapeHtml(string) {
  const str = `${string}`;
  const match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  let escape;
  let html = "";
  let index;
  let lastIndex = 0;

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = "&quot;";
        break;
      case 38: // &
        escape = "&amp;";
        break;
      case 39: // '
        escape = "&#39;";
        break;
      case 60: // <
        escape = "&lt;";
        break;
      case 62: // >
        escape = "&gt;";
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}

/**
 * SynoChatWebHook class
 *
 * From settings used only secure, auth and crossDomain
 *
 * @param server http or https node.js object
 * @param webSettings settings of the web server, like <pre><code>{secure: settings.secure, port: settings.port}</code></pre>
 * @param adapter web adapter object
 * @param instanceSettings instance object with common and native
 * @param app express application
 * @returns object instance
 */
function SynoChatWebHook(server, webSettings, adapter, instanceSettings, app) {
  if (!(this instanceof SynoChatWebHook)) {
    return new SynoChatWebHook(
      server,
      webSettings,
      adapter,
      instanceSettings,
      app,
    );
  }

  this.app = app;
  this.adapter = adapter;
  this.settings = webSettings;
  this.config = instanceSettings ? instanceSettings.native : {};
  this.namespace = instanceSettings
    ? instanceSettings._id.substring("system.adapter.".length)
    : "synochat";
  this.request = {};
  this.synoChat =
    this.config.synochat === true || this.config.synochat === "true";
  const that = this;
  let proxy;
  let request;
  let path;
  let fs;
  let mime;

  this.config.route = this.config.route || `${this.namespace}/`;

  this.config.errorTimeout = parseInt(this.config.errorTimeout, 10) || 10000;
  if (this.config.errorTimeout < 1000) {
    this.config.errorTimeout = 1000;
  }

  this.config.route = this.config.route || `${this.namespace}/`;
  // remove leading slash
  if (this.config.route[0] === "/") {
    this.config.route = this.config.route.substr(1);
  }

  function oneRule(rule) {
    adapter.log.info(`Install extension on /${that.config.route}${rule.regex}`);

    rule.timeout = parseInt(rule.timeout, 10) || that.config.errorTimeout;
  }

  let adapterWebHookUrl = "";
  if (this.settings.secure) {
    adapterWebHookUrl = "https://";
  } else {
    adapterWebHookUrl = "http://";
  }
  adapterWebHookUrl += `${this.config.iobrokerHost}:`;
  adapterWebHookUrl += this.settings.port.toString();
  adapterWebHookUrl += `/${this.namespace}`;

  adapter.setForeignState(
    `${that.namespace}.info.webHookUrl`,
    adapterWebHookUrl,
    true,
    (err, id) => {
      if (err) {
        that.adapter.log.debug(
          `${that.namespace} > Unable to set webHook URL to ioBroker object '${id}' > Error: '${err}'`,
        );
      } else {
        that.adapter.log.debug(
          `${that.namespace} > Successfully set webHook URL ${adapterWebHookUrl} o ioBroker object '${id}'.`,
        );
      }
    },
  );

  this.unload = function () {
    return new Promise((resolve) => {
      adapter.log.debug(
        `${that.namespace} > Destroying extension for adapter instance '${that.namespace}'!`,
      );

      // unload app path
      const middlewareIndex = app._router.stack.findIndex(
        (layer) => layer && layer.route === `/${that.config.demoParam}`,
      );

      if (middlewareIndex !== -1) {
        // Remove the matched middleware
        app._router.stack.splice(middlewareIndex, 1);
      }

      //resolve();
    });
  };

  // self invoke constructor
  (function __constructor() {
    adapter.log.info(`Install extension for synochat on /${that.namespace}`);

    that.app.use(`/${that.namespace}`, (req, res) => {
      that.restApi.call(that, req, res);
    });
  })();

  function doResponse(res, type, status, _headers, content, pretty) {
    status = parseInt(status, 10) || 200;

    if (pretty && typeof content === "object") {
      type = "plain";
      content = JSON.stringify(content, null, 2);
    }

    switch (type) {
      case "json":
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.statusCode = status;
        res.end(JSON.stringify(content), "utf8");
        break;

      case "plain":
        content = escapeHtml(content);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.statusCode = status;
        if (typeof content === "object") {
          content = JSON.stringify(content);
        }

        res.end(content, "utf8");
        break;
    }
  }

  this.restApi = async function (req, res) {
    const queryParams = {};

    let url;
    try {
      url = decodeURI(req.url);
    } catch (e) {
      url = req.url;
      that.adapter.log.warn(`Malformed URL encoding for ${req.url}: ${e}`);
    }

    const pos = url.indexOf("?");

    if (pos !== -1) {
      const arr = url.substring(pos + 1).split("&");
      url = url.substring(0, pos);

      for (let i = 0; i < arr.length; i++) {
        const _parts = arr[i].split("=");

        try {
          _parts[0] = decodeURIComponent(_parts[0]).trim().replace(/%23/g, "#");
          _parts[1] =
            _parts[1] === undefined
              ? null
              : decodeURIComponent(`${_parts[1]}`.replace(/\+/g, "%20"));
          queryParams[_parts[0]] = _parts[1];
        } catch (e) {
          queryParams[_parts[0]] = _parts[1];
        }
      }
      if (queryParams.prettyPrint !== undefined) {
        if (queryParams.prettyPrint === "false") {
          queryParams.prettyPrint = false;
        }
        if (queryParams.prettyPrint === null) {
          queryParams.prettyPrint = true;
        }
      }
    }

    that.adapter.log.debug(
      `${that.namespace} > Got ${req.method} data on relative URL "/${that.namespace}${req.url}" with query params "${JSON.stringify(queryParams)}".`,
    );

    if (req.method === "POST") {
      restApiPost(req, res, queryParams);
      return;
    }
    that.adapter.log.debug(
      `${that.namespace} > ${req.method} requests will not be processed!`,
    );
    doResponse(
      res,
      "plain",
      404,
      {},
      "This Synology-Chat adapter instance is only accepting POST requests from an Synology Chat server!",
      false,
    );
  };

  async function restApiPost(req, res, queryParams) {
    let body = "";
    req.on("data", (data) => (body += data));

    req.on("end", async () => {
      that.adapter.log.debug(
        `${that.namespace} > Body object of the request:"\n${body}"`,
      );
      let synoChatOutgoingDataFieldToken = "";
      let synoChatOutgoingDataFieldChannelId = -1;
      let synoChatOutgoingDataFieldChannelType = -1;
      let synoChatOutgoingDataFieldChannelName = "";
      let synoChatOutgoingDataFieldUserId = -1;
      let synoChatOutgoingDataFieldUsername = "";
      let synoChatOutgoingDataFieldPostId = -1;
      let synoChatOutgoingDataFieldThreadId = -1;
      let synoChatOutgoingDataFieldTimestamp = -1;
      let synoChatOutgoingDataFieldText = "";
      let synoChatOutgoingDataFieldTriggerWord = "";

      let index, element;
      for ([index, element] of Object.entries(body.split("&"))) {
        let attributeKey = element.split("=")[0];
        let attributeValue = element.split("=")[1];

        switch (attributeKey) {
          case "token":
            synoChatOutgoingDataFieldToken = attributeValue;
            break;
          case "channel_id":
            synoChatOutgoingDataFieldChannelId = parseInt(attributeValue);
            break;
          case "channel_type":
            synoChatOutgoingDataFieldChannelType = parseInt(attributeValue);
            break;
          case "channel_name":
            synoChatOutgoingDataFieldChannelName = attributeValue;
            break;
          case "user_id":
            synoChatOutgoingDataFieldUserId = parseInt(attributeValue);
            break;
          case "username":
            synoChatOutgoingDataFieldUsername = attributeValue;
            break;
          case "post_id":
            synoChatOutgoingDataFieldPostId = parseInt(attributeValue);
            break;
          case "thread_id":
            synoChatOutgoingDataFieldThreadId = parseInt(attributeValue);
            break;
          case "timestamp":
            synoChatOutgoingDataFieldTimestamp = parseInt(attributeValue);
            break;
          case "text":
            try {
              synoChatOutgoingDataFieldText =
                decodeURIComponent(attributeValue);
            } catch (e) {
              synoChatOutgoingDataFieldText = attributeValue;
            }
            break;
          case "trigger_word":
            synoChatOutgoingDataFieldTriggerWord = attributeValue;
            break;
        }
      }

      let lookupChannelEnabled = true;
      let lookupChannelName = "";
      let lookupChannelToken = "";
      let lookupChannelContentCertCheck = true;
      let lookupChannelType = "";

      let lookupSuccessful = false;

      for (let i = 0; i < that.config.channels.length; i++) {
        if (
          synoChatOutgoingDataFieldChannelName ==
          that.config.channels[i].channelName
        ) {
          that.adapter.log.debug(
            `${that.namespace} > Found channel for message received from the Synology chat server with name '${synoChatOutgoingDataFieldChannelName}'.`,
          );
          lookupChannelEnabled = that.config.channels[i].channelEnabled;
          lookupChannelName = that.config.channels[i].channelName;
          lookupChannelToken = that.config.channels[i].channelAccessToken;
          lookupChannelContentCertCheck =
            that.config.channels[i].channelValidateCert;
          lookupChannelType = that.config.channels[i].channelType;

          if (!lookupChannelEnabled) {
            that.adapter.log.debug(
              `${that.namespace} > Channel '${lookupChannelName}' was disabled in the adapter instance configuration! > Checking next one...`,
            );
          } else if (lookupChannelType.toLowerCase() == "outgoing") {
            lookupSuccessful = true;
            if (lookupChannelToken == synoChatOutgoingDataFieldToken) {
              let iobrokerChannelObjectId = `${that.namespace}.${
                synoChatOutgoingDataFieldChannelName
              }.message`;
              that.adapter.log.debug(
                `${that.namespace} > Preparing to set received message from body to ioBroker object '${iobrokerChannelObjectId}'.`,
              );
              try {
                let iobrokerChannelObject = null;
                try {
                  iobrokerChannelObject =
                    await that.adapter.getForeignStateAsync(
                      iobrokerChannelObjectId,
                    );
                } catch (err) {
                  that.adapter.log.debug(
                    `${that.namespace} > Unable to load previous message from ioBroker object '${iobrokerChannelObjectId}' for plausibility check! > Error: '${err}'`,
                  );
                  throw err;
                }

                if (
                  iobrokerChannelObject != null &&
                  iobrokerChannelObject.val != null &&
                  iobrokerChannelObject.val == synoChatOutgoingDataFieldText
                ) {
                  that.adapter.log.debug(
                    `${that.namespace} > The received message is equal to the message that is already present in the message object. The message object is attempted to be set anyway in order to update the timestamps accordingly.`,
                  );
                }

                // Set ack to true to prevent a message loop if the channel was set up twice - Incoming & Outgoing!
                let statusOfSet = await that.adapter.setForeignStateAsync(
                  iobrokerChannelObjectId,
                  synoChatOutgoingDataFieldText,
                  true,
                );
                if (statusOfSet) {
                  if (statusOfSet instanceof Error) {
                    statusOfSet = statusOfSet.message;
                    that.adapter.log.debug(
                      `${that.namespace} > Unable to set message to ioBroker object '${iobrokerChannelObjectId}' > Error: '${statusOfSet}'`,
                    );
                    throw statusOfSet;
                  }
                }
                doResponse(res, "plain", 200, {}, "OK", false);
                that.adapter.log.debug(
                  `${that.namespace} > Successfully set message to ioBroker object '${iobrokerChannelObjectId}'!`,
                );
                return;
              } catch (err) {
                that.adapter.log.debug(
                  `${that.namespace} > Unable to proceed message for ioBroker object '${iobrokerChannelObjectId}' - Error: '${err}' > Checking next channel...`,
                );
              }
            } else {
              that.adapter.log.debug(
                `${that.namespace} > WARN: The found channel token does not match the received! > Checking next channel...`,
              );
            }
          } else {
            that.adapter.log.debug(
              `${that.namespace} > WARN: The found channel is not an outgoing channel! > Checking next channel...`,
            );
          }
        }
      }

      that.adapter.log.debug(
        `${that.namespace} > Unable to find an outgoing channel for the requested channel name '${synoChatOutgoingDataFieldChannelName}'! > Request will not be processed!`,
      );
      doResponse(res, "plain", 500, {}, "FAILED", false);
    });
  }
}

module.exports = SynoChatWebHook;
