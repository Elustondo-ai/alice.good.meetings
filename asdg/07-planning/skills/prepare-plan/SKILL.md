---
name: asdg-prepare-plan
description: "Planning Agent: prepare plan, in read-only evaluation."
---

# Prepare Plan

Owner: `ASDG-07`; [entry point](../../AGENTS.md); [contract](../../types/contract.md).
Instruction-only evaluation procedure. It does not activate a role or grant write permission.
Read the owner's contract and shared runtime rules before applying this procedure.
A non-owning caller may inspect the method, but must not use it to bypass role boundaries.

## Procedure

1. Read the authorized scope and available baseline and closure evidence.
2. List missing preflight facts rather than claiming the next sprint can start.
3. Propose component-scoped tasks, dependencies, acceptance evidence and explicit exclusions.
4. Return plan and task proposals; do not create branches, commit, or start implementation.

## Output and checks

Use the owner's output contract and identify facts, assumptions and unavailable evidence.
Do not claim tests, review, routing or implementation happened unless observed.
In this evaluation, return the result in the conversation; no writes or external actions.
Out-of-scope work returns to the coordinator; missing prerequisites are reported as blocked.
This YAML-first file records AI modification, not whole-file human approval.

Before declaring a substantive Markdown deliverable complete, identify its embedded explanatory visual, the idea it conveys and the rendering check performed; missing or uninspected visuals must be reported as a documentation gap.
An ordinary criteria table, status table or decorative image does not replace a diagram of behavior, relationships or evidence; navigation-only pages and immutable source archives retain the shared exceptions.
