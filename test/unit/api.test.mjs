import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SmsTunnelApi, SmsTunnelApiError } from '../../dist/api.js';
import { VERSION } from '../../dist/version.js';
import { FAKE_KEY, fakeFetch, json } from '../helpers.mjs';

function api(routes, timeoutMs = 2000) {
  const fake = fakeFetch(routes);
  return { client: new SmsTunnelApi({ apiKey: FAKE_KEY, serverUrl: 'https://smstunnel.test/', timeoutMs, fetch: fake.fetch }), calls: fake.calls };
}

async function errorOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('expected an error');
}

describe('SmsTunnelApi requests', () => {
  it('sends one text with the key in X-API-Key and no empty fields', async () => {
    const { client, calls } = api({ 'POST /api/v1/sms/send': [200, { success: true, messageId: 'm1', data: { messageId: 'm1' } }] });
    const res = await client.sendText({ to: '+14155550123', message: 'Hello' });
    assert.equal(res.messageId, 'm1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.href, 'https://smstunnel.test/api/v1/sms/send');
    assert.equal(calls[0].headers['X-API-Key'], FAKE_KEY);
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
    assert.equal(calls[0].headers['User-Agent'], `smstunnel-mcp/${VERSION}`);
    assert.deepEqual(calls[0].body, { to: '+14155550123', message: 'Hello' });
  });

  it('passes deviceId and defaultCountryCode when given', async () => {
    const { client, calls } = api({ 'POST /api/v1/sms/send-2fa': [200, { success: true, messageId: 'm2' }] });
    await client.sendSignInCode({ to: '4155550123', message: 'Code 482913', deviceId: 'd1', defaultCountryCode: '+1' });
    assert.equal(calls[0].url.pathname, '/api/v1/sms/send-2fa');
    assert.deepEqual(calls[0].body, { to: '4155550123', message: 'Code 482913', deviceId: 'd1', defaultCountryCode: '+1' });
  });

  it('builds the status, phones, usage and received-texts paths', async () => {
    const { client, calls } = api({
      'GET /api/v1/sms/status/a%2Fb': [200, { success: true, data: { id: 'a/b', phoneNumber: '+1', status: 'sent' } }],
      'GET /api/v1/devices': [200, { success: true, data: { devices: [], online: 0, total: 0 } }],
      'GET /api/v1/account/usage': [200, { success: true, data: { plan: 'free' } }],
      'GET /api/v1/sms/received': [200, { success: true, data: { messages: [], total: 0, page: 1, limit: 5, hasMore: false } }],
    });
    await client.getMessageStatus('a/b');
    await client.listPhones();
    await client.getUsage();
    await client.listReceivedTexts({ limit: 5, page: 2, since: '2026-11-01T00:00:00.000Z', phone: '+40712', deviceId: 'd1' });
    assert.equal(calls[0].url.pathname, '/api/v1/sms/status/a%2Fb');
    assert.equal(calls[1].url.pathname, '/api/v1/devices');
    assert.equal(calls[2].url.pathname, '/api/v1/account/usage');
    assert.deepEqual(Object.fromEntries(calls[3].url.searchParams), {
      limit: '5',
      page: '2',
      since: '2026-11-01T00:00:00.000Z',
      phone: '+40712',
      deviceId: 'd1',
    });
    for (const call of calls.slice(0, 4)) assert.equal(call.headers['Content-Type'], undefined, 'GET has no body');
  });

  it('posts a name lookup to /names/find, with the search word in the body and never in the URL', async () => {
    const { client, calls } = api({ 'POST /api/v1/names/find': [200, { items: [{ name: 'Ana Pop', number: '+40722123456' }], more: false }] });
    const res = await client.findNames({ q: 'Ana Pop', limit: 5 });
    await client.findNames({ q: 'Ștefan' });
    assert.deepEqual(res, { items: [{ name: 'Ana Pop', number: '+40722123456' }], more: false });
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].url.href, 'https://smstunnel.test/api/v1/names/find');
    assert.equal(calls[0].headers['X-API-Key'], FAKE_KEY);
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
    assert.deepEqual(calls[0].body, { q: 'Ana Pop', limit: 5 });
    assert.deepEqual(calls[1].body, { q: 'Ștefan' }, 'limit only when given');
    for (const call of calls) assert.ok(!call.url.href.includes('Ana') && !decodeURIComponent(call.url.href).includes('Ștefan'));
  });
});

describe('SmsTunnelApi errors', () => {
  it('carries status, code and permission from the error body', async () => {
    const { client } = api({
      'GET /api/v1/sms/received': [403, { statusCode: 403, error: 'Forbidden', code: 'PERMISSION_REQUIRED', permission: 'sms:inbox', message: 'This API key may not read received texts.' }],
    });
    const error = await errorOf(client.listReceivedTexts());
    assert.ok(error instanceof SmsTunnelApiError);
    assert.equal(error.status, 403);
    assert.equal(error.code, 'PERMISSION_REQUIRED');
    assert.equal(error.permission, 'sms:inbox');
    assert.match(error.message, /may not read received texts/);
  });

  it('carries the name lookup codes', async () => {
    const answers = {
      a: [403, { statusCode: 403, error: 'Forbidden', code: 'NAMES_NOT_ALLOWED', message: 'This API key may not look up names.' }],
      b: [404, { statusCode: 404, error: 'Not Found', message: 'Cannot POST /api/v1/names/find' }],
      c: [400, { statusCode: 400, error: 'Bad Request', code: 'QUERY_TOO_SHORT', message: ['q must be at least 2 characters'] }],
      d: [429, { statusCode: 429, code: 'NAMES_LOOKUP_LIMIT', message: 'Too many name lookups for this key.' }],
    };
    const { client } = api({ 'POST /api/v1/names/find': (call) => answers[call.body.q] });
    const e403 = await errorOf(client.findNames({ q: 'a' }));
    assert.deepEqual([e403.status, e403.code, e403.message], [403, 'NAMES_NOT_ALLOWED', 'This API key may not look up names.']);
    const e404 = await errorOf(client.findNames({ q: 'b' }));
    assert.deepEqual([e404.status, e404.code], [404, undefined]);
    const e400 = await errorOf(client.findNames({ q: 'c' }));
    assert.deepEqual([e400.status, e400.code, e400.message], [400, 'QUERY_TOO_SHORT', 'q must be at least 2 characters']);
    const e429 = await errorOf(client.findNames({ q: 'd' }));
    assert.deepEqual([e429.status, e429.code], [429, 'NAMES_LOOKUP_LIMIT']);
  });

  it('reads every error body shape', async () => {
    const { client } = api({
      'POST /api/v1/sms/send': [401, { message: 'Invalid or expired API key', error: 'Unauthorized', statusCode: 401 }],
      'POST /api/v1/sms/send-2fa': [400, { message: ['to must be a string', 'message too long'], statusCode: 400 }],
      'GET /api/v1/devices': [429, 'ThrottlerException: Too Many Requests'],
      'GET /api/v1/account/usage': [502, '<html>Bad gateway</html>'],
    });
    const e401 = await errorOf(client.sendText({ to: '+1', message: 'x' }));
    assert.equal(e401.status, 401);
    assert.equal(e401.message, 'Invalid or expired API key');
    const e400 = await errorOf(client.sendSignInCode({ to: '+1', message: 'x' }));
    assert.equal(e400.message, 'to must be a string; message too long');
    const e429 = await errorOf(client.listPhones());
    assert.equal(e429.status, 429);
    assert.match(e429.message, /Too Many Requests/);
    const e502 = await errorOf(client.getUsage());
    assert.equal(e502.status, 502);
  });

  it('treats success:false and non-JSON answers as errors', async () => {
    const { client } = api({
      'POST /api/v1/sms/send': [200, { success: false, error: 'Invite not found or expired' }],
      'GET /api/v1/devices': [200, 'not json'],
    });
    const failed = await errorOf(client.sendText({ to: '+1', message: 'x' }));
    assert.equal(failed.message, 'Invite not found or expired');
    const notJson = await errorOf(client.listPhones());
    assert.equal(notJson.code, 'BAD_RESPONSE');
  });

  it('reports network failures and timeouts without the key', async () => {
    const refused = new SmsTunnelApi({
      apiKey: FAKE_KEY,
      serverUrl: 'https://smstunnel.test',
      timeoutMs: 2000,
      fetch: async () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
      },
    });
    const network = await errorOf(refused.listPhones());
    assert.equal(network.status, 0);
    assert.equal(network.code, 'NETWORK');
    assert.match(network.message, /ECONNREFUSED/);

    const slow = new SmsTunnelApi({
      apiKey: FAKE_KEY,
      serverUrl: 'https://smstunnel.test',
      timeoutMs: 50,
      fetch: (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    });
    const timeout = await errorOf(slow.sendText({ to: '+1', message: 'x' }));
    assert.equal(timeout.code, 'TIMEOUT');

    for (const error of [network, timeout]) {
      assert.ok(!error.message.includes(FAKE_KEY));
      assert.ok(!JSON.stringify(error).includes(FAKE_KEY));
    }
  });

  it('never puts the key in an error, whatever the server answers', async () => {
    const { client } = api({ 'GET /api/v1/devices': () => json(500, { message: 'Internal server error' }) });
    const error = await errorOf(client.listPhones());
    assert.ok(!error.message.includes(FAKE_KEY));
    assert.ok(!String(error.stack).includes(FAKE_KEY));
  });
});
