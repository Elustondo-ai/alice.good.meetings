# ASDG conversation selection policy — pilot

These are conversation instructions, not a native Codex mode or security boundary.
Read [session fields and receipts](session-state.md) each turn; role, subject, attitude and goal are independent.
Explicit native delegated assignments remain valid; these skills do not spawn or replace them.

## Selection

A genuinely new conversation starts with role None, subject NoFocus and attitude NoAttitude unless explicitly assigned.
[Focus](SKILL.md) retains existing role-selection requests and adds an explicit `subject` form; [Attitude](../asdg-attitude/SKILL.md) selects the thinking approach.
Explicit natural-language requests and valid role selectors may select governance 00 or stages 01–12; ambiguity requires a choice before switching.
Governance selects ASDG-COORDINATOR, an explicit whole-project responsibility distinct from no selected role.
Select a proposed role only after its canonical definition and required sources were successfully read.
Reading, maintaining, mentioning or comparing role packages NEVER activates them.
An ordinary skill, topic drift, directory change or status request NEVER selects or clears these fields.
A legacy focus-clear request clears the role only; `subject clear` clears the subject; attitude NoAttitude ends the hat and obsolete expiry.
Every selection preserves the other fields, project binding and conversation history unless the user explicitly changes them.
Invalid input or failed role loading preserves the prior valid state and title; record the failure.
If an active role's required guidance becomes unavailable, retain the declaration but block work needing that guidance.

## Retention and recovery

Retain the selected role on later turns without requiring re-invocation; assignment remains subject to its current contract.
Purpose includes its read-only opening; other specialist openings await pilot review. Activation alone writes no artifacts.
Keep the selecting instruction, actual source reads, goal, subject, attitude/scope/expiry and title outcome in THIS conversation's receipt.
Never use a shared ACTIVE_ROLE file, global hat, another conversation or user-wide logs to reconstruct this chat's authority.
On resume/compaction recover each field independently from a retained unambiguous receipt or supported session metadata.
Unknown fields remain Unknown; lost role evidence requires reaffirmation before specialist work, not an inferred role from the title.
Reread canonical role sources when retained context is insufficient or relevant definitions changed; distinguish earlier reads from fresh inspection.
Legacy role receipts remain valid; [session fields](session-state.md) define migration and distinguish known unset values from missing history.
Reconcile an explicitly scoped attitude's expiry under [Attitude](../asdg-attitude/SKILL.md); ordinary topic or role changes do not end it.
Begin substantive replies with the compact role/subject/attitude declaration; an expired override reports the restored value and attitude used.
A role's lifecycle number never establishes the target project's current lifecycle stage.
Unknown project does not block a role interview; project-specific work requires its real evidence and binding.

## Authority and utilities

All attitudes preserve honesty, role boundaries and code, approval and state-transition gates.
Every agent may save relevant documentation under the client's `docs/` through [shared documentation authority](../../00-governance/docs/documentation-authority.md); documents are the default handoff.
Purpose's two-gate review recording and explicit [Approve](../asdg-approve/SKILL.md) retain their separate documentation-acceptance contracts.
Human-directed [Sprint start](../asdg-sprint-start/SKILL.md), [review](../asdg-sprint-review/SKILL.md) and [close](../asdg-sprint-close/SKILL.md) keep only their stated permissions.
Mode changes, selected hats, agent readiness and successful structural checks never imply human approval or effective runtime enforcement.
[Status](../asdg-status/SKILL.md) reports project facts and separate session fields; it never reactivates a role or silently renames.
Direct Suggestion follows the selected role; Status requests project-wide advice under [continuation](../../00-governance/docs/continuation.md).
An advisory recommendation can suggest a different role, subject or attitude but cannot activate it.
Explicit [Create team](../asdg-create-team/SKILL.md) permits initial role-chat creation, preserving the caller's fields and existing peers.
Routing verifies project, role, subject and stable thread ID; report ambiguous candidates without silently choosing a title match.

## Current-chat title and acceptance

Successful role/subject/attitude selection or clear, repeat selection, explicit expiry and requested title refresh call [current-chat renaming](rename-chat.md).
Titles show the short role name, selected focus and selected attitude; omit the project suffix and all empty-field labels.
This narrow metadata allowance permits no file rename, peer change, internal-store edits or expanded project authority.
Keep valid state if renaming fails; distinguish the computed title from actual native outcomes and observed UI.
Use [the behavioral exercise](TRY-IT.md) and [attitude acceptance cases](../asdg-attitude/TRY-IT.md); scenarios are not test results.
Native discovery, retention, expiry, separate-chat isolation and resume/compaction require actual runtime evidence.
