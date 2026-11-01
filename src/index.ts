#!/usr/bin/env node
/**
 * smstunnel-mcp: the SMSTunnel MCP server over stdio.
 *
 * Settings come from the environment (see --help). stdout carries the MCP protocol only; everything this
 * process says goes to stderr, and the API key is never printed.
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { PACKAGE_NAME, VERSION } from './version.js';

const HELP = `${PACKAGE_NAME} ${VERSION}: SMSTunnel MCP server (stdio)

Lets AI apps (Claude, Cursor, VS Code and others) send texts from your own Android phone and your own
number with SMSTunnel. Your AI app starts it; you don't run it by hand.

Environment:
  SMSTUNNEL_API_KEY               required. From https://dashboard.smstunnel.io/apps (Apps → Add an app).
  SMSTUNNEL_DEVICE_ID             optional. The phone that sends when a call doesn't name one (Phones → Copy).
  SMSTUNNEL_DEFAULT_COUNTRY_CODE  optional. e.g. +40: completes numbers written without + or 00.
  SMSTUNNEL_CONFIRM_EACH_TEXT     optional. true (default): AI apps that support it (Claude Code) ask you
                                  before every text. false: only their usual permission rules apply.
  SMSTUNNEL_SERVER_URL            optional, for testing only. Default https://smstunnel.io.

Example MCP settings:
  { "command": "npx", "args": ["-y", "${PACKAGE_NAME}"], "env": { "SMSTUNNEL_API_KEY": "<your key>" } }

More: https://github.com/narcisbodea/smstunnel-mcp#readme
`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

const config = loadConfig(process.env);
for (const problem of config.problems) console.error(`smstunnel-mcp: ${problem}`);

const handle = serveStdio(() => createServer(config), {
  onerror: (error) => console.error(`smstunnel-mcp: ${error.message}`),
});

console.error(
  `smstunnel-mcp ${VERSION} is running on stdio` +
    (config.serverUrl !== 'https://smstunnel.io' ? ` (SMSTunnel at ${config.serverUrl})` : '') +
    (config.problems.length ? '; tool calls will explain the settings problem above.' : '.'),
);

let closing = false;
function shutdown(): void {
  if (closing) return;
  closing = true;
  handle
    .close()
    .catch(() => undefined)
    .finally(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
