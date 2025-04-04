"use strict";

/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.js-files
 */

const { expect } = require("chai");
const { formatReceivedOnMessageData } = require("./template-interpolation.js");
// import { functionToTest } from "./moduleToTest";

describe("module to test => function to test", () => {
	// initializing logic
	const expected = 5;

	it(`should return ${expected}`, () => {
		const result = 5;
		// assign result a value from functionToTest
		expect(result).to.equal(expected);
		// or using the should() syntax
		result.should.equal(expected);
	});
	// ... more tests => it

});

const DEFAULT_NOTIFICATION_MANAGER_MESSAGE = {
	"host": "system.host.dev-fyta-oma-desktop",
	"scope": {
		"name": "Fyta",
		"description": "TODO"
	},
	"category": {
		"instances": {
			"system.adapter.fyta.0": {
				"messages": [
					{
						"message": "Plant Ren is not having a perfect moisture status",
						"ts": 1743750514032,
						"contextData": {
							"name": "Ren",
							"sName": "Dracaena reflexa",
							"actual": 3
						}
					}
				]
			}
		},
		"description": "The humidity of a plant needs to be checked.",
		"name": "Check Humidity",
		"severity": "alert"
	}
};

describe("formatReceivedOnMessageData", () => {
	it("should return template without parameters", () => {
		const result = formatReceivedOnMessageData(DEFAULT_NOTIFICATION_MANAGER_MESSAGE, "Hello World");

		expect(result).equals("Hello World");
	});
});

