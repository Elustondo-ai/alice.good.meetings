# Native session protocol

Use only within [asdg-team-create2](SKILL.md). Discover tool schemas before calling them; names below describe the observed Copilot interface, not an API to invent.
Required capabilities: inspect current session and project inventory, create a current-session chat, promote that chat to an independent session, move a specific chat into a named session, and read its activation response.
If the current host lacks the required topology or binds new sessions to the wrong project, report `BLOCKED: TEAM_TOPOLOGY` before creating children.

## Keep a receipt, not a second state store

Retain in this conversation: invocation goal, project/host, caller chat link and enclosing session ID, original inventory, chosen team title and returned team link.
For each role retain its exact title, canonical entry, created chat ID, staging owner, current owner/link, move outcome and activation status.
Record each returned ID before the next mutation. Use supported conversation checkpoints on resume; never use a shared ACTIVE_ROLE file or private application databases.

## 1. Create the coordinator

Call `create_session` with `relationship: currentSession`, exact title `Team N` and the [coordinator prompt](activation.md); use only supported project-binding fields.
Honor runtime model defaults; no forced model, reasoning or isolation settings.
Capture and inspect the returned new chat link, then call `move_session` with `session: <that link>` and `relationship: independent`; never pass the caller's link.
Capture the NEW independent session link returned by the move; inspect it and the project inventory. Promotion may change the owner/session ID, so do not continue using the staging link.
Require a new top-level session, the intended project/host and exact title. A link containing a child-chat selector is not proof of an independent team.
If the result is uncertain, reconcile against the pre-creation inventory and initial prompt before retrying. Ambiguity stops the run.
Do not move the caller to become the team and do not create a separate "Create Team N subsessions" coordinator.

## 2. Place the twelve specialists

The caller remains the only roster writer. Process the [twelve roles](activation.md#exact-specialist-titles) in order.
Create one chat using `create_session` with `relationship: currentSession`, the exact specialist title and complete activation prompt.
For a nested caller, this creates a sibling under its enclosing session, not a grandchild under the caller. It is temporary staging, not the final team.
Record the returned chat link/ID; verify it is new, not the caller, and belongs to this run. Never move a pre-existing peer by title.
Call `move_session` with `session: <returned child link>` and `into: <verified independent team link>`.
Capture the returned destination link; read both owners and confirm the same chat ID is under the team and no longer under the staging owner.
Proceed to the next role only after confirmed placement; this serial order also avoids concurrent updates to the same owner.
If the host requires an idle chat before moving it, use supported completion notification/wait behavior and then move that same chat.
Do not assume moving changes its role or title. The initial prompt already names the final team, not its temporary staging owner.

## 3. Reconcile and hand off

Inspect the final top-level team: exactly one coordinator main chat and twelve distinct direct child IDs, no thirteenth specialist or setup child.
Compare every ID/title against the receipt; verify the team remains independent in the same project and that the caller and all original peers remain unchanged.
Read each completed coordinator/specialist response. Confirmation requires canonical role reads and a role/boundary acknowledgment; idle status or a matching title alone is insufficient.
Use bounded native waits if exposed, at most 60 seconds per wait and two waits per batch; otherwise take one status snapshot and report remaining activation pending without polling.
After the roster is verified, use `send_message` when available to give the coordinator the final role/link mapping and setup-only boundary; never ask it to create children.
Retain its delivery acknowledgment separately from activation. If handoff fails, report it pending and include the roster for the user; do not open a UI composer or send to a guessed owner.
Return actual native links to the caller. Do not hardcode IDs from another run or change shared sorting settings to manufacture apparent order.

## Failure and resume

A limit on concurrent sessions means wait using supported mechanisms, then resume; it is not permission to create alternatives.
A service/permission failure stops further creation. Preserve successes and report the exact missing capability or denied operation.
For a failed/uncertain move, inspect source and destination by chat ID: already at destination means keep it; still at source means retry that move only if permitted; neither/both/unknown means stop.
For uncertain creation, inspect inventory before any retry. Do not guess from titles, copy history, delete partial work or create a second team to hide a failure.
A requested retry with an existing receipt resumes only missing roles, after verifying assigned roles, subjects and project. Conflicting receipts require clarification.
Native creation/move acknowledgments and metadata establish topology; visual inspection is a separate claim. Report unavailable UI or activation verification plainly.
