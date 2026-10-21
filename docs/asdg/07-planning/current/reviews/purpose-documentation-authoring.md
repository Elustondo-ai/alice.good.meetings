# Purpose documentation authoring — maintenance review

On 20 October 2026, Pablo requested that Purpose focus produce saved project documentation and explicitly authorized updating the ASDG skill and rule.
The starting Git revision was `7f7d4fd05a3f20389c49c9e98498e814237e67d7`.
Pre-existing edits to the provider review ledger, skills index and asdg-suggestion packages were retained.

## Change and result

Purpose now saves Markdown under the bound client's `docs/asdg/02-purpose/` and appends hash-bound project modification receipts.
The role, procedure, shared runtime/focus policy, local and template adapters, and generated client instruction were aligned.
Other roles retain their evaluation limits; no application implementation, hook changes or lifecycle transitions were performed.
The catalogue and its initialization fingerprint were preserved.

The [Purpose index](../../../02-purpose/README.md) links the intended purpose, reported evidence and selected next outcome.
The documents identify user agreement on direction without claiming approval of unseen file bytes or technical feasibility.
Acceptance cases cover saved output, activation-only behavior, unknown binding, preservation and excluded application work.

## Validation and limits

`python3 asdg/scripts/cli.py verify`: passed.
`TMPDIR=/private/tmp python3 -m unittest discover -s asdg/tests`: 23 tests passed.
The initial suite run failed one path comparison because macOS `/var` resolves to `/private/var`; the canonical temporary directory resolved it without code changes.
`git diff --check`: passed before this report and receipts; checked again at completion.
The skill-creator validator could not run because PyYAML is unavailable in both local Python runtimes.
Markdown lengths, local links and frontmatter fields were checked separately; no dependency was installed.
Source review and successful local writes do not establish fresh-session native role behavior or trusted hook enforcement.
No independent reviewer or human approval of exact modified bytes is claimed.

## Review handoff

Review the bounded permission change, saved Purpose wording and exact-hash receipts before any broader rollout.
Modification events are appended to the existing provider and project review ledgers; earlier events remain intact.
No commit, push or publication was performed.
