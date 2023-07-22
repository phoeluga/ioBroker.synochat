function prepareTextForSendingMessage(adapterInstance, message){
	if(message.includes('"') || message.includes("&") || message.includes("%'") || message.includes("\\")){
		message = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%25").replace(/&/g, "%26");
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

module.exports = {
	prepareTextForSendingMessage,
	isValidHttpUrl
};
