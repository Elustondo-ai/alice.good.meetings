# Portable ASDG verification — 20 October 2026

Package: `0.2.0-pilot.1`. Environment: Linux, Python 3.12.14, Git 2.51.1.
Tests use disposable repositories; the real Speaker Coach Drive folder was not initialized or changed.
The source governance Drive folder was read only. No remote Git changes were made.

## Executed

- Twenty portable regression tests passed; three adapter-parser tests passed.
- Package checks and all 33 canonical/adapter skill-header validations passed.
- Fresh dry run wrote nothing; installation produced explicit project/release/sprint state.
- Repeat installation made no byte changes, including after an active sprint or evidence registration.
- Existing application code, client instructions, documents and ignore rules were preserved.
- Conflicting configuration, adapters, legacy data and foreign bindings were preserved and rejected.
- Missing/malformed state and symlink destinations failed without silently recreating state.
- Moving the client to a path with spaces and an apostrophe preserved status and hook behavior.
- No active sprint denied writes; an active scoped sprint allowed only all-in-scope patch targets.
- Protected distribution/state/policy paths, traversal, symlinks and arbitrary shell writes were blocked.
- Direct execution of the generated hook emitted denial when its guard script was unavailable.
- Central child logs deduplicated identified events and omitted raw commands/tool output.
- Git ignored logs; sprint state and document-review history remained trackable after log deletion.
- SDK context/environment helpers were checked without a model call; no credentials were requested.
- Fixture advice saved its bounded Markdown and review receipt in a fresh planning folder.
- An injected file-write failure rolled back only that transaction's own changes.

## Conversational trial

A fresh tool-assisted agent loaded the packaged Purpose Focus and retained it on a follow-up.
It inspected fixture HTML/JavaScript, distinguished intended outcomes from actual evidence,
and returned a purpose proposal while declining the requested file write under read-only evaluation.
Fixture hashes were unchanged across the follow-up. Native chat rename was truthfully unavailable.
This trial used the current agent runtime, not a native Codex CLI/app invocation.

## Reproduce locally

```sh
python3 asdg/check.py --integrity
python3 -B -m unittest discover -s asdg/tests -v
python3 -B -m unittest discover -s asdg/00-governance/tests -v
```

The package checker verifies role references, adapter boundaries, Markdown links, skill headers,
50-nonblank-line documentation limits and Python 3.9 syntax; integrity also compares delivered hashes.
Python 3.9 runtime execution itself has not been tested here; execution used Python 3.12.

## Pending native checks

Native Codex CLI is unavailable in this build environment. Picker discovery, a real local invocation,
parent permission behavior, current-chat renaming, resume/compaction and trusted hook interception
must be checked in Pablo's Mac Codex session. Direct hook tests do not establish native enforcement.
Actual SubagentStart/Stop callback coverage and logging completeness remain unverified.
Live SDK advice is retained as an optional integration and was not revalidated in this package.
Configuration, tests and packaging do not record human approval or authorize application work.
