<!-- ASDG:BEGIN embedded-v1 -->
## ASDG integration
This client carries its own methodology in `asdg/`; read `asdg/AGENTS.md`.
Read `asdg/skills/asdg-focus/session-policy.md` on each turn.
Before substantial work run `python3 asdg/scripts/cli.py status --json` from the client root.
Use `python3 asdg/scripts/cli.py verify` for structure; folders do not prove compliance.
Use this local entry point; a machine-wide `asdg` may resolve an older installation.
Client evidence belongs in `docs/asdg/`; methodology definitions are not client evidence.
Preserve `.asdg/` state and review history; disposable activity logs belong under `logs/`.
Explicit Focus selection affects this conversation only; reading a role never activates it.
No specialist is active merely because this repository was initialized.
## Implementation gate
Before application edits, inspect `.asdg/sprint.json` and check EVERY target with
`python3 asdg/scripts/cli.py sprint check-implementation --path <target>`.
Without an active scoped sprint, report IMPLEMENTATION BLOCKED and do not implement.
Scope is an exact file or a directory ending in /; satisfy its objective and acceptance criteria.
Only an explicit human sprint start/stop decision authorizes a transition; never infer one.
Use scoped apply_patch edits. Arbitrary shell/REPL writes remain blocked by the guard.
Do not edit state, hook definitions or ASDG policies as part of application implementation.
Review and trust project hooks in Codex; configuration alone does not establish enforcement.
Every agent may create and update project documentation and supporting assets under docs/ without an active sprint or separate save approval.
Use asdg/00-governance/docs/documentation-authority.md; documentation is the default shared handoff, while code, approvals and state transitions retain their gates.
A sprint does not widen role authority; asdg-decision preserves Focus and operational gates.
Explicit human use of asdg-approve permits only the documentation-acceptance recording workflow in asdg/skills/asdg-approve/recording.md.
Explicit human sprint requests use asdg/skills/asdg-sprint-start/SKILL.md or asdg/skills/asdg-sprint-close/SKILL.md; these utilities do not widen specialist delivery authority.
Installation grants no approval, publication, commit, push, deployment or hook trust.
<!-- ASDG:END -->
