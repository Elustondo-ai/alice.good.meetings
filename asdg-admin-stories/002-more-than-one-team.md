# Story 002: more than one team, each in its own worktree

Status: Done by Pablo's decision of 22 November 2026; no chat has yet been started through the skills. Given on 20 November 2026 in the ASDG Admin chat.

## Request

Pablo, by voice, shortened; transcription slips corrected only where the meaning is plain ("ADHD create teams" is `asdg-create-team`):

> I want to be able to create more than one team. Today we have create team, that is supposed to only create one. But I want to update the skill. If the team has already been created [...] you can find Alice ASDG Team Lead [...] it will create a new one with a suffix of 2, the number 2 or 3 or n, whatever follows, and it will create a worktree and a branch 2. Basically what we did today manually, we created a worktree number 2 for the admin.
>
> We are going to have two types of teams. ASDG create team is the one that we already have. And another one very, very similar called ASDG Create Team Admin, which is going to be for changes in ASDG. And no matter which team is created, the new team will be working in the same folder, in the same branch that the other teams are working. And with the suffix corresponding to the number.

## What it means

Confirmed by Pablo on 20 November 2026, except the admin team line:

- There is one clone folder per project. Every team's worktree is created inside it; no second clone.
- `/asdg-create-team` run again in a project that already has a team does not reuse it. It finds the last team created and makes the next number: with teams 1 to 9 present, it creates team 10.
- Each new team gets its own worktree and its own branch carrying that number, as done by hand today for `sprint-04-2`.
- Every chat of one team works in that team's folder and branch. The number appears in the chat titles, for example `Alice ASDG Team Lead 2`.
- A second command, `/asdg-create-team-admin`, creates a team for changes to ASDG itself, numbered the same way.

## What exists today

- `/asdg-create-team` builds one team: Governance plus twelve specialists, reusing confirmed chats and never duplicating a role.
- Its Claude part says "no separate worktree unless the user asks".
- The team lead title is `<Project Nickname> ASDG Team Lead`, with no number.
- Today's manual steps: `git worktree add -b sprint-04-2 .claude/worktrees/sprint-04-2 sprint-04`, enter the worktree, add `.claude/worktrees/` to `.git/info/exclude`.
- Seen today: a chat moved into a worktree mid-session still shows its old branch in the phone app, so team chats should be started inside the worktree.

## Done when

- Running create team where team 1 exists creates team N with worktree, branch and numbered titles, and leaves team 1 untouched.
- Running it where no team exists behaves as it does today.
- `/asdg-create-team-admin` creates the admin team by the same numbering.
- Rules say how uncommitted work in the first folder is treated, and the checks and tests pass.

## Files

Likely `asdg/skills/asdg-create-team/` (`SKILL.md`, `create-chats.md`, `ordering.md`), `asdg/skills/asdg-focus/rename-chat.md`, a new `asdg/skills/asdg-create-team-admin/`, templates, package list and a change record.

## Progress

- 20 November 2026: story recorded. No ASDG file changed.
- 20 November 2026: Pablo settled "same folder": one clone, a worktree and branch per team, number taken from the last team.

- 22 November 2026: implemented on Pablo's "can we implement this ASAP?". Change record: [02.26](../docs/asdg/07-planning/02.26-review-numbered-teams.md). 7 new tests pass; no team created through the skills yet; adapters for `/asdg-create-team-admin` not installed; nothing committed.

- 22 November 2026: first run of `/asdg-create-team`. Team 1 found complete; worktree and branch `sprint-04-3` created from `sprint-04` at `9326d67`. No chat started: the app refused to start sessions while Pablo was on Remote Control.
- 22 November 2026: Pablo: "it's time to mark this complete [...] and just merge it with main so we can use it in the other team". Committed and pushed on `sprint-04-2` by his direction, an override of Admin's no-commit rule.

## Decisions for Pablo

Defaults Admin chose while implementing; each can be changed:

1. An admin team is one ASDG Admin chat.
2. Branch `<stem>-N`, cut from the calling folder's current branch.
3. A new team starts clean; uncommitted files are listed and copied only on your yes.
4. The last team is found from worktree folders and branch names.
5. The number sits after the role label: `05 Architecture 2`.

Still needed: your approval of the setup plan that installs the new command, and a first real run.
