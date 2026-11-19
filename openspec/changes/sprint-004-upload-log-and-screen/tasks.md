# Implementation tasks

These are proposed, unchecked tasks for SPRINT-004; they are not execution evidence. Nothing starts before the sprint is started by Pablo, 00 Governance records readiness (07's report says NOT_READY) and every application edit passes the per-path implementation check. Each task cites the 08 rules ([specification](../../../docs/asdg/08-low-level-design/03.7-sprint-004-screen-specification.md)) and the checks of the [test map](../../../docs/asdg/08-low-level-design/03.8-sprint-004-test-map.md); owners are 09 Coding unless named. Commitments are `S004-*`; the idle-pause guard is not in this sprint.

## 1. Package routes and status (S004-STATUS, S004-UPLOAD)

- [ ] 1.1 Add `GET /package`, `PUT /package` and `DELETE /package` with the caller, content-type, body, file, name, UTF-8 and total checks, 409 while listening and the old package kept on refusal, per SU-3 to SU-10. Verify: ST4-01 to ST4-08, ST4-29, ST4-35 to ST4-37 and ST4-40 pass with a synthetic package.
- [ ] 1.2 Keep the package after Stop and in memory only, and snapshot it at Start, per SU-7 and SU-9. Verify: ST4-06 and ST4-07 pass and no sentinel reaches a log, audit or frame.

## 2. Meeting log and download (S004-LOG, S004-DOWNLOAD)

- [ ] 2.1 Add the one append-only log writer with the header (the version once), two clocks and every event type, per ML-1 to ML-15. Verify: ST4-12 to ST4-23, ST4-41 and ST4-42 pass and a write failure does not stop the session.
- [ ] 2.2 Store logs in `poc/logs/` with its `.gitignore`, `ALICE_LOG_DIR`, modes 0700 and 0600, the 5 MB cap and no deletion, per MS-1 to MS-9 and ML-13. Verify: ST4-24 to ST4-30 and ST4-34 pass and SH4-1 confirms the folder is ignored.
- [ ] 2.3 Add `GET /log` with its headers, 404 and caller checks, per SD-1, SD-3 and SD-4. Verify: ST4-08 to ST4-10 pass.

## 3. Bullets only and the transcript items (S004-SCREEN)

- [ ] 3.1 Drop `details` from the reader's schema and instructions and from the fallback request and result, and from the `proposed` message, per AD-1 to AD-4. Verify: ST4-31 to ST4-33, ST4-38 and ST4-39 pass; 05's wording is checked first.
- [ ] 3.2 Make the `transcript` message a replace-whole snapshot of the last 30 seconds with items, per SA-17. Verify: ST4-11 passes.

## 4. The screen and the keys (S004-SCREEN, S004-CUE, S004-MEETING)

- [ ] 4.1 Build `index.html` and `app.js` with the five areas, sizes, bold, contrast, scrolling and the six states, per SA-1 to SA-19 and SS-1 to SS-10, with `index.md` and `app.md`. Verify: PC4-01 to PC4-26, PC4-49 and PC4-60 pass at 1280 × 900, 1280 × 500 and 390 × 844.
- [ ] 4.2 Add the keys, the 10-second hold on the page clock, Remove, Upload and Download buttons, per SC-1 to SC-11, SS-11 and SU-1 to SU-8. Verify: PC4-27 to PC4-48 pass.

## 5. Checks and companions

- [ ] 5.1 Put the named cases ST4-01 to ST4-43 in `poc/poc.test.mjs` and PC4-01 to PC4-60 in `poc/browser-protocol.mjs`, with their `.md` companions. Verify: `node --test poc/poc.test.mjs` exits 0 with the existing cases still passing, none calls OpenAI, and the page check is reported apart.
- [ ] 5.2 Run `bash poc/alice-run.sh` and the shell steps. Verify: the script's outcomes are recorded separately.

## 6. Statements and reviewer steps (S004-STATEMENTS, S004-CARRY)

- [ ] 6.1 [ASDG Admin 2] Apply the root `AGENTS.md` statements within five lines (45 of 50 used), and [09] `poc/README.md`. Verify: 04's statement check passes (SH4-2).
- [ ] 6.2 [04, 10] Run the reviewer steps and the live session with an uploaded package and a downloaded log, then review that exact revision. Verify: the recorded session and the review.

## 7. The avatar (S004-AVATAR)

- [ ] 7.1 Vendor and pin TalkingHead, three.js and the CC0 `mpfb.glb` in `poc/vendor/` with their licence files beside them, add them and `poc/avatar.js` to the service's fixed file list and load them from the adapter by dynamic import, per AV-7. Verify: ST4-43 and SH4-3 pass and the page makes only same-origin requests (PC4-58).
- [ ] 7.2 Build the adapter `poc/avatar.js` with its companion `poc/avatar.md`: the six states and timings, light motion at about 15 fps, the toggle, the key A, reduced motion, silent failure and isolation, per AV-1 to AV-6 and AV-8. Verify: PC4-50 to PC4-57 and PC4-59 pass.

## Workflow follow-up

Archive and sync stay a later explicit request; SPRINT-003's change remains in place until then.
