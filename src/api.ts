/**
 * A small client for the SMSTunnel public API (https://smstunnel.io/api/v1), covering the calls this server
 * needs. Field names and error handling follow the official SDK (@narcisbodea/smstunnel-sdk, src/node and
 * src/shared/api-error.ts).
 *
 * The API key only ever goes into the X-API-Key header: it is never logged and never part of an error.
 */

import { VERSION } from './version.js';

// ─── Responses (as the API sends them) ───────────────────────────────────────

export interface SendResponse {
  success: boolean;
  messageId?: string;
  /** true when the phone was offline: it gets the text when it is back. */
  queued?: boolean;
  data?: {
    messageId: string;
    /** true when a Free plan's allowance for the day was used and the text went out with a short SMSTunnel line. */
    branded?: boolean;
    queued?: boolean;
    /** clean: texts left today without that line (-1 = unlimited). */
    remaining?: { clean?: number; total?: number | string };
  };
  /** Never set on a text sent now; see ScheduleResponse. */
  scheduled?: false;
}

/** A text SMSTunnel keeps to send later (POST /sms/send with sendAt), as the key that scheduled it sees it. */
export interface ScheduledText {
  id: string;
  to: string;
  message: string;
  /** ISO 8601, UTC. */
  sendAt: string;
  /** scheduled, then sent, failed or canceled. */
  status: string;
  deviceId?: string | null;
  /** Set once it went out: its delivery is GET /sms/status/:messageId. */
  messageId?: string | null;
  /** Why it failed (key_not_active, limit_reached, invalid_number, phone_not_found, interrupted, ...). */
  error?: string | null;
  createdAt?: string | null;
}

/** POST /sms/send with sendAt answers this instead of a SendResponse. */
export interface ScheduleResponse {
  success: boolean;
  scheduled: true;
  scheduledId: string;
  sendAt: string;
  data?: ScheduledText;
}

export interface ScheduledListResponse {
  success: boolean;
  data?: {
    items: ScheduledText[];
    total: number;
    page: number;
    limit: number;
    /** Texts waiting in the whole account (the dashboard's and other keys' too). */
    waiting: number;
    /** The plan's cap on texts waiting at once. */
    max: number;
  };
}

export interface ScheduledTextResponse {
  success: boolean;
  data?: ScheduledText;
}

export interface MessageStatusResponse {
  success: boolean;
  data?: {
    id: string;
    phoneNumber: string;
    /** An unconfirmed text shows as `failed` with `unconfirmed: true`; `deliveryStatus` has the real state. */
    status: string;
    unconfirmed?: boolean;
    deliveryStatus?: string;
    sentAt?: string | null;
    deliveredAt?: string | null;
    errorMessage?: string | null;
  };
}

export interface DevicesResponse {
  success: boolean;
  data?: {
    devices: Array<{ id: string; name?: string | null; isOnline?: boolean; lastSeenAt?: string | null }>;
    online: number;
    total: number;
  };
}

export interface UsageResponse {
  success: boolean;
  data?: {
    plan: string;
    accountType?: string;
    usage: { smsClean: number; smsBranded: number; twoFaClean: number };
    limits: { smsClean: number | string; twoFaClean: number | string };
    remaining: { smsClean: number | string; twoFaClean: number | string };
    /** Present for a client of a company account, which shares the company's allowance. */
    enterprise?: { id: string; name: string };
  };
}

export interface ReceivedResponse {
  success: boolean;
  data?: {
    messages: Array<{
      id: string;
      sender: string;
      /** null when the phone sent it encrypted. */
      message: string | null;
      isEncrypted?: boolean;
      receivedAt?: string | null;
      simSlot?: number;
      deviceId?: string;
      deviceName?: string;
    }>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface NamesFound {
  /** Names the account saved in SMSTunnel itself, never a phone's contacts. */
  items?: Array<{ name?: string | null; number?: string | null }>;
  /** true when more names match than `limit`. */
  more?: boolean;
  /** true when the account's names are private (only its desktop app can read them); `items` is then empty. */
  private?: boolean;
}

export interface NamesFindResponse extends NamesFound {
  success?: boolean;
  /** Read too, in case the route wraps its answer in `data` like the other public routes. */
  data?: NamesFound;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface SendInput {
  to: string;
  message: string;
  deviceId?: string;
  defaultCountryCode?: string;
  /** Only for sendText: send it at this time instead of now. A full ISO 8601 string with its offset (checks.ts). */
  sendAt?: string;
}

export interface ScheduledQuery {
  /** waiting (SMSTunnel's default) or done. */
  scope?: 'waiting' | 'done';
  page?: number;
  limit?: number;
}

export interface ReceivedQuery {
  limit?: number;
  page?: number;
  since?: string;
  phone?: string;
  deviceId?: string;
}

export interface NamesQuery {
  /** The name or part of it, 2 to 60 characters. */
  q: string;
  /** 1 to 5; SMSTunnel's default is 5. */
  limit?: number;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * SMSTunnel answered with an error status, or could not be reached (status 0, code NETWORK or TIMEOUT).
 * - 401: the API key is wrong, deleted or expired.
 * - 400: a bad request (`code: 'QUERY_TOO_SHORT'` for a name search under 2 characters).
 * - 403: the key lacks a permission (`code: 'PERMISSION_REQUIRED'`, see `permission`; `NAMES_NOT_ALLOWED` for name
 *   lookups), or the plan doesn't allow it.
 * - 404: no such message or phone for this key, or name lookups are not on for the account yet.
 * - 409: `code: 'SCHEDULE_NOT_EDITABLE'`: the scheduled text already went out or was canceled.
 * - 429: too many requests (`code: 'NAMES_LOOKUP_LIMIT'`: the key's hourly or daily name lookups are used up).
 * A scheduled text's refusals carry a SCHEDULE_* code (SCHEDULE_TOO_SOON, SCHEDULE_LIMIT_REACHED with `max`, ...).
 */
export class SmsTunnelApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly permission?: string;
  /** With SCHEDULE_LIMIT_REACHED: how many texts the plan lets wait at once. */
  readonly max?: number;

  constructor(status: number, message: string, code?: string, permission?: string, max?: number) {
    super(message);
    this.name = 'SmsTunnelApiError';
    this.status = status;
    this.code = code;
    this.permission = permission;
    if (max !== undefined) this.max = max;
  }

  static fromBody(status: number, body: unknown): SmsTunnelApiError {
    const fields = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    return new SmsTunnelApiError(
      status,
      errorMessageOf(body, status),
      typeof fields.code === 'string' ? fields.code : undefined,
      typeof fields.permission === 'string' ? fields.permission : undefined,
      typeof fields.max === 'number' && Number.isFinite(fields.max) ? fields.max : undefined,
    );
  }
}

/** The words of an error body, whatever its shape (string, { message }, { message: [] }, { error }). */
export function errorMessageOf(body: unknown, status: number): string {
  if (typeof body === 'string' && body.trim()) return body.trim().slice(0, 300);
  const fields = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const message = Array.isArray(fields.message) ? fields.message.join('; ') : fields.message;
  if (typeof message === 'string' && message) return message;
  if (typeof fields.error === 'string' && fields.error) return fields.error;
  return `SMSTunnel answered with HTTP ${status}.`;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export interface SmsTunnelApiOptions {
  apiKey: string;
  serverUrl: string;
  timeoutMs: number;
  /** For tests. Defaults to the global fetch (Node 20+). */
  fetch?: typeof fetch;
}

export class SmsTunnelApi {
  private readonly apiKey: string;
  private readonly serverUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SmsTunnelApiOptions) {
    this.apiKey = options.apiKey;
    this.serverUrl = options.serverUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  /** POST /api/v1/sms/send: one text to one number, now, or with `sendAt` at that time (a ScheduleResponse). */
  sendText(input: SendInput): Promise<SendResponse | ScheduleResponse> {
    return this.request('POST', '/api/v1/sms/send', {
      ...sendBody(input),
      ...(input.sendAt ? { sendAt: input.sendAt } : {}),
    });
  }

  /** POST /api/v1/sms/send-2fa: a sign-in code (4 to 10 digits in the text); separate allowance. */
  sendSignInCode(input: SendInput): Promise<SendResponse> {
    return this.request('POST', '/api/v1/sms/send-2fa', sendBody(input));
  }

  /** GET /api/v1/sms/status/:messageId (needs sms:read). */
  getMessageStatus(messageId: string): Promise<MessageStatusResponse> {
    return this.request('GET', `/api/v1/sms/status/${encodeURIComponent(messageId)}`);
  }

  /** GET /api/v1/sms/scheduled (needs sms:read): the texts this key scheduled, waiting ones soonest first. */
  listScheduled(query: ScheduledQuery = {}): Promise<ScheduledListResponse> {
    const params = new URLSearchParams();
    if (query.scope) params.set('scope', query.scope);
    if (query.page !== undefined) params.set('page', String(query.page));
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    const qs = params.toString();
    return this.request('GET', `/api/v1/sms/scheduled${qs ? `?${qs}` : ''}`);
  }

  /** GET /api/v1/sms/scheduled/:id (needs sms:read); 404 SCHEDULE_NOT_FOUND for another key's text. */
  getScheduled(scheduledId: string): Promise<ScheduledTextResponse> {
    return this.request('GET', `/api/v1/sms/scheduled/${encodeURIComponent(scheduledId)}`);
  }

  /** DELETE /api/v1/sms/scheduled/:id (needs sms:send): cancels it while it waits; 409 once it went out. */
  cancelScheduled(scheduledId: string): Promise<ScheduledTextResponse> {
    return this.request('DELETE', `/api/v1/sms/scheduled/${encodeURIComponent(scheduledId)}`);
  }

  /** GET /api/v1/devices: the phones of the key's account. */
  listPhones(): Promise<DevicesResponse> {
    return this.request('GET', '/api/v1/devices');
  }

  /** GET /api/v1/account/usage: plan, today's usage and what is left. */
  getUsage(): Promise<UsageResponse> {
    return this.request('GET', '/api/v1/account/usage');
  }

  /** GET /api/v1/sms/received (needs the key's opt-in sms:inbox; others get 403 PERMISSION_REQUIRED). */
  listReceivedTexts(query: ReceivedQuery = {}): Promise<ReceivedResponse> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.page !== undefined) params.set('page', String(query.page));
    if (query.since) params.set('since', query.since);
    if (query.phone) params.set('phone', query.phone);
    if (query.deviceId) params.set('deviceId', query.deviceId);
    const qs = params.toString();
    return this.request('GET', `/api/v1/sms/received${qs ? `?${qs}` : ''}`);
  }

  /**
   * POST /api/v1/names/find: numbers for names the account saved in SMSTunnel (needs the key's opt-in
   * canFindNames; others get 403 NAMES_NOT_ALLOWED). The search words go in the body, never in the URL.
   */
  findNames(query: NamesQuery): Promise<NamesFindResponse> {
    return this.request('POST', '/api/v1/names/find', {
      q: query.q,
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
    });
  }

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.serverUrl}${path}`, {
        method,
        headers: {
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
          'User-Agent': `smstunnel-mcp/${VERSION}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new SmsTunnelApiError(0, `SMSTunnel did not answer within ${Math.round(this.timeoutMs / 1000)} seconds.`, 'TIMEOUT');
      }
      throw new SmsTunnelApiError(0, `Could not reach SMSTunnel at ${this.serverUrl} (${networkReason(error)}).`, 'NETWORK');
    }

    let data: unknown;
    try {
      const text = await res.text();
      data = text ? parseJson(text) : undefined;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new SmsTunnelApiError(0, `SMSTunnel did not answer within ${Math.round(this.timeoutMs / 1000)} seconds.`, 'TIMEOUT');
      }
      throw new SmsTunnelApiError(0, `The answer from SMSTunnel was cut off (${networkReason(error)}).`, 'NETWORK');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw SmsTunnelApiError.fromBody(res.status, data);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new SmsTunnelApiError(res.status, 'SMSTunnel answered with something that is not JSON.', 'BAD_RESPONSE');
    }
    if ((data as { success?: unknown }).success === false) {
      throw SmsTunnelApiError.fromBody(res.status, data);
    }
    return data as T;
  }
}

function sendBody(input: SendInput): Record<string, string> {
  return {
    to: input.to,
    message: input.message,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.defaultCountryCode ? { defaultCountryCode: input.defaultCountryCode } : {}),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A short reason for a failed connection, without anything from the request (headers carry the key). */
function networkReason(error: unknown): string {
  const cause = (error as { cause?: { code?: unknown } })?.cause;
  if (cause && typeof cause.code === 'string') return cause.code;
  if (error instanceof Error && error.message) return error.message.slice(0, 120);
  return 'network error';
}
