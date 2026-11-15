/**
 * Checks on what the assistant passes in, and clean-up of what SMSTunnel sends back before a model reads it.
 */

export const MAX_TEXT_LENGTH = 1600; // 10 SMS parts, SMSTunnel's limit for /sms/send
export const MAX_CODE_TEXT_LENGTH = 320; // SMSTunnel's limit for /sms/send-2fa
export const MIN_NAME_LENGTH = 2; // SMSTunnel's /names/find refuses shorter searches (QUERY_TOO_SHORT)
export const MAX_NAME_LENGTH = 60; // and longer ones

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

const PHONE_CHARS = /^\+?[0-9\s.\-()]+$/;

/**
 * One recipient's number. International numbers (+ or 00 and the country code) always pass; a number
 * without one passes only when a default country code is known, so SMSTunnel never has to guess a country.
 */
export function checkRecipient(raw: unknown, countryCode: string | undefined): Check<string> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Give the phone number of the person who should get the text.' };
  }
  const to = raw.trim();
  if (/[,;\n\r]|\s(?:and|or|&)\s/i.test(to) || (to.match(/\+/g)?.length ?? 0) > 1) {
    return {
      ok: false,
      error: 'Give one phone number per call. To text several people, send one text to each number, one call at a time.',
    };
  }
  if (!PHONE_CHARS.test(to)) {
    return {
      ok: false,
      error: `"${preview(to)}" is not a phone number. Use digits, with + and the country code (for example +14155550123).`,
    };
  }
  const compact = to.replace(/[\s.\-()]/g, '');
  const international = compact.startsWith('+') || compact.startsWith('00');
  const digits = compact.replace(/^\+|^00/, '');
  if (international ? digits.length < 7 || digits.length > 15 : digits.length < 6 || digits.length > 14) {
    return {
      ok: false,
      error: `"${preview(to)}" has ${digits.length} digits; a phone number with its country code has 7 to 15.`,
    };
  }
  if (!international && !countryCode) {
    return {
      ok: false,
      error:
        `"${preview(to)}" has no country code. Write it with + and the country code (for example +14155550123), ` +
        'or pass defaultCountryCode (for example "+1") if you know which country the number is from. ' +
        'Ask the user when you are not sure.',
    };
  }
  return { ok: true, value: to };
}

/** The words of a text: not empty, and within SMSTunnel's limit (counted in characters, as the server does). */
export function checkText(raw: unknown, max: number): Check<string> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'The text is empty. Give the words to send.' };
  }
  const length = [...raw].length;
  if (length > max) {
    return { ok: false, error: `The text has ${length} characters; the limit is ${max}. Shorten it.` };
  }
  return { ok: true, value: raw };
}

/** A person's name, or part of it, to look up: trimmed, 2 to 60 characters (counted as the server does). */
export function checkName(raw: unknown): Check<string> {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  const length = [...name].length;
  if (length < MIN_NAME_LENGTH) {
    return {
      ok: false,
      error: `Give at least ${MIN_NAME_LENGTH} characters of the person's name, or ask the user for the number.`,
    };
  }
  if (length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `The name has ${length} characters; the limit is ${MAX_NAME_LENGTH}. Give only the person's name.`,
    };
  }
  return { ok: true, value: name };
}

/** An optional phone ID (deviceId) from a tool call. */
export function checkDeviceId(raw: unknown): Check<string | undefined> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: undefined };
  if (typeof raw === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.trim())) return { ok: true, value: raw.trim() };
  return { ok: false, error: 'deviceId is not a phone ID. Use an id from list_phones, or leave it out.' };
}

/** The ID of a scheduled text (scheduledId from send_sms or list_scheduled_texts). */
export function checkScheduledId(raw: unknown): Check<string> {
  if (typeof raw === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.trim())) return { ok: true, value: raw.trim() };
  return { ok: false, error: 'scheduledId is not the ID of a scheduled text. Use a scheduledId from send_sms or list_scheduled_texts.' };
}

// YYYY-MM-DD, T (or a space), hh:mm, optional :ss and a fraction, then the offset: Z, ±hh:mm, ±hhmm or ±hh.
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?(?:([Zz])|([+-])(\d{2})(?::?(\d{2}))?)?$/;
const SEND_AT_EXAMPLE = '"2026-11-16T09:00:00+02:00"';

/**
 * send_at: an ISO 8601 date and time with its offset, as SMSTunnel's sendAt (it is sent as toISOString(), UTC), or
 * undefined when the text goes out now. A time without its offset is refused: it would be read in some other time
 * zone. So is a date that doesn't exist, such as 30 February (new Date() would turn it into 2 March). Whether it is
 * 1 minute to 30 days ahead is left to SMSTunnel, whose clock decides.
 */
export function checkSendAt(raw: unknown): Check<string | undefined> {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, value: undefined };
  const parts = typeof raw === 'string' ? ISO_DATE_TIME.exec(raw.trim()) : null;
  if (!parts) {
    return {
      ok: false,
      error: `send_at must be a date and time in ISO 8601 with the offset of the user's time zone, such as ${SEND_AT_EXAMPLE}.`,
    };
  }
  const shown = JSON.stringify(clean(raw, 40));
  const [, year, month, day, hour, minute, second = '00', fraction = '', zulu, sign, offsetHours = '00', offsetMinutes = '00'] =
    parts;
  if (!zulu && !sign) {
    return {
      ok: false,
      error:
        `send_at ${shown} has no offset. Add the offset of the user's time zone, such as ${SEND_AT_EXAMPLE} ` +
        "(or Z for UTC), so the text goes out at the time the user means; ask the user when you don't know their time zone.",
    };
  }
  const wall = `${year}-${month}-${day}T${hour}:${minute}:${second}.${(fraction + '000').slice(0, 3)}Z`;
  const at = Date.parse(wall);
  if (Number.isNaN(at) || new Date(at).toISOString() !== wall || Number(offsetHours) > 23 || Number(offsetMinutes) > 59) {
    return { ok: false, error: `send_at ${shown} is not a real date and time. Use one such as ${SEND_AT_EXAMPLE}.` };
  }
  const offset = sign ? (sign === '-' ? -1 : 1) * (Number(offsetHours) * 60 + Number(offsetMinutes)) : 0;
  return { ok: true, value: new Date(at - offset * 60_000).toISOString() };
}

// Control characters, plus the Unicode marks that can hide or reorder text (bidi overrides, zero-width).
const HIDDEN_CHARS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]+/g;

/**
 * Text that came from SMSTunnel (phone names, received texts, error messages) before a model reads it:
 * no control characters or hidden marks (line breaks become spaces), and a length cap.
 */
export function clean(value: unknown, maxLength = 200): string {
  const text = String(value ?? '')
    .replace(HIDDEN_CHARS, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  const chars = [...text];
  return chars.length > maxLength ? chars.slice(0, maxLength).join('') + '…' : text;
}

/** An ISO time from SMSTunnel, or undefined when it is missing or unreadable. */
export function cleanTime(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

function preview(value: string): string {
  return clean(value, 40);
}
