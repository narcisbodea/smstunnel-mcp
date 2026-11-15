# Changelog

## [1.2.0] - 2026-11-15

Needs SMSTunnel with scheduled texts on the server. A server from before them refuses `send_at` (400), the tool says
so, and nothing is sent.

### Added

- **Scheduled texts.** `send_sms` takes an optional `send_at`: the time the user asked for, in the user's own time
  zone, as ISO 8601 with its offset (`2026-11-16T09:00:00+02:00`), 1 minute to 30 days ahead. SMSTunnel keeps the text
  and the user's phone sends it then. The tool's description tells the assistant to convert the user's local time with
  its offset (asking when the time zone is unclear), and to show the user the number, the words and the time and wait
  for their OK, as for any text; the server instructions say the same.
- **`list_scheduled_texts`** (read-only): the texts scheduled with this key, waiting (soonest first) or, with scope
  `done`, sent, failed or canceled in the last 30 days, with how many wait in the account and the plan's cap.
- **`cancel_scheduled_text`**: cancels a scheduled text before it goes out. It is marked destructive and idempotent;
  it sends nothing, so it doesn't carry the ask-before-every-text marker. When SMSTunnel answers that the text can no
  longer be canceled, the tool looks it up and says whether it already went out, failed or was canceled.

### Changed

- `send_sms` answers `{ scheduled, scheduledId, to, sendAt }` for a scheduled text. In its output schema `messageId`,
  `queued` and `branded` are now optional; a text sent now still has all three. `send_sign_in_code` is unchanged:
  sign-in codes are never scheduled.
- A `send_at` without its offset, or a date that doesn't exist (30 February), is refused before SMSTunnel is called.
  The time goes out in UTC (`toISOString()`); the 1 minute to 30 days rule is SMSTunnel's.
- The refusals of a scheduled text are worded for the assistant (`SCHEDULE_TOO_SOON`, `SCHEDULE_TOO_FAR`,
  `SCHEDULE_LIMIT_REACHED` with the plan's cap, a server that doesn't schedule texts yet) and say the text was not
  scheduled. After a timeout or a server error, the assistant is told to check `list_scheduled_texts` before
  scheduling it again.

## [1.1.0] - 2026-11-03

### Added

- `find_contact`: a person's number by a name the user saved in SMSTunnel.

## [1.0.0] - 2026-11-01

First release: `send_sms`, `send_sign_in_code`, `get_message_status`, `list_phones`, `get_usage` and
`list_received_texts`.
