---
name: asdg-init
description: Initialize or verify the embedded ASDG distribution in an explicitly identified client Git repository. Use only for a direct installation request; never for application implementation, role activation or migration from a linked provider.
---

# Initialize embedded ASDG

Read [the installation contract](../../docs/installation.md) and client root instructions.
Resolve this distribution from this file: `../..` is `asdg/`, `../../..` is the client root.
Verify the caller identified this client and its existing Git root; do not use a sibling provider.
Keep current source, documents, configuration and state. Do not initialize Git or install dependencies.
Run `python3 asdg/scripts/init.py --dry-run` from that root; a conflict stops the mutation path.
For a first install, use the user's explicit project status when supplied; otherwise default to `new`.
Never infer `defined`, approval or release readiness from code or document presence.
An explicit initialization request authorizes the initializer's reported writes; no repeated confirmation is needed.
Run the matching initialization command, then `python3 asdg/scripts/cli.py verify` and `status --facts-only`.
Repeat initialization and check that it reports no further managed changes.
Report native discovery and hook trust separately; neither can be inferred from generated files.
If a runtime guard denies initialization, preserve the denial and provide the exact human-terminal command.
Do not disable hooks, bypass trust, rewrite state by hand, start a sprint or activate a specialist.
Report results and unresolved conflicts; do not continue into application work.
