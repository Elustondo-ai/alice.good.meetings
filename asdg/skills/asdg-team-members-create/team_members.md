# Team members step program

`team_members.py` tells a team lead chat the one next step in creating its twelve role chats, and remembers progress. [Team members create](SKILL.md) says when to run it; this page says what it does.

It starts no chat itself: only a chat can, through the Claude desktop app's own tool. The program decides, and the lead carries out one call at a time.

## Use

Run it from the folder the lead works in. Every command takes `--team N` and, once per chat the lead has started, `--have "<title>"` read from the app's list.

- `begin --nickname NAME --team N` opens a run: when the human types the skill's command, or when Team create hands over.
- `result started|denied|refused|carded|failed --team N` reports what the app answered to the step just printed.
- `woke --team N` is for the turn in which the app wakes the lead because started chats reported.
- `status --team N` prints the report and changes nothing.

Each command prints exactly one action, and the command to run after it.

| Action | What the lead does |
| --- | --- |
| `start` | One call that starts one role chat, with the printed arguments |
| `card` | One call that leaves a card for the human and starts nothing |
| `wait` | Ends its turn with the printed line; the app wakes it later |
| `done` | Gives the human the printed report and stops |

## What it decides

| Matter | Rule |
| --- | --- |
| Team folder | Team 1 works in the clone, found from Git. Team N works in the one worktree under `.claude/worktrees` on a branch ending `-N`; `--root` overrides. The role chats start there (`cwd`) when it is not the lead's folder |
| Order | 01 to 12, one role at a time; the next is handed out only after the last was reported |
| Titles, names, prompts | Fixed in the program: `05 Architecture` for team 1, `05 Architecture 2` from team 2 |
| Exists | A role chat counts only when its exact title is in the `--have` list |
| No preset cap | It assumes none: chats the human typed into started twelve or thirteen at once on 25 November 2026 |
| Refused by the app | `wait` if chats from this turn still work, then try again; if refused with none working, the rest become cards |
| Denied by the app's permission check | Never retried; it becomes a card at the end. After two denials in a row, all the rest become cards |
| A step nobody reported | Settled from the list: started if its chat is there, otherwise handed out again |
| A new run | Chats that exist are kept; everything else is tried again |

Chats started by another chat were stopped by the app, in its own words that day: "at most 10 sessions without a card after each message from the user, 5 of them working at once". That is why the human types into the lead.

## Where progress is kept

`.asdg/cache/team-members-N.json` in the folder the lead works in, one file per team. Setup's ignore rules keep that folder out of Git. Deleting it loses nothing that the app's list does not show.

## Exit codes

- `0`: one action, or the status report, was printed.
- `2`: `BLOCKED` on standard error; no run has begun for that team, the team has no single folder, or the result word is unknown. Nothing was changed.

## Limits

It cannot see chats or call the app. It trusts the titles and the result word the lead passes. Whether a clicked card puts its chat under the lead has not been observed.
Tested by [team members tests](../../tests/test_team_members.md) against a pretend app, with and without the cap.
