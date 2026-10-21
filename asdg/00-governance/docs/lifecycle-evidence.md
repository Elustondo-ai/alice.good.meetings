# Authoritative lifecycle evidence index

`python3 asdg/scripts/init.py` creates `.asdg/lifecycle.json` without advancing or approving any stage:
```json
{
  "schema_version": 1,
  "project_status": "new",
  "release": null,
  "stages": {}
}
```
Humans register project-specific evidence using two-digit canonical stage numbers:
```json
{
  "schema_version": 1,
  "stages": {
    "01": {
      "artifacts": ["docs/asdg/01-context-and-domain-analysis/context.md"],
      "not_applicable_reason": null
    }
  }
}
```
References must be repository-relative files in the corresponding stage folder.
Missing or empty referenced files leave the stage unmet. Unregistered files do not establish evidence.
Generated README placeholders, symlinks, traversal and references outside the stage are rejected.
Established means evidence is referenced and present; it does not mean complete or human-approved.
Exception: empty Stage 01 is `ACCEPTED_EMPTY` when Stage 02 has current explicit human acceptance, under the [Purpose completion rule](../../02-purpose/types/completion.md).
Status derives this flag without writing state; substantive Context work is preserved and is never auto-approved.
A file may contain uncertain or unreviewed evidence; quality review remains a human/role responsibility.
The index holds references, not a second copy of project context, intent or implementation content.

Only Stage 06 can be explicitly unnecessary, with an explanation and no artifacts:
```json
{
  "schema_version": 1,
  "stages": {
    "06": {
      "artifacts": [],
      "not_applicable_reason": "No experimental uncertainty requires a POC."
    }
  }
}
```
This does not skip preceding unmet stages. Other stages cannot be marked unnecessary.
Malformed existing indexes are errors and are not silently repaired by init.
Repeat init preserves registered evidence and active sprint state.
The guard protects this index from agent writes; humans establish authoritative evidence references.
The generated AGENTS bridge directs agents to shared status and recommendations without adding rules.
Linked/edited bridges require explicit migration; repeat init preserves an identical embedded bridge.
Existing consuming projects need a deliberate init/upgrade before the new structure verifies.
Use `--project-status defining` for the agreed imported-project declaration; see [status metadata](../../docs/usage.md).
