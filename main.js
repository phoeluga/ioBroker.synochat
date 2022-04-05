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
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		//after installation
		this.setState("info.connection", false, true);
		this.log.info("Got instance configuration. SynoChat adapter instance not yet ready!");

		this.log.info("Initializing SynoChat...");

		if (this.config && Object.keys(this.config).length === 0 && Object.getPrototypeOf(this.config) === Object.prototype) {
            this.log.error("Instance configuration missing! Please update the instance configuration!");
            this.log.error(`Adapter instance not in a usable state!`);
			return;
        } else {
			this.log.info("Instance configuration found! > Checking configuration...");

			if (!this.config.synoUrl ||
				!this.config.channelName ||
				!this.config.channelToken ||
				!this.config.channelType) {
				this.log.error("Instance configuration invalid! One or more values of the configuration is missing.");
				this.log.error(`Adapter instance not in a usable state!`);
				return;
			}

			this.log.info("Instance configuration check passed!");

			this.log.info("Checking and creating object resources...");
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
					role: "text",
					read: true,
					write: true,
				},
				native: {},
			});
		}

		
		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.log.info("Subscribing adapter instance to all instance states.");
        this.subscribeStates("*");
		// this.log.info("Subscribing adapter instance to all instance objects.");
		// this.subscribeObjects("*");

		// // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// // this.subscribeStates("lights.*");
		// // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// // this.subscribeStates("*");
		
		// // setState examples
		// // you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		// // the variable testVariable is set to true as command (ack=false)
		// await this.setStateAsync("testVariable", true);

		// // same thing, but the value is flagged "ack"
		// // ack should be always set to true if the value is received from or acknowledged from the target system
		// await this.setStateAsync("testVariable", { val: true, ack: true });

		// // same thing, but the state is deleted after 30s (getState will return null afterwards)
		// await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// // examples for the checkPassword/checkGroup functions
		// let result = await this.checkPasswordAsync("admin", "iobroker");
		// this.log.info("check user admin pw iobroker: " + result);

		// result = await this.checkGroupAsync("admin", "admin");
		// this.log.info("check group user admin group admin: " + result);
		
		await this.initialConnectivityCheck();
		if (await this.getStateAsync("info.connection")) {
			this.log.info("SynoChat adapter instance initialized! > Instance up and running!");
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.log.warn("Got termination signal for SynoChat adapter instance! > Terminating instance...");
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
		this.log.info("SynoChat adapter instance unloaded!");
	}

	// // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	 async onStateChange(id, state) {
		if (state) {
			if (id.endsWith("info.connection")){
				return "managementStateChange";
			}
			if (state.ack) {
				//only continue when application triggered a change without ack flag, filter out reception state changes
	
				//enable this for system testing
				//this.interfaceTest(id, state);
				this.log.debug(`State for object '${id}' changed to value '${state.val}' but ack flag is set. > Request will not be processed!`);
				return "stateChangeAcknowledged";
			}
			if (!(await this.getStateAsync("info.connection"))) {
				this.log.warn(`State for object '${id}' changed to value '${state.val}' but instance is not ready (info.connection)! > Request will not be processed!`);
				return "instanceNotReady";
			}

			this.log.debug(`State for object '${id}' changed to value '${state.val}' with ack=${state.ack}. > Request will not be processed!`);

			var synoChatEndpointUrl = this.config.synoUrl + "/webapi/entry.cgi";
			this.log.debug(`Preparing REST API call for endoint '${synoChatEndpointUrl}'...`);

			if(this.config.certCheck){
				var request = axios.create();
			} else {
				var request = axios.create({
					httpsAgent: new https.Agent({  
					rejectUnauthorized: false
					}),
					timeout: 10000
				});
			}

			request({
				method: 'post',
				url: synoChatEndpointUrl,
				data: 'payload={"text": "' + state.val + '"}',
				params: {
					'api': "SYNO.Chat.External",
					'method': this.config.channelType,
					'version': "2",
					'token': this.config.channelToken
				}
			})
			.then(res => {
				if(res.status == 200){
					if(JSON.parse(JSON.stringify(res.data))['success'] == true){
						this.setState(id, {ack: true});
						this.log.debug(`Successfully sent message to ${synoChatEndpointUrl}.`);
						return;
					}
					this.log.error(`Unable to send message to Synology Chat REST API ${synoChatEndpointUrl} '${JSON.stringify(res.data)}'`);
				} else {
					this.log.error(`Unable to send message to Synology Chat REST API ${synoChatEndpointUrl} > ${JSON.stringify(res.statusText)} ${JSON.stringify(res.status)} '${JSON.stringify(res.data)}'`);
				}
			})
			.catch(err => {
				this.log.error(`Unable to get send message to Synology Chat REST API ${synoChatEndpointUrl} '${err}'`);
			});

		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }


	async initialConnectivityCheck(){
		this.log.info(`Checking general availability of the Synology Chat REST API...`);
        
		if(this.config.certCheck){
			var request = axios.create();
		} else {
			var request = axios.create({
				httpsAgent: new https.Agent({  
				rejectUnauthorized: false
				}),
				timeout: 10000
			});
		}

		var synoChatEndpointUrl = this.config.synoUrl + "/webapi/entry.cgi";

		await request({
			method: 'get',
			url: synoChatEndpointUrl,
			params: {
				'api': "SYNO.Chat.External",
				'method': "kuchen",
				'version': "2"
			}
		})
		.then(res => {
			if(res.status == 200){
				if(JSON.parse(JSON.stringify(res.data))['success'] == false && JSON.parse(JSON.stringify(res.data))['error']['code'] == 103){
					this.setState("info.connection", true, true);
					this.log.info(`Initial connectivity check of Synology Chat REST API successfully passed!`);
					return;
				}
				this.log.error(`Unable to get valid response of Synology Chat REST API ${synoChatEndpointUrl} '${JSON.stringify(res.data)}'`);
			} else {
				this.log.error(`Unable to request Synology Chat REST API ${synoChatEndpointUrl} > ${JSON.stringify(res.statusText)} ${JSON.stringify(res.status)} '${JSON.stringify(res.data)}'`);
			}
			this.log.error(`Adapter instance not in a usable state!`);
		})
		.catch(err => {
			this.log.error(`Unable to get valid response of Synology Chat REST API ${synoChatEndpointUrl} '${err}'`);
			this.log.error(`Adapter instance not in a usable state!`);
		});
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