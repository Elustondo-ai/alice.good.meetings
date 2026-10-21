# Purpose readiness and User acceptance — maintenance review

On 20 October 2026, the User requested separate agent criteria and explicit User acceptance as done for now.
The starting Git revision was `7f7d4fd05a3f20389c49c9e98498e814237e67d7`; pre-existing local work was preserved.

## Behavior

Purpose now has a [two-gate completion contract](../../../../../asdg/02-purpose/types/completion.md).
ASDG-02 records evidence for eight criteria and may mark the exact document/image bundle `READY_FOR_ACCEPTANCE`.
The User can explicitly accept that reviewed baseline in chat; the recorded result is `ACCEPTED`, done for now.
Praise, file presence and agreement on the rule never create acceptance. Actor labels record provenance and do not authenticate a statement's source.
The existing `.asdg/lifecycle.json` remains authoritative; stage `02` has append-only review history and registered artifacts.
Document, navigation and embedded-image hashes bind both decisions to the reviewed version; changed or missing bytes require reassessment.
No second workflow-state file or automatic User acceptance was introduced.

The evaluator, factual CLI output and read-only dashboard expose completion separately from evidence presence.
Legacy lifecycle records remain valid; other stages retain their existing behavior.
Rules, runtime allowances and local/template native adapters permit only the bounded Purpose review recording.
The current documents passed the agent assessment and are recorded as ready; User acceptance remains pending.

## Verification

`TMPDIR=/private/tmp python3 -B -m unittest discover -s asdg/tests`: 33 tests passed.
Eight new tests cover separate gates, changed documents/images/navigation, missing assets, symlinks, criteria, matching acceptance, history and legacy state.
ASDG structure verification, Markdown length/link checks and `git diff --check` passed.
Factual status reports `Purpose completion: READY_FOR_ACCEPTANCE` while implementation remains blocked by the inactive sprint.
The existing User-supplied screenshot supports rendered Purpose inspection; no fresh native-agent session was tested.
No application code, sprint state, other stage record, commit or publication was changed.
Current event fields and full criteria evidence are inspectable in the lifecycle record; human approval of new methodology bytes is not claimed.
