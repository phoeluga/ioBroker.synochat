"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

const SynoChatRequests = require("./lib/synoChatRequests.js");
const iFaces = require("os").networkInterfaces();
const uuid = require("uuid");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class Synochat extends utils.Adapter {
  constructor(options) {
    super({
      ...options,
      name: "synochat",
    });
    this.connected = false;
    this.on("ready", this.onReady.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));

    this.synoChatRequestHandler = null;
    this.messageQueue = [];
  }

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.messageQueue = [];
    let configChanged = false;

    this.setState("info.connection", false, true);
    //this.log.info("Got instance configuration. SynoChat adapter instance not yet ready!");

    this.log.info("Initializing SynoChat...");

    if (
      this.config &&
      Object.keys(this.config).length === 0 &&
      Object.getPrototypeOf(this.config) === Object.prototype
    ) {
      this.log.error(
        "Instance configuration missing! Please update the instance configuration!",
      );
      this.log.error(`Adapter instance not in a usable state!`);
      return;
    }
    this.log.info("Instance configuration found! > Checking configuration...");

    // Migration from older versions
    if (
      this.config.channelName ||
      this.config.channelToken ||
      this.config.channelType
    ) {
      this.log.warn(
        "Configuration data from older version found! > Migrating data to new channel object...",
      );

      // Adding first web instance
      if (!this.config.webInstance) {
        this.log.warn(
          "Web adapter instance not configured! > Checking current Web adapter instances...",
        );

        let webInstanceObjects = await this.getObjectViewAsync(
          "system",
          "instance",
          {
            startkey: "system.adapter.web.",
            endkey: "system.adapter.web.\u9999",
          },
        );
        let webInstanceIds = [];
        if (webInstanceObjects && webInstanceObjects.rows) {
          webInstanceObjects.rows.forEach((row) => {
            webInstanceIds.push({
              id: row.id.replace("system.adapter.", ""),
              config: row.value.native.type,
            });
          });
          if (webInstanceIds.length >= 1) {
            this.config.webInstance = webInstanceIds[0].id.toString();
            this.log.debug(
              `Found '${webInstanceIds.length.toString()}' Web adapter instances! > Set Web adapter instance '${this.config.webInstance}' as initial configuration value!`,
            );
            configChanged = true;
          } else {
            this.log.error(
              "No Web adapter instances found! > A Web adapter instance is required to start up this adapter instance!",
            );
          }
        } else {
          this.log.error(
            "No Web adapter instances found! > A Web adapter instance is required to start up this adapter instance!",
          );
        }
      }

      // Set ioBroker Host address to the first address in the listed network interfaces
      if (this.config.iobrokerHost == "") {
        let ipAddress = "localhost";

        Object.keys(iFaces).forEach((dev) => {
          iFaces[dev].filter((details) => {
            if (
              (details.family === "IPv4" || details.family === 4) &&
              details.internal === false
            ) {
              ipAddress = details.address;
            }
          });
        });

        this.log.debug(
          `Hostname for 'iobrokerHost' is unset! > Set default value of current local IP '${ipAddress}'.\nNOTE: This might be incorrect when using an Docker instance!`,
        );

        this.config.iobrokerHost = ipAddress;
        configChanged = true;
      }

      // Main migration of previous data
      let migrationChannel = {
        channelEnabled: true,
        channelName: this.config.channelName,
        channelAccessToken: this.config.channelToken,
        channelType: this.config.channelType,
        channelObjectValueTemplate: this.config.channelObjectValueTemplate,
        channelReactOnNotificationmanager: false,
        channelReactOnAllIobrokerMessages: false,
        channelValidateCert: this.config.channelContentCertCheck,
      };

      if (
        this.config.channels.length == 1 &&
        this.config.channels[0].channelName == "" &&
        this.config.channels[0].channelAccessToken == ""
      ) {
        this.log.debug(
          "Found empty initial channel item! > Deleting this item for migration...",
        );
        this.config.channels.pop();
      }

      this.config.channels.push(migrationChannel);

      this.config.channelName = null;
      this.config.channelToken = null;
      this.config.channelType = null;
      this.config.channelObjectValueTemplate = null;

      this.log.debug(
        "Migration data of of older version done! > Old config data was deleted!",
      );
      configChanged = true;
    }

    if (configChanged) {
      this.log.debug(
        "A adapter configuration change was detected! > Adapter will be restarted by the configuration change!",
      );
      this.updateConfig(this.config);
      return "migration";
    }

    if (
      !this.config.synoUrl ||
      !this.config.iobrokerHost ||
      !this.config.webInstance
    ) {
      this.log.error(
        "Instance main configuration invalid! One or more values of the configuration are missing.",
      );
      this.log.error(`Adapter instance not in a usable state!`);
      return;
    }

    for (let i = 0; i < this.config.channels.length; i++) {
      if (
        !this.config.channels[i].channelName ||
        !this.config.channels[i].channelAccessToken ||
        !this.config.channels[i].channelType
      ) {
        this.log.error(
          "At least one channel configuration is invalid! One or more values of the configuration is missing.",
        );
        this.log.error(`Adapter instance not in a usable state!`);
        return;
      }
    }

    this.log.info("Instance configuration check passed!");
    this.log.info("Checking and creating object resources...");

    // Create configured channel resources
    let coveredChannels = [];
    for (let i = 0; i < this.config.channels.length; i++) {
      if (coveredChannels.includes(i)) {
        continue;
      }

      let infoText = `${this.config.channels[i].channelType} messages`;

      try {
        switch (this.config.channels[i].channelType.toLowerCase()) {
          case "incoming":
            infoText = "sending messages to the Synology chat server";
            break;
          case "outgoing":
            infoText = "receiving messages from the Synology chat server";
            break;
        }

        if (i < this.config.channels.length - 1) {
          for (let j = i + 1; j < this.config.channels.length; j++) {
            if (
              this.config.channels[i].channelName ==
              this.config.channels[j].channelName
            ) {
              coveredChannels.push(j);
              infoText = "bidirectional communication";
              break;
            }
          }
        }
      } catch (e) {
        this.log.warn(
          `Unable to parse provided object type for parrent message object descriotion! Set to default! ${e}`,
        );
        infoText = `${this.config.channels[i].channelType} messages`;
      }

      await this.setObjectAsync(this.config.channels[i].channelName, {
        type: "folder",
        common: {
          name: `Synology chat channel for ${infoText}`,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync(
        `${this.config.channels[i].channelName}.message`,
        {
          type: "state",
          common: {
            name: "Message object to be handled",
            type: "string",
            role: "text",
            read: true,
            write: true,
          },
          native: {},
        },
      );
    }

    // Clean up
    for (const adapterInstanceObject in await this.getAdapterObjectsAsync()) {
      if (adapterInstanceObject.split(".").length === 3) {
        if (
          (await this.getObjectAsync(adapterInstanceObject)).type == "folder" &&
          adapterInstanceObject.split(".")[2] != "info"
        ) {
          let deleteObj = true;
          for (let i = 0; i < this.config.channels.length; i++) {
            if (
              this.config.channels[i].channelName ==
              adapterInstanceObject.split(".")[2]
            ) {
              deleteObj = false;
              break;
            }
          }
          if (deleteObj) {
            this.log.warn(
              `Clean up not configured object. Deleting channel objects in '${adapterInstanceObject}'`,
            );
            await this.delObjectAsync(adapterInstanceObject, {
              recursive: true,
            });
          }
        }
      }
    }

    await this.setObjectNotExistsAsync("info.webHookUrl", {
      type: "state",
      common: {
        name: "Adapter web hook URL for receiving data from the Synology chat server",
        type: "string",
        role: "text",
        read: true,
        write: false,
      },
      native: {},
    });

    this.synoChatRequestHandler = new SynoChatRequests.SynoChatRequests(
      this,
      this.config.synoUrl,
      this.config.certCheck,
    );

    if (await this.synoChatRequestHandler.initialConnectivityCheck()) {
      this.setState("info.connection", true, true);

      // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
      this.log.info("Subscribing adapter instance to all instance states.");
      this.subscribeStates("*");

      this.log.info(
        "SynoChat adapter instance initialized! > Instance up and running!",
      );
    } else {
      this.log.error(
        "Initial connectivity check failed! > Adapter instance not in a usable state!",
      );
    }
  }

  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback Callback for unloading the adapter instance
   */
  onUnload(callback) {
    try {
      this.log.warn(
        "Got termination signal for SynoChat adapter instance! > Terminating instance...",
      );
      // Here you must clear all timeouts or intervals that may still be active
      // clearTimeout(timeout1);
      // clearTimeout(timeout2);
      // ...
      // clearInterval(interval1);
      this.setState("info.connection", false, true);
      callback();
    } catch {
      callback();
    }
    this.log.info("SynoChat adapter instance unloaded!");
  }

  /**
   * Is called if a subscribed state changes
   *
   * @param id ID of the changed object
   * @param state State of the changes vale
   */
  async onStateChange(id, state) {
    if (state) {
      if (id.endsWith("info.connection")) {
        return "managementStateChange";
      }
      if (!id.endsWith(".message")) {
        return "notAMessageObject";
      }
      if (state.ack) {
        //only continue when application triggered a change without ack flag, filter out reception state changes

        //enable this for system testing
        //this.interfaceTest(id, state);
        this.log.debug(
          `State for object '${id}' changed to value '${state.val}' but ack flag is set. > Request will not be processed!`,
        );
        return "stateChangeAcknowledged";
      }
      if (!(await this.getStateAsync("info.connection"))) {
        this.log.warn(
          `State for object '${id}' changed to value '${state.val}' but instance is not ready (info.connection)! > Request will not be processed!`,
        );
        return "instanceNotReady";
      }

      let msgUuid = uuid.v1();
      this.log.debug(
        `State for object '${id}' changed to value '${state.val}' with ack=${state.ack}. ID of message: '${msgUuid}'`,
      );

      let sendingResult = false;

      for (let i = 0; i < this.config.channels.length; i++) {
        if (
          id.split(".")[id.split(".").length - 2].toLowerCase() ==
          this.config.channels[i].channelName.toLowerCase()
        ) {
          this.log.debug(
            `Found channel '${this.config.channels[i].channelName}' for requested message to be sent to the Synology chat server with object id '${id}'.`,
          );

          sendingResult = await this.enqueueAndSendMessage(
            i,
            state.val,
            msgUuid,
          );

          if (sendingResult) {
            this.setState(id, { ack: true });
            return;
          }
        }
      }

      this.log.debug(
        `Unable to find an incoming remote channel for the requested object '${id}' on the Synology chat server! > Request will not be processed!`,
      );
    } else {
      // The state was deleted
      this.log.info(
        `The state for '${id}' was deleted! > Request will not be processed!`,
      );
    }
  }

  /**
   * Process a `sendNotification` request
   *
   * @param obj Object representing the message
   */
  async onMessage(obj) {
    this.log.debug("Received message object. Processing...");
    let msgUuid = uuid.v1();

    if (obj && obj.command === "sendNotification" && obj.message) {
      this.log.debug(
        `Process message from Notification-Manager with internal message ID: '${msgUuid}'`,
      );

      let sendingResult = 1;

      for (let i = 0; i < this.config.channels.length; i++) {
        if (this.config.channels[i].channelReactOnNotificationmanager == true) {
          this.log.debug(
            `Found channel '${this.config.channels[i].channelName}' for requested message to react on messages from Notification-Manager.`,
          );

          // Telegram default text from Notificaiton-Manager messages:
          //const subject = obj.message.category.name;
          //const { instances } = obj.message.category;
          //
          //const readableInstances = Object.entries(instances).map(([instance, entry]) => `${instance.substring('system.adapter.'.length)}`);
          //const text = `${obj.message.category.description}
          //	${obj.message.host}:
          //	${readableInstances.join('\n')}
          //`;
          // sample: *Issues with RAM availability* Your system is running out of memory. Please check the number of running adapters and processes or if single processes need too many memory. system.host.iobroker: notification-manager.0
          //const msg = `*${subject}*\n\n${text}`

          sendingResult = await this.enqueueAndSendMessage(
            i,
            obj,
            msgUuid,
            this.config.receivedNotificationManagerTemplate,
          );
          if (!sendingResult) {
            this.sendTo(
              obj.from,
              "sendNotification",
              { sent: false },
              obj.callback,
            );
            this.log.error(
              `Unable to send the received message '${obj._id}' from Notification-Manager! > Request will not be processed!`,
            );
            return;
          }
        }
      }

      if (sendingResult) {
        this.sendTo(obj.from, "sendNotification", { sent: true }, obj.callback);
      } else {
        this.sendTo(
          obj.from,
          "sendNotification",
          { sent: false },
          obj.callback,
        );
        this.log.error(
          `Unable to send the received message '${obj._id}' from Notification-Manager! > Request will not be processed!`,
        );
      }
    } else if (obj && obj.message) {
      this.log.debug(
        `Process message from unknown provider '${obj.from}' with internal message ID: '${msgUuid}'`,
      );
      for (let i = 0; i < this.config.channels.length; i++) {
        if (this.config.channels[i].channelReactOnAllIobrokerMessages == true) {
          this.log.debug(
            `Found channel '${this.config.channels[i].channelName}' for requested message to react on messages default messages.`,
          );
          await this.enqueueAndSendMessage(
            i,
            obj,
            msgUuid,
            this.config.receivedMessageTemplate,
          );
        }
      }
    } else {
      this.log.debug(
        `Unable to process received message from unknown provider '${obj.from}' with object message ID: '${obj._id}'. None or empty inner Message object was provided!`,
      );
    }
  }

  async enqueueAndSendMessage(
    channelIndex,
    messageObject,
    msgUuid,
    messageTemplate = null,
  ) {
    let lookupChannelEnabled =
      this.config.channels[channelIndex].channelEnabled;
    let lookupChannelName = this.config.channels[channelIndex].channelName;
    let lookupChannelToken =
      this.config.channels[channelIndex].channelAccessToken;
    let lookupChannelContentCertCheck =
      this.config.channels[channelIndex].channelValidateCert;
    let lookupChannelType = this.config.channels[channelIndex].channelType;
    let lookupChannelObjectValueTemplate =
      this.config.channels[channelIndex].channelObjectValueTemplate;

    if (!lookupChannelEnabled) {
      this.log.debug(
        `Channel '${lookupChannelName}' was disabled in the adapter instance configuration! > Checking next channel...`,
      );
    } else if (lookupChannelType.toLowerCase() == "incoming") {
      this.log.debug(`Adding message '${msgUuid}' to the send queue...`);
      this.messageQueue.push(msgUuid);

      // Adding message queue to ensure messages will send in the incoming order
      let j = 0;
      for (j = 0; j < 30; j++) {
        if (this.messageQueue[0] == msgUuid) {
          let formattedMessage = "";
          if (messageTemplate) {
            formattedMessage = this.formatReceivedOnMessageData(
              messageObject,
              messageTemplate,
            );
          } else {
            if (lookupChannelObjectValueTemplate) {
              this.log.debug(
                `Parsing template '${lookupChannelObjectValueTemplate}' for provided message...`,
              );
              formattedMessage = this.formatObjectMessageData(
                messageObject,
                this.config[lookupChannelObjectValueTemplate],
              );
            } else {
              formattedMessage = messageObject;
            }
          }

          let messageWasSend = await this.synoChatRequestHandler.sendMessage(
            lookupChannelToken,
            lookupChannelType,
            lookupChannelContentCertCheck,
            String(formattedMessage),
            msgUuid,
          );
          this.messageQueue.splice(this.messageQueue.indexOf(msgUuid), 1);
          return messageWasSend;
        }
        this.log.debug(
          `Message '${msgUuid}' still in the queue. Waiting for processing...`,
        );

        // Math.floor(Math.random() * (max - min + 1) + min)
        await sleep(Math.floor(Math.random() * (1450 - 890 + 1) + 890));
      }
      if (j >= 30) {
        this.log.error(
          `Timeout for sending message '${msgUuid}'. Message will be discarded!`,
        );
        return;
      }
      this.log.debug(
        `Message '${msgUuid}' not successfully sent. > Lookup next configured channel...`,
      );
    } else {
      this.log.debug(
        `WARN: The found channel '${lookupChannelName}' for message '${msgUuid}' is not an incoming channel! > Checking next channel...`,
      );
    }
  }

  formatObjectMessageData(obj, formatTemplate) {
    try {
      obj = JSON.parse(obj);
    } catch (e) {
      this.log.error(`Unable to parse provided object message to JSON! ${e}`);
      return "Unable to parse provided object message to JSON!";
    }

    let maxItter = 100000;
    while (formatTemplate.match(/\$\{(.+?)\}/) && maxItter > 0) {
      let wholeMatch = formatTemplate.match(/\$\{(.+?)\}/)[1];
      let currentMatch = wholeMatch.split(".")[0];

      if (wholeMatch === currentMatch) {
        let replaceValue = currentMatch.split(".").reduce(function (o, k) {
          return o && o[k.replaceAll("/-", ".")];
        }, obj);
        formatTemplate = formatTemplate.replaceAll(
          String(`\${${currentMatch}}`),
          String(replaceValue),
        );
      } else {
        let maxItterB = 100000;
        while (
          formatTemplate.match(`\\$\\{${currentMatch}\\.(.+?)\\}`) &&
          maxItter > 0
        ) {
          let replacePattern = `${currentMatch}.${
            formatTemplate.match(`\\$\\{${currentMatch}\\.(.+?)\\}`)[1]
          }`;
          // https://stackoverflow.com/questions/37611143/access-json-data-with-string-path
          let replaceValue = replacePattern.split(".").reduce(function (o, k) {
            return o && o[k.replaceAll("/-", ".")];
          }, obj);
          formatTemplate = formatTemplate.replaceAll(
            String(`\${${replacePattern}}`),
            JSON.stringify(replaceValue),
          );

          maxItterB--;
        }
        if (maxItterB <= 0) {
          maxItter = 0;
        }
      }

      maxItter--;
    }

    if (maxItter <= 0) {
      this.log.error(
        `Infinite loop while parsing JSON detected! Returning raw text!`,
      );
      formatTemplate = JSON.stringify(obj, undefined, 4);
    }

    return formatTemplate;
  }

  formatReceivedOnMessageData(obj, formatTemplate) {
    let formattedMessage = formatTemplate;

    if (formatTemplate === this.config.receivedNotificationManagerTemplate) {
      const { instances } = obj.message.category;
      const readableInstances = Object.entries(instances).map(
        ([instance, _entry]) =>
          `${instance.substring("system.adapter.".length)}`,
      );
      formattedMessage = formattedMessage.replaceAll(
        "${instances}",
        String(readableInstances.join(", ")),
      );
    }

    formattedMessage = formattedMessage.replaceAll(
      "${command}",
      String(obj.command),
    );
    formattedMessage = formattedMessage.replaceAll("${from}", String(obj.from));
    formattedMessage = formattedMessage.replaceAll("${_id}", String(obj._id));
    formattedMessage = formattedMessage.replaceAll(
      "${message}",
      String(JSON.stringify(obj.message, undefined, 4)),
    );

    let maxItter = 100000;
    while (formattedMessage.match(/\$\{message\.(.+?)\}/) && maxItter > 0) {
      let replacePattern = formattedMessage.match(/\$\{message\.(.+?)\}/)[1];
      let replaceValue = replacePattern.split(".").reduce(function (o, k) {
        return o && o[k.replaceAll("/-", ".")];
      }, obj.message);
      formattedMessage = formattedMessage.replaceAll(
        String(`\${message.${replacePattern}}`),
        JSON.stringify(replaceValue),
      );

      maxItter--;
    }

    if (maxItter <= 0) {
      this.log.error(
        `Infinite loop while parsing JSON detected! Returning raw text!`,
      );
      formattedMessage = obj.message;
    }

    return formattedMessage;
  }
}

if (require.main !== module) {
  // Export the constructor in compact mode
  /**
   * @param [options] Options for instantiating the adapter istance
   */
  module.exports = (options) => new Synochat(options);
} else {
  // otherwise start the instance directly
  new Synochat();
}
