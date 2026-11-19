# Log download

## Purpose

Let Pablo take the current or last meeting log away with one press. Rules SD-1 to SD-4 are on the 08 page [upload and download](../../../../../docs/asdg/08-low-level-design/03.7.4-s004-upload-and-download.md). Commitment S004-DOWNLOAD.

## ADDED Requirements

### Requirement: GET log returns the newest log
`GET /log` SHALL return the current session's log, or the most recent one, as `text/plain; charset=utf-8` with an attachment filename `alice-meeting-<UTC start>.jsonl` and `Cache-Control: no-store`, holding complete lines only, and SHALL answer 404 "No meeting log yet." when none exists. It SHALL apply the same Host and Origin rules as the session socket and give any other caller 403.

#### Scenario: During a session
- **WHEN** Pablo presses Download log while listening
- **THEN** he receives the log so far, complete lines only, and the session is not interrupted.

### Requirement: The button is always available
The Download log button SHALL always be enabled; the page SHALL fetch `/log` from its own origin, save the result as a file and, on 404, say "No meeting log yet." in the monitor line.

#### Scenario: Before any session
- **WHEN** no session has run
- **THEN** pressing the button shows "No meeting log yet." and saves nothing.
