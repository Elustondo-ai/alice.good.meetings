---
name: asdg-init
description: Initialize or verify the embedded ASDG distribution in an explicitly identified client Git repository. Use only for a direct installation request; never for application implementation, role activation or migration from a linked provider.
---

# Initialize embedded ASDG

Read [the installation contract](../../docs/installation.md), [client integrations](../../docs/client-integrations.md) and client root instructions.
Resolve this distribution from this file: `../..` is `asdg/`, `../../..` is the client root.
Verify the caller identified this client and its existing Git root; do not use a sibling provider.
Keep current source, documents, configuration and state. Do not initialize Git or install dependencies.
Before a first install, offer two optional questions together, using answers already supplied rather than asking again:
- What is this project for? A rough sentence is enough.
- Are we starting from scratch, extending an existing project, integrating with other systems, or a combination?
Say explicitly: “Answer either, both, or say skip, not sure, or initialize now.” No explanation is required to skip.
An explicit skip or request to initialize immediately proceeds without questions; partial answers are sufficient and unknowns stay unspecified.
If questions are offered, allow a reply before continuing; do not turn them into an interview or require answers to install.
For an already initialized project, preserve its orientation and do not repeat onboarding questions during verification.
The Python initializer stays noninteractive and creates generic introductions with embedded diagrams, without assuming a purpose or starting point.
Fresh projects inherit the flat numbered layout, human-documentation rules, per-file visual checks and CRC source-companion standard; initialization preserves existing content.
Choose `--client` first: an explicit user choice wins; otherwise use `claude` when running in Claude Code and `codex` when running in Codex. If the host is uncertain, ask; never install both unasked.
Run `python3 asdg/scripts/init.py --client <client> --dry-run` from that root; a conflict stops the mutation path. Adding a client keeps the other's files.
For a first install, use the user's explicit project status when supplied; otherwise default to `new`.
Never infer `defined`, approval or release readiness from code or document presence.
An explicit initialization request authorizes the initializer's reported writes; no repeated confirmation is needed.
Run the matching initialization command, then `python3 asdg/scripts/cli.py verify` and `status --facts-only`.
Repeat initialization and check that it reports no further managed changes.
If the user supplied orientation, save a concise `docs/asdg/00-governance/project-orientation.md` after successful setup and link it from that stage's README.
This bounded setup note records the user's rough purpose and starting point, with unknowns explicit; preserve existing content and record exact-hash documentation receipts.
Follow the shared documentation standard; a compact table of purpose, starting point and known dependencies is sufficient for this short orientation note.
If no answers were supplied, create no orientation note and leave generic introductions intact. Do not infer answers from the project name or lifecycle status.
Orientation is not approved Purpose, completed Context, accepted-empty Context or permission to implement; do not register stage evidence or acceptance from it.
Report native discovery and hook trust separately; neither can be inferred from generated files.
If a runtime guard denies initialization, preserve the denial and provide the exact human-terminal command.
Do not disable hooks, bypass trust, rewrite state by hand, start a sprint or activate a specialist.
Report results and unresolved conflicts; apply [continuation](../../00-governance/docs/continuation.md).
After successful setup, recommend ASDG Status (`$asdg-status` in Codex, `/asdg-status` in Claude) to inspect project facts and receive a project-wide next step.
Do not invoke another skill automatically, activate a specialist or continue into application work.
