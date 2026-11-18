# Proposed answer

## Purpose

Prepare, from one model call, up to three short points and supporting details for the confirmed Focus question, keep them tied to that question, and fail quietly. Exact rules (RQ, RS, CT, RT, TM, PR, FX) are in the 08 pages [request and result](../../../../../docs/asdg/08-low-level-design/03.5.1-s003-answer-request-and-result.md), [controller](../../../../../docs/asdg/08-low-level-design/03.5.2-s003-answer-controller.md), [retry and timing](../../../../../docs/asdg/08-low-level-design/03.5.6-s003-retry-and-timing.md) and [print and fixtures](../../../../../docs/asdg/08-low-level-design/03.5.7-s003-print-and-fixtures.md). Sources: UC-05 and architecture 01.3 (see the [proposal](../../proposal.md)). Commitments S003-ANSWER, S003-DETAILS, S003-CONTEXT, S003-LIVE.

## ADDED Requirements

### Requirement: One request with declared inputs
The service SHALL ask for an answer with one request holding only the session, the Focus version, the confirmed Focus text, the context kind and the package documents, and SHALL build the model input only from fixed instructions, the question and the document texts. The request and its result SHALL never enter the interview agent's input.

#### Scenario: Declared inputs only
- **WHEN** a Focus question is confirmed
- **THEN** the generator receives exactly those five fields, and the model input holds no session id, file name, audio, transcript or Live text.

### Requirement: One result with bullets and details
The service SHALL accept a result only as separate bullets (one to three single-line items) and details, within the length limits (at most three bullets of at most 120 characters each, and details of at most 1500 characters), and SHALL reject a malformed or over-limit result whole, never cutting or trimming it; a bullet with leading or trailing white space is rejected.

#### Scenario: Over-limit result
- **WHEN** the generator returns four bullets or text over a limit
- **THEN** the result is rejected as a failed attempt and nothing is shown.

### Requirement: Always replace on a Focus change
Every confirmation, a confirmed rewording included, SHALL in one update set Focus, show Preparing with no earlier content and start one request, aborting any earlier one. A result SHALL be accepted only for the current Focus version of an active session and published as one message with bullets and details together.

#### Scenario: Late result
- **WHEN** a result arrives for an earlier Focus version
- **THEN** it is dropped, never shown, and the audit names the reason.

### Requirement: Answer area never writes the session
The answer area SHALL have no write path to Focus, Live, phase, reply or revision, and SHALL NOT make a Live update stale.

#### Scenario: Result during a Live update
- **WHEN** an answer is published while a Live update is in flight
- **THEN** the Live update is still accepted and the cue is unchanged.

### Requirement: One retry, then Failed
The service SHALL retry a failed attempt once, immediately, with the same request, and then show Failed with no retry control. It SHALL NOT retry for a superseded version or a stopped session. The per-attempt timeout is provisional.

#### Scenario: Two failures
- **WHEN** both attempts fail
- **THEN** the answer area is Failed and the next Confirm starts afresh.

### Requirement: Stop keeps what was shown
On Stop or disconnect the service SHALL abort the request, never show its result, and mark shown, general and failed content, or a note that none arrived, as last known, keeping each answer's earlier status, reason and note. A new session SHALL start empty.

#### Scenario: Stop while preparing
- **WHEN** listening stops while an answer is being prepared
- **THEN** the area becomes Last known with no content and no later result appears.

### Requirement: Timing points without text
For each Focus version the service SHALL record the Confirm time, request start, accepted result, the page's render report for the bullets and the first voiced audio after Confirm, as one event with derived delays, and no audit event SHALL hold question, package or answer text.

#### Scenario: Bullets visible before speech
- **WHEN** the render report arrives before the first voiced packet
- **THEN** the event records the delay and that the bullets were visible before speech.

### Requirement: Optional print of the request
The service SHALL print the assembled model input to the terminal error stream only when the print option is exactly on, with a private-text warning, and nowhere else.

#### Scenario: Option off
- **WHEN** the option is unset
- **THEN** nothing of the request is printed.

### Requirement: Replaceable inputs for tests
The service SHALL accept replacement generator, transcription connection, clock, timeout, package folder and interview-agent delay, so every state is reachable without OpenAI.

#### Scenario: Fake generator
- **WHEN** a test supplies a generator
- **THEN** the default generator is never called.
