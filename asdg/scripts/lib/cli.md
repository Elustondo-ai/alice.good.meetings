# ASDG command dispatcher

[Source: cli.py](cli.py)

Parses local ASDG commands, dispatches to the owning component and translates results into console or JSON output.

## Responsibilities and collaborators

Owns CLI argument validation, command routing and exit status; optional advice is imported only when requested by the selected mode.

![Command-line arguments → Parser and dispatcher → Owned operation + exit status](images/cli-flow.svg)

- [cli_model](cli_model.md): Resolves the local Git root and catalogue.
- [cli_project](cli_project.md): Initializes/verifies integration.
- [cli_status](cli_status.md): Evaluates facts.
- [cli_sprint](cli_sprint.md): Checks or changes sprint state.
- [cli_advice](cli_advice.md): Runs optional coordinator advice.
- [cli_advice_report](cli_advice_report.md): Saves verbose advice.
- [cli_dashboard](cli_dashboard.md): Serves the local dashboard.

## Interface and data

`argv` is list[str] or None (process arguments). main returns an integer exit status; argparse may raise SystemExit for help, version or invalid syntax.

| Callable or interface | Contract |
| --- | --- |
| `main(argv: list[str] \| None=None) -> int` | Dispatches init, status, verify, next, dashboard, agent and sprint commands. Prints results; returns 0 for success and 1 for operational failure. |

## Effects and failure behavior

Plain status may call the optional model runtime; status --json and --facts-only do not. init and sprint start/stop write state; status --verbose can save reports. Known operational errors are caught and printed; permission to invoke a command remains separate.

## Example

`python3 asdg/scripts/cli.py status --facts-only` reads facts; `--help` lists the command interface.
