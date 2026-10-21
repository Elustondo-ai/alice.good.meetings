---
name: asdg-elicit-purpose
description: "Clarify purpose and deliver ordered project documentation with a required embedded explanatory image, evidence and acceptance questions in docs/asdg/02-purpose/."
---

# Elicit Purpose

Owner: `ASDG-02`; [entry point](../../AGENTS.md); [contract](../../types/contract.md).
Read the [two-gate completion rule](../../types/completion.md) for readiness criteria and explicit User acceptance.
Procedure for an explicitly selected Purpose role; use only its bounded documentation allowance.
Read the owner's contract and shared runtime rules before applying this procedure.
A non-owning caller may inspect the method, but must not use it to bypass role boundaries.

## Procedure

1. Clarify the desired outcome before discussing implementation.
2. Separate goals, constraints, non-goals, assumptions and scope questions.
3. Suggest observable acceptance questions without choosing the architecture.
4. Inspect the bound client's existing `docs/asdg/02-purpose/` and preserve accepted content and history.
5. Save ordered concept files: `01-purpose.md`, `02-current-capabilities.md` and `03-planned-improvements.md`; update README navigation.
6. Record sources and decision status, distinguish reports from verification, and retain unresolved questions.
7. Append exact-hash modification receipts, check Markdown lengths and links, and summarize saved paths.
8. Require an explanatory image near the opening of `01-purpose.md`, stored in `images/` and embedded using a relative link.
   Show the User's situation, desired experience and outcomes; a concept illustration suits Purpose better than a technical architecture diagram.
   Include descriptive alt text and a caption that distinguishes vision from implemented behavior.
9. Reuse a suitable existing visual; generate or revise it when missing, misleading or requested, rather than on every edit.
10. Inspect the image and, when available, the rendered Markdown for legibility, composition, spacing and text accuracy.
11. Assess all eight completion criteria; record `READY_FOR_ACCEPTANCE` only when each has supporting evidence.
12. Present the current document links; record `ACCEPTED` only after an explicit User decision for that unchanged reviewed baseline.

## Output and checks

Use the owner's contract; distinguish purpose, evidenced capabilities and selected improvements with decision status.
Keep these files directly in `docs/asdg/02-purpose/`; no `intended/`, `current/` or `planned/` subfolders are needed.
Canonical identities and Purpose paths follow the catalogue; legacy identities exist only in migration records.
Do not claim tests, review, routing or implementation happened unless observed.
Deliver saved documentation plus a concise conversation summary; activation alone writes no artifacts.
A completed documentation delivery always includes the explanatory visual; a text-only draft is incomplete.
Check that the embedded relative image path resolves inside the client's `docs/asdg/02-purpose/images/`.
Report unavailable generation, saving or rendering explicitly; do not claim an unobserved visual check passed.
Use generic actor names such as `User` in product documentation.
If writing is blocked, report the exact blocker and unsaved outcome; do not claim documentation was delivered.
Out-of-scope work returns to the coordinator; missing prerequisites are reported as blocked.
This YAML-first file records AI modification, not whole-file human approval.
