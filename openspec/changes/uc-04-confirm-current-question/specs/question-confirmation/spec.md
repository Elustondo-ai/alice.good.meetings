# Question confirmation

## Purpose

Make Confirm question bind the Focus question to the exact Live wording Pablo saw, with observable acknowledgement and safe failure behavior. The [UC-04 source and user decisions](../../proposal.md#decisions-and-source-baseline) support every requirement below.

![The server checks the displayed Live version: a match commits it to Focus once, while a stale request leaves Focus unchanged and asks for review of the newer Live.](../../images/confirmation-flow.svg)

## ADDED Requirements

### Requirement: Confirmation commits only the seen Live version
The service SHALL accept confirmation only for the active session's current nonempty Live identity, version and exact text, and the current Focus version. On success it SHALL make that text the Focus question and acknowledge the new Focus version. The page SHALL show it as Focus only after acknowledgement.

#### Scenario: Successful mouse or keyboard confirmation
- **WHEN** Pablo activates Confirm question for a displayed Live whose session, identity, wording and versions still match
- **THEN** Focus becomes exactly that text, Live clears, the phase becomes QUESTION and not ANSWER, and feedback says "Confirmed. Take a moment before you answer."

#### Scenario: Newer Live, retired Live or changed Focus
- **WHEN** confirmation arrives after the Live version or Focus version changed, or names a Live already cleared by Confirm or Clear live
- **THEN** the service returns stale, leaves Focus unchanged, and supplies current state; it never confirms unseen text.

#### Scenario: Invalid, empty or already-focused confirmation
- **WHEN** a request is malformed, altered, for another or stopped session, for an empty Live, or for Live text equal to Focus
- **THEN** nothing is committed, the page gets an invalid or unavailable result, and Focus stays visible.

### Requirement: Confirmation retries are idempotent
Within a live session, the service SHALL return the original result for an identical confirmation retried with the same request identity and SHALL NOT create another exchange or Focus version. Reusing that identity with different content SHALL be rejected.

#### Scenario: Acknowledgement is delayed or lost
- **WHEN** the page has no result five seconds after submitting and Pablo retries the same request in the same live session
- **THEN** the page shows "Retry confirmation" while keeping the submitted wording and the previous Focus, and a repeated success identifies the original commit without committing twice.

#### Scenario: Retry attempts to approve different text
- **WHEN** a request identity is reused with different Live text or versions
- **THEN** the service rejects the altered request rather than interpreting it as fresh approval.

### Requirement: Acknowledgements cannot roll back newer state
The page SHALL associate results with the submitted request and session and SHALL NOT replace a newer displayed state with an older acknowledgement. An accepted confirmation SHALL invalidate older in-flight model proposals.

#### Scenario: Late model result or acknowledgement arrives
- **WHEN** a model result based on pre-confirmation state, or an acknowledgement older than the displayed state, arrives
- **THEN** Focus is unaffected by the stale model result and the page keeps the newer state while settling the request separately.
