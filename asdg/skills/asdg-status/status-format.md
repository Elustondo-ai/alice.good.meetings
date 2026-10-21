# ASDG status report

Answer "Where are we now?" using fresh facts and clearly labeled retained context.
Use this order: status lines, Suggested next step, Observations and technical debt.

## 1. Status lines

Open with a short factual summary and a compact Area / Current status table or equivalent lines.
Include the relevant project state, structure, stage progress/acceptance, sprint/release, implementation permission and chat focus.
Distinguish agent readiness from human acceptance, including review staleness where recorded.
Reflect explicit user deferrals separately from the CLI's missing-evidence heuristic.
Include the latest substantive task/result when useful; keep role responsibilities in `$asdg-role`.
Put an urgent blocker or qualification affecting the recommendation here; do not bury it below the advice.
Use actual observation time/freshness when material; do not fill the table with every empty stage.

## 2. Suggested next step

Apply `$asdg-suggestion` to the status evidence already collected.
Give one action, why it matters and its expected result; keep it advisory.
Include a short ready-to-use assignment when a focused chat would help.
Omit this section for an explicit facts-only request; continue to observations if relevant.

## 3. Observations and technical debt

Place supporting detail here: selected outcome, open questions, Git changes, pending decisions and evidence limitations.
Distinguish product uncertainties, observations and actual technical debt; do not label all unfinished work as debt.
Explain mismatches between registered evidence and observed work, including conversation-only deferrals.
Report configured hooks separately from native trust/enforcement; distinguish previous checks from checks run now.
Keep the last observed title/activation receipt here only when relevant; do not infer UI readback or other chats' activity.
Identify sources actually inspected and important freshness limits without repeating the status table.
Mention actionable maintenance issues proportionally; do not invent backlog items or commitments.
If nothing material remains, say so briefly rather than padding this section.

Preserve this section order unless the user explicitly requests another format.
Do not automatically invoke Role, execute the suggestion, mutate state or add a second interaction envelope.
