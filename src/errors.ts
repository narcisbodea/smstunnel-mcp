/**
 * What a model reads when a call doesn't go through: what happened, whether the text went out, and what to do.
 */

import { SmsTunnelApiError } from './api.js';
import { clean } from './checks.js';
import { DASHBOARD_APPS_URL } from './config.js';

export type ToolKind = 'send' | 'code' | 'status' | 'phones' | 'usage' | 'received';

const NOT_SENT = 'The text was not sent.';
const MAYBE_SENT =
  'It is not known whether SMSTunnel accepted the text, so do not send it again on your own: ' +
  'ask the user to check the Messages page in the SMSTunnel dashboard first.';

export function describeError(error: unknown, kind: ToolKind): string {
  const sending = kind === 'send' || kind === 'code';

  if (!(error instanceof SmsTunnelApiError)) {
    const reason = error instanceof Error ? clean(error.message) : 'unknown error';
    return `Something went wrong in the SMSTunnel MCP server (${reason}).${sending ? ` ${MAYBE_SENT}` : ''}`;
  }

  const said = clean(error.message, 300);
  const tag = `(HTTP ${error.status}${error.code ? `, ${clean(error.code, 40)}` : ''})`;

  if (error.status === 0) {
    if (error.code === 'TIMEOUT') return `${said}${sending ? ` ${MAYBE_SENT}` : ' Try again in a moment.'}`;
    return `${said} Check the internet connection and SMSTUNNEL_SERVER_URL.${sending ? ` ${NOT_SENT}` : ''}`;
  }

  switch (error.status) {
    case 400:
      if (kind === 'code' && /verification code/i.test(error.message)) {
        return (
          `SMSTunnel refused the text: it found no sign-in code in it ${tag}. The code must stand on its own as ` +
          '4 to 10 digits (for example "Your code is 482913") or as two groups of three digits joined by a dash ' +
          '(123-456). Words, letter or mixed codes (A1B2C3), 11 or more digits, digits right after + and dates ' +
          `or decimals don't count. For a text without a sign-in code, use send_sms. ${NOT_SENT}`
        );
      }
      return `SMSTunnel refused the request ${tag}: ${said}${sending ? ` ${NOT_SENT}` : ''}`;

    case 401:
      return (
        `SMSTunnel did not accept the API key ${tag}: it is wrong, deleted or expired. Create a new key in the ` +
        `SMSTunnel dashboard (${DASHBOARD_APPS_URL}: Apps → Add an app) and put it in SMSTUNNEL_API_KEY in your ` +
        `AI app's MCP settings.${sending ? ` ${NOT_SENT}` : ''}`
      );

    case 403:
      if (
        (error.code === 'PERMISSION_REQUIRED' && (error.permission === 'sms:inbox' || kind === 'received')) ||
        (kind === 'received' && !error.code)
      ) {
        return (
          `This API key may not read received texts ${tag}. Reading them is a separate opt-in: in the SMSTunnel ` +
          `dashboard (${DASHBOARD_APPS_URL}), turn on "Allow reading received texts" for this app, or add an app ` +
          'with "Can also read received texts" and use its key. Also turn on syncing of received texts in the ' +
          'SMSTunnel app on the phone (it is off by default): only texts that arrive after that are synced.'
        );
      }
      if (error.code === 'PERMISSION_REQUIRED') {
        const permission = error.permission ? `"${clean(error.permission, 40)}"` : 'a needed';
        return (
          `This API key lacks the ${permission} permission ${tag}. Keys made in the dashboard under Apps → Add an ` +
          `app can send texts and check their status; create one at ${DASHBOARD_APPS_URL}.` +
          `${sending ? ` ${NOT_SENT}` : ''}`
        );
      }
      return `SMSTunnel refused the request ${tag}: ${said}${sending ? ` ${NOT_SENT}` : ''}`;

    case 404:
      if (kind === 'status') {
        return (
          `SMSTunnel has no text with this ID for this API key ${tag}. Use the messageId that send_sms or ` +
          'send_sign_in_code returned.'
        );
      }
      if (sending) {
        return `SMSTunnel could not find the phone or account to send from ${tag}: ${said} Check deviceId with list_phones. ${NOT_SENT}`;
      }
      return `SMSTunnel found nothing ${tag}: ${said}`;

    case 429:
      return (
        `Too many requests ${tag}: SMSTunnel takes about 30 texts a minute. ${sending ? `${NOT_SENT} ` : ''}` +
        'Wait a minute before trying again.'
      );

    default:
      if (error.status >= 500) {
        return `SMSTunnel had a server error ${tag}: ${said}${sending ? ` ${MAYBE_SENT}` : ' Try again in a moment.'}`;
      }
      return `SMSTunnel answered with an error ${tag}: ${said}${sending ? ` ${NOT_SENT}` : ''}`;
  }
}
