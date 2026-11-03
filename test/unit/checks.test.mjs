import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkDeviceId, checkName, checkRecipient, checkText, clean, cleanTime } from '../../dist/checks.js';

describe('checkName', () => {
  it('trims the name and takes 2 to 60 characters', () => {
    assert.deepEqual(checkName('  Ana \n Pop '), { ok: true, value: 'Ana Pop' });
    assert.deepEqual(checkName('Ș'.repeat(60)), { ok: true, value: 'Ș'.repeat(60) });
    assert.equal(checkName('😀'.repeat(60)).ok, true, 'counted in characters');
    for (const bad of ['', '  ', 'A', ' b ', '😀', undefined, null, 42]) {
      const refused = checkName(bad);
      assert.equal(refused.ok, false, String(bad));
      assert.match(refused.error, /at least 2 characters/);
    }
    assert.match(checkName('x'.repeat(61)).error, /61 characters; the limit is 60/);
  });
});

describe('checkRecipient', () => {
  it('accepts one international number', () => {
    assert.deepEqual(checkRecipient('+14155550123', undefined), { ok: true, value: '+14155550123' });
    assert.equal(checkRecipient(' +1 (415) 555-0123 ', undefined).ok, true);
    assert.equal(checkRecipient('0040 712 345 678', undefined).ok, true);
  });

  it('needs a country code for a local number', () => {
    const refused = checkRecipient('(415) 555-0123', undefined);
    assert.equal(refused.ok, false);
    assert.match(refused.error, /no country code/);
    assert.match(refused.error, /defaultCountryCode/);
    assert.equal(checkRecipient('(415) 555-0123', '+1').ok, true);
  });

  it('refuses several numbers in one call', () => {
    for (const several of ['+14155550123, +14155550124', '+14155550123;+14155550124', '+14155550123 +14155550124', '+14155550123 and +14155550124', '+14155550123\n+14155550124']) {
      const result = checkRecipient(several, '+1');
      assert.equal(result.ok, false, several);
      assert.match(result.error, /one phone number per call/i, several);
    }
  });

  it('refuses things that are not phone numbers', () => {
    for (const bad of ['', '   ', 'John', '+1415555012a', '+123', '+1234567890123456', 42, null]) {
      assert.equal(checkRecipient(bad, '+1').ok, false, String(bad));
    }
  });
});

describe('checkText', () => {
  it('counts characters as the server does', () => {
    assert.equal(checkText('a'.repeat(1600), 1600).ok, true);
    assert.equal(checkText('a'.repeat(1601), 1600).ok, false);
    assert.equal(checkText('😀'.repeat(1600), 1600).ok, true);
    assert.equal(checkText('😀'.repeat(1601), 1600).ok, false);
    assert.match(checkText('a'.repeat(321), 320).error, /321 characters; the limit is 320/);
  });

  it('refuses an empty text', () => {
    assert.equal(checkText('', 1600).ok, false);
    assert.equal(checkText('  \n ', 1600).ok, false);
    assert.equal(checkText(undefined, 1600).ok, false);
  });
});

describe('checkDeviceId', () => {
  it('accepts an id or nothing', () => {
    assert.deepEqual(checkDeviceId(undefined), { ok: true, value: undefined });
    assert.deepEqual(checkDeviceId(''), { ok: true, value: undefined });
    assert.deepEqual(checkDeviceId(' 6ae660e96609f21a1184a210 '), { ok: true, value: '6ae660e96609f21a1184a210' });
    assert.equal(checkDeviceId('a b').ok, false);
    assert.equal(checkDeviceId('x'.repeat(65)).ok, false);
  });
});

describe('clean', () => {
  it('removes control characters and hidden marks, and caps the length', () => {
    assert.equal(clean('Store\nphone\u0007'), 'Store phone');
    assert.equal(clean('a‮b​c﻿d'), 'a b c d');
    assert.equal(clean('x'.repeat(10), 5), 'xxxxx…');
    assert.equal(clean(null), '');
    assert.equal(clean(12), '12');
  });

  it('reads times as ISO', () => {
    assert.equal(cleanTime('2026-11-01T20:51:09.526Z'), '2026-11-01T20:51:09.526Z');
    assert.equal(cleanTime('nope'), undefined);
    assert.equal(cleanTime(null), undefined);
  });
});
