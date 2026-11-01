/**
 * Input validation and output sanitization helpers.
 */

const E164 = /^\+[1-9]\d{6,14}$/;
const MAX_MESSAGE_LENGTH = 1600;

// Matches ASCII control characters (0x00-0x1F and 0x7F) without embedding them in source.
const CONTROL_CHARS = new RegExp('[\\x00-\\x1F\\x7F]+', 'g');

/** Validate a phone number against E.164. Returns an error string or null if valid. */
export function validatePhone(to: unknown): string | null {
  if (typeof to !== 'string' || !E164.test(to.trim())) {
    return `Invalid phone number "${String(to)}". Use E.164 format, e.g. +40712345678.`;
  }
  return null;
}

/** Validate message body length/presence. Returns an error string or null if valid. */
export function validateMessage(message: unknown): string | null {
  if (typeof message !== 'string' || message.length === 0) {
    return 'Message body is required.';
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `Message too long (${message.length} chars). Maximum is ${MAX_MESSAGE_LENGTH}.`;
  }
  return null;
}

/**
 * Neutralize server-controlled strings before they are placed into LLM-facing text,
 * to reduce indirect prompt-injection (device names, error messages, etc.).
 * Strips control characters / newlines and caps length.
 */
export function sanitizeForLLM(value: unknown, maxLen = 200): string {
  const s = String(value ?? '');
  const cleaned = s.replace(CONTROL_CHARS, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned;
}
