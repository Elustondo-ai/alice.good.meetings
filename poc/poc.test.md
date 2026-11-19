# Deterministic POC checks

[poc.test.mjs](poc.test.mjs) exercises controller and transport behavior without OpenAI access.

| Fixture | Responsibility | Boundary |
| --- | --- | --- |
| In-memory session | Revision, Focus protection, Live updates, intent routing, coalescing and Stop checks | Injected model output |
| VM worklet | Checks packet counts and amplitude at common sample rates | Simulated audio frames |
| Local HTTP/WS server | Verifies asset allowlist, origin rejection, PCM forwarding and cleanup | Fake transcription transport |
| Answer fixtures | The 57 SPRINT-003 cases ST-01 to ST-57: request, result checks, controller, loader, `/health`, no-key cases, retry, timing, print option, preview route and the PK-11 source scan | [Fixtures](fixtures.md), synthetic packages in temporary folders |

Run `node --test poc/poc.test.mjs` from the project root, using Node.js 22+ and installed POC dependencies.
The integration case needs permission to bind an ephemeral loopback port. A sandbox permission failure is an environment failure, not a passed check.
`packet(sequence)` constructs correctly ordered silent PCM. `until(predicate)` waits up to 1.5 seconds for asynchronous fixture events.
`proposal(changes)` builds a valid `new-question` proposal; `clarify(question, evidenceIds)` builds a `clarify` proposal.
`liveSession()` returns a session with `hear(id, text, intent)`, `confirm(requestId, changes)`, `reset(requestId)`, `payload(changes)` and `send(requestId, message)`; the controls return the latest `question.result`.
`startServer(t, options)` runs the real server on a loopback port with a fake transcription socket and returns its origin and the upstream events sent.
The nineteen cases cover audio gaps, stale/invalid evidence, transcript reconciliation, continuous intake during reasoning, late-response suppression, resampling and the HTTP/WebSocket boundary.
Eleven UC-04 cases cover: model output never writing Focus; Live corrections, multipart and new questions; unknown intents; exact confirmation and result ordering; the 4 November regression (a new question after Confirm leaves Focus unchanged); restatement exchanges and Live equal to Focus; Clear live; rejected requests; idempotent retries and the cap; text-free audit, including the reason a rejected agent result is audited with; and WebSocket controls during audio with a late model result.
Fixtures prove plumbing and deterministic validation only. The separate [browser smoke](browser-smoke.md) tests real OpenAI behavior with synthetic microphone input.

## SPRINT-003 service tests (ST-01 to ST-57)

The 57 cases use the exact titles of the [test map](../docs/asdg/08-low-level-design/03.6-sprint-003-test-map.md). `node --test poc/poc.test.mjs` now runs 76 cases: the 19 above plus these; none calls OpenAI, reads a real preparation package or reads the benchmark folder.
Helpers: `answering({generate, pkg, now, timeoutMs})` builds a session with a fake generator and returns `confirm(text)`, the emitted `events` and the `audits`; `setup(t, options)` adds [fixtures](fixtures.md); `liveServer(t, {files, ...options})` runs the real server on a loopback port with fixtures, a synthetic package folder and a `reasonDelayMs` of 0, and `open()` returns a WebSocket session with `confirm(text)`; `tempDir(t, files)` makes a synthetic package; `clockAt()` gives a controllable clock; `answerOk()` and `packageOf()` build invented results and packages.
The original 19 cases run against `createPocServer` wrapped to use an empty temporary package folder, so they never read Pablo's real package. ST-36 starts the real `server.mjs` as a child process with no key and no `.env.local` on an ephemeral port. ST-57 scans `poc/` sources (excluding `review/`, `docs/`, `preview/`, `context/` and `node_modules/`) for the benchmark folder name and the reviewer script name; test titles are exempt and the existing 404 probe is the one allowed use.

## Added 18 November 2026

Eight offline cases, with an invented fixture package only: vocabulary extraction and caps; the transcription prompt with and without a package; the reader receiving terms and documents and the audit holding only a count; the reader input shape; the automatic flow (Focus and answer from one call, no second request); repeated, unrelated and already-used readings changing nothing; a later pause replacing the earlier reading and `covered` false giving a general answer; and an invalid one-call answer falling back to the answer request. The older Confirm cases run with `autoFocus` off.
