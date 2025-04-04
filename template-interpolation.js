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

    if (maxItter <= 0 && !!log) {
        log.error(
            `Infinite loop while parsing JSON detected! Returning raw text!`,
        );
        formattedMessage = obj.message;
    }

    return formattedMessage;
}

module.exports = { formatReceivedOnMessageData };