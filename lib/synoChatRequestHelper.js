const https = require('https');
const axios = require('axios');

function prepareTextForSendingMessage(adapterInstance, message){
    if(message.includes('"') || message.includes('&') || message.includes('%') || message.includes('\\')){
        message = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%25').replace(/&/g, '%26')
        adapterInstance.log.debug(`Special characters were detected in the text to be sent. > New message "${message}"`);
    };
    return message;
}

function isValidHttpUrl(adapterInstance, string) {
    let url;
    
    try {
        url = new URL(string);
    } catch (err) {
        //adapterInstance.log.debug(`Message is not an URL: "${err}"`);
        return false;  
    }
  
    return url.protocol === "http:" || url.protocol === "https:";
}


// Deprecated functions for handling Synology-Chat requests

async function sendBaseRequest(adapterInstance, synoChatEndpointUrl, certCheck, requestProperties){
    if(certCheck){
        var request = axios.create();
    } else {
        var request = axios.create({
            httpsAgent: new https.Agent({  
            rejectUnauthorized: false
            }),
            timeout: 10000
        });
    }

    var requestResponse = null;
    await request(requestProperties)
    .then(res => {
        if(res.status == 200){
            adapterInstance.log.debug(`${synoChatEndpointUrl}: ${res.status} ${res.statusText}`);
            requestResponse = res;
        } else {
            adapterInstance.log.error(`Unable to get valid response from Synology Chat REST API ${synoChatEndpointUrl} > ${JSON.stringify(res.statusText)} ${JSON.stringify(res.status)}\n'${JSON.stringify(res.data)}'`);
        }
    });

    return requestResponse;
}

async function initialConnectivityCheck(adapterInstance, synoBaseUrl, certCheck){
    adapterInstance.log.info(`Checking general availability of the Synology Chat REST API...`);

    var synoChatEndpointUrl = synoBaseUrl + "/webapi/entry.cgi";
    adapterInstance.log.debug(`Preparing REST API call for endpoint '${synoChatEndpointUrl}'...`);

    var requestProperties = {
        method: 'get',
        url: synoChatEndpointUrl,
        params: {
            'api': "SYNO.Chat.External",
            'method': "kuchen",
            'version': "2"
        }
    }

    try {
        var response = await sendBaseRequest(adapterInstance, synoChatEndpointUrl, certCheck, requestProperties);
        if(JSON.parse(JSON.stringify(response.data))['success'] == false && JSON.parse(JSON.stringify(response.data))['error']['code'] == 103){
            adapterInstance.log.info(`Initial connectivity check of Synology Chat REST API successfully passed!`);
            return true;
        }
        adapterInstance.log.error(`Unable to get valid response of Synology Chat REST API ${synoChatEndpointUrl} '${JSON.stringify(response.data)}'`);
    }
    catch(err) {
        adapterInstance.log.error(`Unable to send message to Synology Chat REST API ${synoChatEndpointUrl}\n'${err}'`);
    }

    adapterInstance.log.error(`Adapter instance not in a usable state!`);
    return false;
}

async function sendMessage(adapterInstance, synoBaseUrl, channelToken, synoSendMethod, certCheck, data){
    var synoChatEndpointUrl = synoBaseUrl + "/webapi/entry.cgi";
    adapterInstance.log.debug(`Preparing REST API call for endoint '${synoChatEndpointUrl}'...`);
    
    var requestProperties = {
        method: 'post',
        url: synoChatEndpointUrl,
        data: data,
        params: {
            'api': "SYNO.Chat.External",
            'method': synoSendMethod,
            'version': "2",
            'token': channelToken
        }
    }

    try {
        var response = await sendBaseRequest(adapterInstance, synoChatEndpointUrl, certCheck, requestProperties);
        if(JSON.parse(JSON.stringify(response.data))['success'] == true){
            adapterInstance.log.debug(`Successfully sent message to ${synoChatEndpointUrl}.`);
            return true;
        }
    }
    catch(err) {
        adapterInstance.log.error(`Unable to get send message to Synology Chat REST API ${synoChatEndpointUrl}\n'${err}'`);
    }

    adapterInstance.log.error(`Unable to send message to Synology Chat REST API ${synoChatEndpointUrl} '${JSON.stringify(response.data)}'`);
    return false;
}

module.exports = {
    prepareTextForSendingMessage,
    isValidHttpUrl,

    sendBaseRequest,
    initialConnectivityCheck,
    sendMessage
};
