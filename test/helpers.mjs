// Test helpers: a recording fake fetch, and an MCP client wired to the server in memory.
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';

import { createServer } from '../dist/server.js';

export const FAKE_KEY = 'sk_live_unit_test_key_0123456789abcdef';

/**
 * A fetch that answers from a list of routes and records every request.
 * routes: { 'POST /api/v1/sms/send': (req) => response | [status, body] , ... }
 */
export function fakeFetch(routes = {}) {
  const calls = [];
  async function fetch(url, init = {}) {
    const u = new URL(url);
    const key = `${init.method ?? 'GET'} ${u.pathname}`;
    const call = {
      url: u,
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes[key];
    if (!route) return json(404, { message: `No route for ${key}`, statusCode: 404 });
    const answer = typeof route === 'function' ? await route(call, init) : route;
    if (answer instanceof Response) return answer;
    const [status, body] = answer;
    return typeof body === 'string' ? new Response(body, { status }) : json(status, body);
  }
  return { fetch, calls };
}

export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function baseConfig(overrides = {}) {
  return {
    apiKey: FAKE_KEY,
    serverUrl: 'https://smstunnel.test',
    deviceId: undefined,
    defaultCountryCode: undefined,
    confirmEachText: true,
    timeoutMs: 2000,
    problems: [],
    ...overrides,
  };
}

/** Connects an MCP client to a fresh server instance over an in-memory transport pair. */
export async function connect(config = baseConfig(), routes = {}) {
  const fake = fakeFetch(routes);
  const server = createServer(config, { fetch: fake.fetch });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'unit-test', version: '0.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    calls: fake.calls,
    async call(name, args = {}) {
      return client.callTool({ name, arguments: args });
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}

export function textOf(result) {
  return result.content.map((block) => block.text ?? '').join('\n');
}
