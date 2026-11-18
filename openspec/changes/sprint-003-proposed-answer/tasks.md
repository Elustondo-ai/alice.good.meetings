# Implementation tasks

These are proposed, unchecked tasks for SPRINT-003; they are not execution evidence. Task IDs in brackets are the Stage 07 [plan](../../../docs/asdg/07-planning/03.9.2-sprint-003-plan-build.md) IDs, which this file now owns. Nothing starts before the specification review (T14) and the Governance record `READY_FOR_09`; every application edit needs the active sprint and a passing implementation check for its path. The rules cited are on the 08 [specification](../../../docs/asdg/08-low-level-design/03.5-sprint-003-specification.md); each check is on the [test map](../../../docs/asdg/08-low-level-design/03.6-sprint-003-test-map.md). Commitments are `S003-*`.

## 1. Preview and limits (T20, T21, T22)

- [ ] 1.1 [T20, 09] Build the static preview at `poc/preview/` for PV-1 to PV-5 (S003-PREVIEW, LAYOUT, GLANCE, DETAILS) with invented text. Verify: ST-53 passes, PC-17 and PC-18 pass, and file hashes are recorded.
- [ ] 1.2 [T21, Pablo] Approve, change or reject the preview, including control placement. Verify: a dated approval naming the files by hash; this is not an agent task. Recorded on 18 November 2026 in the [approval record](../../../docs/asdg/00-governance/03-sprint-003-preview-approval.md).
- [ ] 1.3 [T19, 10 ReviewQA] Record the baseline cue, Focus and Live text sizes of the page at revision `7d60c0f` as constants for PG-3. Verify: 10 ReviewQA's [record](../../../docs/asdg/10-document-review-and-release/03.3-sprint-003-pg3-baseline-text-sizes.md) of the sizes and method exists before task 4.1 starts.
- [x] 1.4 [T22, 08] Fixed on 18 November 2026: `BULLET_MAX` 120, `DETAILS_MAX` 1500, label wording, control placement and row heights, from the approved preview, in [03.5.11](../../../docs/asdg/08-low-level-design/03.5.11-s003-fixed-layout-values.md). Verify: no "provisional" remains for those rules (S003-GLANCE, DETAILS).

## 2. Service: loader, request, controller (T23, T25)

- [ ] 2.1 [T23, 09] Package loader per PK-1 to PK-10 (S003-CONTEXT). Verify: ST-25 to ST-31 pass with a synthetic package.
- [ ] 2.2 [T23, 09] Request object, generator seam, result checks per RQ-1 to RQ-8 and RS-1 to RS-5 (S003-ANSWER, DETAILS). Verify: ST-01 to ST-10 pass with a fake generator.
- [ ] 2.3 [T23, 09] Answer area, `proposed` message, Focus binding, Stop rules and one retry per CT-1 to CT-17 and RT-1 to RT-6. Verify: ST-11 to ST-24 and ST-39 to ST-43 pass.
- [ ] 2.4 [T23, 09] Timing points and audit events per TM-1 to TM-8, with the page's render report extended. Verify: ST-44 to ST-46 and ST-54 to ST-56 pass.
- [ ] 2.5 [T25, 09, optional] Print option per PR-1 to PR-4; Pablo may drop it. Verify: ST-47 and ST-48 pass.
- [ ] 2.6 [T23, 09] Fixture hooks and `poc/fixtures.mjs` per FX-1 to FX-5. Verify: ST-49 to ST-52 pass.

## 3. Service: health and no key (T24)

- [ ] 3.1 [T24, 09] `/health` fields and the three no-key cases per HL-1 to HL-5 and NK-1 to NK-4, NK-8 (S003-NOKEY). Verify: ST-32 to ST-38 pass and no OpenAI connection is opened without a key.

## 4. Page (T26, T28)

Precondition for 4.1: task 1.2 (T21) is done, meaning a dated approval by Pablo names the preview files by hash and `index.html` is unchanged until then (PV-6, checked by the reviewer gate SH-15). Task 1.3 is also done.

- [ ] 4.1 [T26, 09] New `index.html` and `app.js` with `index.md` and `app.md`, matching the approved preview, per LB-1 to LB-10, PG-1 to PG-16, HL-6 and NK-5 to NK-7. Verify: PC-01 to PC-16 and PC-19 to PC-29 pass, and SH-15 shows the approval gate held.
- [ ] 4.2 [T28, 09] Extend `poc/browser-protocol.mjs` to drive all seven states at both sizes and report separately from `node --test`. Verify: the page-check result for all seven states is recorded.

## 5. Service tests (T27)

- [ ] 5.1 [T27, 09] Add the named cases ST-01 to ST-57 to `poc/poc.test.mjs` and update `poc/poc.test.md`. Verify: `node --test poc/poc.test.mjs` exits 0, the 19 existing cases still pass and none calls OpenAI (S003-TESTS).

## 6. Run command (T29, T30)

- [ ] 6.1 [T29, 09] `poc/alice-run.sh` and `poc/alice-run.md` per RN-1 to RN-14 (S003-RUN). Verify: SH-1 to SH-4 and SH-12 to SH-14 pass.
- [ ] 6.2 [T30, 09 writes, 10 reviews] Shell check of the script. Verify: SH-1 to SH-15 recorded, with exit codes, for all outcomes.

## 7. Data statements and package checks (T31 to T34)

- [ ] 7.1 [T31, 00] Apply the root `AGENTS.md` statements after ST-01 to ST-57 pass (S003-STATEMENTS). Verify: wording equals the [data statements](../../../docs/asdg/08-low-level-design/../05-high-level-design-and-architecture/decisions/Proposed%20answer%20and%20its%20context/03-data-statements.md).
- [ ] 7.2 [T32, 09] Apply the `poc/README.md` statements. Verify: same wording check.
- [ ] 7.3 [T33, 04] Statement check of both pages against RQ-1 and RQ-5. Verify: any difference fails.
- [ ] 7.4 [09 writes] The reviewer script `poc/review/package-check.mjs` with its companion, from the procedures on 04's page 03.8; the reviewer runs it by hand. Verify: ST-57 passes and no file outside `poc/review/` imports it.
- [ ] 7.5 [T34, 04] Package check before any billable run: file list with digests and the shingle check reporting counts only. Verify: no benchmark material, or the run is invalid.

## Workflow follow-up

Live session (T40), review (T41), refresh (T42) and sprint close (T43) are Stage 07 tasks outside this change. Archive and sync stay a later explicit request.
