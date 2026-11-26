# Slide 13: Architecture, Intended

**Architecture accepted: local log, memory-only package, one call per pause**

The accepted design keeps the meeting log in a Git-ignored folder inside the project, one local route to download it, and the preparation package in memory. After each pause the service makes one call to OpenAI. Architecture also records its comparison of agent SDKs and its decision to use the OpenAI Agents SDK. Pablo accepted these on 21 November.

## Fine print

- Evidence state: **CURRENT**. Question this slide answers: What has been approved?
- Snapshot: revision `673c3bd` on `main`, as of 2026-11-23T17:40:00Z. Working tree clean apart from `.DS_Store`.
- Sources checked:
  - `docs/asdg/05-high-level-design-and-architecture/01-architecture.md`
  - `docs/asdg/05-high-level-design-and-architecture/01.9-sprint-004-architecture-review.md`
  - `.asdg/lifecycle.json`
