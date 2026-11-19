<!-- ASDG:BEGIN bootstrap-v2 -->
## ASDG bootstrap
This project uses the ASDG methodology embedded in `asdg/`. ASDG setup generates this block; edit only outside its markers.
Before any project work, read and follow `asdg/AGENTS.md` and every startup source it requires.
If a required source is missing or contradictory, stop dependent work and report it; read-only diagnosis stays allowed.
Shared ASDG rules live under `asdg/`; project-owned guidance follows this block.
<!-- ASDG:END -->

## Alice.Good.Meetings project guidance

This section is project-owned. It points to the authoritative documents instead of restating them.

### What Alice.Good.Meetings is

Alice.Good.Meetings helps its user, today Pablo as the project owner, stay focused and answer clearly in interviews and meetings through brief visual cues read at a glance; see [Purpose](docs/asdg/02-purpose/01-purpose.md).
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

### Installing and starting the app

Steps with commands are in the [README](README.md) (Initialize, Run); detail is in [running and verification](poc/docs/07-running-and-verification.md).

- Requires Node.js 22 or newer. All dependencies are npm packages in [poc/package.json](poc/package.json): `@openai/agents` (pinned to 0.21.0), `ws` (^8.18.3) and `zod` (^4.0.0); the root page (`index.html`, `app.js`) has none.
- Install once per machine inside `poc/`: `pnpm install --frozen-lockfile --ignore-scripts`. `npm install --ignore-scripts` also works but ignores `pnpm-lock.yaml` and may resolve newer versions; if `pnpm` is missing, run `corepack enable` or `npm install -g pnpm`.
- Create `poc/.env.local`, which Git ignores, by copying [poc/.env.example](poc/.env.example) and filling in `OPENAI_API_KEY`; the other names there are optional overrides. Never print or commit the key.
- Check the install with `node --test poc/poc.test.mjs`; these tests do not call OpenAI.
- Start from the repository root with `bash poc/start.sh`, then open http://127.0.0.1:3000; open the page through the service, not as a file.
- Press **Start Listening**, allow the microphone and wait for **listening on server** before speaking; press **Stop listening** to end, and Ctrl+C in the terminal to stop the server.
- [`poc/start.sh`](poc/start.md) uses `ALICE_GOOD_MEETINGS_NODE` if set, then `node` on PATH, then the bundled Codex Node runtime; `PORT` changes the port from 3000.
- If startup or tests fail with `Cannot find package`, the package links in `poc/node_modules` are broken; repeat the install in `poc/` on that machine.
- Google Drive sync breaks `poc/node_modules` and makes Node need minutes to load packages. Run from a working copy outside Drive, for example `~/dev/alice.good.meetings` holding `index.html`, `app.js` and `poc/` without `node_modules`, install there, and re-copy changed source files when needed.
- Observed on 18 November 2026: the install took 5 seconds, 19 offline tests passed, and `/health` reported `configured: true` on Node 24.22.3 with pnpm 12.21.0.

### Project constraints

- Preserve the user's attention: brief, glanceable visual cues; spoken coaching previously interrupted his thinking ([Purpose](docs/asdg/02-purpose/01-purpose.md)).
- The OpenAI key lives only in `poc/.env.local`, which Git ignores; do not print it or commit it ([.env.example](poc/.env.example)).
- While the POC listens, microphone audio and selected transcript text go to OpenAI ([POC README](poc/README.md)).
- [`poc/browser-smoke.mjs`](poc/browser-smoke.md) makes billable OpenAI requests and uses synthetic speech, never a private benchmark recording.
- No analysis component may access future audio, private transcripts, evaluator labels or reference answers ([evaluation strategy](docs/asdg/04-benchmarks-and-eval-strategy/01-evaluation-strategy.md)).
- The benchmark transcript and timestamps in `eval-data/` are evaluation references, not live-agent inputs, and have been kept unchanged ([analysis guide](eval-data/interview-analysis-2026-10-25/README.md)).
