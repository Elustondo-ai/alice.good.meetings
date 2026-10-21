---
name: asdg-focus
description: Explicitly focus this conversation on ASDG governance 00 or a specialist stage 01-12, or clear focus. Shared activation workflow for thirteen picker entries; no delegation or project execution.
---

# ASDG Focus — shared activation workflow v0.2

Read [session policy](session-policy.md). Only explicit user selection activates focus.
Prefer a dedicated `asdg-focus-<NN>-<label>` skill: its fixed role ID needs no argument.
The generic skill remains a shortcut; trailing text is an instruction argument, not a shell command.

## Resolve the selection

Read [the existing catalogue](../../00-governance/types/agent-catalog.json) and [UI choices](focus-choices.md).
A dedicated adapter supplies its fixed catalogue role ID; preserve its actual invocation in the receipt.
Extra task text is context, not another selector. Conflicting explicit selections require clarification.
Generic input accepts one trimmed, case-insensitive role ID, native name, 00-12, catalogue folder basename or listed alias.
Missing generic input: direct the user to the thirteen named Focus skills; keep focus unchanged and stop.
For `clear`, skip role loading, clear only conversation focus, then rename and report Status.
Unknown, ambiguous or path-like input leaves focus unchanged.
Resolve to exactly one catalogue entry, governance 00 or stage 01-12. Do not synthesize paths from user input.
00 selects ASDG-COORDINATOR / asdg_coordinator, an explicit management focus outside the twelve development stages.
Governance is distinct from None; `clear` never selects it. Never create or renumber roles.

## Read before changing focus

Resolve the client root as `../../..` and distribution root as `../..` from THIS canonical skill directory.
Read client root AGENTS.md and `asdg/AGENTS.md`; retain the target project and existing task context.
Verify its session-policy reference; otherwise report BLOCKED: SESSION_POLICY_NOT_CONFIGURED.
Use [the lifecycle baseline](../../docs/lifecycle-baseline.md); stop on identity/order disagreement.
Resolve the target project only from explicit context or verified binding; unknown is valid for an interview.
Read the selected catalogue `entry`, its required sources and catalogue `skill`, in full.
Include its contract, runtime rules and shared response envelope; resolve links from their containing files.
Check the role ID/native name/stage match the catalogue. Missing or contradictory sources block activation.
Inspecting these files does not activate them. A failed switch preserves the previous selection and title.
Do not replace definitions with an older SDLC2 folder, remembered summary or another project's package.

## Activate, rename and report

After successful reads, replace THIS conversation's focus with the selected canonical role.
Record actual source paths, available versions and the invoked skill; keep all canonical role/evaluation boundaries.
Roles retain evaluation boundaries; ASDG-02's contract additionally permits assigned Purpose documentation writes.
Loading a procedure does not start its interview, execute its task or write artifacts; wait for an assignment.
After successful activation or explicit clear, follow [the current-chat rename step](rename-chat.md).
Renaming is the narrow chat-metadata exception; failure never undoes successful activation/clear.
For `clear`, retain project context and independent restrictions; do not silently activate the coordinator.
Repeated selection of the same role refreshes required reads and retries rename; no child agent is created.
Return [ASDG Status](../asdg-status/SKILL.md), including the actual rename outcome, then stop.
No project-file changes, installs, delegation, commits, pushes, deployment, sprint transitions or mode switches.
This YAML-first file records AI modification, not whole-file human approval.
