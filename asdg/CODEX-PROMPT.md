# Codex prompt — initialize this project with ASDG

Copy the prompt below into a general Codex conversation opened at the target project's existing Git root.
The portable distribution must already be extracted as the project's local `asdg/` folder.

---

Help me initialize and verify the embedded ASDG distribution in this repository.
Follow `asdg/skills/asdg-init/SKILL.md`, `asdg/AGENTS.md` and the client root instructions.
Use the local Python entry points, not a machine-wide command or an external provider checkout.

Before first setup, offer the two optional orientation questions from the Init skill: rough purpose and starting point.
Reuse answers I have already supplied. I can answer either, both, or say skip, not sure, or initialize now.
Starting from scratch, extending an existing project and integrating other systems may overlap.
Do not infer answers from the repository name, code presence or project status.
When I provide answers, retain them as initial orientation, not accepted Purpose or completed Context.

Inspect the actual repository and Git status, preserve existing work, and record application file hashes.
Use the initializer's dry run before writing. Resolve conflicts without overwriting user changes.
Default to the initializer's new-project status unless I explicitly supplied another initial status.
Run local structure verification and factual status, then repeat initialization to check that it makes no further changes.
Keep the Python initializer noninteractive; the conversational skill owns the optional questions.

For a fresh project, confirm that the stage introductions are generic and contain explanatory visuals.
New living documents use flat stage files: 01 Intended, 02 Current, 03 Planned, with dotted topic extensions.
Follow the shared human documentation, visual-review and source-companion rules.
Existing project documentation stays intact; initialization does not migrate or certify its contents.

Report observed results, changed paths, preservation checks and unresolved issues.
Distinguish configured discovery and hooks from actual native invocation, human trust and runtime enforcement.
If a hook blocks a step, retain the denial and provide the exact command for me to run in a terminal.
Do not bypass hooks, change trust, invent project facts or mark documentation accepted.

Do not start a sprint, declare a release, implement application changes, activate/delegate a specialist, commit or push.
After successful setup, recommend ASDG Status and let me choose the next conversation.
