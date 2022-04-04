# <img src="admin/synochat.png" alt="drawing" style="width:50px;"/> Synology-Chat adapter for ioBroker

[![NPM version](https://img.shields.io/npm/v/iobroker.synochat.svg)](https://www.npmjs.com/package/iobroker.synochat)
[![Downloads](https://img.shields.io/npm/dm/iobroker.synochat.svg)](https://www.npmjs.com/package/iobroker.synochat)
![Number of Installations](https://iobroker.live/badges/synochat-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/synochat-stable.svg)
[![Dependency Status](https://img.shields.io/david/phoeluga/iobroker.synochat.svg)](https://david-dm.org/phoeluga/iobroker.synochat)

[![NPM](https://nodei.co/npm/iobroker.synochat.png?downloads=true)](https://nodei.co/npm/iobroker.synochat/)

**Tests:** ![Test and Release](https://github.com/phoeluga/ioBroker.synochat/workflows/Test%20and%20Release/badge.svg)

## synochat adapter for ioBroker

This adapter provides access to incoming and outgoing Synology-Chat channels

## Developer manual
This section is intended for the developer. It can be deleted later

### Getting started

You are almost done, only a few steps left:
1. Create a new repository on GitHub with the name `ioBroker.synochat`
1. Initialize the current folder as a new git repository:  
	```bash
	git init -b main
	git add .
	git commit -m "Initial commit"
	```
1. Link your local repository with the one on GitHub:  
	```bash
	git remote add origin https://github.com/phoeluga/ioBroker.synochat
	```

1. Push all files to the GitHub repo:  
	```bash
	git push origin main
	```

1. Head over to [main.js](main.js) and start programming!

### Best Practices
We've collected some [best practices](https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices) regarding ioBroker development and coding in general. If you're new to ioBroker or Node.js, you should
check them out. If you're already experienced, you should also take a look at them - you might learn something new :)

### Scripts in `package.json`
Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `test:js` | Executes the tests you defined in `*.test.js` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:unit` | Tests the adapter startup with unit tests (fast, but might require module mocks to work). |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |
| `translate` | Translates texts in your adapter to all required languages, see [`@iobroker/adapter-dev`](https://github.com/ioBroker/adapter-dev#manage-translations) for more details. |
| `release` | Creates a new release, see [`@alcalzone/release-script`](https://github.com/AlCalzone/release-script#usage) for more details. |

### Writing tests
When done right, testing code is invaluable, because it gives you the 
confidence to change your code while knowing exactly if and when 
something breaks. A good read on the topic of test-driven development 
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92. 
Although writing tests before the code might seem strange at first, but it has very 
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter
Using GitHub Actions, you can enable automatic releases on npm whenever you push a new git tag that matches the form 
`v<major>.<minor>.<patch>`. We **strongly recommend** that you do. The necessary steps are described in `.github/workflows/test-and-release.yml`.

Since you installed the release script, you can create a new
release simply by calling:
```bash
npm run release
```
Additional command line options for the release script are explained in the
[release-script documentation](https://github.com/AlCalzone/release-script#command-line).

To get your adapter released in ioBroker, please refer to the documentation 
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually on a local ioBroker installation
In order to install the adapter locally without publishing, the following steps are recommended:
1. Create a tarball from your dev directory:  
	```bash
	npm pack
	```
1. Upload the resulting file to your ioBroker host
1. Install it locally (The paths are different on Windows):
	```bash
	cd /opt/iobroker
	npm i /path/to/tarball.tgz
	```

For later updates, the above procedure is not necessary. Just do the following:
1. Overwrite the changed files in the adapter directory (`/opt/iobroker/node_modules/iobroker.synochat`)
1. Execute `iobroker upload synochat` on the ioBroker host

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
* (phoeluga) initial release

## Changelog
All changes to this project are described in the [CHANGELOG.md](./CHANGELOG.md).

## License
This code is licensed under the license specified in the [LICENSE](./LICENSE) file.


## Other disclosures
#### Resource attribution
- [Chat icons created by Pixel perfect - Flaticon](https://www.flaticon.com/free-icons/chat)
