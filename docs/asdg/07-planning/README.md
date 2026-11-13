# Planning: choose a small piece of work

This folder connects desired outcomes to selected release and sprint work. A useful plan explains what we will do, why it matters, what is excluded and what evidence will show it is finished.

![Desired outcome → Bounded scope → Completion evidence. Diagram of this stage's purpose, not a completion claim.](images/stage-overview.svg)

## SpeakerCoach today

As of 28 October 2026, SPRINT-000 is active for the streaming/agent POC and no release is declared. The existing review reports concern documentation and ASDG evolution; they should not be mistaken for a committed product delivery plan.

## What belongs here as we develop

Release plans describe a broader delivery objective. Sprint plans select a small, explicit scope within that direction. Both need clear decision status, dependencies and completion criteria.

## Explore

- [Client-aware initialization](02.15-review-client-aware-initialization.md): `--client codex|claude|both`, thin Claude skill adapters from the shared templates, idempotent repeat setup.
- [`$asdg-admin` skill](02.14-review-asdg-admin-skill.md): an explicit skill that switches a chat to ASDG Admin, and `clear` back to 00 Governance.
- [Root AGENTS.md bootstrap and project guidance](02.13-review-root-agents-bootstrap.md): a seven-line ASDG bootstrap first, shared rules under `asdg/`, SpeakerCoach guidance after.
- [Governance default, ASDG Admin and title sync](02.12-review-governance-admin-and-titles.md): every session has an accountable role, and only Admin changes ASDG rules.
- [ASDG–OpenSpec proposal wrapper](02.11-review-openspec-proposal-wrapper.md): source-linked planning through the installed native OpenSpec workflow.
- [Concise role, focus and attitude titles](02.10-review-concise-role-titles.md): the current naming convention, with the thirteen short role labels.
- [Shorter session names](02.9-review-short-session-names.md): role and attitude in titles, with NoAttitude and NoFocus for unset selections.
- [Attitude and session naming review](02.8-review-attitude-and-session-naming.md): independent role, subject and thinking attitude, with portable skills and native test evidence.
- [Shared documentation authority review](02.7-review-documentation-authority.md): every agent can save documents while code and approval gates remain separate.

- [ASDG evolution task list](03-asdg-evolution-tasks.md): methodology work and its recorded sequencing.
- [ASDG installation lifecycle plan](03.1-asdg-install-lifecycle-plan.md): proposed `init`, `update` and `replace` under a mandatory clean-Git rule, and reconciling Alice's manual swap.
- [Continuation increment review](current/reviews/asdg-continuation-increment-01.md): evidence from that methodology increment.
- [Purpose documentation review](current/reviews/purpose-documentation-authoring.md): a documentation-related review record.

Read files in order: **01 Intended**, **02 Current**, **03 Planned**. Additional topics use dotted numbers such as `01.1` or `03.2`; release and sprint plans identify their horizon in the filename and text.
See the [folder guide](../../../asdg/00-governance/docs/stage-layout.md) for consolidation at cycle closeout. Return to [project documentation](../README.md).
