# Team creation acceptance scenarios

These are checks for [asdg-team-create2](SKILL.md), not evidence that it has run.
Use disposable user-authorized sessions; inspecting this file must not create a team.
For each run record caller/team/child IDs, before/after inventory, actual titles, source-read receipts and native outcomes.

## Required scenarios

| Scenario | Required result |
| --- | --- |
| Top-level caller, no existing teams | One new independent Team 1; exactly twelve direct specialist chats; caller unchanged. |
| Nested caller inside an existing team | A new independent Team N, not a child of the caller or its enclosing team; no new siblings remain staged. |
| Agent invocation within an authorized task | Same result without a human-only invocation gate; no project work or permission bypass. |
| Merely explaining or installing the skill | Zero session mutations. |
| Existing Team 1 | Fresh invocation reserves Team 2 or the next higher available number; Team 1 is untouched. |
| Concurrent/ambiguous naming | Reinspect inventory; do not claim unique numbering without evidence or take another run's team. |
| Resume after six completed placements | Reuse this run's verified IDs; create only missing roles; final team has twelve, not eighteen. |
| Move response lost | Find the same chat in source/destination before retrying; no duplicate child or blind deletion. |
| Creation response lost | Reconcile new native IDs and prompt evidence; stop if ambiguous rather than recreate. |
| No independent-session or move capability | Explicit topology blocker; no false team-success claim or UI-send workaround. |
| Coordinator handoff returns Unknown chat owner | Topology retained; handoff reported pending; no typing into a new-chat composer. |
| Source missing or canonical role conflicts | Block affected activation; never infer it from the chat title. |
| Child is idle but has no role acknowledgment | Activation pending/unverified, not confirmed. |
| Permission denial or concurrency limit | Respect denial; bounded wait only for limits; retain partial roster and exact IDs. |
| User returns to the caller | Caller remains in its original location and role; only the independent team owns new specialists. |

## Exact success check

Compare final roster with all twelve role/title pairs in [activation](activation.md#exact-specialist-titles).
Require twelve unique direct child IDs under the returned independent team ID, plus its coordinator main chat.
Require zero staged children from this run left under the caller's enclosing session and no extra setup/coordinator top-level session.
Require the correct project/host and intact original chats; inspect completed role acknowledgments separately from native idle indicators.
Full readiness requires thirteen confirmed activations; topology complete with pending activation must be labeled partial readiness.
Record message delivery separately; role labels, TOML presence, manifests and source checks do not prove native activation.

## Prior observation, not a test of this new skill

In Copilot on 26 November 2026, twelve `currentSession` chats were successfully moved by their IDs into an existing independent Team 1.
Their exact titles and histories were retained; native readback showed one main chat and twelve specialist children.
Earlier setup instructions had reached a different top-level session; checking only its children missed the wrong coordinator identity.
Direct messaging had reported `Unknown chat owner`; the subsequent UI handoff did not establish that the intended session received the request.
This workflow avoids that dependency: the caller places the roster directly and never uses UI typing as a routing fallback.
The complete fresh-team workflow from both caller topologies still requires live acceptance; source validation alone cannot certify it.
