# Codex prompt — first portable ASDG installation

Copy the prompt below into a general Codex conversation opened at the fresh Speaker Coach Git root.
The zip must already be extracted so `asdg/` sits beside `app.js` and `index.html`.

---

Work with me on installing and verifying the embedded ASDG pilot in this fresh Speaker Coach repository.
This is a bounded ASDG installation task. Keep the application and existing documents intact.
The embedded `asdg/` is our evolving working baseline; do not resolve the old sibling governance checkout.
Do not use a global `asdg` command, which may still point to the old installation.

Read `asdg/README.md`, `asdg/AGENTS.md`, `asdg/docs/installation.md`,
`asdg/docs/native-integration.md`, `asdg/docs/review-loop.md` and `asdg/docs/verification.md`.
Inspect the actual repository, applicable instructions and Git status. Record application file hashes.
Confirm the distribution is directly under this client's Git root; do not initialize another repository.

Run these commands from the client root:

```sh
python3 asdg/scripts/check.py --integrity
python3 asdg/scripts/init.py --project-status defining --dry-run
python3 asdg/scripts/init.py --project-status defining
python3 asdg/scripts/cli.py verify --json
python3 asdg/scripts/cli.py status --facts-only
python3 asdg/scripts/init.py --project-status defining --json
```

The repeat run should report no managed changes. Record actual results, not expected outcomes.
Confirm project DEFINING, release none, sprint inactive, implementation BLOCKED and no registered stage evidence.
Confirm application hashes are unchanged, logs are Git-ignored and `.asdg/` state is not ignored.
Confirm the twelve Focus adapters and thirteen named-role adapters resolve to this local distribution.
Check native skill discovery if your runtime exposes it. Do not claim native invocation based on files alone.
Separate configured hooks, human trust, direct guard tests and actual native interception.
If a hook blocks a step, report the exact human-terminal command; do not bypass or disable it.

Do not start a sprint, declare a release, register/approve evidence, modify app code, install SDK packages,
activate/delegate a specialist, commit or push as part of this task.
If anything conflicts or fails, preserve existing files and report the concrete issue and proposed bounded fix.
Do not silently weaken governance or turn installation into a broad refactor.

Return a concise review report with changed paths, test commands/results, Codex/Python versions,
application-integrity results, native checks still pending, and the proposed next iteration.
If permitted, save it under `docs/asdg/07-planning/current/reviews/install-YYYYMMDD.md` (50 nonblank lines max);
otherwise return the same report in the conversation. Retain a hash-bound modification receipt when saving.
Provide the exact diff of any existing files changed. I will share this evidence with our reviewer in ChatGPT.
After installation, wait for my choice of Context or Purpose review; the current specialist roles remain read-only.
