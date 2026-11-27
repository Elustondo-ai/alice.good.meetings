# Team create tests

These tests check the pages and packaging of the two skills that start a team in the Claude desktop app: [Team create](../skills/asdg-team-create/SKILL.md), which starts a team's lead chat, and [Team members create](../skills/asdg-team-members-create/SKILL.md), which the lead uses to start its twelve role chats.

| Test | What it shows |
| --- | --- |
| `test_both_skills_are_packaged_registered_and_human_only` | Each skill's page, adapter template and Codex policy, the step program and its page are in the package list, the skill is discovered, its Claude adapter cannot be invoked by the model on its own, and the skill index and Help list it |
| `test_each_skill_is_one_short_page_that_asks_nothing_and_holds_no_prompt` | Each page stays within 50 nonblank lines, says to ask nothing and that it is for the Claude desktop app only, and holds no prompt text, because the texts live in the program |
| `test_team_create_turns_the_typed_chat_into_the_lead` | Team create refuses a chat that another chat started, titles the chat as the lead, takes later teams' folders from the existing worktree script, and hands over to Team members create in the same chat without starting a lead chat |
| `test_members_page_is_a_loop_that_the_program_drives` | Team members create tells the lead to run the step program, do exactly the one action it prints and report back, names the four actions, forbids retries and changes, holds no role table of its own, and the program's page quotes the app's limit and says why the human types into the lead |
| `test_only_the_human_request_authorizes_and_policy_names_both_routes` | Team members create says only the human's typed request authorizes it and skips existing roles, and the session policy and runtime contract permit chat creation through these skills |

## Fixtures

None. The tests read the product's own pages, templates, package list and catalogue.

## Run

```sh
cd asdg && python3 -B -m unittest tests.test_team_create
```

## Limits

The tests check wording and packaging only; the step program has its own [tests](test_team_members.md). What the app does needs a real session in the Claude desktop app.
