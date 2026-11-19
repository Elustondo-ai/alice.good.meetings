# Alice.Good.Meetings

Brief visual cues (GOOD, LAND IT, STOP) that help you stay focused and answer clearly in interviews and meetings.
See [AGENTS.md](AGENTS.md) for project guidance and [Purpose](docs/asdg/02-purpose/01-purpose.md) for the why.

## Prerequisites

Only Git is assumed. Install everything else below on a new machine.

### Mandatory: needed to install and run the app

| Tool | Version | Install | Used for |
| --- | --- | --- | --- |
| Node.js (includes `npm`) | 22 or newer | https://nodejs.org or `brew install node` | Runs the local service in `poc/` |
| OpenAI API key | — | https://platform.openai.com/api-keys | Live transcription and the coaching agent |
| Chrome or another Chromium browser | current | https://www.google.com/chrome | Opens the page and captures the microphone |

### Optional: only for the tasks listed

| Tool | Version | Install | Used for |
| --- | --- | --- | --- |
| pnpm | any recent | `npm install -g pnpm` | The project's package manager; `npm` works too |
| Python 3 | 3.9 or newer | https://www.python.org or `brew install python` | ASDG workflow: `python3 asdg/scripts/cli.py status` |
| OpenSpec CLI | 1.x | `npm install -g @fission-ai/openspec` | Proposing and applying changes under `openspec/` |
| Playwright | any recent | `npm install -g playwright` | Live browser smoke test (`poc/browser-smoke.mjs`, billed by OpenAI) |
| Claude Code or Codex | current | https://claude.com/claude-code | The ASDG team chats and skills in `.claude/` and `.agents/` |

## Initialize (once per machine)

```bash
git clone https://github.com/Elustondo-ai/alice.good.meetings.git
cd alice.good.meetings
cd poc && pnpm install --ignore-scripts && cd ..   # or: npm install --ignore-scripts
cp poc/.env.example poc/.env.local                 # then set OPENAI_API_KEY in poc/.env.local
node --test poc/poc.test.mjs                       # offline checks; no OpenAI calls
```

Instead of `cp`, you can unzip the password-protected env files: `unzip alice-env-files-locked.zip -d poc`.
Never commit `poc/.env.local`. If the folder syncs through Google Drive, rerun the install on each machine.

## Run

```bash
bash poc/start.sh
```

Open http://127.0.0.1:3000, press **Start Listening**, allow the microphone and wait for **listening on server**.
Press **Stop listening** to end, and Ctrl+C in the terminal to stop the server. Set `PORT` to use another port.
While listening, microphone audio and transcript text are sent to OpenAI.

More detail: [POC README](poc/README.md) and [running and verification](poc/docs/07-running-and-verification.md).
