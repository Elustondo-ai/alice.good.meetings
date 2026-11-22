# Story 001: complete the sprint approvals and commands

Status: Noted. Given on 20 November 2026 in the ASDG Admin chat.

## Request

Pablo, by voice, transcribed as received:

> is one thing that I struggled today was to approve things, especially style coding. I think we need more approval steps. Style coding is one very clear, but we need to analyze other sprint approvals. Maybe a star. You know, we do have sprint close. So this story is about completing some sprint-related approvals and commands.

Admin's reading, not yet confirmed: "style coding" means **start coding**, and "maybe a star" means **maybe a start**.

## What it means

A sprint passes several points where Pablo must say yes, and today most of them have no command. He has to find the right words each time, and the yes is not recorded in one known place.
The story is to list every approval point in a sprint, decide which ones need a command, and add those commands.
Out of scope until Pablo says otherwise: documentation approval for stages, which `/asdg-approve` already covers, and release or deployment.

## What exists today

| Point in the sprint | Command today | Records Pablo's yes? |
| --- | --- | --- |
| Approve the proposed sprint: goal, scope, criteria | None | No |
| Start the sprint: branch and active scope | `/asdg-sprint-start` | Yes, as the start itself |
| Check readiness from purpose to specifications | `/asdg-sprint-align` | No; it reports `READY_FOR_09` or not |
| Review everything before code | `/asdg-pre-code-review` | No; it only builds the deck |
| **Approve the start of coding** | **None** | **No** |
| Review results against the criteria | `/asdg-sprint-review` | No; read-only |
| Accept the sprint's results | None | No |
| Close the sprint | `/asdg-sprint-close` | Yes, as the close itself; it is not acceptance |
| Commit, push, pull request | None | No |

Read from the skill pages on 20 November 2026; the sprint gate and sprint state pages are not yet read for this story.

## Done when

- Pablo has a written list of the sprint's approval points and has chosen which get a command.
- "Approve the start of coding" is one command that names what is being approved and records the yes.
- Each chosen command says what it permits and what it does not, and the checks and tests pass.

## Files

Not decided. Likely `asdg/skills/` for new commands, `asdg/00-governance/docs/sprint-gate.md` and `sprint-state.md`, the templates and package list, and a change record in `docs/asdg/07-planning/`.

## Progress

- 20 November 2026: story recorded; table above drafted from the six sprint and approval skill pages. No ASDG file changed.

## Decisions for Pablo

1. Is "start coding" the approval you struggled with today?
2. Which other points in the table should get a command in this story?
