# Local browser and transcription service

[server.mjs](server.mjs) connects the existing page to live transcription and one server agent.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| HTTP server | Serves seven explicitly listed public paths and `/health` | Existing HTML/JS, capture worklet and the static [preview](preview/index.md) |
| Package store | Holds the uploaded or folder package; a session takes a snapshot once before `ready` | [Package store](package-store.md), [loader](package-loader.md) |
| Answer generator | Prepares one proposed answer per confirmed question | [Answer area](answer-area.md), [answer](answer.md) |
| `/session` WebSocket | Accepts one same-origin browser session at a time | [Session](session.md) |
| Transcription socket | Streams PCM and forwards partial/final text | OpenAI Realtime transcription |
| Agent/controller | Generates and validates display proposals | [Agent](agent.md) |

`createPocServer({reason?, apiKey?, transcriptionModel?, connect?, audit?, generate?, now?, answerTimeoutMs?, packageDir?, log?, reasonDelayMs?, printRequest?, stderr?})` returns a Node HTTP server. Tests inject reasoning, the generator, the clock and the upstream transport (see [fixtures](fixtures.md)); normal execution uses real OpenAI connections. `packageDir` defaults to `ALICE_PACKAGE_DIR` or `poc/context/interview/`; `answerTimeoutMs` to `ANSWER_TIMEOUT_MS` (30,000 ms); `printRequest` is on only when `ALICE_PRINT_REQUEST` is exactly `1`.
The executable binds `127.0.0.1`, using `PORT` or 3000. `GET /health` returns `{status:'alive', service:'alice-good-meetings', startedAt, configured, sessions, package:{found, chars}}`: `configured` is true only for a non-blank key and `package` says whether eligible files exist and their total size. It never holds the key, file names, package text or errors, and does not prove OpenAI availability. Without a key the service still starts and listens; a session opened without one gets `Server needs OPENAI_API_KEY` and no OpenAI connection is made.
Only `/`, `/index.html`, `/app.js`, `/poc/audio-worklet.js` and the three static layout-preview files (`/preview`, `/preview/preview.css`, `/preview/preview.js`) are served. Repository files and credentials are inaccessible through the static server.
HTTP Host and WebSocket Origin must match localhost or 127.0.0.1 and the listening port.

The upstream connection uses `session.update` for 24 kHz PCM transcription. Start sending browser audio after the `ready` event; audio spoken during connection setup is not transmitted.
Server RMS above 0.012 marks speech. A turn commits only after 800 ms of silence following speech (tune with `ALICE_PAUSE_MS`, 300 to 5000 in steps of 100); continuous speech is never cut (a 120-second backstop protects the upstream buffer limit). The agent is asked for guidance only while Pablo is pausing (speech heard, then the pause): a transcript that arrives mid-speech waits for the next pause, and the `requirePause` option (default on) exists so tests can turn the gate off. Pure silence buffers clear every five seconds.
Agent reasoning can start from partial transcription. Audio intake continues while that request runs.
Audio send backlog above two seconds closes the connection with a degraded status. Sessions have a 30-minute POC limit and must be explicitly restarted after failures.
At session start, before `ready`, the server loads the package, audits `package_loaded` and logs one status line: names, sizes and digests for the folder package, counts only for an uploaded one, never text. A refused key (an `error` event or a 401 handshake) ends the session with `OpenAI authentication failed`. Voiced packets and the page's `rendered` report (with `answerFocusVersion` and `answerStatus`) feed the answer timing events. With `ALICE_PRINT_REQUEST=1` the assembled model input is printed to standard error only, after a private-text warning at startup and before each request.
Text controls `question.reset` and `question.confirm` go to [the session](session.md), which replies with `question.result`; a malformed question control returns `invalid` and leaves the session open. Other unknown controls still close it. See [the protocol guide](docs/04-server-and-protocol.md) for payloads.
`stop`, socket closure, SIGINT and SIGTERM release sessions and pending work. Public errors omit provider request details and credentials.
Audit stdout contains event names, times, counts and revisions, without audio, transcripts or API keys. `transcript_final` records an item ID when its transcript completes; `question_control` records each question request's ID, type, status, whether it was a replay, and versions, never wording. `browser_rendered` is a client acknowledgement, not a human acceptance decision; when it names a Live id and version it records display, never consent.
See [live transcription guidance](https://developers.openai.com/api/docs/guides/realtime-transcription).

## Vocabulary hints and automatic focus (18 November 2026)

After the package loads, the server extracts terms ([vocabulary](vocabulary.md)) for a usable package, adds `prompt` to the transcription session when there are terms, and calls `session.setContext({ terms, documents })`. The `package_loaded` audit gains a `terms` count and nothing else. The option `autoFocus` (default on) passes through to the session; tests turn it off for the manual Confirm cases.

## Package routes (SPRINT-004)

`GET /package` returns `{source, status, files, chars, terms}` (`source` is `uploaded`, `folder` or `none`) and never a name or text. `PUT /package` takes `application/json` `{files:[{name,text}]}` (200 KB) and answers `{result, reason, package, skipped}`; `DELETE /package` clears the package in use, the folder one until restart. Both change only while no session listens (else 409 `listening`); a refusal keeps the previous package and gives 400 `refused`, 413 `body-too-large`, 415 `content-type` or 422 `too-large`, `empty`, `unreadable` or `too-many-files`. A caller needs this Host; a change also needs an Origin that is this page, a GET may omit it; anything else gets 403. The audit gains `package_uploaded` and `package_removed` (counts only, no names) and `package_loaded` gains `source`. The session is scheduled only after its package snapshot is taken, so the first reading always sees it. Rules: [package store](package-store.md).

## Meeting log and download (SPRINT-004)

Options `logDir` (default `ALICE_LOG_DIR`, else `poc/logs/`), `logMaxBytes`, `mono` and `revision` (default: the short Git commit, else `unknown`). After the package snapshot every listening session starts a [meeting log](meeting-log.md) with `log_started` (header: version, session id, UTC start with `tzOffsetMin`, revision, models, key state, pause setting and package counts) and `package` (counts only), then `speech_start` and `pause` (silences of 800 ms or more, from voiced packets), `error` with the public message and `session_stopped` with its reason (`user`, `error`, `limit`, `disconnect`) and seconds heard. A session that ends before the package is read (no key) writes no log. Logging cannot be turned off. A write failure sends the page `{type:'log', status:'not saved'}` and the session continues. `GET /log` returns the current or newest log as `text/plain; charset=utf-8`, complete lines only, with an attachment filename `alice-meeting-<UTC start>.jsonl`, 404 `No meeting log yet.` when none exists, 403 for another Host or Origin and 405 for any other method; there is no list or delete route. Uploads happen only while no session listens, so they are not log events; the next session's `package` event shows the package it used.

## Avatar files (SPRINT-004, AV-7)

`VENDOR_FILES` is a fixed list of 19 files under `poc/vendor/` (TalkingHead's four modules, three's two builds and twelve addons, and `models/mpfb.glb`), served at `/poc/vendor/<file>`, plus `/poc/avatar.js`. The model is sent as `model/gltf-binary` with no charset. Everything else under `poc/vendor`, including licences, `VENDOR.md` and any `..` path, is 404. `VENDOR_ASSETS` exports the served paths for the tests.

## Fixes after the review of 21 November 2026

- A request that fails part-way, such as an upload cut off mid-body, is caught in one place (`route(...).catch`) and answered or dropped; before, the rejected promise ended the service process.
- `validCaller` also reads `Sec-Fetch-Site` on a GET with no Origin: `cross-site` and `same-site` get 403 on `/log` and `/package`, so another site cannot make the browser fetch or save the log; `same-origin`, `none` (the address bar) and tools that send neither header are allowed.

## Fix of 22 November 2026

`cleanup` stops the session before it writes `session_stopped` and closes the meeting log, so anything the session records on stopping is in the log and `session_stopped` stays the last line.

## Uploaded file names (22 November 2026, SU-9 as amended)

For an uploaded package the `package_loaded` audit holds `files` and `skipped` as counts, and the console line prints the number skipped, not their names. An uploaded file's name appears only in the upload's answer to the page (SU-4). The folder package's start-up audit keeps its names, sizes and digests, as built in SPRINT-003 (PK-9).

## Hosted mode (22 November 2026)

Four settings, read as options of `createPocServer` and from the environment. With none set the service is the local one described above, unchanged.

| Setting (option) | Contract |
| --- | --- |
| `ALICE_PUBLIC_HOST` (`publicHost`) | One or more host names, comma-separated. `listenHost()` then returns `0.0.0.0` in place of `127.0.0.1`. A request for a named host is served only when `X-Forwarded-Proto` is `https`, and its page origin is `https://<host>` for `PUT`, `DELETE` and the session socket. Local addresses are still served. Any other host gets 403. |
| `ALICE_ACCESS_CODE` (`accessCode`) | Trimmed. `/package` (all methods) and `/log` answer 401 without the header `X-Alice-Code`; `/session` answers 401 unless the client offers the subprotocols `alice` and `alice-code.<base64url of the code>`. Codes are compared as SHA-256 digests with `timingSafeEqual`. Only `alice` is echoed; the code is never logged, audited or put in an address. The page, `/health` and static files need no code. |
| `ALICE_LOG=off` (`logOff`) | Only with a public host: no meeting log is started and `/log` answers 404 "No meeting log yet." Without a public host it has no effect (ML-13). |
| `ALICE_AVATAR=off` (`avatarOff`) | `/poc/avatar.js` and everything under `/poc/vendor/` answer 404, so the page drops the avatar silently. |

The access code travels in a header and not in the socket's address, because a hosting platform records request addresses in its own logs. The files and commands for Google Cloud Run are in [deploy](deploy/README.md).

## Measurement clock (SPRINT-005)

The service gives each session `elapsed`, the clock of its meeting log, so the times inside `model_call` and `question_timing` match the `ms` of the lines around them. Nothing else changed here; see [the measurement lines](docs/09-measurement-events.md).
