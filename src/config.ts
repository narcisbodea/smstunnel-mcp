/**
 * Settings, read once from the environment of the MCP server process.
 *
 * Problems are collected instead of thrown: the server still starts and lists its tools (MCP directories
 * inspect servers without a key), and every tool call answers with the problem in words.
 */

export const DEFAULT_SERVER_URL = 'https://smstunnel.io';
export const DASHBOARD_APPS_URL = 'https://dashboard.smstunnel.io/apps';
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Plain http is allowed only for these hosts (a local test server); everything else must be https. */
const PLAIN_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']);

/** A phone's ID as the dashboard shows it (MongoDB ids are 24 hex characters; kept a little looser). */
const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface SmsTunnelConfig {
  /** Undefined when SMSTUNNEL_API_KEY is missing; see `problems`. */
  apiKey?: string;
  /** Origin of the SMSTunnel API, without a trailing slash, e.g. https://smstunnel.io */
  serverUrl: string;
  /** SMSTUNNEL_DEVICE_ID: the phone that sends when a call doesn't name one. */
  deviceId?: string;
  /** SMSTUNNEL_DEFAULT_COUNTRY_CODE, as "+<digits>". */
  defaultCountryCode?: string;
  timeoutMs: number;
  /** What is wrong with the settings, in words. Empty when everything is usable. */
  problems: string[];
}

export function loadConfig(env: Record<string, string | undefined> = process.env): SmsTunnelConfig {
  const problems: string[] = [];

  const rawKey = env.SMSTUNNEL_API_KEY?.trim() ?? '';
  let apiKey: string | undefined;
  if (!rawKey) {
    problems.push(
      `SMSTUNNEL_API_KEY is not set. Create a key in the SMSTunnel dashboard (${DASHBOARD_APPS_URL}: ` +
        'Apps → Add an app) and put it in the "env" of this server in your AI app\'s MCP settings.',
    );
  } else if (/\s/.test(rawKey)) {
    problems.push('SMSTUNNEL_API_KEY contains spaces or line breaks. Copy the key again, on one line.');
  } else {
    apiKey = rawKey;
  }

  let serverUrl = DEFAULT_SERVER_URL;
  const rawUrl = env.SMSTUNNEL_SERVER_URL?.trim();
  if (rawUrl) {
    const parsed = parseServerUrl(rawUrl);
    if (typeof parsed === 'string') serverUrl = parsed;
    else problems.push(parsed.problem);
  }

  const deviceId = env.SMSTUNNEL_DEVICE_ID?.trim() || undefined;
  if (deviceId && !DEVICE_ID.test(deviceId)) {
    problems.push(
      'SMSTUNNEL_DEVICE_ID is not a phone ID. Copy the ID from Phones in the SMSTunnel dashboard, or leave it empty.',
    );
  }

  let defaultCountryCode: string | undefined;
  const rawCountry = env.SMSTUNNEL_DEFAULT_COUNTRY_CODE?.trim();
  if (rawCountry) {
    defaultCountryCode = cleanCountryCode(rawCountry);
    if (!defaultCountryCode) {
      problems.push(
        'SMSTUNNEL_DEFAULT_COUNTRY_CODE must be a country calling code such as 40, +40 or 0040 (1 to 4 digits).',
      );
    }
  }

  return {
    apiKey,
    serverUrl,
    deviceId: deviceId && DEVICE_ID.test(deviceId) ? deviceId : undefined,
    defaultCountryCode,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    problems,
  };
}

/**
 * The origin to call. Accepts the bare origin, or one ending in /api/v1 (the old SMSTUNNEL_API_URL style).
 * Refuses plain http outside localhost, so the API key never travels unencrypted.
 */
export function parseServerUrl(raw: string): string | { problem: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { problem: `SMSTUNNEL_SERVER_URL is not a URL. Leave it empty to use ${DEFAULT_SERVER_URL}.` };
  }
  if (url.username || url.password || url.search || url.hash) {
    return { problem: 'SMSTUNNEL_SERVER_URL must not contain a user name, password, query or #fragment.' };
  }
  const plainHttpOk = url.protocol === 'http:' && PLAIN_HTTP_HOSTS.has(url.hostname.toLowerCase());
  if (url.protocol !== 'https:' && !plainHttpOk) {
    return {
      problem:
        'SMSTUNNEL_SERVER_URL must start with https:// (plain http only for localhost). ' +
        `Leave it empty to use ${DEFAULT_SERVER_URL}.`,
    };
  }
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  return `${url.origin}${path}`;
}

/**
 * A country calling code as "+<digits>", the way SMSTunnel reads it: "+49", "49", "0049" and " +1 " are
 * accepted, as is "+1268" (1 to 4 digits). Anything else gives undefined.
 * Mirrors cleanCountryCode() in the SMSTunnel server.
 */
export function cleanCountryCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let code = value.replace(/[\s\-().]/g, '');
  if (code.startsWith('00')) code = '+' + code.slice(2);
  else if (!code.startsWith('+')) code = '+' + code;
  return /^\+[1-9]\d{0,3}$/.test(code) ? code : undefined;
}
