# Replacement acceptance tests

[Source: test_push_replace.py](test_push_replace.py) exercises the public command against initialized disposable Git repositories with realistic packaged sources.

![Acceptance checks exact planning, recoverable application and verified publication.](../docs/images/push-replace-flow.svg)

`PushReplaceTests` creates isolated canonical/client fixtures. `initialize` uses the existing initializer, `run_replace` previews and applies one exact digest, and `snapshot` captures bytes and modes. The `git` and `seal` helpers establish fixture identity and integrity only.

Cases cover owned customizations, preserved unknown neighbors/application/state/history, verification and a no-write second run; clock-independent plans; source, target and ledger changes invalidating plans; unknown collisions; hostile ownership paths; CLI preview/apply/verify; and a source that keeps the package in an `asdg/` folder, which must plan and apply the same replacement without shipping the files around that folder; setup and replacement agreeing on every integration file, in both orders and with existing Claude instructions; and a source reached under the former repository name, which must be recorded under that name and leave a second run with nothing to do.

Integration and transaction companions describe separate shared-file, fault, concurrency and recovery cases. These tests establish file behavior, not native skill discovery or hook trust.

Run `python3 -B -m unittest discover -s tests -p 'test_push*.py' -v` from the canonical source. Fixtures never use real clients or network services.
