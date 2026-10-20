# Embedded project contract — schema 1, pilot 0.2.0

The client contains the full `asdg/` distribution. Python 3.9+ and Git are required.
Run `python3 asdg/init.py` from that client Git root; no machine-wide installation is necessary.
The resolved Git root must be the parent of this distribution; an external provider is rejected.
The catalogue remains version 0.2, exactly governance 00 and stages 01–12.

## Operations

`init --dry-run` validates all planned destinations without writing.
`init` creates missing binding, lifecycle/sprint state, stage README scaffolds and discovery adapters.
`--project-status` explicitly declares first-install new/defining/defined; omitted defaults to new.
Repeat initialization preserves existing status, release, sprint, evidence and review history.
`python3 asdg/cli.py verify` inspects structure; `status --facts-only` and `status --json` do not call a model.
Plain status retains optional SDK advice; `--verbose` saves a bounded planning report and receipt.
`agent list/describe` inspects definitions. `next` and `dashboard` reuse the same status engine.
`sprint status/start/stop/check-implementation` preserves the authoritative sprint transition contract.
The human makes explicit transition decisions; initialization never starts a sprint.

## Outputs and preservation

`.asdg/project.json` records provider, schema, catalogue hash, embedded installation mode and version.
It uses repository-relative paths; no external home, checkout or Python environment is stored.
`.asdg/lifecycle.json` separates project, release and stage evidence; fresh release is null, evidence empty.
`.asdg/sprint.json` starts inactive; valid existing state is never reset.
`.asdg/document-reviews.json` retains exact-state modification/legacy-approval records, outside disposable logs.
`.agents/skills/` and `.codex/agents/` are thin generated adapters; the methodology stays single-source.
Root `AGENTS.md` retains client instructions plus one identified ASDG bridge.
`.codex/hooks.json` configures guard and public-log callbacks; `.codex/config.toml` enables hooks.
Root `.gitignore` adds precise log/cache exclusions, never all of `.asdg/`.
`docs/asdg/` contains client evidence; package files are never registered as client evidence by init.

## Conflicts and limits

Validate all managed destinations before writing; refuse symlinks, foreign providers and unsupported schemas.
Existing conflicting hooks/config/adapters or edited bridge blocks require explicit reconciliation.
Missing/malformed existing state, changed catalogue or distribution version require reviewed repair/migration.
The old linked-provider and `.asdlc` installation are outside this fresh-install pilot.
Ordinary write failures roll back only this operation's own changes; no cross-machine transaction is promised.
A repeated successful init makes no managed byte changes. No Git commit/push or native trust is performed.
Source documents remain within 50 nonblank lines; review history never approves newly edited bytes.
Configuration, native discovery, live invocation, semantic compliance and human approval remain distinct.
