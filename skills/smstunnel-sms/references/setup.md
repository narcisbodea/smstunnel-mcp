# Setting up the SMSTunnel MCP server

Three steps, done once by the user. The agent can guide them but must never ask for the key in the chat.

## 1. Link the phone

Install the SMSTunnel app from Google Play on the Android phone and sign in:
https://play.google.com/store/apps/details?id=io.smstunnel.app

Sign in at https://smstunnel.io on the computer with the same account. The phone appears under **Phones** (it can also be linked with the QR code from **Phones → Add phone**).

## 2. Create a key

In the dashboard (https://dashboard.smstunnel.io/apps), open **Apps → Add an app**, choose **MCP**, and copy the key. It is shown only once. Deleting it later cuts the AI app off.

To let the AI app read received texts, also turn on **Can also read received texts** for that key, and turn on syncing of received texts in the SMSTunnel app on the phone.

## 3. Add the server to the AI app

The AI app starts the server with `npx`; Node.js 20 or newer is needed. Replace `sk_live_your_key` with the key.

**Claude Code**

```bash
claude mcp add --env SMSTUNNEL_API_KEY=sk_live_your_key --transport stdio --scope user smstunnel -- npx -y @narcisbodea/smstunnel-mcp
```

Then run `/mcp` to check that `smstunnel` is connected.

**Claude Desktop, Cursor and most other apps** (`claude_desktop_config.json`, `~/.cursor/mcp.json`, …):

```json
{
  "mcpServers": {
    "smstunnel": {
      "command": "npx",
      "args": ["-y", "@narcisbodea/smstunnel-mcp"],
      "env": { "SMSTUNNEL_API_KEY": "sk_live_your_key" }
    }
  }
}
```

On Windows, if the app can't start `npx`, use `"command": "cmd"` and `"args": ["/c", "npx", "-y", "@narcisbodea/smstunnel-mcp"]`. Restart the app after editing its settings.

**VS Code** (`.vscode/mcp.json`) asks for the key once and keeps it out of the file:

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

## Optional settings

| Variable | What it does |
| --- | --- |
| `SMSTUNNEL_DEVICE_ID` | The phone that sends when none is named (its ID is under **Phones**). |
| `SMSTUNNEL_DEFAULT_COUNTRY_CODE` | For example `+40` or `1`: completes numbers written without `+`. |
| `SMSTUNNEL_CONFIRM_EACH_TEXT` | `true` by default: apps that support it ask before every text. Set `false` only for unattended runs. |

More: https://smstunnel.io/integrations/mcp/ and https://github.com/narcisbodea/smstunnel-mcp
