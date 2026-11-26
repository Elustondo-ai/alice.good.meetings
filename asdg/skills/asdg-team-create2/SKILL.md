---
name: asdg-team-create2
description: Create a separate top-level ASDG team with exactly twelve specialist chats using Copilot session tools, from a top-level or nested caller. Human or agent invocation; setup only, no worktrees or project work.
---

# Create one team, not another disconnected setup chat

Use this workflow in the Copilot Agents window when a human or agent needs a new ASDG team.
It is a conversational skill using native tools, not a shell script or a new CLI command.
Read [session policy](../asdg-focus/session-policy.md); preserve the caller's project, role, focus, attitude, title and location.
Read [the session protocol](session-protocol.md) and [activation instructions](activation.md) before creating anything.

```text
Caller (top-level or nested, unchanged)
Team N (separate top-level coordinator)
  01 Context ... 12 Observability (exactly twelve direct children)
```

The caller creates the team and places the children; the coordinator and specialists only activate and wait.
This avoids a second agent creating a duplicate roster or an extra setup session being mistaken for the team.

## Invocation and authority

Human invocation or agent invocation within the user's authorized goal permits this bounded setup without a separate human-only trigger.
Agent invocation is allowed, not required: do not create teams merely because this skill was discovered, read, installed or discussed.
This exception permits session creation, initial role assignment, moving only this run's new coordinator and specialist chats, and setup handoff messages.
It grants no project work, file edits, installation, worktree, branch, sprint, commit, push, release, deployment or shared sidebar-setting change.
Respect host permissions, costs and concurrency limits; skill instructions do not override them.
Unlike [Create team](../asdg-create-team/SKILL.md), later teams here share the verified project folder; do not run its numbered-worktree workflow.

## Resolve once

1. Resolve this installed client's root as `../../..`; read its `AGENTS.md`, `asdg/AGENTS.md`, [catalogue](../../00-governance/types/agent-catalog.json) and [lifecycle baseline](../../docs/lifecycle-baseline.md).
2. Verify initialization with `python3 asdg/scripts/cli.py status --json`. Missing stage evidence or an inactive sprint does not block setup; missing role/bootstrap sources do.
3. Read all thirteen catalogue entries, contracts, local procedures and required role sources, the shared runtime/envelope, installed Focus adapter and available catalogue TOML adapters. A missing required source blocks setup; a TOML file is instruction evidence, never proof of native agent loading.
4. Discover current native session tools and their schemas. Verify the caller's full chat link, enclosing session ID, project root and execution host; a nested chat is not a separate top-level session.
5. List all relevant project sessions, including children and archived entries where supported. Preserve every pre-existing session; titles reserve names but do not establish role identity.
6. For a fresh invocation, choose `Team N`, with N one greater than the highest reserved `Team N` in this project, or 1 when none exist. Recheck before creation; ambiguous or incomplete inventory blocks numbering rather than guessing.
7. For a retry/resume, recover this run's exact team and child IDs from its conversation receipt and inspect them. Do not choose a different team by title, fill it from another team, or create replacements for uncertain operations.

## Execute and verify

Use [the protocol](session-protocol.md): create and promote one coordinator to an independent session, then create and place one specialist at a time using returned IDs.
Use [the activation prompts](activation.md), explicit role IDs and exact custom titles; never ask any child to create peers.
Verify topology, titles, project binding, activation receipts and caller preservation separately.
Return the top-level team link and twelve child links with created/reused-on-resume, confirmed/pending/blocked activation and placement outcomes.
Report setup complete only when the exact roster is in the intended team; report full readiness only after all thirteen activation receipts are confirmed.
Stop with recoverable IDs on failure. Never repair by blindly recreating, deleting, moving the caller, editing internal stores, or typing into an uncertain UI composer.

## Examples

`Use asdg-team-create2` from General Session creates Team 1 if no team number is reserved.
The same request from Team 1's Planning chat creates a separate Team 2; Team 1 and Planning stay where they are.
`Resume the asdg-team-create2 setup at <team link>` completes that recorded run, not a new numbered team.
For regression scenarios and the limits of the observed evidence, see [TRY-IT](TRY-IT.md).
