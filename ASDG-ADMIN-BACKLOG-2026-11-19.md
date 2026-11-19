# ASDG Admin backlog (methodology improvements) and tomorrow's prompt

Draft of 19 November 2026 by 00 Governance for Pablo. This is the methodology's own maintenance list. It is separate from the Alice product backlog in `docs/asdg/07-planning/03.12-product-backlog.md`, which must never hold methodology items. Nothing here is approved, applied or pushed.

## Admin backlog

| ID | Story | Source |
| --- | --- | --- |
| A-01 | As Pablo I want 07 Planning to keep a product backlog and build sprint proposals from stories by default, so planning stays agile without being asked | 19 Nov session; the earlier Admin analysis below |
| A-02 | As Pablo I want Admin and every role to check that the session folder is the project's Git root, and to warn when it is a Google Drive copy, so edits never land in a stale tree | An Admin session worked in the Drive copy on 19 Nov and found stale documents and an active SPRINT-003 |
| A-03 | As Pablo I want the 77 "Package manifest differs" integrity failures (and 3 of 215 unit tests) explained or fixed in a deliberate packaging step | Admin baseline run on the Drive copy; not yet checked in the git-projects copy |
| A-04 | As Pablo I want a defined way to update the root `AGENTS.md` data statement, which the sprint gate treats as agent policy | SPRINT-003 criterion 9 could not be met; the statement is still the old one |
| A-05 | As Pablo I want role names such as `asdg-05-architecture` to resolve for cross-session messages, so Governance need not look up session IDs | `SendMessage` works only by `local_...` ID |
| A-06 | As Pablo I want specialists' documents recorded with exact hashes at the time of edit and a stale-hash warning, so 09-style reports are not silently invalidated by later edits | 09 Coding reported its hashes stale after other roles edited files |
| A-07 | As Pablo I want a closeout skill step that offers to update the backlog after a sprint closes | Optional line the Admin proposed for `asdg-sprint-close`; left out for now |

## A-01 in detail: the Admin's analysis, saved

Where 07 Planning falls short today: the word "backlog" does not appear in 07's files; sprint proposals are only implied (`prepare-plan` says "sprint scope, bounded tasks"); the pre-coding document list exists only inside sprint-align after a sprint is defined; closure evidence is an input but 07 is not required to state it; nothing carries stories forward at close; authority limits are already explicit.

Conflicts and how the proposed wording resolves them:
- 07 must not choose the next specialist: it names the missing document and its stage and returns it to the Coordinator.
- The continuation contract and `status-format.md` say not to invent backlog items: stories come only from the human, specialist flags and source evidence, never from Planning's own advice, and the backlog is never the methodology's own list.
- 07's contract forbids a second copy of sprint state: the backlog holds sprint IDs and closeout links only; scope and criteria stay in `.asdg/sprint.json`.
- Sprint start rejects `docs/asdg/` as scope: proposals list application paths as scope and list documents separately.
- 50-line page limit and visual rule: split the backlog into pages, one diagram per format page.
- Templates: `asdg/templates/` holds only generated client adapters, so the two formats go beside the skill, in `asdg/07-planning/skills/prepare-plan/`, as sprint-align does with its `report.md`.

Proposed edits (apply only after approval, in the git-projects copy):
1. `asdg/07-planning/AGENTS.md`, under "Owned responsibility": keep the product backlog in `docs/asdg/07-planning/` per `skills/prepare-plan/backlog.md`; build every sprint proposal from stories per `sprint-proposal.md` and say whether the active sprint must close first and what its closeout lacks; list the specialist documents a proposal needs, return missing ones to the Coordinator; at sprint close update the backlog, carrying unfinished stories forward and linking the receipt; these are default duties and the human decides. Under "Explicit exclusions": do not begin tasks, bypass preflight, approve plans or record approval, edit application code, start, stop or amend a sprint, or create Git commits.
2. `asdg/07-planning/types/contract.md`: input "the current backlog"; output "the product backlog and the sprint proposals built from it; story status records evidence, never approval"; invariant "the backlog is a client document, not a second sprint state; stories come from the human, specialist flags and source evidence".
3. `asdg/07-planning/skills/prepare-plan/SKILL.md`: procedure becomes read scope, backlog and closure evidence; capture stories; draft the proposal from stories with an Option B and a recommendation; list documents needed before coding; state whether the active sprint must close first; update the backlog after a close; return proposals only.
4. `asdg/07-planning/tests/acceptance.md`: three rows (remark becomes a story; proposal built from stories; declines to start a sprint), marked NOT RUN.
5. New `skills/prepare-plan/backlog.md`: story fields (ID `B-nn` never reused, story, acceptance idea, size S/M/L, needs, source, status ready / needs a decision / parked / done / dropped, sprint ID); rules (capture only what the human said, flags or sources show; deferrals are parked with the human's words and date; done links a receipt whose criteria passed; dropped keeps its reason; never delete); a status-flow diagram.
6. New `skills/prepare-plan/sprint-proposal.md`: theme and objective; stories and order; exact application scope with documents listed separately; draft criteria traced to story IDs; what is out; documents needed first with state and owner; whether the previous sprint must close first; Option B and a recommendation; facts, assumptions and unknowns marked.

After approval the Admin runs `check-write` for each target with `workflow: admin`, keeps before-copies for a `.diff`, records hashes in `.asdg/document-reviews.json` and in `00-governance/types/document-reviews.json`, saves a change record `docs/asdg/07-planning/02.12-review-planning-backlog.md`, and prepares an upstream proposal for `Elustondo-ai/asdg`. It touches no application code, sprint state, hooks or other `.asdg/` state, and does not commit or push.

## Prompt for tomorrow's ASDG Admin session

Start the session in the Git copy, `/Users/pabloelustondo/git-projects/alice.good.meetings`, not the Google Drive copy. Then select Admin with `/asdg-admin` and paste:

```text
Role: ASDG Admin. I (Pablo) authorize this bounded task in /Users/pabloelustondo/git-projects/alice.good.meetings only (not the Google Drive copy; if your working directory is anywhere else, stop and tell me).
Read ASDG-ADMIN-BACKLOG-2026-11-19.md at the repo root and docs/asdg/07-planning/03.12-product-backlog.md, 03.12.1, 03.13 and 03.13.1 as the example of what 07 should produce by default.
Then redo the analysis of 07 Planning against the six expectations in story A-01, confirm or correct the proposed edits listed there against the real files, and show the exact wording of every edit before applying anything. Apply only after my explicit approval, record hashes, run the methodology's checks and compare with the baseline in this copy, and do not commit, push, regenerate the package manifest, or touch application code, sprint state or hooks. Also add stories A-02 to A-07 to a separate ASDG Admin backlog page under the methodology's proposals folder if you find that is the right place; tell me where you chose and why.
```
