function replacePropertiesForTemplate(formattedMessage, templateString, dataSource, log) {
    let maxItter = 100000;
    const regexStr = `\\$\\{${templateString}\\.(.+?)\\}`;
    const regex = new RegExp(regexStr);
    
    while (regex.test(formattedMessage) && maxItter > 0) {
        const match = regex.exec(formattedMessage);
        if(!match) break;
        
        let replacePattern = match[1];
        let replaceValue = replacePattern.split(".").reduce(function (o, k) {
            return o && o[k.replaceAll("/-", ".")];
        }, dataSource);
        formattedMessage = formattedMessage.replaceAll(
            String(`\${message.${replacePattern}}`),
            JSON.stringify(replaceValue),
        );

        maxItter--;
    }

    if (maxItter <= 0 && !!log) {
        log.error(
            `Infinite loop while parsing JSON detected! Returning raw text for ${templateString}!`,
        );
        formattedMessage = dataSource;
    }
    
    return formattedMessage;
}

function formatReceivedOnMessageData(obj, formatTemplate, config, log) {
    let formattedMessage = formatTemplate;

    if (formatTemplate === config?.receivedNotificationManagerTemplate) {
        const { instances } = obj.message.category;
        const readableInstances = Object.entries(instances).map(
            ([instance, _entry]) =>
                `${instance.substring("system.adapter.".length)}`,
        );
        formattedMessage = formattedMessage.replaceAll(
            "${instances}",
            String(readableInstances.join(", ")),
        );
        
        const allMessages = Object.values(instances).map(byAdapter => byAdapter.messages ?? [])
            .reduce((prev, curr) => [...prev, ...curr], []);
        
        if(allMessages.length === 1 && !!allMessages[0].contextData) {
            formatTemplate = replacePropertiesForTemplate(formattedMessage, "contextData", allMessages[0].contextData, log);
        }
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

    formattedMessage = replacePropertiesForTemplate(formattedMessage, "message", obj.message, log);
        
    return formattedMessage;
}

module.exports = { formatReceivedOnMessageData };