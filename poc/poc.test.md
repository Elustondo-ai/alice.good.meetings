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

## SPRINT-004 package cases (20 November 2026)

Twelve cases with the exact titles of ST4-01 to ST4-08, ST4-29, ST4-35 to ST4-37 and ST4-40 cover `GET`, `PUT` and `DELETE /package`: counts only, replacement, every limit, refusals keeping the previous package, the listening refusal, survival after Stop and the Start snapshot, no sentinel text in any reply, audit, log or frame, wrong Host or Origin, Remove including the folder package, unsafe names, the content type, unreadable text and a restart. Helpers `putPackage`, `getPackage`, `deletePackage` and `upload` drive them with `liveServer` and synthetic text only. `node --test poc/poc.test.mjs` now runs 98 cases.

## SPRINT-004 log cases

Twenty cases with the exact titles of ST4-09 to ST4-28, ST4-30, ST4-34, ST4-41, ST4-42 and ST4-11 (the `transcript` snapshot, run on the session alone with a controllable clock) cover the log: the headers of `GET /log` and the 404, complete lines only, the header, every event type and its source or `via`, no text that must stay out, the 800 ms pause rule, the 5 MB cap with one `log_full`, modes 0700 and 0600, the folder setting, no list or delete route, no log text sent to OpenAI, no deletion, no off switch, and a failing or slow disk. Every `createPocServer` in the tests now gets a temporary log folder, so no test writes to `poc/logs/`. `node --test poc/poc.test.mjs` now runs 122 cases.

## Bullets only (S4-15)

ST4-31, 32, 33, 38 and 39 check that neither the reader nor the fallback asks for details, that a `details` field refuses the answer whole, and that the proposed message holds bullets only. The older answer cases no longer pass `details`.

## Avatar (SPRINT-004)

ST4-43 checks that the 19 vendored files and `/poc/avatar.js` are served with the right types and that nothing else under `poc/vendor` is. SH4-3's hash part compares each served file with its SHA-256 in `poc/vendor/VENDOR.md` and checks the licences and `poc/avatar.md`. Three more cases drive `createStateMachine` with a controlled clock for the six states, the 1.5, 2.5 and 3 second times, the 3 second gap and the priority order (AV-2, AV-3).

## Review fixes (21 November 2026)

Three cases: an item with no words is skipped and does not cut the transcript snapshot; an upload cut off mid-body leaves the service running; a browser GET marked `cross-site` or `same-site` is refused on `/log` and `/package` while `same-origin`, `none` and no header are served.

## Second pass of review fixes (22 November 2026)

Six cases, one per fix: the `log_full` line holds no event data and the file stays under its cap; an answer in flight at Stop is logged as dropped before the last line; a failed reading is logged as an `error` with its public message only; a control is logged before its effects and a refused one as `invalid`; a reader reply with any unknown field falls back; Download log offers an older log when the newest file is gone.
