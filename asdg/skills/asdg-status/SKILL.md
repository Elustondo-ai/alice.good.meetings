---
name: asdg-status
description: Report current ASDG project and session facts, progress, evidence, pending decisions and blockers, then call asdg-suggestion for one next step. Role responsibilities belong to asdg-role.
---

# ASDG Status — project and session facts

Answer "Where are we now?" without performing project work.
Read client instructions and [session policy](../asdg-focus/session-policy.md); use [the report format](status-format.md).
Resolve the client root from this canonical file as `../../..`; use its embedded CLI, not a global launcher.
Keep three concerns separate: Status reports facts; [Role](../asdg-role/SKILL.md) explains the mandate; [Suggestion](../asdg-suggestion/SKILL.md) recommends action.

## Collect current evidence

Identify the target project from explicit context or its verified binding; never substitute the methodology provider.
Run `python3 asdg/scripts/cli.py status --json` from the client root for recorded lifecycle, release, sprint and structural facts.
Use this deterministic command without SDK advice. If denied or unavailable, report the exact gap once and qualify retained facts as stale.
Inspect relevant project artifacts under `docs/asdg/` and durable review records when needed to explain actual progress or pending decisions.
Report observed but unregistered work separately from registered stage evidence; an empty index never proves no work exists.
Where provided, distinguish agent readiness, human acceptance, exact-state review validity and application implementation permission.
Never promote a proposal, a saved document or an agent readiness assessment into human acceptance or product success.
Run `git status --short` for worktree facts; summarize staged/unstaged/untracked work without attributing authorship from filenames.
Use this conversation's successful activation/clear receipt for focus; no selection means None, not Governance.
Report explicit Governance as 00 / ASDG-COORDINATOR. Lost activation history means Unknown — reactivation required.
A known selection with unavailable guidance remains selected but blocked; Status never activates, refreshes or clears it.
State the latest substantive task and observed result, not this status request or an invented cross-chat activity.
Retain the last actual title-update receipt; do not infer UI visibility or focus from the title alone.

## Explain status without mixing roles

Use this order: compact status lines/table, Suggested next step, then Observations and technical debt.
Keep supporting Git details, open questions and verification limits in the final section; urgent blockers remain visible in the status lines.
Keep the role to its name/ID and availability; omit responsibilities, procedure explanations and boundary tutorials.
Include current implementation permission and reason as a workflow fact; link to Role for the detailed mandate.
Separate CLI facts, inspected artifacts, conversation reports and unknowns, with dates/source links where useful.
The CLI's earliest-unmet-evidence stage is a registration heuristic, not a human-declared current activity.
Explain material contradictions or missing decisions; do not recite every empty stage as a blocker.
Configured hooks, native trust and observed interception are separate; unknown trust is not a blanket read-only-work blocker.
Do not claim fresh verification, tests, deployment or user outcomes without observed evidence.
Show material limitations and source freshness; omit unrelated runtime/account configuration and sensitive data.
After the status lines, read and apply [Suggestion](../asdg-suggestion/SKILL.md) for a clearly labeled Suggested next step.
Follow it with Observations and technical debt; distinguish ordinary uncertainty and unfinished work from actual debt.
Pass the freshly collected status, inspected evidence and user priorities; reuse them rather than rerunning the same checks.
Keep that advice distinct from facts; give one action, why it matters and the expected result. Do not execute it.
Honor an explicit facts-only request by omitting the suggestion. If its guidance is unavailable, keep the report and state that limitation.
Return the report, then stop: no files/state changes, installs, role/title changes, delegation, approvals or sprint/release transitions.
