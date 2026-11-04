<!-- ASDG:BEGIN bootstrap-v2 -->
## ASDG bootstrap
This project uses the ASDG methodology embedded in `asdg/`. ASDG setup generates this block; edit only outside its markers.
Before any project work, read and follow `asdg/AGENTS.md` and every startup source it requires.
If a required source is missing or contradictory, stop dependent work and report it; read-only diagnosis stays allowed.
Shared ASDG rules live under `asdg/`; project-owned guidance follows this block.
<!-- ASDG:END -->

## SpeakerCoach project guidance

This section is project-owned. It points to the authoritative documents instead of restating them.

### What SpeakerCoach is

SpeakerCoach helps its user, today Pablo as the project owner, stay focused and answer clearly in interviews and meetings through brief visual cues read at a glance; see [Purpose](docs/asdg/02-purpose/01-purpose.md).
This repository contains:

- The browser page, [index.html](index.html) and [app.js](app.js), which times speaking turns and shows GOOD, LAND IT or STOP; Markdown companions such as [index.md](index.md) sit beside the code.
- A local Node service proof of concept in [poc/](poc/README.md) that streams microphone audio to OpenAI transcription and an agent.
- Evaluation recordings and analysis in [eval-data/](eval-data/README.md), and proposed changes under `openspec/changes/`.
- Project documentation by lifecycle stage in [docs/asdg/](docs/asdg/README.md); the embedded ASDG methodology is in `asdg/`.

### Read first

1. [Purpose](docs/asdg/02-purpose/01-purpose.md), [current capabilities](docs/asdg/02-purpose/02-current-capabilities.md) and [planned improvements](docs/asdg/02-purpose/03-planned-improvements.md).
2. Current project, sprint and stage state from `python3 asdg/scripts/cli.py status --json`; it is recorded there, not here.
3. The [documentation index](docs/asdg/README.md) and the review records in [Planning](docs/asdg/07-planning/README.md).

### Where to look

- Use cases: [system model and use cases](docs/asdg/03-system-model-and-use-cases/README.md).
- Evaluation: [strategy and benchmarks](docs/asdg/04-benchmarks-and-eval-strategy/README.md).
- Architecture: [proposed design](docs/asdg/05-high-level-design-and-architecture/README.md) and [what the page does today](docs/asdg/05-high-level-design-and-architecture/02-current-architecture.md).
- Implementation: the [POC solution guide](poc/docs/README.md) and its [code map](poc/docs/06-code-navigation.md).
- Running and tests: the [POC README](poc/README.md) and [running and verification](poc/docs/07-running-and-verification.md).

### Project constraints

- Preserve the user's attention: brief, glanceable visual cues; spoken coaching previously interrupted his thinking ([Purpose](docs/asdg/02-purpose/01-purpose.md)).
- The OpenAI key lives only in `poc/.env.local`, which Git ignores; do not print it or commit it ([.env.example](poc/.env.example)).
- While the POC listens, microphone audio and selected transcript text go to OpenAI ([POC README](poc/README.md)).
- [`poc/browser-smoke.mjs`](poc/browser-smoke.md) makes billable OpenAI requests and uses synthetic speech, never a private benchmark recording.
- No analysis component may access future audio, private transcripts, evaluator labels or reference answers ([evaluation strategy](docs/asdg/04-benchmarks-and-eval-strategy/01-evaluation-strategy.md)).
- The benchmark transcript and timestamps in `eval-data/` are evaluation references, not live-agent inputs, and have been kept unchanged ([analysis guide](eval-data/interview-analysis-2026-10-25/README.md)).
