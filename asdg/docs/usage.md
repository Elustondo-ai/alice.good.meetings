# Work with the embedded methodology

Run commands from the client Git root. The project-local command is `python3 asdg/scripts/cli.py`.
An older globally installed `asdg` can point elsewhere; do not use it for this pilot without resolving it.

```sh
python3 asdg/scripts/cli.py status --facts-only
python3 asdg/scripts/cli.py status --json
python3 asdg/scripts/cli.py agent list
python3 asdg/scripts/cli.py sprint status
```

These operations are deterministic; they do not call a model. Status reads the recorded project,
release and sprint separately. The earliest unregistered evidence is a mechanical finding, not approval or priority.
An existing code file or stage README never establishes accepted lifecycle evidence.

## A specialist conversation

For whole-project management, select `$asdg-focus-00-governance`; its title is `00 Governance — <project>`.
It selects the existing coordinator, distinct from a general chat with no focus; it grants no execution authority.

Select `$asdg-focus-01-context` or `$asdg-focus-02-purpose` in Codex.
Activation loads the role and reports focus; assign the review task in the following message.
For example: “Read this project's existing code and purpose documents; explain the gaps and propose corrections.”
Stage 02 is Purpose; `intent` remains a generic Focus alias. No `asdg-intent` adapter is installed.
The focus stays in this conversation while its activation receipt remains available.
`$asdg-status` reports conversation focus; it is distinct from CLI workflow status.
These skills do not create a new window or persistent agent process. Resume the same Codex conversation.
All named roles currently propose changes in conversation. File-writing specialist workflows need a later reviewed change.

## Sprint transitions

Use `$asdg-sprint-start` to start a human-selected scope, objective and acceptance criteria; `$asdg-sprint-review` assesses evidence without changing state.
Use `$asdg-sprint-close` to preserve a review and end the explicitly selected sprint, including an unfinished or cancelled one. These utilities preserve Focus.
The existing local CLI remains available:

```sh
python3 asdg/scripts/cli.py sprint start --id SPRINT-001 --objective 'Chosen improvement' \
  --scope app.js --acceptance 'Observable acceptance criterion'
python3 asdg/scripts/cli.py sprint check-implementation --path app.js
python3 asdg/scripts/cli.py sprint stop
```

An active sprint authorizes only its file scope and intended work, subject to independent role/runtime restrictions.
Scope may be an exact file or a directory ending in `/`; policies, distribution and state are protected.
Stopping returns the current record to inactive. The close skill preserves a receipt under `.asdg/sprint-closeouts/`; direct CLI stop does not, and no release is closed.
Do not run these example transitions as part of installation.

## Optional AI advice

Plain `status` and `status --verbose` retain the existing Codex SDK advisory path.
The latter saves a report and receipt at the Stage 07 root as `02.1-status-<time>-<id>.md` and a matching JSON receipt.
It requires a compatible separately installed SDK/runtime and Codex sign-in; initialization installs neither.
The retained adapter targets `openai-codex==0.163.0`; live advice has not been revalidated for this package.
If advice is unavailable, report the failure and use `--facts-only`; do not confuse mechanical guidance with AI advice.
