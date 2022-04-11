"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

const SynoChatRequests = require("./lib/synoChatRequests.js");
const synoChatRequestHelper = require("./lib/synoChatRequestHelper.js");
const ipInfo = require('ip');

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
		this.on("unload", this.onUnload.bind(this));

		this.synoChatRequestHandler = null;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.setState("info.connection", false, true);
		this.log.info("Got instance configuration. SynoChat adapter instance not yet ready!");

		this.log.info("Initializing SynoChat...");

		if(this.config.iobrokerHost == ""){
			var sysIp = ipInfo.address();
			this.log.debug(`Hostname for 'iobrokerHost' is unset! > Set default value of current local IP '${sysIp}'.\nNOTE: This might be incorrect when using an Docker instance!`);
			this.config.iobrokerHost = sysIp;
			this.updateConfig(this.config);
		}

		if (this.config && Object.keys(this.config).length === 0 && Object.getPrototypeOf(this.config) === Object.prototype) {
            this.log.error("Instance configuration missing! Please update the instance configuration!");
            this.log.error(`Adapter instance not in a usable state!`);
			return;
        } else {
			this.log.info("Instance configuration found! > Checking configuration...");

			if (!this.config.synoUrl ||
				!this.config.channelName ||
				!this.config.channelToken ||
				!this.config.channelType ||
				!this.config.webInstance) {
				this.log.error("Instance configuration invalid! One or more values of the configuration is missing.");
				this.log.error(`Adapter instance not in a usable state!`);
				return;
			}

			this.log.info("Instance configuration check passed!");

			this.log.info("Checking and creating object resources...");
			await this.setObjectNotExistsAsync(this.config.channelName, {
				type: "folder",
				common: {
					name: "Synology chat channel for " + this.config.channelType + " messages",
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
		} 

		this.synoChatRequestHandler = new SynoChatRequests.SynoChatRequests(this, this.config.synoUrl, this.config.certCheck);
		
		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.log.info("Subscribing adapter instance to all instance states.");
        this.subscribeStates("*");

		if (await this.synoChatRequestHandler.initialConnectivityCheck()) {
			this.setState("info.connection", true, true);
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
			if (!id.endsWith(".message")){
				return "notAMessageObject";
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

			this.log.debug(`State for object '${id}' changed to value '${state.val}' with ack=${state.ack}.`);

			if(await this.synoChatRequestHandler.sendMessage(this.config.channelToken, this.config.channelType, this.config.channelContentCertCheck, state.val)){
				this.setState(id, {ack: true});
			}
			
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
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