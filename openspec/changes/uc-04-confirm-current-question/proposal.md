# UC-04: keep a Focus question and confirm each new one

## Why

During an interview Pablo needs two things in view at once: the question being answered, which must never change behind Pablo's back, and what SpeakerCoach hears as a question right now. The 28 October version of this change confirmed only during clarification and tracked automatically everywhere else. In the 4 November live run, an automatic `new-question` replaced a question Pablo had just confirmed. The panel showed "(AUTOMATIC)" wording, with Confirm disabled.

## What Changes

- Two areas are always visible. The **Focus question** is the confirmed question being answered. The **Live question** is the current automatic interpretation of speech: new questions, restatements and corrections.
- Only **Confirm question** writes Focus. It copies exactly the Live version Pablo saw, after server acknowledgement. Model output, silence, transcript finality and timers never write Focus.
- After Confirm, or after **Clear live** (formerly Start question), Live clears and refills only from speech heard afterwards. A small muted tag says whether Live holds a "new question" or a "restatement".
- Confirmation sets phase QUESTION, leaving time to reflect. A confirmed restatement keeps the current exchange; any other confirmation starts a new one.
- **BREAKING** for the paired browser and service: `question.start` becomes `question.reset`. Draft fields become Live fields, Focus fields replace `question`/`questionVersion`, and `questionOrigin` is removed.

![Speech fills Live automatically; only Confirm question copies the seen Live wording into Focus; Live then refills from later speech while Focus stays fixed.](images/proposal-flow.svg)

## Capabilities

### New Capabilities

- `live-question`: always-visible automatic interpretation, evidence cutoff, Clear live and readable tagged wording.
- `question-confirmation`: exact-version consent from Live to Focus, acknowledgement, stale and retired requests, and retries.
- `focus-question`: Focus written only by confirmation, kept through reflection and answers, and safe across failures and session boundaries.

### Modified Capabilities

None: the OpenSpec capability inventory is still empty. `live-question` and `focus-question` replace the earlier draft names `question-clarification` and `question-tracking`. Nothing was archived under those names.

## Impact

The change touches `app.js`, `index.html`, `poc/session.mjs`, `poc/agent.mjs`, `poc/server.mjs`, the tests and their Markdown companions. The earlier version of this change is already implemented, uncommitted, on branch `sprint-01`, so the work modifies that code. It adds no SDK, database or audio transport. Answer suggestions, cross-session storage and speaker recognition are excluded.

SPRINT-001 is active for UC-04. Its recorded objective and acceptance criteria still describe the 28 October behaviour, and only Pablo can update them. This proposal does not change sprint state.

## Decisions and source baseline

On 4 November 2026 Pablo decided: *"I like to see two areas all the time"*. This supersedes the 28 October choice of confirmation only during clarification. The 28 October decision that **Pablo's voice alone is sufficient** still holds. The same day Pablo accepted the five design recommendations in [08 decisions](../../../docs/asdg/08-low-level-design/03.4-uc-04-openspec-update.md): keep Clear live, the exchange numbering rule, the tag, phase QUESTION after Confirm, and no shortcut. These are stakeholder direction relayed by 09 Coding, not exact-document acceptance.

"Accepted bytes" means a matching User acceptance hash in [the lifecycle ledger](../../../.asdg/lifecycle.json). The 03 and 08 documents are AI-modified drafts. The [design](design.md) lists the code baseline.

| Source | SHA-256 of inspected bytes | Claim used and status |
| --- | --- | --- |
| [Purpose](../../../docs/asdg/02-purpose/01-purpose.md) | `2b288e476d331b96c7c269ae0f38daf87804e1c49015b0dcfc512b1b4b8601b0` | Glanceable visual guidance; accepted bytes, package stale. |
| [Next outcome](../../../docs/asdg/02-purpose/03-planned-improvements.md) | `5319c35ac926315c133fd56badd6e501af278acdad7e097a41d698e73b4fbf4f` | Persistent question; accepted bytes. |
| [UC-04](../../../docs/asdg/03-system-model-and-use-cases/01.4-confirm-current-question.md) | `313f1ab9dd5fc40194a8c53cabd2e9b187be3008ce0ac791856a4fd5ade79330` | Focus/Live behaviour and failure scenarios; 4 Nov draft, not accepted. |
| [Evaluation](../../../docs/asdg/04-benchmarks-and-eval-strategy/01.2-evaluation-criteria.md) | `e1ea9652518ed8401daee8517966f9b6eeb9d578425f164e90e6f5529a65e31d` | Fidelity, persistence, readability; accepted bytes. |
| [Interview state](../../../docs/asdg/05-high-level-design-and-architecture/01.2-interview-state.md) | `ebed2f85ae618967f48a87f384d3a2885a752cb3a689e2e85de61b56b1b1cde4` | Its automatic promotion conflicts with Focus; Pablo's 4 Nov decision governs UC-04. Accepted bytes. |
| [08 design overview](../../../docs/asdg/08-low-level-design/03-uc-04-focus-and-live-question.md) | `7d7d766f0112b82ebbad0139c245a58f42cdd80b6b19e33b728f7a4a5aee3c57` | Cycle and mockups; draft. |
| [08 state model](../../../docs/asdg/08-low-level-design/03.2-uc-04-state-and-rules.md) | `bce6d379817401e6be72af653b15fbb0a4990914617b290c4b94035cf99e23aa` | Fields, transitions, invariants; draft. |
| [08 protocol](../../../docs/asdg/08-low-level-design/03.3-uc-04-protocol.md) | `2ba2fe8c65d985d72348cddedff30171e268e217a21973afe71569d00d535875` | Message and result contract; draft. |
| [Sprint state](../../../.asdg/sprint.json) | `601d2bebae897927aeaf18ed8769f73475b8ae2009a022f79b16e5c9ced5e31a` | SPRINT-001 active with the Focus/Live criteria. |
