# SMSTunnel MCP Server

Send SMS messages through AI assistants like Claude using the Model Context Protocol (MCP).

## Features

- **send_sms** - Send SMS to a single recipient
- **send_bulk_sms** - Send SMS to up to 100 recipients
- **check_sms_status** - Check delivery status of sent messages
- **get_usage** - View your SMS usage and remaining quota
- **list_devices** - List available devices and their status

## Installation

### 1. Get Your API Key

1. Sign up at [smstunnel.io](https://smstunnel.io)
2. Install the [SMSTunnel app from Google Play](https://play.google.com/store/apps/details?id=io.smstunnel.app) and connect your Android phone
3. In your [dashboard](https://dashboard.smstunnel.io), open **Apps** → **Add an app** and click **Create the key**
4. Copy the key (it starts with `sk_live_` and is shown only once)

### 2. Install the MCP Server

```bash
# Clone or download this directory
cd smstunnel-mcp

# Install dependencies
npm install

# Build
npm run build
```

### 3. Configure Claude Desktop

Add to your Claude Desktop configuration file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "smstunnel": {
      "command": "node",
      "args": ["D:\\ANDROID\\smstunnel-mcp\\dist\\index.js"],
      "env": {
        "SMSTUNNEL_API_KEY": "sk_live_your_api_key_here"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

## Usage Examples

Once configured, you can ask Claude to:

### Send SMS
> "Send an SMS to +40712345678 saying 'Meeting at 3pm tomorrow'"

### Send Bulk SMS
> "Send 'Happy New Year!' to these numbers: +40712345678, +40723456789, +40734567890"

### Check Status
> "Check if my last SMS was delivered (message ID: abc123)"

### View Usage
> "How many SMS do I have left today?"

### List Devices
> "Show me my available devices"

## Available Tools

### send_sms
Send a single SMS message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| to | string | Yes | Phone number in E.164 format (+40712345678) |
| message | string | Yes | Message content (max 1600 chars) |
| deviceId | string | No | Specific device to use |

### send_bulk_sms
Send SMS to multiple recipients.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| to | string[] | Yes | Array of phone numbers (max 100) |
| message | string | Yes | Message content |
| deviceId | string | No | Specific device to use |

### check_sms_status
Check delivery status of a message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| messageId | string | Yes | Message ID from send_sms response |

### get_usage
Get account usage statistics. No parameters required.

### list_devices
List available devices. No parameters required.

## Phone Number Format

Always use E.164 format for phone numbers:
- Include country code with `+` prefix
- No spaces or dashes
- Example: `+40712345678` (Romania)

## Build it with an AI assistant

The server works in AI apps that run local MCP servers, such as Claude Desktop, Claude Code, Cursor and VS Code with Copilot. Paste this into the one you use and replace the parts in brackets. Don't paste your API key into the chat: the prompt doesn't need it.

```text
Help me connect the SMSTunnel MCP server to [my AI app], so it can send texts from my own phone when
I ask.

About SMSTunnel (https://smstunnel.io): my own apps and tools hand text messages (SMS) to my
SMSTunnel account, and my own Android phone sends them from my own number, on my own SIM and plan.
The phone runs the SMSTunnel app from Google Play
(https://play.google.com/store/apps/details?id=io.smstunnel.app), signed in to my account.

What I want: [describe what should send a text, to whom, and when]

How it works:
- It is a local Node.js server (Node 18+, stdio): in its folder, npm install and npm run build; the
  AI app then starts node <folder>/dist/index.js.
- The key goes in the environment variable SMSTUNNEL_API_KEY, in the "env" of the app's MCP server
  config; the server stops without it.
- Its tools include send_sms (to, message, deviceId optional), check_sms_status (messageId),
  get_usage and list_devices. Numbers in international format (+ and the country code, no spaces);
  texts up to 1600 characters.
- The API key comes from my SMSTunnel dashboard (https://dashboard.smstunnel.io): Apps → Add an app
  → Create the key. It is shown only once and can send texts and check whether they went out.

Rules for your answer:
- Do not ask for my SMSTunnel password or API key and do not put a real key in your answer; I will
  not paste it in this chat.
- Phone numbers must be in international format (+ and the country code).
- Help me test it with my own number first.
- Only send texts people expect from me. No unsolicited texts.
- Before every text, show me the number and the words and wait for my OK.
- Never resend a text on your own: one that shows as failed may have gone out without a
  confirmation.
```

## Troubleshooting

### "SMSTUNNEL_API_KEY environment variable is required"
Make sure you've added the API key to your Claude Desktop config.

### "No devices online"
Open the SMSTunnel app on your Android phone and ensure it's connected.

### "Invalid API key"
Check that your API key is correct and starts with `sk_live_`.

## Security

- Your API key is stored locally in Claude Desktop config
- All communication uses HTTPS
- Messages are sent through your own phone number
- The texts you send are kept on your dashboard's **Messages** page, like texts from your other apps (this server doesn't encrypt them end to end)

## Support

- Website: [smstunnel.io](https://smstunnel.io)
- Documentation: [smstunnel.io/docs](https://smstunnel.io/docs)
- Email: support@smstunnel.io

## License

MIT
