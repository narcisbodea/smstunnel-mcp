import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkDeviceId,
  checkName,
  checkRecipient,
  checkScheduledId,
  checkSendAt,
  checkText,
  clean,
  cleanTime,
} from '../../dist/checks.js';

describe('checkSendAt', () => {
  it('takes ISO 8601 with its offset and gives it in UTC, as toISOString()', () => {
    for (const [given, sent] of [
      ['2026-11-16T09:00:00+02:00', '2026-11-16T07:00:00.000Z'],
      ['2026-11-16T09:00Z', '2026-11-16T09:00:00.000Z'],
      ['2026-11-16T09:00:00.5-05:00', '2026-11-16T14:00:00.500Z'],
      [' 2026-11-16 09:00:00.123456+0530 ', '2026-11-16T03:30:00.123Z'],
      ['2026-11-16t09:00:00z', '2026-11-16T09:00:00.000Z'],
      ['2026-11-16T09:00:00-03', '2026-11-16T12:00:00.000Z'],
      ['2028-02-29T00:30:00+01:00', '2028-02-28T23:30:00.000Z'],
    ]) {
      assert.deepEqual(checkSendAt(given), { ok: true, value: sent }, given);
    }
  });

  it('is not set when left out or empty', () => {
    for (const nothing of [undefined, null, '', '   ']) assert.deepEqual(checkSendAt(nothing), { ok: true, value: undefined });
  });

  it('refuses a time without its offset, or that is not a real time', () => {
    const noOffset = checkSendAt('2026-11-16T09:00:00');
    assert.equal(noOffset.ok, false);
    assert.match(noOffset.error, /has no offset\. Add the offset of the user's time zone, such as "2026-11-16T09:00:00\+02:00"/);
    for (const bad of ['2026-11-16T09:00', '2026-02-30T09:00:00Z', '2026-11-16T24:00:00Z', '2026-11-16T09:00:60Z', '2026-11-16T09:00:00+24:00']) {
      assert.equal(checkSendAt(bad).ok, false, bad);
    }
    assert.match(checkSendAt('2026-02-30T09:00:00Z').error, /is not a real date and time/);
    for (const bad of ['2026-11-16', 'tomorrow 9:00', '16/11/2026 09:00+02:00', '2026-11-16T09:00:00‮', 1794812400000, {}, true]) {
      const refused = checkSendAt(bad);
      assert.equal(refused.ok, false, String(bad));
      assert.match(refused.error, /^send_at must be a date and time in ISO 8601 with the offset of the user's time zone/);
    }
  });
});

describe('checkScheduledId', () => {
  it('accepts an ID and trims it, and refuses anything else', () => {
    assert.deepEqual(checkScheduledId(' 6735a0c4e1d9e1b7b54cf994 '), { ok: true, value: '6735a0c4e1d9e1b7b54cf994' });
    for (const bad of ['', ' ', 'a/b', 'a b', 'x'.repeat(65), undefined, 42]) {
      assert.equal(checkScheduledId(bad).ok, false, String(bad));
    }
  });
});

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
