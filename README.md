# TODO BEFORE RELEASE > v1.1.0
- Name usage of web.0 > For debugging debug output of synochat.0 + web.0 needs to be activated
- Remove note of Outgoing implementation planned
- Remove Note of naming convention Incoming + Outgoing
- (optional) check ChannelType in main.js for handling Incoming messages and Outgoing response > Currently covered with the ack flag of a state change!
- Add hint of new web instance combobox in README.md
- Add version desc to io-package.json

# <img src="admin/synochat.png" alt="drawing" style="width:30px;"/> Synology-Chat adapter for ioBroker

[![NPM version](https://img.shields.io/npm/v/iobroker.synochat.svg)](https://www.npmjs.com/package/iobroker.synochat)
[![Downloads](https://img.shields.io/npm/dm/iobroker.synochat.svg)](https://www.npmjs.com/package/iobroker.synochat)
![Number of Installations](https://iobroker.live/badges/synochat-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/synochat-stable.svg)
[![Dependency Status](https://img.shields.io/david/phoeluga/iobroker.synochat.svg)](https://david-dm.org/phoeluga/iobroker.synochat)
![Test and Release](https://github.com/phoeluga/ioBroker.synochat/workflows/Test%20and%20Release/badge.svg)

[![NPM](https://nodei.co/npm/iobroker.synochat.png?downloads=true)](https://nodei.co/npm/iobroker.synochat/)

[![Donate][donate-badge2]][donate-link]

## What is it? 
This adapter provides an interface between Synology Chat and ioBroker.
For this purpose, the standard integration features provided by Synology Chat and the corresponding REST API endpoints are used.

---

# Manual

## 1. Installation
The adapter can be instanciated from the adapter section in your ioBroker installation.
More information can be found in the offical [ioBroker documentation](https://www.iobroker.net/#de/documentation/admin/adapter.md).

## 2. Configuration
***NOTE:***\
*The perspective of the direction of incoming or outgoing messages mentioned below is considered from the point of view of the Synology chat server. For example, selecting 'Incoming' in the channel type configuration means that the messages will be sent to the Synology chat.*
### 2.1. Synology chat configuration
Synology Chat offers the possibility to handle incoming and outgoing messages. In the following, both options will be examined in more detail.

Please note that at the time of the initial release, there may be some limitations. You will find more details in the sections [Changelog](#changelog) and [Planned features](#planned-features).

To create messages via the Synology Chat interface, an integration must be created in Synology Chat:
![SynoChatChannel](./docs/images/diSynoChatChannel.png)
![SynoChatIntegrations](./docs/images/diSynoChatIntegrations.png)

* **Incoming Webhooks**
  
	For the integration of an incoming message in the Synology chat, a token is needed, which can be taken from the URL generated during the creation.
	![SynoChatIntegrationIncoming](./docs/images/diSynoChatIntegrationIncoming.png)
	![SynoChatIntegrationIncomingSettings](./docs/images/diSynoChatIntegrationIncomingSettings.png)

* **Outgoing Webhooks**\
	You will find more details in the sections [Changelog](#changelog) and [Planned features](#planned-features).

For more details on how to handle integrations within Synlogy chat, please refer to Synlogy's official documentation [HERE](https://kb.synology.com/DSM/help/Chat/chat_integration)



### 2.2. ioBroker adapter instance configuration
- The configuration of this adapter can be done in the instance settings.
    #### 2.2.1. General setup:
	![IobrokerInstanceSettingsGeneralSettings](./docs/images/diIobrokerInstanceSettingsGeneralSettings.png)
    
	* **Synology URL/IP**

        With this property a URL to your Synology-Chat app will be provided. Please note to use an absolute URL including `http://` or `https://` and do not provide an postfix like `/`.
		A specific port can be provided as usual behind the URL using `:`.

		***Sample for valide values:***
		- https://mychat.mydomain.tld
		- https://192.168.1.1:8080

    * **Validate SSL certificate**

        It is of course always recommended to encrypt data transfers.
		Often, self-signed certificates are used for encrypted connections in home environments. In this case, it may be necessary to disable SSL certificate verification of an HTTP connection.
		Disable this property to turn off certificate validation.

    #### 2.2.2. Channel configuration:	
	![IobrokerInstanceSettingsChannelConfiguration](./docs/images/diIobrokerInstanceSettingsChannelConfiguration02.png)

    * **Channel name**

		This setting specifies the name of the channel from/to which messages are sent. This name can be freely selected and is used for referencing.

	* **Channel token**

		This setting provides the access token to the Synology chat channel. Depending on the channel type, the creation of this varies.
		More details can be found in chapter [Synology chat configuration](#synology-chat-configuration).

		***NOTE:***\
		*Depending on the integration, when create the Synology chat integration, you will get a link similar to the following example:*

			https://mychat.mydomain.tld/webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2&token=%22QF5DWyG7M47Ls3cv%22
		
		*In this example, the token is included in the URL. Encoded control characters - `%22` - are specified here at the beginning and end of the setting.\
		**These have to be removed!**\
		In this example the token to be entered would be `QF5DWyG7M47Ls3cv`.*
		
	* **Channel type**

		This setting specifies the type of Synology chat channel that will be used depending on the integration selected in Synology chat.

		***NOTE:***\
		*The channel type must be specified from the perspective of the Synology chat. For example, selecting 'Incoming' in the configuration means that the messages will be sent to the Synology chat.*

	* **Validate SSL certificate for non-text messages**
	
		In case that for an incoming channel type a content other than a text, for example an image, is to be sent, this is specified from an HTTP source via a URL. If this content is provided with a self-signed certificate, the certificate check can be enabled or disabled with this setting.
		For details on sending non-text content, see chapter [Synology chat configuration](#synology-chat-configuration)..

	#### 2.2.3. Help:
   	* This tab usually redirects to the official GitHub page of this project, where detailed help and usage instructions are given.
	* If there are any open questions, suggestions for changes, unwanted behavior or bugs, please create a [GitHub issue](https://github.com/phoeluga/ioBroker.synochat/issues/new/choose) to ensure the quality of this project.

## 3. Usage
### 3.1 General
* After the adapter is instantiated, a respective folder is created in the objects of the respective adapter instance for the Synology chat channel specified in the instance configuration.
	![IobrokerObjectOverview](./docs/images/diIobrokerObjectOverview.png)

* In this folder a message object can be found, which represents the sent or received message.
  
  ***NOTE:***\
	*When sending a message or when the message object is changed by the user, make sure that the Ack flag is not set. The Ack flag is set by the adapter after confirmation of successful receipt of the message by the Synology chat server.\
	**If the Ack flag is set by the user when changing, the message will not be forwarded!***
		
	![IobrokerObjectSetMessage](./docs/images/diIobrokerObjectSetMessage.png)

* When the message object is changed, this message - depending on the channel type - is passed to the Synology chat in the channel published.
	![SynoChatChannelIncomingMessage](./docs/images/diSynoChatChannelIncomingMessage.png)

### 3.2 Message content type

Besides sending plain text messages, other content types such as images can also be sent to an incoming channel.\
To realize this, the content must be available as a web resource. To send an image, just set the URL as the value of the the message object of the Syno-Chat adapter instance mentioned in [3. Usage > 3.1 General](#3.1-general).

**Example of a use case of a surveillance camera:**\
Many surveillance cameras provide a stream or interface to retrieve an image that is updated at a specified time interval or when motion is detected.\
This URL provides image that needs to be set as the value of the the message object.

---

## Changelog
All changes to this project are described in the [CHANGELOG](./CHANGELOG.md).
### Planned features:
- Outgoing message implementation

	***NOTE:***
	*The channel type must be specified from the perspective of the Synology chat. For example, selecting 'Incoming' in the configuration means that the messages will be sent to the Synology chat.*


## License
This code is licensed under the license specified in the [LICENSE](./LICENSE) file.

Copyright (c) 2022 phoeluga <phoeluga@gmail.com>


## Other disclosures
#### Resource attribution
- [Chat icons created by Pixel perfect - Flaticon](https://www.flaticon.com/free-icons/chat)



[donate-badge]:https://img.shields.io/static/v1?label=Treat%20a%20coffee&message=donate%20a%20tip&color=2a9cde&logo=data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTcgMjJoMTBhMSAxIDAgMCAwIC45OS0uODU4TDE5Ljg2NyA4SDIxVjZoLTEuMzgybC0xLjcyNC0zLjQ0N0EuOTk4Ljk5OCAwIDAgMCAxNyAySDdjLS4zNzkgMC0uNzI1LjIxNC0uODk1LjU1M0w0LjM4MiA2SDN2MmgxLjEzM0w2LjAxIDIxLjE0MkExIDEgMCAwIDAgNyAyMnptMTAuNDE4LTExSDYuNTgybC0uNDI5LTNoMTEuNjkzbC0uNDI4IDN6bS05LjU1MSA5LS40MjktM2g5LjEyM2wtLjQyOSAzSDcuODY3ek03LjYxOCA0aDguNzY0bDEgMkg2LjYxOGwxLTJ6IiBmaWxsPSIjZWRmMmZhIiBjbGFzcz0iZmlsbC0wMDAwMDAiPjwvcGF0aD48L3N2Zz4=
[donate-badge2]:https://img.shields.io/static/v1?label=Treat%20a%20coffee&message=donate%20a%20tip&color=2a9cde&logo=data:image/svg+xml;base64,PHN2ZyBkYXRhLW5hbWU9IkxheWVyIDEiIHZpZXdCb3g9IjAgMCAzMiAzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjYuNSAxNUgyNnYtMWEyIDIgMCAwIDAtMi0ySDJhMiAyIDAgMCAwLTIgMnY2YTEwLjY0IDEwLjY0IDAgMCAwIDExIDExaDRhMTAuNzkgMTAuNzkgMCAwIDAgOS4zMS01aDIuMTlhNS41IDUuNSAwIDAgMCAwLTExWk0xNSAyN2gtNGE2LjcgNi43IDAgMCAxLTctN3YtNGgxOHY0YTYuNzcgNi43NyAwIDAgMS03IDdabTExLjQ0LTQuNzdoLS43OGExMy43NSAxMy43NSAwIDAgMCAuMi0yLjMxdi0xLjE1aC41OGExLjczIDEuNzMgMCAwIDEgMCAzLjQ2Wk0xMyAxMGEyIDIgMCAwIDAgMi0yVjJhMiAyIDAgMSAwLTQgMHY2YTIgMiAwIDAgMCAyIDJaTTIwIDEwYTIgMiAwIDAgMCAyLTJWN2EyIDIgMCAwIDAtNCAwdjFhMiAyIDAgMCAwIDIgMlpNNiAxMGEyIDIgMCAwIDAgMi0yVjZhMiAyIDAgMCAwLTQgMHYyYTIgMiAwIDAgMCAyIDJaIiBmaWxsPSIjZjBmNWZhIiBjbGFzcz0iZmlsbC1iYTYzYzYiPjwvcGF0aD48L3N2Zz4=
[donate-link]: https://www.paypal.com/donate/?hosted_button_id=9MLB29CKX5674
