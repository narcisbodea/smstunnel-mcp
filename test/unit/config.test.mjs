import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleanCountryCode, loadConfig, parseServerUrl } from '../../dist/config.js';

describe('loadConfig', () => {
  it('reports a missing key in words and keeps the server usable for tools/list', () => {
    const config = loadConfig({});
    assert.equal(config.apiKey, undefined);
    assert.equal(config.serverUrl, 'https://smstunnel.io');
    assert.equal(config.problems.length, 1);
    assert.match(config.problems[0], /SMSTUNNEL_API_KEY is not set/);
    assert.match(config.problems[0], /Apps → Add an app/);
  });

  it('accepts a key and trims it', () => {
    const config = loadConfig({ SMSTUNNEL_API_KEY: '  sk_live_abc  ' });
    assert.equal(config.apiKey, 'sk_live_abc');
    assert.deepEqual(config.problems, []);
  });

  it('refuses a key with spaces inside, without repeating the key', () => {
    const config = loadConfig({ SMSTUNNEL_API_KEY: 'sk_live_abc def' });
    assert.equal(config.apiKey, undefined);
    assert.match(config.problems[0], /spaces or line breaks/);
    assert.ok(!config.problems[0].includes('sk_live_abc'));
  });

  it('reads the optional phone and country code', () => {
    const config = loadConfig({
      SMSTUNNEL_API_KEY: 'k',
      SMSTUNNEL_DEVICE_ID: '6ae660e96609f21a1184a210',
      SMSTUNNEL_DEFAULT_COUNTRY_CODE: '0040',
    });
    assert.equal(config.deviceId, '6ae660e96609f21a1184a210');
    assert.equal(config.defaultCountryCode, '+40');
    assert.deepEqual(config.problems, []);
  });

  it('reports a bad phone ID and a bad country code', () => {
    const config = loadConfig({ SMSTUNNEL_API_KEY: 'k', SMSTUNNEL_DEVICE_ID: 'not an id!', SMSTUNNEL_DEFAULT_COUNTRY_CODE: 'RO' });
    assert.equal(config.deviceId, undefined);
    assert.equal(config.defaultCountryCode, undefined);
    assert.equal(config.problems.length, 2);
    assert.match(config.problems.join(' '), /SMSTUNNEL_DEVICE_ID/);
    assert.match(config.problems.join(' '), /SMSTUNNEL_DEFAULT_COUNTRY_CODE/);
  });
});

describe('parseServerUrl', () => {
  it('keeps https origins and strips a trailing /api/v1', () => {
    assert.equal(parseServerUrl('https://smstunnel.io'), 'https://smstunnel.io');
    assert.equal(parseServerUrl('https://smstunnel.io/'), 'https://smstunnel.io');
    assert.equal(parseServerUrl('https://smstunnel.io/api/v1/'), 'https://smstunnel.io');
  });

  it('allows plain http only for local test servers', () => {
    assert.equal(parseServerUrl('http://127.0.0.1:3101'), 'http://127.0.0.1:3101');
    assert.equal(parseServerUrl('http://localhost:3101/'), 'http://localhost:3101');
    assert.equal(parseServerUrl('http://host.docker.internal:3101'), 'http://host.docker.internal:3101');
    assert.equal(parseServerUrl('http://[::1]:3101'), 'http://[::1]:3101');
    for (const bad of ['http://smstunnel.io', 'http://192.168.1.10:3101', 'ftp://smstunnel.io']) {
      assert.equal(typeof parseServerUrl(bad), 'object', bad);
    }
  });

  it('refuses credentials, queries and non-URLs', () => {
    for (const bad of ['https://user:pw@smstunnel.io', 'https://smstunnel.io/?x=1', 'https://smstunnel.io/#a', 'smstunnel.io']) {
      assert.equal(typeof parseServerUrl(bad), 'object', bad);
    }
  });
});

describe('cleanCountryCode', () => {
  it('reads codes the way the SMSTunnel server does', () => {
    assert.equal(cleanCountryCode('40'), '+40');
    assert.equal(cleanCountryCode('+49'), '+49');
    assert.equal(cleanCountryCode('0049'), '+49');
    assert.equal(cleanCountryCode(' +1 '), '+1');
    assert.equal(cleanCountryCode('+1268'), '+1268');
    for (const bad of ['RO', '+0', '', '12345', '+', 40]) assert.equal(cleanCountryCode(bad), undefined, String(bad));
  });
});
