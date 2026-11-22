# Meeting log

## Purpose

Keep a complete, time-stamped local record of each listening session, for every meeting, that Pablo can review later. Rules ML-1 to ML-14 and MS-1 to MS-9 are on the 08 pages [meeting log](../../../../../docs/asdg/08-low-level-design/03.7.5-s004-meeting-log.md) and [storage](../../../../../docs/asdg/08-low-level-design/03.7.6-s004-meeting-log-storage.md). Commitment S004-LOG; sources 05 01.10 and UC-08. 05 decided 12's suggestions on 19 November 2026.

## ADDED Requirements

### Requirement: One JSON Lines file per session
Every listening session SHALL write one UTF-8 JSON Lines file, with no way to turn logging off, whose lines each hold a UTC wall-clock time, milliseconds since the session started and a type, and whose first line, \`log_started\`, is the header with the schema version (once), the session id, the UTC start with \`tzOffsetMin\`, the app revision (the Git commit or "unknown"), the models, whether a key is configured, the pause setting and the package source kind with counts only, but no cue limits.

#### Scenario: Two sessions
- **WHEN** Pablo listens twice
- **THEN** two files exist, each starting with its own header.

### Requirement: Complete up to 5 MB
The log SHALL hold, in the order they happened, every final transcript item, speech start, pause of 800 ms or more, Live question and clearing, Focus change with its source (`pause`, `confirm-button` or `confirm-space`), Confirm and Clear with how they were used, answer shown, failed or dropped with its bullets, package and upload counts, error and session stop; at 5 MB it SHALL end with one `log_full` event and write nothing more.

#### Scenario: Cap reached
- **WHEN** a log reaches 5 MB
- **THEN** its last line is `log_full` and no event is lost before it.

### Requirement: No cue events in version 1
The first version SHALL hold no cue events and no transcription confidence, because the cue lives only in the page and the service keeps no confidence.

#### Scenario: Cue change
- **WHEN** the cue changes from GOOD to LAND IT
- **THEN** the log holds no event for it.

### Requirement: What is never logged
The log SHALL NOT hold package file content or names, the key, the prompts, hints and replies exchanged with OpenAI, the interview agent's reply, or audio. The bullets shown MAY quote the package and are logged.

#### Scenario: Canary
- **WHEN** a session uses a package with a sentinel sentence
- **THEN** the sentinel is in no log line except where a shown bullet quotes it.

### Requirement: Stored in poc/logs, kept until Pablo deletes it
Logs SHALL be written only by the service to `poc/logs/` (or `ALICE_LOG_DIR`), which `poc/logs/.gitignore` keeps out of Git, with each file at mode 0600 and the folder left at the mode it is given, and SHALL never be deleted, rotated or expired by Alice. A write failure SHALL NOT stop the session and the monitor line SHALL say "log not saved".

#### Scenario: Unwritable folder
- **WHEN** the log folder cannot be written
- **THEN** the session continues and the page says the log was not saved.
