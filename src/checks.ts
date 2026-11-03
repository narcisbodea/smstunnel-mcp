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
