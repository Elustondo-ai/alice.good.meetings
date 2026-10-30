# UC-04 implementation tasks

These unchecked tasks are proposed work, not execution evidence or a SPRINT-000 extension. Before application edits, require a later explicit apply request, an applicable human sprint decision, role authority and per-target checks. [User decisions and ASDG source baseline](proposal.md#decisions-and-source-baseline) govern scope; [design](design.md) supplies interfaces and proposed defaults.

![Controller and reasoner precede transport, browser controls and integrated evidence; tests and documentation accompany each implementation group.](images/task-flow.svg)

## 1. Draft state and reasoning

- [ ] 1.1 Extend `poc/session.mjs` with separate draft/question versions, provenance, exchange identity and clarification entry/refinement; add deterministic `poc/poc.test.mjs` cases for automatic/manual entry, repeated Start, corrections, multipart content and no promotion on silence. Verify the [clarification requirements](specs/question-clarification/spec.md) with `node --test poc/poc.test.mjs`.
- [ ] 1.2 Extend `poc/agent.mjs` schema/prompt and controller routing with explicit clarification/new-question/answer intent and cited evidence, allowing Pablo-only clarification while preserving automatic tracking. Verify schema rejection, same/new/unknown exchange handling and ordinary-answer restatement fixtures against [tracking](specs/question-tracking/spec.md); injected proposals verify control logic, not real model accuracy.
- [ ] 1.3 Document fields, cutoff/phase rules, speaker uncertainty and proposed limits in `poc/session.md`, `poc/agent.md` and `poc/poc.test.md`; verify each public contract against the edited code and render its explanatory visual.

## 2. Confirmation and transport

- [ ] 2.1 Implement atomic exact-version confirmation and bounded request-result caching in `poc/session.mjs`; test success, empty/unknown/stale/altered drafts, incorrect session, duplicate requests, changed retry payloads, receipt limits and pre-confirmation model results. Verify every [confirmation scenario](specs/question-confirmation/spec.md), including unchanged question/exchange versions on retries and rejection.
- [ ] 2.2 Extend `poc/server.mjs` control dispatch and versioned responses while preserving audio framing, origin checks and Stop cleanup; add injected-WebSocket tests proving audio continues during confirmation and malformed controls preserve valid question state. Verify with `node --test poc/poc.test.mjs`, including wrong-session, disconnect and delayed-result cases.
- [ ] 2.3 Update `poc/server.md`, `poc/session.md`, `poc/poc.test.md` and `poc/docs/04-server-and-protocol.md` with examples of start, confirm, success, stale and retry responses; verify examples match schemas and that response documentation distinguishes render acknowledgement from consent.

## 3. Browser clarification and confirmation

- [ ] 3.1 Add separate current/draft regions and Start question / Confirm question controls in `index.html` and `app.js`, using native keyboard interaction and preserving the color timer. Verify [clarification](specs/question-clarification/spec.md) with mouse/keyboard, empty/disconnected states and complete multipart text at desktop and narrow viewport widths.
- [ ] 3.2 Bind Confirm to the rendered tuple, freeze submitted text while pending, reconcile request results separately from monotonic snapshots, and show uncertainty/retry feedback. Extend `poc/browser-smoke.mjs` with deterministic protocol fixtures for newer unseen drafts, lost/duplicate/old acknowledgements, restart and stale-session events; verify [confirmation](specs/question-confirmation/spec.md) and [session boundaries](specs/question-tracking/spec.md).
- [ ] 3.3 Update `app.md`, `index.md`, `poc/browser-smoke.md` and `poc/docs/03-browser-and-audio.md` to explain controls, draft versus current wording, limits and cleanup; render and inspect the documents and keep example payloads consistent with transport documentation.

## 4. Integrated acceptance evidence

- [ ] 4.1 Run the integrated microphone flow with only Pablo audible: automatic clarification, manual fallback, correction, confirmation, reflection, answer, then an ordinary automatically tracked new question. Record displayed wording, session/draft/request identities and outcomes for all three specs; obtain live attention/readability observations without claiming broad effectiveness.
- [ ] 4.2 Exercise stale confirmations, delayed acknowledgements, network loss, late model output and Stop/restart through browser plus service; verify confirmed text cannot change silently and identical live-session retries do not create exchanges. Record browser-render times alongside commit and transcript times, labeling misses and uncertainty as required by [evaluation](proposal.md#decisions-and-source-baseline).
- [ ] 4.3 If replay is used, pass only elapsed audio through the existing downstream interface and keep evaluator references outside analysis; retain delivery/access evidence and treat synthetic button events as injected control tests. Verify the existing benchmark transcript/timestamps are unchanged; real-use benefit and automatic-intent accuracy remain separately evidenced.
- [ ] 4.4 Save the integrated UC-04 results under `docs/asdg/08-low-level-design/02-uc-04-verification.md`, with per-scenario pass/fail/unverified status, timing observations, visual evidence and unresolved limitations. Verify links and exact source/version attribution; obtain separate human review without marking these tasks done from proposal validation alone.
