# ASDG Coordinator — package

Native name: `asdg_coordinator`. Stable role: `ASDG-COORDINATOR`.
This folder owns the specialization, not the consuming project's results.

| Entry | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Role entry point, boundaries and self-explanation |
| [docs](docs/README.md) | Package guide and relevant shared material |
| [types](types/contract.md) | Input/output contract; no mandated type language |
| [src](../scripts/lib/README.md) | Package-specific operations, when implemented |
| [tests](../tests/acceptance.md) | Role interview and negative-boundary acceptance cases |
| [local skill](skills/review-routing/SKILL.md) | Bounded procedure, explicitly loaded by this agent |

Shared [documentation](../skills/asdg-documentation/SKILL.md) remains single-source.
Using a capability does not grant its caller a new responsibility or write authority.

## Review

Ask Codex to spawn `asdg_coordinator`, read this package and introduce itself.
Ask an in-scope question, then request an excluded deliverable.
Expect a truthful proposal or an `OUT_OF_SCOPE` return, never fabricated execution.
Current mode is read-only evaluation; native behavior after this migration is not yet tested.
See [package catalogue](../README.md) and [runtime rules](docs/runtime-contract.md).

## Perspectives

Client assessments belong in the matching stage under `docs/asdg/`: `intended/`, `current/`, and `planned/`.
Empty folders make no evidence or completion claim; use the [shared contract](docs/stage-perspectives.md).
