# Using and maintaining embedded ASDG

This directory is the client's local methodology distribution, not the client application's evidence.
Follow the client root `AGENTS.md` and the user's explicit task. No external provider checkout is required.
Read [the lifecycle baseline](docs/lifecycle-baseline.md); preserve governance 00 and stages 01–12.
Use [the catalogue](00-governance/types/agent-catalog.json) for identities and paths; Stage 02 is Purpose.

## Client work

Read [the session policy](skills/asdg-focus/session-policy.md) on every turn.
Every session acts under an accountable role: 00 Governance by default, or a specialist only after explicit selection loads it.
Keep [goal, role, subject focus and attitude](skills/asdg-focus/session-state.md) separate in this chat's receipt; title changes reflect selections and explicit expiry, never grant authority.
Every agent may save project documentation under `docs/` without an active sprint or separate save approval; follow [documentation authority](00-governance/docs/documentation-authority.md).
Purpose Focus begins a read-only opening assessment; assigned Purpose work produces saved client documentation.
Use the [continuation contract](00-governance/docs/continuation.md); other specialist openings await the pilot review.
Human-directed [Sprint start](skills/asdg-sprint-start/SKILL.md), [review](skills/asdg-sprint-review/SKILL.md) and [close](skills/asdg-sprint-close/SKILL.md) preserve Focus and specialist delivery boundaries.
Read the selected role, its local procedure, runtime contract and response envelope in full.
Use client sources as evidence; definitions in this folder never establish application behavior.
Apply [Intended / Actual / Planned](00-governance/docs/stage-perspectives.md) to the stated client subject.
Run `python3 asdg/scripts/cli.py status --json` from the client root for project/release/sprint facts.
`$asdg-status` combines project facts with session progress; `$asdg-role` explains the current role's mandate.
Use `docs/asdg/` for accepted client artifacts and `.asdg/` for durable state and review records.
Use root `logs/` for disposable activity records; no role may claim complete logging without evidence.
Check every implementation target through the sprint guard; hook trust is a separate runtime check.

## Documentation rules for every adopting project

Governance 00, all twelve specialists and methodology maintainers must follow the [documentation standard](00-governance/docs/documentation-standard.md).
All reader-facing `docs/asdg/` artifacts explain the project to humans, with useful embedded visuals and technically precise prose.
Material decisions across all roles use [ASDG Decision](skills/asdg-decision/SKILL.md), with generic defaults and an [optional local specialization](skills/asdg-decision/specialization.md); role authority remains unchanged.
Every maintained source file requires a [CRC-inspired Markdown companion](00-governance/docs/code-companions.md), kept current with the code.
Documentation, guides and designs for a graphical interface open with who uses it and a captioned [representative visual](00-governance/docs/gui-visuals.md).
Apply the [documentation review criteria](00-governance/docs/documentation-review.md) before claiming documentation complete; initialization alone proves no compliance.
These portable requirements travel with this distribution and do not depend on SpeakerCoach or an external provider checkout.

## Explicit ASDG maintenance

Agent changes to these definitions run only under explicitly selected [ASDG Admin](admin/AGENTS.md) within a human-authorized scope; any role may propose them.
Maintaining a definition never activates the specialist whose file is edited, and no agent selects Admin to escape a restriction.
The user has chosen this embedded folder as an evolving working baseline; record bounded changes here.
Do not silently pull or overwrite it from the old sibling repository, package or Google Drive source.
Keep canonical skills here; native discovery adapters remain thin references generated from `templates/`.
Preserve state, evidence, user configuration and prior review records through changes.
Read [the iteration contract](docs/review-loop.md) before preparing a local maintenance handoff.
Preserve code, approval and state-transition gates; documentation authority does not start a sprint.
Run the relevant tests and distinguish configured, observed, tested and human-approved results.
Record edited documentation with exact hashes; never transfer an old approval to new bytes.
Keep YAML front matter first. Do not add human approval without an exact-state decision.
Do not infer commit, push, publication, deletion or deployment authority from a proposal.
