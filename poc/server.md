# Local browser and transcription service

[server.mjs](server.mjs) connects the existing page to live transcription and one server agent.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| HTTP server | Serves seven explicitly listed public paths and `/health` | Existing HTML/JS, capture worklet and the static [preview](preview/index.md) |
| Package loader | Reads the preparation package once per session before `ready` | [Package loader](package-loader.md) |
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
At session start, before `ready`, the server loads the package, audits `package_loaded` (names, sizes, digests, never text) and logs one status line. A refused key (an `error` event or a 401 handshake) ends the session with `OpenAI authentication failed`. Voiced packets and the page's `rendered` report (with `answerFocusVersion` and `answerStatus`) feed the answer timing events. With `ALICE_PRINT_REQUEST=1` the assembled model input is printed to standard error only, after a private-text warning at startup and before each request.
Text controls `question.reset` and `question.confirm` go to [the session](session.md), which replies with `question.result`; a malformed question control returns `invalid` and leaves the session open. Other unknown controls still close it. See [the protocol guide](docs/04-server-and-protocol.md) for payloads.
`stop`, socket closure, SIGINT and SIGTERM release sessions and pending work. Public errors omit provider request details and credentials.
Audit stdout contains event names, times, counts and revisions, without audio, transcripts or API keys. `transcript_final` records an item ID when its transcript completes; `question_control` records each question request's ID, type, status, whether it was a replay, and versions, never wording. `browser_rendered` is a client acknowledgement, not a human acceptance decision; when it names a Live id and version it records display, never consent.
See [live transcription guidance](https://developers.openai.com/api/docs/guides/realtime-transcription).

## Vocabulary hints and automatic focus (18 November 2026)

After the package loads, the server extracts terms ([vocabulary](vocabulary.md)) for a usable package, adds `prompt` to the transcription session when there are terms, and calls `session.setContext({ terms, documents })`. The `package_loaded` audit gains a `terms` count and nothing else. The option `autoFocus` (default on) passes through to the session; tests turn it off for the manual Confirm cases.
