# Deterministic POC checks

[poc.test.mjs](poc.test.mjs) exercises controller and transport behavior without OpenAI access.

| Fixture | Responsibility | Boundary |
| --- | --- | --- |
| In-memory session | Revision, Focus protection, Live updates, intent routing, coalescing and Stop checks | Injected model output |
| VM worklet | Checks packet counts and amplitude at common sample rates | Simulated audio frames |
| Local HTTP/WS server | Verifies asset allowlist, origin rejection, PCM forwarding and cleanup | Fake transcription transport |

Run `node --test poc/poc.test.mjs` from the project root, using Node.js 22+ and installed POC dependencies.
The integration case needs permission to bind an ephemeral loopback port. A sandbox permission failure is an environment failure, not a passed check.
`packet(sequence)` constructs correctly ordered silent PCM. `until(predicate)` waits up to 1.5 seconds for asynchronous fixture events.
`proposal(changes)` builds a valid `new-question` proposal; `clarify(question, evidenceIds)` builds a `clarify` proposal.
`liveSession()` returns a session with `hear(id, text, intent)`, `confirm(requestId, changes)`, `reset(requestId)`, `payload(changes)` and `send(requestId, message)`; the controls return the latest `question.result`.
`startServer(t, options)` runs the real server on a loopback port with a fake transcription socket and returns its origin and the upstream events sent.
The nineteen cases cover audio gaps, stale/invalid evidence, transcript reconciliation, continuous intake during reasoning, late-response suppression, resampling and the HTTP/WebSocket boundary.
Eleven UC-04 cases cover: model output never writing Focus; Live corrections, multipart and new questions; unknown intents; exact confirmation and result ordering; the 4 November regression (a new question after Confirm leaves Focus unchanged); restatement exchanges and Live equal to Focus; Clear live; rejected requests; idempotent retries and the cap; text-free audit, including the reason a rejected agent result is audited with; and WebSocket controls during audio with a late model result.
Fixtures prove plumbing and deterministic validation only. The separate [browser smoke](browser-smoke.md) tests real OpenAI behavior with synthetic microphone input.
