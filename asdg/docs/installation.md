# Install ASDG in a client repository

Extract the zip once so the Git root contains `asdg/scripts/init.py`, alongside the existing application.
Do not nest it inside another `asdg/` or run it from the old governance project.
Use Python 3.9+ and Git on macOS/Linux. Windows and remote/cloud hook enforcement are unverified.
Nothing changes outside the selected client repository; no shell startup file or Python environment is edited.

| Location | Ownership |
| --- | --- |
| `asdg/` | Local versioned methodology, scripts, contracts, templates and tests |
| `asdg/scripts/` | Python entry points and supporting runtime modules |
| `asdg/metadata/` | Distribution records; original delivery manifest retained under `deliveries/` |
| `.asdg/` | Durable project/release/sprint/evidence state, selected clients and document review history |
| `.agents/skills/`, `.claude/skills/` | Codex and Claude skill adapters, only for selected clients; canonical instructions stay in `asdg/` |
| `.codex/agents/` | Thirteen named-role adapters, Codex only |
| `.codex/hooks.json` | Guard and attributed activity-log callbacks, Codex only; trust must be verified locally |
| Root `AGENTS.md` | A short generated ASDG bootstrap first, then project-owned guidance |
| `docs/asdg/` | Client evidence and stage README scaffolds; existing documents are preserved |
| `logs/` | Ignored disposable records, centralized by session and child instance |

Choose Codex, Claude or both as described in [client integrations](client-integrations.md). For a first setup, run the command in a terminal or ask your agent to run it; the Init skill is not needed yet.
Every adopting project inherits the [human documentation rules](../00-governance/docs/documentation-standard.md) through `asdg/AGENTS.md`; initialization neither creates all source companions nor certifies their quality.
Optional commands, run from the project root:

```sh
python3 asdg/scripts/init.py --client claude --dry-run  # Preview a Claude setup without writing
python3 asdg/scripts/cli.py status --facts-only  # Inspect recorded project state
python3 asdg/scripts/cli.py verify  # Check project structure and integration
```

Add `--project-status defining` for an existing project; without it, a first setup records `new`.
Use the project-local CLI; a global `asdg` command may point to an older checkout.
The dry run validates all destinations and reports planned writes. A conflict causes no planned file writes.
Initialization refuses conflicting hooks, Codex config or either client's adapters; it never resets them, and repeat setup never recreates or duplicates a file.
Existing instructions and ignore rules are retained; the bootstrap goes first, earlier exact blocks move there, and an edited block requires review.
An initial status argument does not change a previously recorded status.
Missing or malformed existing state and incompatible versions require explicit repair/migration.
This fresh-install pilot does not migrate `.asdlc/` or the old linked-provider installation.

## Native checks

Open/reload the project in local Codex and inspect the skills picker and named-agent discovery.
Review the generated hook definitions through `/hooks`; only the human/native trust flow grants trust.
Confirm a harmless denied write in a disposable copy before relying on interception.
In Claude Code, ask "What skills are available?" or open `/skills`, and check loaded instructions with `/memory`.
Structural verification and direct hook execution are different from native runtime enforcement.
The Codex guard blocks arbitrary shell/REPL execution, including builds and tests, and once trusted may block repeat setup; run those in a human terminal.
Do not disable the guard merely to make a test or maintenance edit succeed.
Custom agents inherit parent permissions; advisory instructions do not create a separate sandbox.
See [native integration limits](native-integration.md) and the actual local runtime version.

## Repetition and upgrades

Repeat initialization preserves state and restores current generated entries; retire an older client's per-role Focus adapters only through an authorized migration after checking customizations.
Deleting `logs/` loses observations only; it does not remove lifecycle or review history.
Review package updates as diffs against this local working baseline; never replace the folder wholesale.
Keep `.asdg/` across upgrades. Catalogue/version changes require a reviewed migration.
`python3 asdg/scripts/check.py --integrity` compares package bytes to the delivered manifest; edits are visible.
Ordinary status/verify remains usable for intentional local changes if contracts and generated adapters agree.
