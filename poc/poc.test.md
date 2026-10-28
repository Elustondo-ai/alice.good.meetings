# Deterministic POC checks

[poc.test.mjs](poc.test.mjs) exercises controller and transport behavior without OpenAI access.

| Fixture | Responsibility | Boundary |
| --- | --- | --- |
| In-memory session | Revision, question retention, coalescing and Stop checks | Injected model output |
| VM worklet | Checks packet counts and amplitude at common sample rates | Simulated audio frames |
| Local HTTP/WS server | Verifies asset allowlist, origin rejection, PCM forwarding and cleanup | Fake transcription transport |

Run `node --test poc/poc.test.mjs` from the project root, using Node.js 22+ and installed POC dependencies.
The integration case needs permission to bind an ephemeral loopback port. A sandbox permission failure is an environment failure, not a passed check.
`packet(sequence)` constructs correctly ordered silent PCM. `until(predicate)` waits up to 1.5 seconds for asynchronous fixture events.
The eight cases cover audio gaps, retained questions, stale/invalid evidence, transcript reconciliation, continuous intake during reasoning, late-response suppression, resampling and the HTTP/WebSocket boundary.
Fixtures prove plumbing and deterministic validation only. The separate [browser smoke](browser-smoke.md) tests real OpenAI behavior with synthetic microphone input.
