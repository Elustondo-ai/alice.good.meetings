---
project: Alice.Good.Meetings
sprint: SPRINT-004 (active, plan v7): upload, meeting log, new screen and avatar
presenter: Pablo Elustondo
date: 20 November 2026
notes: This is the pre-code review for SPRINT-004, assembled from the specialists' documents as of alignment report version 8 (READY_FOR_09). The sprint is active but nothing is coded. No document carries a recorded hash approval. Read each slide, check the open items, and say what you accept before coding starts.
---

# Context

## GAP: No context study, unchanged
- Looked in the Context folder: a README and one overview picture
- The study stays empty by Pablo's earlier choice
> Nothing new was written for this sprint in stage 01. This is the same gap as in the SPRINT-003 review, and it is yours to keep or fill. It does not block this sprint.
Source: docs/asdg/01-context-and-domain-analysis/README.md

# Purpose

## He wants Alice in every meeting, so practical stories come first
- Upload the package from the page, see what is loaded before Start
- A complete time-stamped log of each meeting, downloadable for his own review
- A new, clearer screen and a small avatar; security is deferred
- The purpose stays: brief, glanceable cues that protect his attention
> This is the sprint's reason in his words: he wants to use Alice in every meeting he can. The new screen and the avatar must not break the older purpose line about short visual cues. Check that you still agree with that order of priorities.
Source: docs/asdg/02-purpose/03-planned-improvements.md, docs/asdg/02-purpose/03.4-sprint-004-record-and-upload-boundary.md

## The record's boundary, decided
- Log in Git-ignored poc/logs/ inside the project, kept until he deletes the files
- Package held in memory, replaces the folder package, survives Stop
- Purpose adds the outcome "review a past meeting"; other people's speech waits for security
> The five conflicts Purpose found were settled on 19 November: the log is local and Git-ignored, and Alice deletes nothing. Check that you accept that the log keeps other people's speech, locally.
Source: docs/asdg/02-purpose/03.4-sprint-004-record-and-upload-boundary.md, docs/asdg/02-purpose/03.5-sprint-004-purpose-alignment.md

## The avatar: a second, subtler state signal
- Your words: a UI feature that moves with state changes, one more element in the colour code, client side only
- An explicit exception to "nothing moves"; on by default, against Purpose's advice to start off
- Toggle and key A; off with reduced motion; silent on any failure
> Purpose says it fits with conditions: it is silent and visual, but a moving face may draw the eye from the cue. Only the live session can show whether it does. Decide whether you keep it on by default after that session.
Source: docs/asdg/02-purpose/03.6-avatar-purpose-assessment.md

# Use cases

## UC-08: a meeting log you can download
- One log per listening session, written as the meeting goes
- Download log works during or after the meeting; failures are scenarios
- The log holds the other speakers' words too, locally
> This is the use case for the record you asked for. Check that the scenarios match what you expect: download in the middle, download after Stop, nothing yet, a write failure.
Source: docs/asdg/03-system-model-and-use-cases/01.8-meeting-log-and-download.md

## UC-09: the new screen, avatar and keys
- Six situations: question confirmed, candidate present, answer pending, error, package missing, while speaking
- Every input stays: speech, Space, Confirm, Esc, Clear, keys G, L, S, A
- The three cue buttons leave the screen; this goes against "add, never remove"
- The avatar row: a 56 px logo at the left of the bar, with the centre reserved
> UC-09 describes the screen from your seat while you speak. The one real tension is that removing the cue buttons removes an input. The keys G, L and S are the answer, and a manual cue holds for 10 seconds. Say whether that is enough.
Source: docs/asdg/03-system-model-and-use-cases/01.9-new-screen.md, docs/asdg/03-system-model-and-use-cases/01.7-load-preparation-package.md

# Evaluation

## What a pass looks like for upload, log, screen and avatar
- Upload: caller, size cap, file rules, strict UTF-8, 20,000 characters, failure keeps the old package
- Log: complete, time-ordered, no package text, one per session, local only
- Avatar: checks A1 to A5 mapped to 08's AV rules
- 04 aligns its checks with 08's test map so nothing is checked twice
> These are checks, not results: nothing has been run. The automated ones run for free with node test; the reviewer and you settle what a script cannot.
Source: docs/asdg/04-benchmarks-and-eval-strategy/03.10-sprint-004-upload-log-and-screen-checks.md

## The live session, the log review and the statement check
- A live session with an uploaded package, fresh questions, then a downloaded log
- You review the log for order, times, an answer per Focus, one file per session
- The statement check compares the root AGENTS.md and poc/README.md with what really leaves the Mac
> This is where you personally decide. The pass rule asks whether you would keep the feature on, avatar included. Accept the proposed additions or change them.
Source: docs/asdg/04-benchmarks-and-eval-strategy/03.11-sprint-004-live-session-and-statement-check.md

# Architecture

## What 05 accepts for this sprint
- Upload design accepted with three amendments; Remove clears the package
- Package status returns counts only, never package text
- Skip a request when nothing new was said; print the post-pause request
- Source tag, terms and C2, C5 move to SPRINT-005, except the Focus source in the log
> Five architecture points. The sizing of the two small code changes was 05's guess and 08 has since specified them.
Source: docs/asdg/05-high-level-design-and-architecture/01.9-sprint-004-architecture-review.md

## The log lives in the project, behind one local route
- One writer appends events; a write failure never stops a session
- Git-ignored poc/logs/, settable folder, files readable only by him, 5 MB per file
- Only a local page may fetch it; no list, delete or other read route
- The page shows the last 30 seconds of speech as a snapshot, never logged while partial
> The log is the first place Alice keeps private speech text beyond a session, so its limits are an architecture matter. No retention by Alice: you delete files yourself.
Source: docs/asdg/05-high-level-design-and-architecture/01.10-meeting-log-and-transcript-message.md, docs/asdg/05-high-level-design-and-architecture/01.10.1-upload-and-log-statements.md

## The avatar adapter
- One adapter, poc/avatar.js, reads page state only and never touches the page when it fails
- TalkingHead, three.js and the free CC0 mpfb.glb are vendored and pinned in poc/vendor/
- The only server change: the fixed asset list; no speech, no AI call, no log write
> This is the client-side-only design you asked for. Note that "no backend change" becomes "no new backend behaviour", because the files are served by the existing service.
Source: docs/asdg/05-high-level-design-and-architecture/01.11-avatar-adapter.md

# Proof of concept

## No proof of concept before the build
- Decision of stage 06: no experiment first; the avatar draw loop is covered too
- Three uncertainties end in existing checks: log size against 5 MB, log writes never block audio, the 10-second cue hold
- Send-back triggers return the work to 05 and 08
> Stage 06 decided that no bounded experiment is needed. Confirm that, or ask 06 for a different decision.
Source: docs/asdg/06-viable-proof-of-concept/03.2-sprint-004-poc-decision.md

# Sprint plan

## Plan v7: eleven criteria, one theme
- Theme: Alice you can load, use and review in any meeting
- Stories: package status, upload, log with download, new screen, cue keys, wording, carry-forward, avatar
- Out, moved to SPRINT-005: idle-pause guard, own terms, zip, the 20,000-character decision, security, Whisper
> This is the plan as the sprint started. It is bigger than the earlier sprints. If it must shrink, the avatar and part of the wording can slip.
Source: docs/asdg/07-planning/03.14-sprint-004-working-plan.md

## Decided, aligned and what is still open
- Decided: all screen questions, 05's questions, the log in this sprint, folder, retention and the manual cue hold
- Alignment report version 8: READY_FOR_09, no contradiction left
- Still open: no document has a hash approval; the live session and 10's review come last
> Decisions were relayed by Governance. The sprint was started on the alignment result, as SPRINT-003 was. Say whether you want to accept the documents by hash as well.
Source: docs/asdg/07-planning/03.14.1-sprint-004-documents-and-decisions.md, docs/asdg/07-planning/03.16-sprint-004-alignment-report.md

# Detailed design

## The screen: five areas, a mockup as input
- Slim bar with the avatar logo, big bold question, one candidate line, two columns
- Alice suggests: three bold bullets; What I hear: live words, newest bold
- Mockup drafted by Governance from your words; sizes for 1280 by 900
![Annotated wireframe of the five areas with their sizes](docs/asdg/08-low-level-design/images/s004-screen-areas.svg)
> Look at the picture first. The wireframe shows the five areas and their sizes. The page scrolls in a short window and nothing clips.
Source: docs/asdg/08-low-level-design/03.7.1-s004-screen-areas.md, docs/asdg/08-low-level-design/03.7-sprint-004-screen-specification.md

## The mockup you approved the look of
![Mockup of the new screen](docs/asdg/08-low-level-design/images/s004-alice-ui-v2-mockup.png)
> This is the first mockup, drafted before the avatar. The avatar now sits at the left of the bar as a logo with its caption, and the centre of the bar is empty, kept for Alice's later advice.
Source: docs/asdg/08-low-level-design/03.7-sprint-004-screen-specification.md

## 91 rules and 106 checks, each tied to a request
- Nine requests UI-1 to UI-9 trace to rules and checks; the avatar adds AV-1 to AV-8
- Controls keep every input; upload and download are specified
- Log format and storage are rules ML and MS
- All fourteen questions are decided, including the 10-second cue hold
> The specification is complete as a draft and nothing is built or run. Read the decision record page for what you decided.
Source: docs/asdg/08-low-level-design/03.7.7-s004-open-questions.md, docs/asdg/08-low-level-design/03.8-sprint-004-test-map.md, docs/asdg/08-low-level-design/03.7.3-s004-controls-and-inputs.md

## What the log must let you learn
- Replay a session: what was said, what question held, what Alice showed, what you did
- Cheap now, hard later: a schema version and two clocks
- Review questions come from 12 Observability
> 12 asked for a schema version and two clocks, since they cannot be added afterwards. 05 and 12 were reconciled on what goes into the log; check that the result is what you want to review later.
Source: docs/asdg/12-observability-insights-and-learning/01-meeting-log-learning-needs.md
