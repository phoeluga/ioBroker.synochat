"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

const SynoChatRequests = require("./lib/synoChatRequests.js");
const iFaces = require('os').networkInterfaces();
const uuid = require('uuid');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
class Synochat extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "synochat",
		});
		this.connected = false;
		this.on("ready", this.onReady.bind(this));
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
		var configChanged = false;

		this.setState("info.connection", false, true);
		//this.log.info("Got instance configuration. SynoChat adapter instance not yet ready!");

		this.log.info("Initializing SynoChat...");

		if (this.config && Object.keys(this.config).length === 0 && Object.getPrototypeOf(this.config) === Object.prototype) {
            this.log.error("Instance configuration missing! Please update the instance configuration!");
            this.log.error(`Adapter instance not in a usable state!`);
			return;
        } else {
			this.log.info("Instance configuration found! > Checking configuration...");

			// Migration from older versions
			if (this.config.channelName ||
				this.config.channelToken ||
				this.config.channelType) {

				this.log.warn("Configuration data from older version found! > Migrating data to new channel object...");
				
				// Adding first web instance
				if (!this.config.webInstance) {
					this.log.warn("Web adapter instance not configured! > Checking current Web adapter instances...");

					var webInstanceObjects = await this.getObjectViewAsync('system', 'instance', {startkey: 'system.adapter.web.', endkey: 'system.adapter.web.\u9999'});
					let webInstanceIds = [];
					if (webInstanceObjects && webInstanceObjects.rows){
						webInstanceObjects.rows.forEach(row => {
							webInstanceIds.push({id: row.id.replace('system.adapter.', ''), config: row.value.native.type})
						});
						if(webInstanceIds.length >= 1){
							this.config.webInstance = webInstanceIds[0].id.toString();
							this.log.debug(`Found '${webInstanceIds.length.toString()}' Web adapter instances! > Set Web adapter instance '${this.config.webInstance}' as initial configuration value!`);
							configChanged = true;
						} else {
							this.log.error("No Web adapter instances found! > A Web adapter instance is required to start up this adapter instance!");
						}
					} else {
						this.log.error("No Web adapter instances found! > A Web adapter instance is required to start up this adapter instance!");
					}
				}

				// Set ioBroker Host address to the first address in the listed network interfaces
				if(this.config.iobrokerHost == ""){
					var ipAddress = "localhost";

					Object.keys(iFaces).forEach(dev => {
						iFaces[dev].filter(details => {
							if ((details.family === 'IPv4' || details.family === 4) && details.internal === false){
								ipAddress = details.address;
							}
						});
					});
					
					this.log.debug(`Hostname for 'iobrokerHost' is unset! > Set default value of current local IP '${ipAddress}'.\nNOTE: This might be incorrect when using an Docker instance!`);	

					this.config.iobrokerHost = ipAddress;
					configChanged = true;
				}

				// Main migration of previous data
				var migrationChannel = {
					"channelEnabled": true,
					"channelName": this.config.channelName,
					"channelAccessToken": this.config.channelToken,
					"channelType": this.config.channelType,
					"channelValidateCert": this.config.channelContentCertCheck
				};
				
				if(this.config.channels.length == 1 && this.config.channels[0].channelName == "" && this.config.channels[0].channelAccessToken == ""){
					this.log.debug("Found empty initial channel item! > Deleting this item for migration...");
					this.config.channels.pop();
				}

				this.config.channels.push(migrationChannel);

				this.config.channelName = null;
				this.config.channelToken = null;
				this.config.channelType = null;
				
				this.log.debug("Migration data of of older version done! > Old config data was deleted!");
				configChanged = true;
			}

			if(configChanged){
				this.log.debug("A adapter configuration change was detected! > Adapter will be restarted by the configuration change!");
				this.updateConfig(this.config);
				return "migration";
			}

			if (!this.config.synoUrl ||
				!this.config.iobrokerHost ||
				!this.config.webInstance) {
				this.log.error("Instance main configuration invalid! One or more values of the configuration are missing.");
				this.log.error(`Adapter instance not in a usable state!`);
				return;
			}
			
			for (let i = 0; i < this.config.channels.length; i++) {
				if (!this.config.channels[i].channelName ||
					!this.config.channels[i].channelAccessToken ||
					!this.config.channels[i].channelType) {
					this.log.error("At least one channel configuration is invalid! One or more values of the configuration is missing.");
					this.log.error(`Adapter instance not in a usable state!`);
					return;
				}
			}

			this.log.info("Instance configuration check passed!");
			this.log.info("Checking and creating object resources...");

			// Create configured channel ressources
			for (let i = 0; i < this.config.channels.length; i++) {
				await this.setObjectNotExistsAsync(this.config.channels[i].channelName, {
					type: "folder",
					common: {
						name: "Synology chat channel for " + this.config.channels[i].channelType + " messages",
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(this.config.channels[i].channelName + ".message", {
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

			// Clean up
			for(const adapterInstanceObject in await this.getAdapterObjectsAsync()){
				if(adapterInstanceObject.split(".").length === 3){
					if((await this.getObjectAsync(adapterInstanceObject)).type == "folder" && adapterInstanceObject.split(".")[2] != "info"){
						var deleteObj = true;
						for (let i = 0; i < this.config.channels.length; i++) {
							if(this.config.channels[i].channelName == adapterInstanceObject.split(".")[2]){
								deleteObj = false;
								break;
							}
						}
						if(deleteObj){
							this.log.warn(`Clean up not configured object. Deleting channel objects in '${adapterInstanceObject}'`);
							await this.delObjectAsync(adapterInstanceObject, {recursive: true});
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
		}

		this.synoChatRequestHandler = new SynoChatRequests.SynoChatRequests(this, this.config.synoUrl, this.config.certCheck);
		
		if (await this.synoChatRequestHandler.initialConnectivityCheck()) {
			this.setState("info.connection", true, true);

			// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
			this.log.info("Subscribing adapter instance to all instance states.");
			this.subscribeStates("*");

			this.log.info("SynoChat adapter instance initialized! > Instance up and running!");
		} else {
			this.log.error("Initial connectivity check failed! > Adapter instance not in a usable state!");
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

			var msgUuid =  uuid.v1();
			this.log.debug(`State for object '${id}' changed to value '${state.val}' with ack=${state.ack}. ID of message: '${msgUuid}'`);

			var lookupChannelEnabled = true;
			var lookupChannelName = "";
			var lookupChannelToken = "";
			var lookupChannelContentCertCheck = true;
			var lookupChannelType = "";

			var lookupSuccessful = false;

			for (let i = 0; i < this.config.channels.length; i++) {
				if(id.split(".")[id.split(".").length - 2].toLowerCase() == this.config.channels[i].channelName.toLowerCase()){
					this.log.debug(`Found channel for requested message to be sent to the Synology chat server with object id '${id}'.`);
					lookupChannelEnabled = this.config.channels[i].channelEnabled;
					lookupChannelName = this.config.channels[i].channelName;
					lookupChannelToken = this.config.channels[i].channelAccessToken;
					lookupChannelContentCertCheck = this.config.channels[i].channelValidateCert;
					lookupChannelType = this.config.channels[i].channelType;
					
					if(!lookupChannelEnabled){
						this.log.debug(`Channel '${lookupChannelName}' was disabled in the adapter instance configuration! > Checking next channel...`);
					} else if(lookupChannelType.toLowerCase() == "incoming"){
						lookupSuccessful = true;
						this.log.debug(`Adding message '${msgUuid}' to the send queue...`);
						this.messageQueue.push(msgUuid);

						// Adding message queue to ensure messages will send in the incoming order
						var j = 0;
						for(j = 0; j < 30; j++){
							if(this.messageQueue[0] == msgUuid){
								var messageWasSend = await this.synoChatRequestHandler.sendMessage(lookupChannelToken, lookupChannelType, lookupChannelContentCertCheck, state.val, msgUuid);
								this.messageQueue.splice(this.messageQueue.indexOf(msgUuid), 1);

								if(messageWasSend){
									this.setState(id, {ack: true});
									return;
								}
								break;
							} else {
								this.log.debug(`Message '${msgUuid}' still in the queue. Waiting for processing...`);
							}

							// Math.floor(Math.random() * (max - min + 1) + min)
                    		await sleep(Math.floor(Math.random() * (1450 - 890 + 1) + 890))
					  	}
						if(j >= 30){
							this.log.error(`Timeout for sending message '${msgUuid}'. Message will be discarded!`);
							return;
						} else {
							this.log.debug(`Message '${msgUuid}' not successfully sent. > Lookup next channel for '${lookupChannelName}' in the configured channels...`);
						}
						
					} else {
						this.log.debug(`WARN: The found channel '${lookupChannelName}' for message '${msgUuid}' is not an incoming channel! > Checking next channel...`);
					}
				}
			}
			
			this.log.debug(`Unable to find an incoming channel for the requested channel name '${lookupChannelName}'! > Request will not be processed!`);
		} else {
			// The state was deleted
			this.log.info(`The state for '${id}' was deleted! > Request will not be processed!`);
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
