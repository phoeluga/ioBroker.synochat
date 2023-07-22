
const https = require("https");
const axios = require("axios");

const synoChatRequestHelper = require("./synoChatRequestHelper.js");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class SynoChatRequests {

	constructor(adapterInstance, synoBaseUrl, certCheck) {
		this.adapterInstance = adapterInstance;
		this.synoBaseUrl = synoBaseUrl;
		this.certCheck = certCheck;
	}

	async sendBaseRequest(requestProperties, checkCert = null){
		if (checkCert == null){
			checkCert = this.certCheck;
		}

		if(checkCert){
			var request = axios.create();
		} else {
			var request = axios.create({
				httpsAgent: new https.Agent({  
				rejectUnauthorized: false
				}),
				timeout: 15000
			});
		}

		var requestResponse = null;
		await request(requestProperties)
		.then(res => {
			if(res.status == 200){
				this.adapterInstance.log.debug(`${requestProperties["url"]}: ${res.status} ${res.statusText}\n'${JSON.stringify(res.data)}'`);
				requestResponse = res;
			} else {
				this.adapterInstance.log.error(`Unable to get valid response from Synology Chat REST API ${requestProperties["url"]} > ${JSON.stringify(res.statusText)} ${JSON.stringify(res.status)}\n'${JSON.stringify(res.data)}'`);
			}
		});

		return requestResponse;
	}

	async initialConnectivityCheck(){
		this.adapterInstance.log.info(`Checking general availability of the Synology Chat REST API...`);
		
		var synoChatEndpointUrl = this.synoBaseUrl + "/webapi/entry.cgi";
		this.adapterInstance.log.debug(`Preparing REST API call for endpoint '${synoChatEndpointUrl}'...`);
		
		var requestProperties = {
			method: "get",
			url: synoChatEndpointUrl,
			params: {
				"api": "SYNO.Chat.External",
				"method": "kuchen",
				"version": "2"
			}
		}

		try {
			var response = await this.sendBaseRequest(requestProperties);
			if(JSON.parse(JSON.stringify(response.data))["success"] == false && JSON.parse(JSON.stringify(response.data))["error"]["code"] == 103){
				this.adapterInstance.log.info(`Initial connectivity check of Synology Chat REST API successfully passed!`);
				return true;
			}
			this.adapterInstance.log.error(`Unable to get valid response of Synology Chat REST API ${synoChatEndpointUrl} '${JSON.stringify(response.data)}'`);
		}
		catch(err) {
			this.adapterInstance.log.error(`Unable to send message to Synology Chat REST API ${synoChatEndpointUrl}\n'${err}'`);
		}

		this.adapterInstance.log.error(`Adapter instance not in a usable state!`);
		return false;
	}

	async sendMessage(channelToken, synoSendMethod, channelContentCertCheck, message, msgUuid, callIteration = 1){
		var synoChatEndpointUrl = this.synoBaseUrl + "/webapi/entry.cgi";
		this.adapterInstance.log.debug(`Preparing REST API call for message with ID '${msgUuid}' to endpoint '${synoChatEndpointUrl}'...`);
		
		var data = await this.preparePayloadData(channelContentCertCheck, message);

		var requestProperties = {
			method: "post",
			url: synoChatEndpointUrl,
			data: data,
			params: {
				"api": "SYNO.Chat.External",
				"method": synoSendMethod,
				"version": "2",
				"token": channelToken
			}
		}

		try {
			var response = await this.sendBaseRequest(requestProperties);
			if(JSON.parse(JSON.stringify(response.data))["success"] == true){
				this.adapterInstance.log.debug(`Successfully sent message '${msgUuid}' to ${synoChatEndpointUrl}.`);
				return true;
			} else {
				// Adding retry operation in case multiple messages were send in a too short time 
				if(JSON.parse(JSON.stringify(response.data))["error"]["code"] == "411"){
					this.adapterInstance.log.warn(`Attempt to send message '${msgUuid}' failed due to too fast sending sequence: '${JSON.parse(JSON.stringify(response.data))['error']['errors']}' > Delaying the message for ${callIteration} second/s...`);

					if(callIteration >= 30){
						this.adapterInstance.log.error(`The limit for attempting to send a message has been reached. Message '${msgUuid}' will be discarded!`);
						return false;
					}

					// Math.floor(Math.random() * (max - min + 1) + min)
					await sleep((Math.floor(Math.random() * (1450 - 890 + 1) + 890)) * callIteration)

					this.adapterInstance.log.debug(`Start a new attempt to send the message '${msgUuid}'...`);
					return await this.sendMessage(channelToken, synoSendMethod, channelContentCertCheck, message, msgUuid, callIteration + 1)
				}
			}
		}
		catch(err) {
			this.adapterInstance.log.error(`Unable to send message '${msgUuid}' to Synology Chat REST API ${synoChatEndpointUrl}\n'${err}'`);
			return false;
		}

		this.adapterInstance.log.error(`Unable to send message '${msgUuid}' to Synology Chat REST API ${synoChatEndpointUrl}!`);
		return false;
	}

	async preparePayloadData(channelContentCertCheck, message){
		if(synoChatRequestHelper.isValidHttpUrl(this.adapterInstance, message)){
			this.adapterInstance.log.debug(`Message seems to be an URL. Checking content...`);
			try {
				var requestProperties = {
					method: "get",
					url: message
				}

				const res = await this.sendBaseRequest(requestProperties, channelContentCertCheck);

				// See content types https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
				if(res.headers["content-type"].includes("image/")){
					return (`payload={"file_url": "${message}"}`)
				}

				this.adapterInstance.log.debug(`Content type is not an image! > Skipping file send preparation.`);
			}
			catch(err) {
				this.adapterInstance.log.debug(`Unable check content type of URL. > Skipping file send preparation.`);
			}
		}

		return (`payload={"text": "${synoChatRequestHelper.prepareTextForSendingMessage(this.adapterInstance, message)}"}`)
	}
}

module.exports = {
	SynoChatRequests
};
