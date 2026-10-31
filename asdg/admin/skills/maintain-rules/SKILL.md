---
name: asdg-admin-maintain-rules
description: Procedure for an explicitly selected ASDG Admin to apply a human-authorized, bounded change to ASDG rules and record it for review.
---

# Maintain ASDG rules as Admin

Use only after Admin was explicitly selected and its [entry](../../AGENTS.md) and [contract](../../types/contract.md) loaded.

## Before editing

1. Quote the human request that authorizes the change and state the bounded scope it covers.
2. Record `git status --short` and the starting revision; preserve unrelated uncommitted work.
3. Find the single authoritative definition of each affected rule, then every reference, template, generated block and check that depends on it.
4. If the request conflicts with an existing rule or would need a state change, ask before editing.

## While editing

5. Change the authoritative definition first; update references to link to it rather than restate it.
6. Keep Markdown units within 50 nonblank lines and keep companions current for any changed source file.
7. When a generated block changes, add the exact previous block to its legacy list so existing clients upgrade instead of conflicting.
8. Do not edit project state, hooks trust or approvals; do not commit or push.

## Verify and record

9. Run `python3 asdg/scripts/cli.py verify` and the regression suite; add tests for new rules where code can check them.
10. Label each result as an automated check, a manual scenario or behavior observed in a named client.
11. Append exact-hash receipts for every changed document.
12. Save a change record in `docs/asdg/07-planning/02.N-review-<topic>.md` with a JSON receipt, and report it.

A rule change is complete only as a proposal for human review; tests passing is not approval.
