/**
 * What a model reads when a call doesn't go through: what happened, whether the text went out, and what to do.
 */

import { SmsTunnelApiError } from './api.js';
import { clean } from './checks.js';
import { DASHBOARD_APPS_URL } from './config.js';

/** schedule: send_sms with send_at. scheduled: list_scheduled_texts. cancel: cancel_scheduled_text. */
export type ToolKind =
  | 'send'
  | 'code'
  | 'schedule'
  | 'status'
  | 'phones'
  | 'usage'
  | 'received'
  | 'names'
  | 'scheduled'
  | 'cancel';

const NOT_SENT = 'The text was not sent.';
const NOT_SCHEDULED = 'The text was not scheduled.';
const MAYBE_SENT =
  'It is not known whether SMSTunnel accepted the text, so do not send it again on your own: ' +
  'ask the user to check the Messages page in the SMSTunnel dashboard first.';
const MAYBE_SCHEDULED =
  'It is not known whether SMSTunnel accepted the scheduled text, so do not schedule it again on your own: ' +
  'check list_scheduled_texts first.';

export function describeError(error: unknown, kind: ToolKind): string {
  const sending = kind === 'send' || kind === 'code' || kind === 'schedule';
  const notDone = kind === 'schedule' ? NOT_SCHEDULED : NOT_SENT;
  const maybeDone = kind === 'schedule' ? MAYBE_SCHEDULED : MAYBE_SENT;

  if (!(error instanceof SmsTunnelApiError)) {
    const reason = error instanceof Error ? clean(error.message) : 'unknown error';
    return `Something went wrong in the SMSTunnel MCP server (${reason}).${sending ? ` ${maybeDone}` : ''}`;
  }

  const said = clean(error.message, 300);
  const tag = `(HTTP ${error.status}${error.code ? `, ${clean(error.code, 40)}` : ''})`;

  if (error.status === 0) {
    if (error.code === 'TIMEOUT') return `${said}${sending ? ` ${maybeDone}` : ' Try again in a moment.'}`;
    return `${said} Check the internet connection and SMSTUNNEL_SERVER_URL.${sending ? ` ${notDone}` : ''}`;
  }

  switch (error.status) {
    case 400:
      if (kind === 'names' && error.code === 'QUERY_TOO_SHORT') {
        return `SMSTunnel needs at least 2 characters of a name to look it up ${tag}, so ask the user for more of the name or for the number.`;
      }
      if (kind === 'code' && /verification code/i.test(error.message)) {
        return (
          `SMSTunnel refused the text: it found no sign-in code in it ${tag}. The code must stand on its own as ` +
          '4 to 10 digits (for example "Your code is 482913") or as two groups of three digits joined by a dash ' +
          '(123-456). Words, letter or mixed codes (A1B2C3), 11 or more digits, digits right after + and dates ' +
          `or decimals don't count. For a text without a sign-in code, use send_sms. ${NOT_SENT}`
        );
      }
      if (kind === 'schedule') {
        // The server before scheduled texts refuses the field it doesn't know.
        if (/sendAt should not exist/i.test(error.message)) {
          return `This SMSTunnel server does not schedule texts yet ${tag}. ${NOT_SCHEDULED} Send it now, without send_at, only if the user agrees.`;
        }
        if (error.code === 'SCHEDULE_TOO_SOON') {
          return `send_at must be at least a minute from now ${tag}. ${NOT_SCHEDULED} To send it now instead, leave send_at out, with the user's OK.`;
        }
        if (error.code === 'SCHEDULE_TOO_FAR') {
          return `send_at must be within the next 30 days ${tag}. ${NOT_SCHEDULED}`;
        }
      }
      return `SMSTunnel refused the request ${tag}: ${said}${sending ? ` ${notDone}` : ''}`;

    case 401:
      return (
        `SMSTunnel did not accept the API key ${tag}: it is wrong, deleted or expired. Create a new key in the ` +
        `SMSTunnel dashboard (${DASHBOARD_APPS_URL}: Apps → Add an app) and put it in SMSTUNNEL_API_KEY in your ` +
        `AI app's MCP settings.${sending ? ` ${notDone}` : ''}`
      );

    case 403:
      if (kind === 'schedule' && error.code === 'SCHEDULE_LIMIT_REACHED') {
        return (
          `As many scheduled texts are waiting as the plan allows${error.max !== undefined ? ` (${error.max})` : ''} ` +
          `${tag}. ${NOT_SCHEDULED} Tell the user: some have to go out first, or the user can have one canceled ` +
          '(list_scheduled_texts, then cancel_scheduled_text).'
        );
      }
      if (kind === 'names' && (!error.code || error.code === 'NAMES_NOT_ALLOWED' || error.code === 'PERMISSION_REQUIRED')) {
        return (
          `This API key may not look up names ${tag}: to allow it, open Apps in the SMSTunnel dashboard ` +
          `(${DASHBOARD_APPS_URL}), choose this key and turn on "Can also look up names you saved in SMSTunnel"; ` +
          'until then, ask the user for the number.'
        );
      }
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
          `${sending ? ` ${notDone}` : ''}`
        );
      }
      return `SMSTunnel refused the request ${tag}: ${said}${sending ? ` ${notDone}` : ''}`;

    case 404:
      if (kind === 'names') {
        return `Looking up names is not available on this SMSTunnel account yet ${tag}, so ask the user for the person's number.`;
      }
      if (kind === 'status') {
        return (
          `SMSTunnel has no text with this ID for this API key ${tag}. Use the messageId that send_sms or ` +
          'send_sign_in_code returned; a scheduled text gets one only when it goes out (see list_scheduled_texts).'
        );
      }
      if (kind === 'scheduled' || kind === 'cancel') {
        return error.code === 'SCHEDULE_NOT_FOUND'
          ? `SMSTunnel has no scheduled text with this ID for this API key ${tag}. Use a scheduledId from list_scheduled_texts.`
          : `This SMSTunnel server does not have scheduled texts yet ${tag}.`;
      }
      if (sending) {
        return `SMSTunnel could not find the phone or account to send from ${tag}: ${said} Check deviceId with list_phones. ${notDone}`;
      }
      return `SMSTunnel found nothing ${tag}: ${said}`;

    case 409:
      if (kind === 'cancel' && error.code === 'SCHEDULE_NOT_EDITABLE') {
        return (
          `This text can no longer be canceled: it already went out, failed or was canceled ${tag}. ` +
          'list_scheduled_texts with scope "done" shows what happened to it.'
        );
      }
      return `SMSTunnel answered with an error ${tag}: ${said}${sending ? ` ${notDone}` : ''}`;

    case 429:
      if (kind === 'names') {
        return error.code === 'NAMES_LOOKUP_LIMIT'
          ? `This API key reached its hourly or daily limit for name lookups ${tag}, so ask the user for the number.`
          : `Too many requests ${tag}: wait a minute before looking up another name, or ask the user for the number.`;
      }
      return (
        `Too many requests ${tag}: SMSTunnel takes about 30 texts a minute. ${sending ? `${notDone} ` : ''}` +
        'Wait a minute before trying again.'
      );

    default:
      if (error.status >= 500) {
        return `SMSTunnel had a server error ${tag}: ${said}${sending ? ` ${maybeDone}` : ' Try again in a moment.'}`;
      }
      return `SMSTunnel answered with an error ${tag}: ${said}${sending ? ` ${notDone}` : ''}`;
  }
}
