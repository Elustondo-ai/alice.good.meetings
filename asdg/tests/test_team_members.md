# Team members tests

These tests check [team_members.py](../skills/asdg-team-members-create/team_members.md), the program that tells a team lead the one next step in creating its twelve role chats.

| Test | What it shows |
| --- | --- |
| `test_a_chat_the_human_typed_into_starts_all_twelve_in_order_without_waiting` | With no cap the program hands out 01 to 12 in order, with no wait and no card, and reports 12 of 12 |
| `test_a_capped_chat_waits_for_working_chats_then_leaves_cards_for_the_rest` | Against an app that allows five working and ten in total, a refusal makes it wait, a second refusal after the wait turns 11 and 12 into cards, and it reports 10 of 12 |
| `test_a_denied_start_is_never_retried_and_becomes_the_last_card` | A start the app's permission check denies is handed out once only, and ends as a card after the others |
| `test_two_denials_in_a_row_turn_the_rest_into_cards` | After two denials in a row no further start is tried; every remaining role becomes a card |
| `test_typing_the_command_again_starts_only_what_is_missing` | A new run keeps the ten that exist and starts only 11 and 12 |
| `test_a_start_counts_only_when_its_chat_is_in_the_list` | A start the lead reports but the app's list does not show is reported as not seen, and counts once the list shows it |
| `test_an_unreported_start_is_settled_from_the_list_not_repeated_blindly` | A step nobody reported on is repeated only if its chat is absent from the list; a result with no step waiting is refused |
| `test_titles_names_and_arguments_are_fixed_by_the_program` | Titles, short names and call arguments for team 1 and later teams, the fixed prompt, the card form, and `cwd` only when the team's folder is not the lead's |
| `test_role_table_matches_focus_choices_and_the_catalogue` | The program's twelve roles equal the short labels in Focus choices and the catalogue's stages |
| `test_the_team_folder_comes_from_git` | Team 1 is the clone and team N the one worktree on a branch ending `-N` under `.claude/worktrees`; a missing or unrelated branch is refused |
| `test_command_line_keeps_progress_per_team_and_prints_one_action` | Each command prints exactly one action, keeps one progress file per team in `.asdg/cache/`, which setup's ignore rules cover, and exits 2 on an unknown result or a run that never began |

## Fixtures

A small pretend app inside the test file plays the lead's side: it starts chats until its working or total limit is reached, and can deny chosen starts or hide chats from the list. One test builds a small Git repository with worktrees. No real chat is started.

## Run

```sh
cd asdg && python3 -B -m unittest tests.test_team_members
```

## Limits

The pretend app has no memory of the real app's rules beyond the cap the human-typed runs did not meet and the caps that chats started by another chat did. The real app may change them, and its permission check cannot be predicted. Whether a lead follows the printed steps exactly needs a real session.
