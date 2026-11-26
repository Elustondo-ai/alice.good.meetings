# Slide 14: Architecture, Actual

**The built service passes all 145 offline tests at 673c3bd**

I ran the offline suite and it passed 145 of 145 at revision 673c3bd. These tests do not call OpenAI. They show the service behaves as specified, not that live sessions work. The hosted mode for Cloud Run is built but not deployed. I did not re-read the current-architecture page, so I cannot say whether it is up to date.

## Fine print

- Evidence state: **CURRENT**. Question this slide answers: What demonstrably works?
- Snapshot: revision `673c3bd` on `main`, as of 2026-11-23T17:40:00Z. Working tree clean apart from `.DS_Store`.
- Sources checked:
  - `poc/poc.test.mjs`
  - `docs/asdg/07-planning/03.19-sprint-006-outline.md`
  - `docs/asdg/05-high-level-design-and-architecture/02-current-architecture.md`
