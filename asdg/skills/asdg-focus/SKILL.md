---
name: asdg-focus
description: Interpret the user's free-text Focus request, select the matching ASDG specialist or governance role, clarify ambiguity, or clear focus. Selection preserves existing authority.
---

# ASDG Focus — conversational selection

Read [session policy](session-policy.md). Only explicit user selection activates focus.
This is the single public Focus skill. Accept the user's own words, such as “focus on high level architecture.”
Trailing text is a conversational request, not a shell command; preserve its complete meaning and accompanying task context.

## Resolve the selection

Read [the existing catalogue](../../00-governance/types/agent-catalog.json) and the [interpretation and clarification guide](focus-choices.md).
Interpret intent using the phrase and relevant conversation context; match responsibilities, not just keywords. Numbers, role IDs and names remain valid shortcuts.
For one clear match, briefly state the interpreted role and continue without asking for confirmation.
For unresolved ambiguity, ask one question with the plausible specialists, a recommended option and its reason; await the user's choice before activation or renaming.
For missing or unrecognizable intent, ask which specialist the user wants and show all twelve; offer Governance separately.
Clarification preserves the previous focus, title and task. An unanswered or preselected recommendation is not a choice.
For an explicit clear request, including natural-language equivalents, skip role loading, clear only conversation focus, then rename and report Status.
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
Record the original phrase, interpreted role, actual source paths and invoked skill; keep all canonical role/evaluation boundaries.
All roles share [documentation authority](../../00-governance/docs/documentation-authority.md) under the client's `docs/`; code, approvals and operational gates remain separate.
Purpose selection begins its [opening assessment](../../02-purpose/skills/elicit-purpose/opening.md); activation alone writes no artifacts.
After successful activation or explicit clear, follow [the current-chat rename step](rename-chat.md).
Renaming is the narrow chat-metadata exception; failure never undoes successful activation/clear.
For `clear`, retain project context and independent restrictions; do not silently activate the coordinator.
Repeated selection of the same role refreshes required reads and retries rename; no child agent is created.
For Purpose, collect [Status](../asdg-status/SKILL.md) facts-only once, reuse them in the opening and include the actual rename outcome.
If Purpose selection includes an assignment, begin that authorized work without a redundant onboarding interview.
For clear or another role, return Status and stop; other specialist openings await pilot review.
Activation grants no project-file writes, installs, delegation, commits, deployment, sprint transitions or mode switches.
This YAML-first file records AI modification, not whole-file human approval.
