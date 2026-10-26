# ASDG continuation pilot review

Increment 1 implements the shared continuation contract and Init → Status/Suggestion → Purpose flow.
Direct Suggestion follows the selected specialist; Status keeps a neutral project-wide view and preserves Focus.
Purpose selection now inspects relevant evidence and begins a useful conversational opening without creating documents or approvals.
An accompanying assignment proceeds under the existing Purpose contract; other specialist openings remain unchanged.

## Changes

- Added canonical continuation and Purpose-opening guidance; reconciled Focus, runtime, response and Purpose contracts.
- Init now points to the installed Status skill after successful console initialization, with no model call.
- Status requests Suggestion once with project-wide scope; direct specialist advice identifies its perspective briefly.
- Connected the existing optional SDK advice prompt to the same canonical guidance; no live SDK call was made.
- Synchronized three thin discovery adapters with their templates: Purpose Focus, Status and Suggestion.
- Added four deterministic regression cases, disposable behavioral fixtures and repeatable conversation exercises.
- Corrected two assertions in the existing advice-report test to compare resolved macOS temporary paths.

## Observed validation

Python 3.15.0 and Apple Git 2.50.1 were used on macOS. Python 3.9 syntax was checked, not Python 3.9 execution.
Before editing, 42 of 43 regressions passed; the existing advice-report assertion failed on equivalent `/var` and `/private/var` paths.
After the change, `python3 -B -m unittest discover -s asdg/tests -v` passed all 47 tests.
The added tests cover successful-only initialization guidance, selector installation, repeat-init preservation, no advice import on factual paths, and preservation of unregistered Purpose work.
`python3 -B asdg/scripts/cli.py verify` passed; live initializer dry-run planned zero writes; `git diff --check` passed.
The package checker reports only the same eight pre-existing README links outside the client. It is not an overall PASS.
The skill-creator quick validator could not run because PyYAML is unavailable; the repository checker validated skill headers, links, line limits and syntax apart from those known links.
Five fresh agent contexts and follow-ups exercised actual skill behavior; see [observed interactions](asdg-continuation-trials-01.md).
All four conversational fixture snapshots remained byte-identical. Simulated acceptance events were created only in disposable fixtures.

## Preservation and limits

Speaker Coach application files, all existing `.asdg/` files, accepted client documentation and unrelated pre-existing edits were preserved.
Methodology modification receipts append exact hashes without human approval; no sprint, release or project transition was recorded.
This review is implementation evidence, not human acceptance. No commit, push, deployment or live project closure occurred.
Fresh agents share methodology source and fixture authorship; their replies do not establish independent product evidence.
Native picker discovery, title actions, compaction/resume and trusted hook interception remain untested; fixture title control was explicitly unavailable.
Task-list opening was queued, but Computer Use denied access to Codex; rendered Markdown preview remains unverified.
No new application permissions or guard exceptions were introduced.

## Review artifacts and next increment

The [bounded source diff](asdg-continuation-increment-01.diff) compares this increment with the inspected dirty worktree, excluding earlier unrelated edits.
The [technical evidence](asdg-continuation-evidence-01.json) records baseline revision, hashes, checks and preservation; receipt additions are in the existing methodology ledger.
The [task list](asdg-evolution-tasks.md) retains the full requested order and review pauses.
Recommend increment 2: extend continuation to Governance, Context and Use Cases, using the validated Purpose pattern to improve domain-specific next steps and advisory handoffs.
