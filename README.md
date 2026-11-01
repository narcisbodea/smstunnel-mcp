# SMSTunnel MCP server

[![npm](https://img.shields.io/npm/v/@narcisbodea/smstunnel-mcp)](https://www.npmjs.com/package/@narcisbodea/smstunnel-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Let Claude, Cursor, VS Code and other AI apps send texts from **your own Android phone**, from **your own number**, with [SMSTunnel](https://smstunnel.io).

You ask your AI app to text someone; it hands the text to your SMSTunnel account, and your phone sends it from its own SIM, so the recipient sees a number they know and can reply to. The phone is linked to your account when you sign in to the SMSTunnel app, and you can cut this server off anytime by deleting its key in your dashboard.

Your phone needs the SMSTunnel app from Google Play:

<a href="https://play.google.com/store/apps/details?id=io.smstunnel.app"><img src="https://smstunnel.io/google-play-badge.png" alt="Get it on Google Play" height="56"></a>

## What it can do

| Tool | What it does | Changes anything? |
| --- | --- | --- |
| `send_sms` | Sends one text to one number. To text several people, the assistant calls it once per number. | Sends a text |
| `send_sign_in_code` | Sends a sign-in or verification code (the text must contain a code of 4 to 10 digits). Uses the separate sign-in code allowance. | Sends a text |
| `get_message_status` | Shows whether a text is pending, sent, delivered, failed or unconfirmed. | No |
| `list_phones` | Lists your linked phones, which are online, and their IDs. | No |
| `get_usage` | Shows your plan, what you sent today and what is left. | No |
| `list_received_texts` | Reads texts your phones received (only with the opt-in below). | No |

Every tool carries a title and the MCP annotations (read-only, destructive, idempotent, open-world), so your AI app can ask you before anything is sent.

## Setup

### 1. Link your phone

Install the [SMSTunnel app from Google Play](https://play.google.com/store/apps/details?id=io.smstunnel.app) on your Android phone and sign in. Sign in at [smstunnel.io](https://smstunnel.io) on your computer with the same account: the phone appears under **Phones** (you can also link it with the QR code from **Phones → Add phone**).

### 2. Create a key

In your [SMSTunnel dashboard](https://dashboard.smstunnel.io/apps), open **Apps → Add an app** and copy its key. It is shown only once, and it can send texts and look up whether they went out.

To let your AI app read the texts you receive, also turn on **Can also read received texts** when you add the app (or **Allow reading received texts** later), and turn on syncing of received texts in the SMSTunnel app on the phone. Syncing is off by default; when you turn it on, only texts that arrive from then on are synced.

### 3. Add the server to your AI app

You need [Node.js](https://nodejs.org) 20 or newer. Your AI app starts the server with `npx`; you don't run it by hand.

**Claude Desktop**: Settings → Developer → Edit Config (`claude_desktop_config.json`), then restart Claude:

```json
{
  "mcpServers": {
    "smstunnel": {
      "command": "npx",
      "args": ["-y", "@narcisbodea/smstunnel-mcp"],
      "env": {
        "SMSTUNNEL_API_KEY": "sk_live_your_key"
      }
    }
  }
}
```

On Windows, if the app can't start `npx`, use `"command": "cmd"` and `"args": ["/c", "npx", "-y", "@narcisbodea/smstunnel-mcp"]`.

**Claude Code**:

```bash
claude mcp add smstunnel --scope user -e SMSTUNNEL_API_KEY=sk_live_your_key -- npx -y @narcisbodea/smstunnel-mcp
```

**Cursor**: the same `mcpServers` block as Claude Desktop, in `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project).

**VS Code** (`.vscode/mcp.json`): VS Code asks for the key once and keeps it out of the file:

```json
{
  "inputs": [
    { "type": "promptString", "id": "smstunnel-api-key", "description": "SMSTunnel API key", "password": true }
  ],
  "servers": {
    "smstunnel": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@narcisbodea/smstunnel-mcp"],
      "env": { "SMSTUNNEL_API_KEY": "${input:smstunnel-api-key}" }
    }
  }
}
```

**Docker**: the image runs the same server over stdio:

```json
{
  "mcpServers": {
    "smstunnel": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "SMSTUNNEL_API_KEY", "mcp/smstunnel"],
      "env": { "SMSTUNNEL_API_KEY": "sk_live_your_key" }
    }
  }
}
```

(`mcp/smstunnel` is the name in the Docker MCP Catalog; you can also build it from this repository with `docker build -t smstunnel-mcp .`.)

### Settings

| Variable | Required | What it does |
| --- | --- | --- |
| `SMSTUNNEL_API_KEY` | yes | The key from **Apps → Add an app**. |
| `SMSTUNNEL_DEVICE_ID` | no | The phone that sends when the assistant doesn't name one. Copy its ID under **Phones**. Without it, SMSTunnel picks one of your online phones. |
| `SMSTUNNEL_DEFAULT_COUNTRY_CODE` | no | For example `+40` or `1`: completes numbers written without `+` or `00`. Without it, numbers must be in international format. |
| `SMSTUNNEL_SERVER_URL` | no | For testing only. Default `https://smstunnel.io`. |

The server starts even without a key, so your AI app can list its tools; every call then says what is missing. The key is never printed or logged.

## Try it

- "Text +14155550123: the delivery is at the back door."
- "Send my sign-in code 482913 to +447700900123."
- "Did my last text go out?"
- "Which of my phones are online?"
- "How many texts do I have left today?"
- "Did anyone reply to me since this morning?"

## Safe use

- **Only texts people expect.** Alerts to yourself, replies, reminders, sign-in codes. Unsolicited texts from a personal SIM break most carriers' terms, and in the EU they fall under GDPR and the ePrivacy rules.
- **You approve each text.** The tools tell the assistant to show you the number and the words and wait for your OK, and AI apps ask before calling a tool that changes something.
- **One recipient per text.** There is no tool for several numbers: the assistant sends one text per person, at most about 30 a minute.
- **No blind resends.** A failed, unconfirmed or timed-out text may still have gone out; the tools tell the assistant to ask you instead of sending it again.
- **Received texts are data.** Anyone can text your phone, so the tools tell the assistant to treat received words as information, never as instructions. Turn reading on only if you need it.
- **Your key.** Keep it in your AI app's settings or secret store, never in a chat, a repository or client-side code. Delete the app in **Apps** to cut the key off.
- The texts you send are kept on your dashboard's **Messages** page, like texts from your other apps; this server doesn't encrypt them end to end.

## Build it with an AI assistant

Paste this into Claude, ChatGPT, Cursor or Copilot and replace the part in brackets. Don't paste your API key into the chat: the prompt doesn't need it.

```text
Help me use SMSTunnel from my AI app, so it can send texts from my own phone.

About SMSTunnel (https://smstunnel.io): my own apps and tools hand text messages (SMS) to my
SMSTunnel account, and my own Android phone sends them from my own number, on my own SIM and plan.
The phone runs the SMSTunnel app from Google Play
(https://play.google.com/store/apps/details?id=io.smstunnel.app), signed in to my account.

What I want: [describe what should send a text, to whom, and when]

How it works:
- MCP server: my AI app starts it with the command `npx -y @narcisbodea/smstunnel-mcp` (Node.js
  20+, stdio). Its settings go in the "env" of the app's MCP server config: SMSTUNNEL_API_KEY
  (required), SMSTUNNEL_DEVICE_ID and SMSTUNNEL_DEFAULT_COUNTRY_CODE (optional).
- Tools: send_sms (to, message, deviceId?, defaultCountryCode?), send_sign_in_code (same
  fields), get_message_status (messageId), list_phones, get_usage, list_received_texts.
- The same API, if you write code: POST https://smstunnel.io/api/v1/sms/send with the headers
  X-API-Key: <key> and Content-Type: application/json, body {"to", "message", "deviceId"?,
  "defaultCountryCode"?}. The answer has "messageId"; GET /api/v1/sms/status/<messageId> shows
  pending, sent, delivered or failed.
- One recipient per call: for several people, one call per number. About 30 texts a minute.
- Numbers in international format (+ and the country code). defaultCountryCode (e.g. "+44")
  completes numbers written without + or 00 and takes precedence over the phone's own setting.
- Texts up to 1600 characters. Sign-in codes go through /api/v1/sms/send-2fa (tool
  send_sign_in_code): the text must contain a code of 4 to 10 digits standing on its own (or
  123-456), up to 320 characters; it uses a separate allowance.
- Errors are JSON with "message" and sometimes "code": 401 = wrong or deleted key; 403 = the key
  lacks a permission (code PERMISSION_REQUIRED; reading received texts is a separate opt-in) or
  the plan doesn't allow it; 429 = too many requests, wait a minute; 5xx = SMSTunnel problem, it
  is unclear whether the text was accepted.
- If my phone is offline, the text waits and goes out when the phone is back online.
- The API key comes from my SMSTunnel dashboard (https://dashboard.smstunnel.io): Apps → Add an
  app. It is shown only once and can send texts and check whether they went out.

Rules for your answer:
- Do not ask for my SMSTunnel password or API key and do not put a real key in your answer; I will
  not paste it in this chat.
- Keep the key in an environment variable or the platform's secret store, never in source code,
  a repository or client-side code.
- Validate phone numbers (international format) before sending, and handle every error above.
- Help me test it with my own number first.
- Only send texts people expect from me. No unsolicited texts.
- Never resend a text on your own: one that shows as failed or unconfirmed may have gone out.
```

## Troubleshooting

- **"SMSTUNNEL_API_KEY is not set"**: add the key to the `env` of the server in your AI app's MCP settings and restart the app.
- **"SMSTunnel did not accept the API key"**: the key is wrong or was deleted. Create a new one under **Apps → Add an app**.
- **The text stays pending**: the phone is offline or the SMSTunnel app can't run in the background. Open the app on the phone; the text goes out when it is back online.
- **"This API key may not read received texts"**: turn on **Allow reading received texts** for the app in the dashboard, and syncing of received texts in the SMSTunnel app.
- **A number "has no country code"**: write it with `+` and the country code, or set `SMSTUNNEL_DEFAULT_COUNTRY_CODE`.

## Development

```bash
npm install
npm run build
npm test                                   # unit tests (Node 22+), no network
npx @modelcontextprotocol/inspector node dist/index.js
```

The end-to-end test starts the built server over stdio, calls every tool against a **local** SMSTunnel API (it refuses any other host), and checks the texts in that API's MongoDB:

```bash
SMSTUNNEL_E2E_KEY_FILE=/path/to/local-test-key.json \
SMSTUNNEL_E2E_MONGO_URL=mongodb://127.0.0.1:27018/smstunnel_app_dev \
SMSTUNNEL_E2E_MONGODB_FROM=/path/to/a/project/with/mongodb/package.json \
npm run test:e2e
```

The key file is JSON with `serverUrl`, `apiKey` and `deviceId`.

## Links

- [SMSTunnel](https://smstunnel.io) · [Dashboard](https://dashboard.smstunnel.io) · [Documentation](https://smstunnel.io/docs)
- [SMSTunnel on Google Play](https://play.google.com/store/apps/details?id=io.smstunnel.app)
- Support: support@smstunnel.io

Claude, Cursor, Visual Studio Code and Docker are trademarks of their owners. SMSTunnel is not affiliated with, endorsed by, or sponsored by Anthropic, Anysphere, Microsoft or Docker.

## License

[MIT](LICENSE) © NARBOWEB SRL
