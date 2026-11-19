---
project: Alice.Good.Meetings
sprint: SPRINT-004 (draft): upload, meeting log and the new screen
presenter: Pablo Elustondo
date: 19 November 2026
notes: This is the pre-code review for SPRINT-004, assembled from the drafts the specialists wrote today. Nothing in it is approved or built. Read each slide, check the open questions, and say what you accept before the sprint starts.
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
- A new, clearer screen; security is deferred
- The purpose stays: brief, glanceable cues that protect his attention
> This is the sprint's reason in his words: he wants to use Alice in every meeting he can. The new screen must not break the older purpose line about short visual cues. Check that you still agree with that order of priorities.
Source: docs/asdg/02-purpose/03-planned-improvements.md, docs/asdg/02-purpose/03.4-sprint-004-record-and-upload-boundary.md

## The record's boundary, and five conflicts to settle
- Kept on his machine, outside the project, until he deletes it; never package text, key or audio
- Package held in memory, replaces the folder package, survives Stop
- Conflicts: log location, package text in answers, interviews first, other people's speech, "no persistent storage" wording
> Purpose found five conflicts with the plan. The two that matter most are where the log lives, since the project folder syncs to Google Drive, and whether answers shown may quote the package. Decide them or accept the recommended defaults.
Source: docs/asdg/02-purpose/03.4-sprint-004-record-and-upload-boundary.md

# Use cases

## UC-08: a meeting log you can download
- One log per listening session, written as the meeting goes
- Download log works during or after the meeting; failures are scenarios
- The log holds the interviewer's words too, locally
> This is the use case for the record you asked for. Check that the scenarios match what you expect: download in the middle, download after Stop, nothing yet, a write failure.
Source: docs/asdg/03-system-model-and-use-cases/01.8-meeting-log-and-download.md

## UC-09: the new screen, six situations
- Question confirmed, candidate present, answer pending, error, package missing, while speaking
- Every input stays: speech, Space, Confirm, Esc, Clear, keys G, L, S
- The three cue buttons leave the screen; this goes against "add, never remove"
> UC-09 describes the screen from your seat while you speak. The one real tension is that removing the cue buttons removes an input. The keys G, L and S are the proposed answer. Say whether that is enough.
Source: docs/asdg/03-system-model-and-use-cases/01.9-new-screen.md, docs/asdg/03-system-model-and-use-cases/01.7-load-preparation-package.md

# Evaluation

## What a pass looks like for upload, log and screen
- Upload: caller, size cap, file rules, strict UTF-8, 20,000 characters, failure keeps the old package
- Log: complete, time-ordered, no package text, one per session, local only, outside the project
- 04 aligns its checks with 08's test map so nothing is checked twice
> These are checks, not results: nothing has been run. The automated ones run for free with node test; the reviewer and you settle what a script cannot.
Source: docs/asdg/04-benchmarks-and-eval-strategy/03.10-sprint-004-upload-log-and-screen-checks.md

## The live session, the log review and the statement check
- A live session with an uploaded package, fresh questions, then a downloaded log
- You review the log for order, times, an answer per Focus, one file per session
- The statement check compares the root AGENTS.md and poc/README.md with what really leaves the Mac
> This is where you personally decide. The pass rule asks whether you would keep the feature on. Accept the proposed additions or change them.
Source: docs/asdg/04-benchmarks-and-eval-strategy/03.11-sprint-004-live-session-and-statement-check.md

# Architecture

## What 05 accepts for this sprint
- Upload design accepted with three amendments; Remove clears the package
- Package status returns counts only, never package text
- Skip a request when nothing new was said; print the post-pause request
- Source tag, terms and C2, C5 move to SPRINT-005, except the Focus source in the log
> Five architecture points. The sizing of the two small code changes is 05's guess and needs 08 to confirm.
Source: docs/asdg/05-high-level-design-and-architecture/01.9-sprint-004-architecture-review.md

## The log lives outside the project, behind one local route
- One writer appends events; a write failure never stops a session
- Folder set by a setting, files readable only by him, 5 MB per file
- Only a local page may fetch it; no list, delete or other read route
- The page shows the last 30 seconds of speech as a snapshot, never logged while partial
> The log is the first place Alice keeps private speech text beyond a session, so its limits are an architecture matter. No retention by Alice: you delete files yourself.
Source: docs/asdg/05-high-level-design-and-architecture/01.10-meeting-log-and-transcript-message.md, docs/asdg/05-high-level-design-and-architecture/01.10.1-upload-and-log-statements.md

# Proof of concept

## GAP: No proof of concept for this sprint
- The proof of concept of SPRINT-003 is the running service itself
- Nothing new was written in stage 06 for SPRINT-004
> Stage 06 produced nothing for this sprint, and none seems needed since the service already runs. Confirm that, or ask 06 for a decision page.
Source: docs/asdg/06-viable-proof-of-concept/README.md

# Sprint plan

## Draft plan v4: eleven criteria, one theme
- Theme: Alice you can load, use and review in a meeting
- Stories: package status, upload, simple log with download, new screen, wording, carry-forward
- Out: own terms, zip, the 20,000-character decision, security, Whisper
> This is the plan, version 4. It is bigger than the earlier sprints. If it must shrink, the cheap guards and part of the wording can slip. The plan is a draft until the final alignment check.
Source: docs/asdg/07-planning/03.14-sprint-004-working-plan.md

## Decided and still owed
- Decided: Q1 to Q13 of the screen, 05's Q1 to Q4, the log in this sprint
- Owed: your own UI list, the log folder, Q14 manual cue hold
- Needed before coding: 02, 03, 04, 05, 08 drafts accepted and a 10 review plan
> Decisions were relayed by Governance; no document has hash approval yet. Pablo still owes the UI list and the folder.
Source: docs/asdg/07-planning/03.14.1-sprint-004-documents-and-decisions.md

# Detailed design

## The screen: five areas, a mockup as input
- Slim bar, big bold question, one candidate line, two columns, nothing else visible
- Alice suggests: three bold bullets; What I hear: live words, newest bold
- Mockup drafted by Governance from your words; sizes for 1280 by 900
![Annotated wireframe of the five areas with their sizes](docs/asdg/08-low-level-design/images/s004-screen-areas.svg)
> Look at the picture first. The wireframe shows the five areas and their sizes. The page scrolls in a short window and nothing clips.
Source: docs/asdg/08-low-level-design/03.7.1-s004-screen-areas.md, docs/asdg/08-low-level-design/03.7-sprint-004-screen-specification.md

## 74 rules and 80 checks, each tied to a request
- Nine requests UI-1 to UI-9 trace to rules and checks
- Controls keep every input; upload and download are specified
- Log format and storage are rules ML and MS
- Q14 asks whether a manual cue holds for 10 seconds
> The specification is complete as a draft and nothing is built or run. Read the decision record page for what you decided and what you still owe.
Source: docs/asdg/08-low-level-design/03.7.7-s004-open-questions.md, docs/asdg/08-low-level-design/03.8-sprint-004-test-map.md, docs/asdg/08-low-level-design/03.7.3-s004-controls-and-inputs.md

## What the log must let you learn
- Replay a session: what was said, what question held, what Alice showed, what you did
- Cheap now, hard later: a schema version and two clocks
- Review questions come from 12 Observability
> 12 answered in one line and asked for a schema version and two clocks, since they cannot be added afterwards. Note that 05 leaves the cue out of the log while 12 wants it; that is a contradiction to settle.
Source: docs/asdg/12-observability-insights-and-learning/01-meeting-log-learning-needs.md
