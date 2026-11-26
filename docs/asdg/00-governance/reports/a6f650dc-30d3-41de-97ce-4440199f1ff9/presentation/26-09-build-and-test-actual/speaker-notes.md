# Slide 26: Build and Test, Actual

**Committed code passes 145 of 145 tests; live evidence is missing**

The code works in the sense that matters for tests: all 145 pass in four seconds without calling OpenAI. What is not shown is a real session. Pablo forgot to download the logs on 22 November, so the criterion that needs one recorded live session failed. He has seen the download work before, but that is not a record.

## Fine print

- Evidence state: **CURRENT**. Question this slide answers: What demonstrably works?
- Snapshot: revision `673c3bd` on `main`, as of 2026-11-23T17:40:00Z. Working tree clean apart from `.DS_Store`.
- Sources checked:
  - `poc/poc.test.mjs`
  - `.asdg/sprint-closeouts/acc3497d-a261-4ad9-865a-0f7d213eabf0.json`
