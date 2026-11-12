# ASDG Distribution — portable pilot 0.2.0-pilot.2

ASDG is Agentic Software Development Lifecycle Governance: twelve stages, specialist responsibilities, evidence rules and sprint controls carried inside your client repository.
This pilot is an iteration baseline, not a claim of production enforcement or approved methodology.

## Learn about ASDG

Start with these three presentations (PowerPoint):

1. [ASDG introduction](../../agentic-sdlc-governance/docs/presentations/asdg-introduction/build/asdlc-introduction.pptx) — the ideas behind the method; [detailed version](../../agentic-sdlc-governance/docs/presentations/asdg-introduction/build/asdlc-introduction-detailed.pptx).
2. [Formalization Gradient](../../agentic-sdlc-governance/docs/presentations/formalization-gradient/build/formalization-gradient.pptx) — choosing how much structure a project needs.
3. [Codex agents, skills and adapters](../../agentic-sdlc-governance/docs/presentations/codex-agent-skills-and-adapters/build/codex-agent-skills-and-adapters.pptx) — how the method maps to development tools.

Optional extra material:

- [Coding-agent architecture](../../agentic-sdlc-governance/docs/presentations/coding-agents-architecture-article/build/coding-agents-architecture-article-detailed.pptx) — context, planning, tools and feedback loops.
- [ASDG Sprint Governance](../../agentic-sdlc-governance/docs/presentations/asdg-sprint-governance-review/build/asdlc-sprint-governance-review-detailed.pptx) — proposed sprint gates and human decisions.
- [Spec-Driven Development deep dive](../../agentic-sdlc-governance/docs/presentations/spec-driven-development-deep-dive/build/spec-driven-development-deep-dive.pptx) — a single research-reference slide.
- [Agentic AI](../../agentic-sdlc-governance/docs/presentations/agentic-ai/build/agentic-ai.pptx) — development-time and runtime agents.

These links require the sibling `agentic-sdlc-governance` working copy and its generated `build/` files. Presentations provide background; review drafts and historical terminology do not override this package's current contracts.

## Start

Unpack this one `asdg/` folder beside the client's application files, inside its existing Git root.
Python 3.9+ and Git are required. Bootstrap uses the standard library and makes no model calls.
For the fresh Speaker Coach project, run from its root:

```sh
python3 asdg/scripts/init.py --client codex  # or --client claude, or --client both
```

To hand setup to an agent, ask it to run that command for its own client; for Codex you can copy the [Codex setup prompt](CODEX-PROMPT.md). [Client integrations](docs/client-integrations.md) explains the choice.

This sets up local project instructions and state with the project marked as new; no sprint is started.
See [installation details](docs/installation.md) for optional previews, checks and other starting states.

In Codex, choose **[ASDG create team](skills/asdg-create-team/SKILL.md)** to set up governance and twelve specialist chats, reusing existing focused chats.
Each chat loads its role and waits for your assignment; team setup does not start project work.
Use **[ASDG Sprint start](skills/asdg-sprint-start/SKILL.md)**, **[Sprint review](skills/asdg-sprint-review/SKILL.md)** and **[Sprint close](skills/asdg-sprint-close/SKILL.md)** for human-directed sprint events.
Start defines active scope, review checks evidence, and close preserves the result before ending that scope; closure does not imply successful completion or release.

## Included

Governance 00, all twelve stages, thirteen role definitions and local procedures, Focus/Status skills,
the initializer, status/evidence engine, sprint transitions, guards and central activity recorder.
The optional existing Codex SDK advice adapter is retained; deterministic operation needs no SDK.
Presentation/video production, historical work reports and the external-source baseline generator are omitted.

## Read next

- [Codex handoff prompt](CODEX-PROMPT.md): copy into a general Codex conversation in this client.
- [Installation and ownership](docs/installation.md): generated files, conflict handling and native trust.
- [Workflow usage](docs/usage.md): focus, status, sprint scope and optional advice.
- [Lifecycle baseline](docs/lifecycle-baseline.md): exact twelve-stage order.
- [Review loop](docs/review-loop.md): the embedded folder evolves through bounded local iterations.
- [Verification](docs/verification.md): executed checks and remaining native-runtime work.
- [Source and changes](docs/provenance.md): selected snapshot, exclusions and adaptations.

Runtime Python lives in `scripts/`, package records in `metadata/`, and verification in `docs/`.
Keep `asdg/`, `.asdg/`, discovery adapters and engineering documents in Git; ignore disposable `logs/`.
No sprint, release, human approval, specialist session or hook trust is created by extraction.
