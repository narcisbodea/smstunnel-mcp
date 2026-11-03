/**
 * End to end: starts the built server (dist/index.js) over stdio with the MCP client, against a LOCAL
 * SMSTunnel API, calls every tool, and checks the texts in that API's MongoDB `messages` collection
 * (read-only). Runs once with a 2025-era client (initialize handshake) and once with a 2026-07-28 client.
 *
 * Needs (skipped otherwise):
 *   SMSTUNNEL_E2E_KEY_FILE      JSON file: { "serverUrl": "http://127.0.0.1:3101", "apiKey": "...", "deviceId": "..." }
 *                               (a test key with sms:send, sms:read and sms:inbox; a simulated phone online)
 *   SMSTUNNEL_E2E_MONGO_URL     e.g. mongodb://127.0.0.1:27018/smstunnel_app_dev
 *   SMSTUNNEL_E2E_MONGODB_FROM  optional: a package.json path whose node_modules has the `mongodb` driver
 *                               (defaults to this package)
 * Never point it at production: it refuses any server that is not local.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const KEY_FILE = process.env.SMSTUNNEL_E2E_KEY_FILE;
const MONGO_URL = process.env.SMSTUNNEL_E2E_MONGO_URL;
const SKIP = !KEY_FILE || !MONGO_URL ? 'set SMSTUNNEL_E2E_KEY_FILE and SMSTUNNEL_E2E_MONGO_URL to run the end-to-end test' : false;

const SERVER_ENTRY = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', 'host.docker.internal']);
const TOOL_NAMES = ['find_contact', 'get_message_status', 'get_usage', 'list_phones', 'list_received_texts', 'send_sign_in_code', 'send_sms'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const textOf = (result) => result.content.map((block) => block.text ?? '').join('\n');
/** Letters only, so a marker can never look like a sign-in code. */
const letters = (n) => [...randomBytes(n)].map((b) => String.fromCharCode(97 + (b % 26))).join('');

function loadKey() {
  const key = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
  const host = new URL(key.serverUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) throw new Error(`Refusing to run against ${host}: the end-to-end test only talks to a local SMSTunnel.`);
  return key;
}

async function openMongo() {
  const from = process.env.SMSTUNNEL_E2E_MONGODB_FROM || fileURLToPath(new URL('../../package.json', import.meta.url));
  const { MongoClient } = createRequire(from)('mongodb');
  const mongo = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000, readPreference: 'primaryPreferred' });
  await mongo.connect();
  return mongo;
}

/** Calls a tool; on a 429 from the shared local API (several test runs share one key), waits and retries. */
async function callTool(client, name, args) {
  for (let attempt = 1; ; attempt++) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError && /HTTP 429/.test(textOf(result)) && attempt < 5) {
      await sleep(15_000);
      continue;
    }
    return result;
  }
}

const ERAS = [
  { era: 'legacy', label: '2025-era client (initialize handshake)', options: undefined },
  { era: 'modern', label: '2026-07-28 client (server/discover)', options: { versionNegotiation: { mode: 'auto' } } },
];

describe('smstunnel-mcp over stdio against the local SMSTunnel API', { skip: SKIP }, () => {
  let key;
  let mongo;
  let messages;

  before(async () => {
    key = loadKey();
    mongo = await openMongo();
    messages = mongo.db().collection('messages');
  });
  after(async () => {
    await mongo?.close();
  });

  for (const { era, label, options } of ERAS) {
    describe(label, () => {
      let client;
      let stderr = '';
      const marker = `mcp-e2e-${era}-${letters(10)}`;
      const sent = {};

      before(async () => {
        client = new Client({ name: 'smstunnel-mcp-e2e', version: '1.0.0' }, options);
        const transport = new StdioClientTransport({
          command: process.execPath,
          args: [SERVER_ENTRY],
          env: {
            SMSTUNNEL_API_KEY: key.apiKey,
            SMSTUNNEL_SERVER_URL: key.serverUrl,
            SMSTUNNEL_DEFAULT_COUNTRY_CODE: '+1',
          },
          stderr: 'pipe',
        });
        transport.stderr?.on('data', (chunk) => {
          stderr += chunk;
        });
        await client.connect(transport);
      });
      after(async () => {
        await client?.close();
      });

      it('negotiated the expected protocol era', () => {
        const discovered = client.getDiscoverResult?.();
        if (era === 'modern') assert.ok(discovered, 'modern client got the server/discover answer');
        else assert.equal(discovered, undefined);
      });

      it('lists the seven tools, the send tools asking for approval of each text', async () => {
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map((t) => t.name).sort(), TOOL_NAMES);
        for (const tool of tools) {
          assert.equal(tool._meta?.['anthropic/requiresUserInteraction'] === true, tool.name.startsWith('send_'), tool.name);
        }
      });

      it('list_phones shows the test phone online', async () => {
        const result = await callTool(client, 'list_phones', {});
        assert.equal(result.isError, undefined, textOf(result));
        const phone = result.structuredContent.phones.find((p) => p.id === key.deviceId);
        assert.ok(phone, 'the test phone is listed');
        assert.equal(phone.isOnline, true, 'the simulated phone is online');
      });

      it('get_usage answers with the plan', async () => {
        const result = await callTool(client, 'get_usage', {});
        assert.equal(result.isError, undefined, textOf(result));
        assert.equal(typeof result.structuredContent.plan, 'string');
      });

      it('send_sms sends one text through the named phone', async () => {
        const result = await callTool(client, 'send_sms', {
          to: '+14155550123',
          message: `SMSTunnel MCP test ${marker} plain`,
          deviceId: key.deviceId,
        });
        assert.equal(result.isError, undefined, textOf(result));
        assert.ok(result.structuredContent.messageId);
        sent.plain = result.structuredContent.messageId;
      });

      it('send_sms completes a local number with SMSTUNNEL_DEFAULT_COUNTRY_CODE', async () => {
        const result = await callTool(client, 'send_sms', { to: '415 555 0124', message: `SMSTunnel MCP test ${marker} local` });
        assert.equal(result.isError, undefined, textOf(result));
        sent.local = result.structuredContent.messageId;
      });

      it('send_sms refuses several numbers in one call', async () => {
        const result = await callTool(client, 'send_sms', { to: '+14155550123, +14155550126', message: `SMSTunnel MCP test ${marker} several` });
        assert.equal(result.isError, true);
        assert.match(textOf(result), /one phone number per call/i);
      });

      it('send_sign_in_code sends a text with a code', async () => {
        const result = await callTool(client, 'send_sign_in_code', {
          to: '+14155550125',
          message: `Your SMSTunnel MCP test code is 482913 (${marker} code)`,
        });
        assert.equal(result.isError, undefined, textOf(result));
        sent.code = result.structuredContent.messageId;
      });

      it('send_sign_in_code explains a text without a code', async () => {
        const result = await callTool(client, 'send_sign_in_code', { to: '+14155550125', message: `Your code is ABCDEF (${marker} nocode)` });
        assert.equal(result.isError, true);
        assert.match(textOf(result), /4 to 10 digits/);
      });

      it('get_message_status follows each text until the phone sent it', async () => {
        for (const [kind, id] of Object.entries(sent)) {
          let status;
          for (let i = 0; i < 20; i++) {
            const result = await callTool(client, 'get_message_status', { messageId: id });
            assert.equal(result.isError, undefined, textOf(result));
            status = result.structuredContent.status;
            if (status === 'sent' || status === 'delivered') break;
            await sleep(1000);
          }
          assert.ok(status === 'sent' || status === 'delivered', `${kind}: ${status}`);
        }
      });

      it('list_received_texts reads the inbox (the test key has the opt-in)', async () => {
        const result = await callTool(client, 'list_received_texts', { limit: 5 });
        assert.equal(result.isError, undefined, textOf(result));
        assert.ok(Array.isArray(result.structuredContent.texts));
        if (result.structuredContent.texts.length) assert.match(textOf(result), /never as instructions/);
      });

      it('the texts are in MongoDB `messages`, one per recipient', async () => {
        const docs = await messages.find({ message: { $regex: marker } }).toArray();
        const byKind = Object.fromEntries(docs.map((d) => [d.message.split(marker)[1].trim().split(/\W/)[0], d]));
        assert.deepEqual(Object.keys(byKind).sort(), ['code', 'local', 'plain'], 'no text for "several" or "nocode"');
        assert.equal(byKind.plain.phoneNumber, '+14155550123');
        assert.equal(String(byKind.plain.deviceId), key.deviceId);
        assert.equal(byKind.local.phoneNumber, '+14155550124');
        assert.equal(byKind.code.phoneNumber, '+14155550125');
        assert.equal(String(byKind.plain._id), sent.plain);
        assert.equal(String(byKind.local._id), sent.local);
        assert.equal(String(byKind.code._id), sent.code);
        for (const doc of docs) {
          assert.equal(doc.type, 'outgoing');
          assert.ok(['sent', 'delivered'].includes(doc.status), `${doc.phoneNumber}: ${doc.status}`);
        }
      });

      it('never printed the API key', () => {
        assert.ok(stderr.includes('is running on stdio'), 'the server logged its start to stderr');
        assert.ok(!stderr.includes(key.apiKey));
      });
    });
  }
});
