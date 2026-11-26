# Slide 11: Benchmarks, Actual

**SPRINT-004: 8 of 11 criteria pass, 2 fail, 1 unverified**

At close on 22 November the sprint record had eight criteria passing, two failing and one unverified. The failures are the manual cue and the live session: Pablo said he forgot to download the logs. I ran the offline test suite today and all 145 tests pass. The statement check, which compares the data statements with what the code sends, passed on its rerun, but the closeout kept it unverified pending a re-run on the final file bytes.

## Fine print

- Evidence state: **CURRENT**. Question this slide answers: What demonstrably works?
- Snapshot: revision `673c3bd` on `main`, as of 2026-11-23T17:40:00Z. Working tree clean apart from `.DS_Store`.
- Sources checked:
  - `.asdg/sprint-closeouts/acc3497d-a261-4ad9-865a-0f7d213eabf0.json`
  - `docs/asdg/04-benchmarks-and-eval-strategy/03.13-sprint-004-statement-check-result.md`
  - `poc/poc.test.mjs`
