# Purpose concept files — maintenance review

On 20 October 2026, Pablo selected one Markdown file per concept and authorized flattening the Purpose documents.

The [Purpose index](../../../02-purpose/README.md) now links `purpose.md`, `current-capabilities.md` and `planned-improvements.md` directly.
Content and decision status were retained; document titles and relative links were updated, and empty perspective folders were removed.
The Purpose procedure, contract and package guide now require this layout.
The shared perspective contract permits Purpose's concept names while retaining other stages' existing layouts.
Explicitly requested Purpose renames preserve content, links and exact-hash review provenance.

## Verification

`python3 asdg/scripts/cli.py verify` and `git diff --check` passed after the moves.
Changed Markdown lengths, relative links and the final four-file Purpose directory were checked.
Hash-bound modification records retain each renamed document's previous path and exact previous bytes.
No application code changed; the test suite was not rerun for this documentation reorganization.
Earlier review records and unrelated working-tree edits were preserved. No commit, publication or lifecycle transition occurred.
