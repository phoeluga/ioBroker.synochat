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

const DEFAULT_FROM = "from-propertery-top-level";
const DEFAULT_HOST = "iobroker-host";
const DEFAULT_ID = "some-random-id";

const DEFAULT_SCOPE_NAME = "scope name";

const DEFAULT_CATEGORY_DESCRIPTION = "category description";
const DEFAULT_CATEGORY_NAME = "category name";

const DEFAULT_DOTTED_PROPERTY = "this is a dotted property";
const DEFAULT_ACTUAL_NESTED_PROPERTY = "this is an actual nested property";

const DEFAULT_MESSAGE_OBJ = {
  message: "Plant Ren is not having a perfect moisture status",
  ts: 1743750514032,
  contextData: {
    name: "Ren",
    detailedName: "Dracaena reflexa",
    "dotted.name": DEFAULT_DOTTED_PROPERTY,
    dotted: {
      name: DEFAULT_ACTUAL_NESTED_PROPERTY,
    },
    actual: 3,
  },
};

const DEFAULT_NOTIFICATION_MANAGER_MESSAGE = {
  command: "command-tbd",
  from: DEFAULT_FROM,
  _id: DEFAULT_ID,
  message: {
    host: DEFAULT_HOST,
    scope: {
      name: DEFAULT_SCOPE_NAME,
      description: "notification-description",
    },
    "test.nested.property": DEFAULT_DOTTED_PROPERTY,
    test: {
      nested: {
        property: DEFAULT_ACTUAL_NESTED_PROPERTY,
      },
    },
    category: {
      instances: {
        "system.adapter.adapter.0": {
          messages: [DEFAULT_MESSAGE_OBJ],
        },
      },
      description: DEFAULT_CATEGORY_DESCRIPTION,
      name: DEFAULT_CATEGORY_NAME,
      severity: "alert",
    },
  },
};

describe("formatReceivedOnMessageData", () => {
  it("should return template without parameters", () => {
    const result = formatReceivedOnMessageData(
      DEFAULT_NOTIFICATION_MANAGER_MESSAGE,
      "Hello World",
    );

    expect(result).equals("Hello World");
  });

  const replacementTests = [
    { args: ["${_id}"], expected: `${DEFAULT_ID}` },
    { args: ["${instances}"], expected: `adapter.0` },
    { args: ["${from}"], expected: `${DEFAULT_FROM}` },
    { args: ["${message.host}"], expected: `"${DEFAULT_HOST}"` },

    {
      args: ["${message.category.description}"],
      expected: `"${DEFAULT_CATEGORY_DESCRIPTION}"`,
    },
    {
      args: ["${message.category.name}"],
      expected: `"${DEFAULT_CATEGORY_NAME}"`,
    },

    // Check that dotted/nested properties are handled correctly
    {
      args: ["${message.test.nested.property}"],
      expected: `"${DEFAULT_ACTUAL_NESTED_PROPERTY}"`,
    },
    {
      args: ["${message.test/-nested/-property}"],
      expected: `"${DEFAULT_DOTTED_PROPERTY}"`,
    },

    {
      args: ["${instances}: ${message.host}"],
      expected: `adapter.0: "${DEFAULT_HOST}"`,
    },

    { args: ["${contextData.name}"], expected: `"Ren"` },
    {
      args: ["${contextData.name} -> ${contextData.detailedName}"],
      expected: `"Ren" -> "Dracaena reflexa"`,
    },

    {
      args: ["${contextData.dotted.name}"],
      expected: `"${DEFAULT_ACTUAL_NESTED_PROPERTY}"`,
    },
    {
      args: ["${contextData.dotted/-name}"],
      expected: `"${DEFAULT_DOTTED_PROPERTY}"`,
    },
  ];

  replacementTests.forEach(({ args, expected }) => {
    it(`correctly replaces ${args[0]}`, function () {
      const res = formatReceivedOnMessageData(
        DEFAULT_NOTIFICATION_MANAGER_MESSAGE,
        args[0],
        { receivedNotificationManagerTemplate: args[0] },
      );
      expect(res).equals(expected);
    });
  });

  it("should skip processing contextData if not present in the notification", () => {
    const notificationClone = {
      ...DEFAULT_NOTIFICATION_MANAGER_MESSAGE,
      message: {
        ...DEFAULT_NOTIFICATION_MANAGER_MESSAGE.message,
        category: {
          ...DEFAULT_NOTIFICATION_MANAGER_MESSAGE.message.category,
          instances: [],
        },
      },
    };

    const template = "${contextData.name}";
    const result = formatReceivedOnMessageData(notificationClone, template, {
      receivedNotificationManagerTemplate: template,
    });
    expect(result).equals("${contextData.name}");
  });

  it("should skip processing contextData if multiple messages are received", () => {
    const notificationClone = {
      ...DEFAULT_NOTIFICATION_MANAGER_MESSAGE,
      message: {
        ...DEFAULT_NOTIFICATION_MANAGER_MESSAGE.message,
        category: {
          ...DEFAULT_NOTIFICATION_MANAGER_MESSAGE.message.category,
          instances: {
            ...DEFAULT_NOTIFICATION_MANAGER_MESSAGE.message.category.instances,
            "system.adapter.adapter.0": {
              messages: [DEFAULT_MESSAGE_OBJ, DEFAULT_MESSAGE_OBJ],
            },
          },
        },
      },
    };

    const template = "${contextData.name}";
    const result = formatReceivedOnMessageData(notificationClone, template, {
      receivedNotificationManagerTemplate: template,
    });
    expect(result).equals("${contextData.name}");
  });
});
