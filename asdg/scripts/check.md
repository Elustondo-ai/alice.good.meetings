# Validate the embedded package

[Source: check.py](check.py)

Checks reusable ASDG files for structural problems before they are used or packaged.

## Responsibilities and collaborators

Validates catalogue/rules, role adapters, Python 3.9 syntax, Markdown size/links and optional delivery hashes.

![Embedded files + optional manifest → Static package checks → Issue list / exit status](images/check-flow.svg)

- [agent_config](lib/agent_config.md): Reads adapter TOML.
- [cli_model](lib/cli_model.md): Validates the catalogue.
- [cli_status](lib/cli_status.md): Checks lifecycle rules.
- [documentation](lib/documentation.md): Counts Markdown source lines.

## Interface and data

validate takes core:Path and integrity:bool and returns list[str] of issues. CORE is the embedded asdg directory. main returns a process exit code.

| Callable or interface | Contract |
| --- | --- |
| `validate(core=CORE, integrity=False)` | Walks package files and returns all detected issues; optional integrity compares every delivered file hash with MANIFEST.json. |
| `main()` | Parses --integrity, prints failures with exit 1 or a validation summary with exit 0. |

## Effects and failure behavior

This is a static check, not proof of live agent behavior or semantic completeness. The current working package has known external presentation links flagged as escaping the client. An evolved checkout can differ from the delivery manifest without implying corruption.

## Example

`python3 asdg/scripts/check.py` checks structure and links; add --integrity only when comparing to the delivered package baseline.
