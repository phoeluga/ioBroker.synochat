"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");
const https = require('https');
const axios = require('axios')

class Synochat extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "synochat",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("objectChange", this.onObjectChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		// this.log.info("config option1: " + this.config.option1);
		// this.log.info("config option2: " + this.config.option2);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		//after installation
		this.log.debug("Initializing SynoChat...");
        
		if (this.config && Object.keys(this.config).length === 0 && Object.getPrototypeOf(this.config) === Object.prototype) {
            this.log.error("Adapter configuration missing! Please update the instance configuration!");
            return;
        } else {
			this.log.info("Adapter configuration found! > Checking configuration");

			if (!this.config.synoUrl ||
				!this.config.channelName ||
				!this.config.channelToken ||
				!this.config.channelType) {
				this.log.error("Instance configuration invalid!");
				return;
			}

			this.log.info("Adapter configuration OK!");

			await this.setObjectNotExistsAsync(this.config.channelName, {
				type: "folder",
				common: {
					name: "Synonlogy chat channel for " + this.config.channelType + " messages",
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(this.config.channelName + ".message", {
				type: "state",
				common: {
					name: "Message object to be handled",
					type: "string",
					role: "indicator",
					read: true,
					write: true,
				},
				native: {},
			});
		}
		

		/*
		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("testVariable");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");
		*/
		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		/*
		// the variable testVariable is set to true as command (ack=false)
		await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info("check user admin pw iobroker: " + result);

		result = await this.checkGroupAsync("admin", "admin");
		this.log.info("check group user admin group admin: " + result);
		*/

		// In order to get state updates, you need to subscribe to them.
        this.subscribeStates("*");
		this.subscribeObjects("*");

        this.main();
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			this.setState("info.connection", false, true);
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		if (obj) {
			// The object was changed
			this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else {
			// The object was deleted
			this.log.info(`object ${id} deleted`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	 async onStateChange(id, state) {
		if (state) {
			if (state.ack) {
				//only continue when application triggered a change without ack flag, filter out reception state changes
	
				//enable this for system testing
				//this.interfaceTest(id, state);
	
				return "ack is set";
			}
			if (!(await this.getStateAsync("info.connection"))) {
				this.log.warn("onStateChange: Instance not ready!");
				return "instance not connected";
			}

			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

			// var params = "api=SYNO.Chat.External&method=incoming&version=2&token=%22JqHUEnjX7owTRl8HABnTQeS2p7ZQdO5KBvAF0Rk0mHQHYmlPTGHPn8tsBD4LRFI2%22";

			// requests.open('POST', this.config.synoUrl + "/webapi/entry.cgi", true);
			// curl -k -X POST -H "Content-Type: application/json" -d 'payload={"text": "

			// //Send the proper header information along with the request
			// requests.setRequestHeader("Content-type", "application/json");

			// requests.onreadystatechange = function() {//Call a function when the state changes.
			// 	if(requests.readyState == 4 && requests.status == 200) {
			// 		alert(requests.responseText);
			// 	}
			// }
			// requests.send(params);


			if(this.config.certCheck){
				var request = axios.create();
			} else {
				var request = axios.create({
					httpsAgent: new https.Agent({  
					rejectUnauthorized: false
					})
				});
			}

			request({
				method: 'post',
				url: this.config.synoUrl + "/webapi/entry.cgi",
				data: 'payload={"text": "' + state.val + '"}',
				params: {
					'api': "SYNO.Chat.External",
					'method': this.config.channelType,
					'version': "2",
					'token': this.config.channelToken
				}
			})
			.then(res => {
				this.log.info(JSON.stringify(res.data));
			})
			.catch(err => {
				this.log.error(err);
			});



			// var synoChatRequestUrl = new URL(this.config.synoUrl + "/webapi/entry.cgi")
			// // var queryParams = {api:"SYNO.Chat.External", method:"incoming", version:2, token:"%220AG30XrsbdJgi3OMI2jTEGxwQxf8qcfYXqheR2FlzgAlBY6XKsYAz8erNLguOecj%22"}
			// var queryParams = [['api', 'SYNO.Chat.External'], ['method', 'incoming'], ['version', '2'], ['token', "%220AG30XrsbdJgi3OMI2jTEGxwQxf8qcfYXqheR2FlzgAlBY6XKsYAz8erNLguOecj%22"]]
			// synoChatRequestUrl.search = new URLSearchParams(queryParams).toString();

			// const response = await fetch(synoChatRequestUrl, {
			// 	method: 'POST',
			// 	headers: {
			// 		'Content-Type': 'application/json'
			// 	},
			// 	body: 'payload={"text": "kuchensens"}',
			// });

			// response.json().then(data => {
			// 	this.log.info(data);
			// });




			this.setState(id, {ack: true});

		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	/**
	 * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	 * Using this method requires "common.messagebox" property to be set to true in io-package.json
	 * @param {ioBroker.Message} obj
	 */
	onMessage(obj) {
		if (typeof obj === "object" && obj.message) {
			if (obj.command === "send") {
				// e.g. send email or pushover or whatever
				this.log.info("send command");

				// Send response in callback if required
				if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
			}
		}
	}


	main(){
		this.log.info(utils.controllerDir);
        this.setState("info.connection", false, true);

		// TODO - Do the magic here

		this.setState("info.connection", true, true);
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Synochat(options);
} else {
	// otherwise start the instance directly
	new Synochat();
}