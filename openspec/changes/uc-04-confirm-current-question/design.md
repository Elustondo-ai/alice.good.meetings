# UC-04 design

## Context

See [proposal motivation, user decisions and ASDG hashes](proposal.md). The existing controller has one `question` and a global revision; a QUESTION proposal citing final transcript text can replace that question. The browser renders `answer` events and the server accepts only `stop` and `rendered` controls. There is no confirmation path or exchange ID in this inspected implementation.

The following code was read, not executed for this proposal. These observed bytes supersede the dated architecture document's description of a browser-only prototype as evidence of current source behavior; no upstream historical document is rewritten.

| Source | SHA-256 | Relevant responsibility |
| --- | --- | --- |
| [Controller](../../../poc/session.mjs) | `16ba46e7b8e5a3c97bb9e9a58407371b77bf31cb14a7a7f556bdd6c83615c0a8` | Revision/evidence checks, snapshots, coalescing and Stop. |
| [Reasoner](../../../poc/agent.mjs) | `43ff0a2c883ece40b2a2c14a6a9f627328d76f6a20100e1bdb65b20424dd8ce3` | Structured proposals currently require interviewer-question evidence. |
| [Transport](../../../poc/server.mjs) | `0732aa9a158ef7c979d8e11a9a1ebbc6013e7bbca695c4735f90398a2ccf7db6` | Same-origin WebSocket, control dispatch and one connection-owned session. |
| [Browser](../../../app.js) | `188dadc7287357a1c6058d7f267e2055b75feb0c3057afab48cd79924ffadeca` | Monotonic rendering and capture lifecycle. |
| [Page](../../../index.html) | `6963f1f6cf33385e4175c011d53392723c95090f9760d24d764d61728a5426cc` | Color timer and scrolling diagnostic overlay; no question controls. |
| [Tests](../../../poc/poc.test.mjs) | `c4b09aab4027c63bea3465490e54abb7702319b6e603b886ab789cb81624c3a0` | Injected reasoning, stale proposals, retained answers, transport and cleanup. |

## Goals / Non-Goals

Implement the [clarification](specs/question-clarification/spec.md), [confirmation](specs/question-confirmation/spec.md) and [tracking](specs/question-tracking/spec.md) contracts in the existing small service. Keep audio intake independent of controls and reasoning; reuse session memory, the existing model integration and connection lifecycle. No durable storage, additional provider, automatic reconnect or speaker-recognition project is introduced.

## Decisions

![The browser submits its rendered tuple; the controller validates, commits once and returns a correlated result and versioned state.](images/design-protocol.svg)

**State ownership.** Extend controller state with `questionVersion` (0 before a question), `questionOrigin` (`automatic` or `user-confirmed`), `exchangeId`, and nullable `clarification: {id, version, text, exchangeId, baseQuestionVersion}`. Keep existing `question` as the authoritative text, not a second copy. Separate draft versions avoid rejecting consent merely because unrelated transcript activity advanced the global revision; a single shared text field cannot represent both draft and retained question safely.

**Entry and refinement.** Add structured agent intent `none | clarify | new-question | answer` with cited observations. Recognized clarify intent opens/refines a draft; Start question enters that mode immediately, records the observation/audio cutoff and waits for subsequent speech. It preserves existing draft text on repeated Start rather than clearing it. Manual intent is not speaker identity; silence and timer boundaries are not confirmation. Prefer this explicit control plus semantic detection to a mandatory spoken password.

**Versions and exchanges.** Opening, changing or confirming a draft increments global `revision`, invalidating older reasoning snapshots. Text changes increment draft `version`; question replacement increments `questionVersion`. A clarification keeps the current exchange unless evidence supports a genuinely new question; if none exists allocate the first exchange. Unknown relation conservatively retains the exchange and exposes uncertainty, a proposed default for review. Repeated confirmation cannot allocate another exchange.

**Exact consent.** The browser captures the rendered draft tuple at activation, including its exact text; the server compares it to its canonical draft without re-normalizing or substituting newer text. Choose stale rejection with current-state feedback over retaining a version history and accepting an old unseen-on-server draft. Validate and commit synchronously before publishing: update question/text provenance, increment versions, clear clarification, retain its evidence cutoff and set phase QUESTION so confirmation permits reflection rather than inferring ANSWER.

Emit the correlated confirmation result before any subsequent state broadcast. The browser must not infer completion of its pending request merely from an unrelated `answer` event containing confirmed provenance.

| Protocol extension | Payload and response contract |
| --- | --- |
| `question.start` | `{sessionId, requestId}`; return `question.result` with `started` and the current full snapshot; no wording is approved. |
| `question.confirm` | `{sessionId, requestId, draftId, draftVersion, expectedQuestionVersion, text}`; strings bounded, versions safe nonnegative integers, text nonempty and at most the existing 600-character controller limit. |
| `question.result` | `{sessionId, requestId, status, state}`; status is `started`, `confirmed`, `stale`, `invalid`, `unavailable` or `limit`; a confirmed result includes the accepted draft identity and resulting question version. |
| Existing `answer` / `rendered` | Extend full state with draft/provenance/version fields; retain existing question/reply fields. Render acknowledgements can additionally identify draft ID/version, recording display rather than consent. |

**Retries and errors.** Cache each well-formed control's payload fingerprint and result by request ID in the live session; identical retries return the original result and changed payloads return `invalid`. Proposed cap: 256 distinct controls per existing 30-minute session, then reject new controls with `limit` before mutation; retained results remain retryable. Unlike evicting successful receipts, this bounded policy cannot recommit an old request. Malformed controls produce safe feedback without exposing provider details or destroying a valid current question.

**Browser behavior.** Use native keyboard-operable buttons and separate current-question/draft regions. Disable Confirm while disconnected, empty or pending; freeze the submitted wording while queuing newer drafts until its result. Apply snapshots only when session matches and revision advances, but correlate duplicate/older results by request ID to settle pending status without rolling back the display. After five seconds without a result show “confirmation uncertain” and allow an identical retry; never auto-approve. New sessions clear pending controls and old confirmation labels.

**Automatic compatibility.** With a draft open, model question proposals only refine it. After confirmation, retain its wording through answer evidence, silence and acknowledgements; ordinary restatement is not clarification intent. A later explicitly cited new question can resume automatic promotion outside clarification, using final evidence beyond the confirmation cutoff. Suspected correction opens a separate draft, while ambiguous relation preserves the established question. Schema/version checks constrain ordering; fidelity and intent still need semantic evaluation.

## Risks / Trade-offs

- Misread clarification or new-question intent → retain the established question, expose uncertainty and test Pablo-only utterances, ordinary answer restatements and multipart corrections separately.
- Rapid draft changes or stale confirmations → freeze submitted text, reject stale versions visibly and retry only after renewed review; record browser-visible timing rather than inventing a latency guarantee.
- Disconnect after server commit → the page shows uncertainty and its previous acknowledged text; retries work only in the same live session. A restart is a new session, not recovery of consent.
- Input-size or control-count limits → show actionable feedback without truncating approved meaning; tuning these proposed limits requires review, not a hidden behavior change.

## Migration Plan

After explicit apply authorization and an applicable UC-04 sprint decision, extend controller/schema and tests, then transport, then browser and documentation as listed in [tasks](tasks.md). Ship browser and service together, keeping existing fields and audio framing. Restart local sessions for the new protocol; there is no persistent data migration. Rollback restores the paired prior browser/service versions and starts a fresh session; it cannot preserve session-only confirmed memory.

## Open Questions

Final control labels, layout spacing and a user-acceptable latency target remain review refinements; defaults are Start question / Confirm question and the existing reasoning cadence. Measure recognition-to-draft, click-to-commit and acknowledgement-to-render separately. Stage 04's provisional two-second question-display target is not a consent timeout or an accepted UC-04 gate.
