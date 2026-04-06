# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Build React admin UI
npm run watch          # Build with watch mode
npm test               # Run JS unit tests + package tests
npm run test:js        # Unit tests only (mocha)
npm run test:package   # Package integrity tests
npm run test:integration  # Integration tests
npm run lint           # ESLint
npm run check          # TypeScript type check (no emit)
npm run translate      # Update i18n translation files
npm run release        # Release script
```

Run a single test file:
```bash
npx mocha --config test/mocharc.custom.json main.test.js
```

## Architecture

This is an **ioBroker adapter** providing bi-directional integration with **Synology Chat**. It follows the standard ioBroker adapter pattern by extending `@iobroker/adapter-core`.

### Data Flow

```
ioBroker State Change → main.js → Message Queue → synoChatRequests.js → Synology Chat REST API

Synology Chat Webhook → lib/web.js → ioBroker State Update
```

### Key Files

- [main.js](main.js) — Main adapter class. Handles lifecycle (`onReady`, `onStateChange`, `onUnload`), message queue processing, template formatting, config validation/migration, and webhook URL generation.
- [lib/synoChatRequests.js](lib/synoChatRequests.js) — Wraps axios for Synology Chat API. Handles connectivity checks, message sending with retry on rate limits, and optional certificate validation.
- [lib/synoChatRequestHelper.js](lib/synoChatRequestHelper.js) — Escapes special characters for message text and validates HTTP URLs.
- [lib/template-interpolation.js](lib/template-interpolation.js) — Recursive template engine that interpolates ioBroker state values and Notification Manager message properties into message templates.
- [lib/web.js](lib/web.js) — Webhook endpoint handler integrated into ioBroker's web adapter. Receives outgoing webhook messages from Synology Chat and maps them to ioBroker states.
- [admin/src/tab-app.jsx](admin/src/tab-app.jsx) — Main React admin UI component using Material-UI and ioBroker's `@iobroker/adapter-react`.
- [io-package.json](io-package.json) — ioBroker metadata, instance config schema, and object structure definitions.

### Message Queueing

Outgoing messages are queued and processed sequentially (`messageQueue` array in `main.js`) to prevent hitting Synology Chat API rate limits. The queue is processed one message at a time.

### Configuration

Channels are configured as an array in the adapter config (`config.channels`). Each channel has its own incoming token, outgoing token, and optional message templates. The adapter supports config migration from older schema versions.

### Testing

Tests use Mocha + Chai + proxyquire. The main unit tests in [main.test.js](main.test.js) focus on template interpolation via `formatReceivedOnMessageData`. Adapter core is mocked using `@iobroker/testing`.

### Tech Stack

- **Runtime**: Node.js 20+ (CommonJS, ES2021)
- **HTTP**: axios
- **Admin UI**: React 17 + Material-UI 4
- **Testing**: Mocha + Chai + proxyquire
- **CI**: GitHub Actions, testing on Node 20/22/24 across Ubuntu/Windows/macOS
