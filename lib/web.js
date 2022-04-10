/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint -W061 */
'use strict';



const matchHtmlRegExp = /["'&<>]/;
function escapeHtml (string) {
    const str = `${string}`;
    const match = matchHtmlRegExp.exec(str);

    if (!match) {
        return str;
    }

    let escape;
    let html = '';
    let index;
    let lastIndex = 0;

    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
            case 34: // "
                escape = '&quot;';
                break;
            case 38: // &
                escape = '&amp;';
                break;
            case 39: // '
                escape = '&#39;';
                break;
            case 60: // <
                escape = '&lt;';
                break;
            case 62: // >
                escape = '&gt;';
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

    return lastIndex !== index
        ? html + str.substring(lastIndex, index)
        : html;
}



/**
 * SynoChatWebHook class
 *
 * From settings used only secure, auth and crossDomain
 *
 * @class
 * @param {object} server http or https node.js object
 * @param {object} webSettings settings of the web server, like <pre><code>{secure: settings.secure, port: settings.port}</code></pre>
 * @param {object} adapter web adapter object
 * @param {object} instanceSettings instance object with common and native
 * @param {object} app express application
 * @return {object} object instance
 */
 function SynoChatWebHook(server, webSettings, adapter, instanceSettings, app) {
    if (!(this instanceof SynoChatWebHook)) return new SynoChatWebHook(server, webSettings, adapter, instanceSettings, app);

    this.app       = app;
    this.adapter   = adapter;
    this.settings  = webSettings;
    this.config    = instanceSettings ? instanceSettings.native : {};
    this.namespace = instanceSettings ? instanceSettings._id.substring('system.adapter.'.length) : 'synochat';
    this.request   = {};
    this.synoChat = this.config.synochat === true || this.config.synochat === 'true';
    const that       = this;
    let proxy;
    let request;
    let path;
    let fs;
    let mime;

    this.config.route = this.config.route || (this.namespace + '/');

    this.config.errorTimeout = parseInt(this.config.errorTimeout, 10) || 10000;
    if (this.config.errorTimeout < 1000) {
        this.config.errorTimeout = 1000;
    }

    this.config.route = this.config.route || (this.namespace + '/');
    // remove leading slash
    if (this.config.route[0] === '/') {
        this.config.route = this.config.route.substr(1);
    }

    function oneRule(rule) {
        adapter.log.info('Install extension on /' + that.config.route + rule.regex);

        rule.timeout = parseInt(rule.timeout, 10) || that.config.errorTimeout;
    }

    this.unload = function () {
        return new Promise(resolve => {
            adapter.log.debug('Demo extension unloaded!');
            
            // unload app path
            const middlewareIndex = app._router.stack.findIndex(layer => 
                layer && layer.route === '/' + that.config.demoParam);
                
            if (middlewareIndex !== -1) {
                // Remove the matched middleware
                app._router.stack.splice(middlewareIndex, 1);
            }
            
            //resolve();
        });
    };

    // // self invoke constructor
    // (function __constructor () {
    //     var kuchen = instanceSettings ? instanceSettings._id.substring('system.adapter.'.length) : 'synochat';
    //     adapter.log.info('Install extension on /' + kuchen);
        
    //     for (let e = 0; e < that.config.rules.length; e++) {
    //         oneRule(that.config.rules[e]);
    //     }

    //     // that.app.use('/' + that.config.demoParam, (req, res) => {
    //     //     res.setHeader('Content-type', 'text/html');
    //     //     res.status(200).send('You called a demo web extension with path "' + req.url + '"');
    //     // });
    // })();


    // this.destroy = function () {
    //     if (this.interval) {
    //         clearInterval(this.interval);
    //         this.interval = null;
    //     }
    // };

    // self invoke constructor
    (function __constructor () {
        adapter.log.info('Install extension for synochat on /' + that.namespace);
        
        that.app.use('/' + that.namespace, (req, res) => {that.restApi.call(that, req, res)});
    })();

    // const __construct = (function () {
    //     this.adapter.log.info('Install extension on /' + this.namespace);

    //     that.adapter.log.info(`${that.settings.secure ? 'Secure ' : ''}simpleAPI server listening on port ${that.settings.port}`);
    //     that.adapter.config.defaultUser = that.adapter.config.defaultUser || 'system.user.admin';
    //     if (!that.adapter.config.defaultUser.match(/^system\.user\./)) {
    //         that.adapter.config.defaultUser = `system.user.${that.adapter.config.defaultUser}`;
    //     }
    //     if (that.adapter.config.onlyAllowWhenUserIsOwner === undefined) {
    //         that.adapter.config.onlyAllowWhenUserIsOwner = false;
    //     }
    //     adapter.log.info(`Allow states only when user is owner: ${that.adapter.config.onlyAllowWhenUserIsOwner}`);

    //     if (that.app) {
    //         adapter.log.info(`Install extension on /${that.namespace}/`);

    //         that.app.use(`/${that.namespace}/`, (req, res) =>
    //             that.restApi.call(that, req, res));

    //         // // let it be accessible under old address too
    //         // for (const c in commandsPermissions) {
    //         //     (function (command) {
    //         //         adapter.log.info(`Install extension on /${command}/`);
    //         //         that.app.use(`/${command}/`, (req, res) => {
    //         //             req.url = `/${command}${req.url}`;
    //         //             that.restApi.call(that, req, res);
    //         //         });
    //         //     })(c);
    //         // }
    //     }

    //     // Subscribe on object changes to manage cache
    //     that.adapter.subscribeForeignObjects('*');

    //     // that.app.use('/' + that.config.demoParam, (req, res) => {
    //     //     res.setHeader('Content-type', 'text/html');
    //     //     res.status(200).send('You called a demo web extension with path "' + req.url + '"');
    //     // });
    // }.bind(this))();

    function doResponse(res, type, status, _headers, content, pretty) {
        status = parseInt(status, 10) || 200;

        if (pretty && typeof content === 'object') {
            type = 'plain';
            content = JSON.stringify(content, null, 2);
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

        switch (type) {
            case 'json':
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.statusCode = status;
                res.end(JSON.stringify(content), 'utf8');
                break;

            case 'plain':
                content = escapeHtml(content);
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.statusCode = status;
                if (typeof content === 'object') {
                    content = JSON.stringify(content);
                }

                res.end(content, 'utf8');
                break;
        }
    }

    this.restApi = async function (req, res) {
        const queryParams = {};
        let ack = false;

        let url;
        try {
            url = decodeURI(req.url);
        } catch (e) {
            url = req.url;
            that.adapter.log.warn(`Malformed URL encoding for ${req.url}: ${e}`);
        }

        const pos = url.indexOf('?');

        if (pos !== -1) {
            const arr = url.substring(pos + 1).split('&');
            url = url.substring(0, pos);

            for (let i = 0; i < arr.length; i++) {
                const _parts = arr[i].split('=');

                try {
                    _parts[0] = decodeURIComponent(_parts[0]).trim().replace(/%23/g, '#');
                    _parts[1] = _parts[1] === undefined ? null : decodeURIComponent((`${_parts[1]}`).replace(/\+/g, '%20'));
                    queryParams[_parts[0]] = _parts[1];
                } catch (e) {
                    queryParams[_parts[0]] = _parts[1];
                }
            }
            if (queryParams.prettyPrint !== undefined) {
                if (queryParams.prettyPrint === 'false') {
                    queryParams.prettyPrint = false;
                }
                if (queryParams.prettyPrint === null) {
                    queryParams.prettyPrint = true;
                }
            }
        }

        if (req.method === 'POST') {
            restApiPost(req, res, queryParams);
            return;
        }
        doResponse(res, 'plain', 404, {}, "This Synology-Chat adapter instance is only accepting POST requests from an Synology Chat server!", false);
    };

    function restApiPost(req, res, queryParams) {
        let body = '';
        req.on('data', data => body += data);
        
        req.on('end', () => {
            that.adapter.log.debug(`${that.namespace} > Got POST data on relative URL '/${that.namespace}/${req.url}' with query params '${JSON.stringify(queryParams)}'.\nBody details:'\n${body}'`);

            doResponse(res, 'plain', 200, {}, "OK", false);
        });
    }
}

module.exports = SynoChatWebHook;
