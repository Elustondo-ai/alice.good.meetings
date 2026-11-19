---
project: Alice.Good.Meetings
sprint: SPRINT-003: new page layout and a proposed answer to the Focus question
presenter: Pablo Elustondo
date: 18 November 2026
---

# Context

## GAP: No context study exists, by Pablo's choice
- Looked in the Context folder: it holds a README and one overview picture
- The README says the product started from scratch and the study is left empty
- Missing: meeting environment, audio access limits and outside dependencies
> The Context stage is empty on purpose. Its README says the project started from scratch and that Pablo chose to leave the context assessment empty for now.
> So there is no description of a meeting environment, of audio access limits, or of outside dependencies. The page says these can be added later, when they become relevant, from real findings and not invented ones.
> Before coding, Pablo should simply confirm that this is still his choice for this sprint. If he wants a context study, the Context specialist owns writing it.
Source: docs/asdg/01-context-and-domain-analysis/README.md

# Purpose

## Brief visual cues that protect his attention
- Regulate delivery: know when to slow down, pause or conclude
- Stay on topic: keep the question and a few relevant points
- Recall experience: bring real accomplishments to mind
![Concept illustration of the desired experience, not a screenshot of the current page](docs/asdg/02-purpose/images/alice.good.meetings-purpose.png)
> This is why the product exists. It helps Pablo stay focused, recall relevant experience and give clear, structured answers in interviews and meetings.
> The main constraint is that preserving attention takes precedence over giving more advice. Spoken coaching interrupted his thinking before, so guidance is visual, short and readable at a glance on a second screen or a phone.
> The picture is a concept illustration that includes future capabilities. It is not a screenshot.
> Pablo agreed with this direction in October, but no acceptance of the exact page is recorded. He should check that the three outcomes still say what he wants.
Source: docs/asdg/02-purpose/01-purpose.md, docs/asdg/02-purpose/README.md

## Today: a timing cue and a confirmed question
- The page shows GOOD, LAND IT or STOP with a timer, computed locally
- It keeps a Focus question and a Live question, with Confirm question
- No proposed answer and no speaker identification exist yet
> This slide separates what is reported, what was read in the source and what was seen running.
> Pablo reports that the green, yellow and red display helps him notice when he has talked too long. That is his own account, not a measured result.
> The Focus and Live questions were read in the source at revision 7d60c0f. Nothing was run for that page. One browser check with synthetic speech on 26 October showed a transcript and an agent reply.
> Whether the visible question keeps him on topic is still an open validation question. Pablo should keep that limit in mind when judging what the sprint adds.
Source: docs/asdg/02-purpose/02-current-capabilities.md

## Next: a proposed answer that stays his own
- A few short points beside the Focus question, details below
- It states nothing about him that his preparation package lacks
- The cue and the Focus question stay the first things he sees
> The next improvement is a proposed answer. When Pablo confirms an interview question, a few short points appear beside it, with supporting details below in case the interviewer wants more.
> The boundaries matter. The answer prompts his own answer, it never invents experience, and it draws only on the interview preparation package he prepares. That package text is sent to OpenAI together with the question.
> The second Purpose review of the sprint ended with change required, and its wording amendments are applied in the Purpose pages as drafts. The one open decision is settled: on 18 November 2026 Pablo decided the page gives no package notice before Start, and the data statements say that package text leaves his Mac. No acceptance of the exact Purpose pages is recorded.
Source: docs/asdg/02-purpose/03-planned-improvements.md, docs/asdg/02-purpose/03.3-sprint-003-purpose-alignment-v2.md

# Use cases

## One coaching goal, three answer scenarios
- Direct question, open question and experience question
- Shared behavior: retain the question, prepare brief answer cues
- UC-04 and UC-05 refine those two shared behaviors
![UML use-case diagram: interviewee, interviewer and the Alice boundary](docs/asdg/03-system-model-and-use-cases/images/system-use-cases.png)
> The system model has one main use case: help an interviewee answer questions through brief private visual coaching. The interviewee receives the cues. The interviewer only contributes speech.
> There are three answer scenarios: a direct question, an open question and an experience question. All of them share two behaviors, keeping the current question and preparing brief answer cues.
> Use case four refines the first shared behavior, and use case five, new in this sprint, refines the second.
> These are intended behaviors and modeling proposals. Pablo should note that exact versus summarized question text and mixed flow transitions are still candidate decisions with no owner or schedule.
Source: docs/asdg/03-system-model-and-use-cases/01-system-model.md, docs/asdg/03-system-model-and-use-cases/README.md

## Only Confirm writes the Focus question
- Live follows speech automatically; Focus stays fixed
- Confirm question copies the exact Live wording into Focus
- Clear live empties Live and never touches Focus
![The Focus and Live cycle of UC-04, a concept and not a screenshot](docs/asdg/03-system-model-and-use-cases/images/focus-live-cycle.svg)
> Use case four keeps two questions in view. The Focus question is the one Pablo is answering. The Live question is what the product currently hears as the question.
> The rule is simple. Speech only writes Live. Only Pablo pressing Confirm question writes Focus. This answers the defect of 4 November, when later speech replaced a question he had already confirmed.
> The new layout of this sprint moves these areas into a Focus card and a Live bar, without changing the rules.
> One thing is open by design: where Clear live, Start and Stop listening and the manual cue buttons go. The layout preview settles that, so Pablo should look for it there.
Source: docs/asdg/03-system-model-and-use-cases/01.4-confirm-current-question.md

## UC-05: points appear after Confirm, then replace
- At most three points and the details arrive together, silently
- Any Focus change removes the old answer at once
- Seven states: from Empty and Preparing to Unavailable and Last known
![Three moments of the proposed answer, a concept and not a screenshot](docs/asdg/03-system-model-and-use-cases/images/proposed-answer-storyboard.svg)
> Use case five is the heart of this sprint. Pablo confirms a question, then at most three short points and the details appear together, with no motion or sound.
> Any new Confirm, even of a rewording, removes the old answer at once. A late answer to an earlier question is never shown.
> The answer area is always in one of seven named states, shown in the preview.
> The second use case review found three gaps, and all are answered in the pages: an oversized package, the page with no key, and long details. On 18 November 2026 Pablo decided that long details scroll inside their own area with no collapse control, and that the page shows no package notice before Start.
Source: docs/asdg/03-system-model-and-use-cases/01.5-proposed-answer.md, docs/asdg/03-system-model-and-use-cases/01.5.1-proposed-answer-states.md, docs/asdg/03-system-model-and-use-cases/03.1-sprint-003-use-case-review-v2.md

# Evaluation

## Three methods give three kinds of evidence
- Automatic replay: repeat one recorded case across versions
- Air QA: play audio aloud through the real microphone
- Live interview: fresh questions show attention and usefulness
![Replay, Air QA and live interviews complement each other](docs/asdg/04-benchmarks-and-eval-strategy/images/evaluation-strategy.svg)
> The evaluation strategy uses three methods, and none replaces the others. Replay feeds a recorded conversation through the product at normal speed. Air QA exercises the real microphone and room. A live interview shows whether guidance helps without distracting.
> A recorded answer cannot react to new coaching, so replay alone cannot show that Pablo answers better.
> One rule holds everywhere: no analysis component may access future audio, private transcripts, evaluator labels or reference answers. The preparation package is permitted background, and it never contains benchmark material.
> Pablo selected these methods and a target of ten recordings. Detailed scoring and numeric thresholds are still proposals, and no benchmark run or measured result exists.
Source: docs/asdg/04-benchmarks-and-eval-strategy/01-evaluation-strategy.md, docs/asdg/04-benchmarks-and-eval-strategy/README.md

## Four layers of evidence check the sprint
- Layers 1 and 2: service tests and a scripted page check, no OpenAI cost
- Layer 3: Pablo approves the preview. Layer 4: one billable live session
- The second review found five gaps; the plan was amended on 18 November
> The sprint is checked in four layers. Service tests and a scripted page check need no OpenAI request. Then Pablo approves a preview. Last comes one live session.
> The live session has seven steps and a pass rule he decided on 18 November. It passes when every step meets its expectation, no answer for an earlier question is shown, every statement about him is in the package, he takes in the cue, the question and the points at a glance, and he would keep the answer on. Delay is reported, not judged.
> The second review found five gaps. The plan now adds checks, with no approval recorded. One session shows it works for him, not that he answers better.
Source: docs/asdg/04-benchmarks-and-eval-strategy/03.6-sprint-003-evaluation-plan.md, docs/asdg/04-benchmarks-and-eval-strategy/03.6.1-sprint-003-live-session.md, docs/asdg/04-benchmarks-and-eval-strategy/03.7-sprint-003-evaluation-review-v2.md

## Two reviewer-run checks keep the data honest
- Package check before every billable run: file digests, then eight-word shingles against the private benchmark text, reporting counts only
- Statement check: every sentence of the two data statements is compared with the request object
- The reviewer script lives at poc/review/package-check.mjs, and no live code may import it
> Two checks belong to a reviewer, not to the product. The package check makes sure no benchmark material is in the preparation package before any billable run. It never prints package or benchmark text, only file names, counts and line numbers.
> The statement check makes sure the data statements in the root instructions and in the POC readme say exactly what leaves the Mac: the question and the package text for an answer request, plus the audio and transcript that already go to OpenAI for transcription.
> Both procedures are drafts with no approval recorded. Pablo should know that a match he judges to be benchmark material makes the run invalid, not merely poor.
Source: docs/asdg/04-benchmarks-and-eval-strategy/03.8-sprint-003-package-and-statement-checks.md

# Architecture

## One local service with cloud transcription and reasoning
- The page captures audio, renders updates and computes the cue itself
- The local service holds the key, the agent and the new answer generator
- Audio, selected text and the package text leave the Mac
![Proposed architecture: where each part runs](docs/asdg/05-high-level-design-and-architecture/images/deployment.svg)
> This is the proposed architecture. A small service on Pablo's MacBook serves the web page and owns the interview session. The browser captures the microphone and renders updates.
> Two parts are new in this sprint and are not built: the answer generator, and the preparation package that the service reads from local disk. The package text never reaches the page.
> Cloud transcription supplies text, and a reasoning model serves two separate operations: the interview agent and the answer generator.
> Pablo should be clear on what leaves the Mac: audio, selected transcript text and, with this sprint, the Focus question and his package text. This is a draft proposal, not a formally accepted design.
Source: docs/asdg/05-high-level-design-and-architecture/01-architecture.md, docs/asdg/05-high-level-design-and-architecture/README.md

## What runs today: the page cue plus a local service
- The cue is computed in the page alone and needs no service
- The service forwards audio to live transcription and holds the key
- The state controller validates proposals; only Confirm writes Focus
![Current implementation, drawn from the source and not from a running page](docs/asdg/05-high-level-design-and-architecture/images/current-system.svg)
> This picture shows what the source does today, read at revision 7d60c0f and rechecked on 18 November. It was drawn from the source. Nothing was run for this assessment, apart from one start check.
> The page computes the cue by itself. It shows LAND IT after 25 seconds of a turn and STOP after 35 seconds, and it keeps working when the service is absent or disconnects.
> The local service accepts one session at a time, forwards audio to OpenAI live transcription and asks a reasoning model for proposals. The state controller validates each proposal.
> Pablo should compare this slide with the previous one. The difference between them is what the sprint has to build.
Source: docs/asdg/05-high-level-design-and-architecture/02-current-architecture.md

## Each answer is bound to its Focus version
- One model call per Focus version returns points and details together
- A result is accepted only for the current Focus version
- No package notice before Start: Pablo decided on 18 November
> This rule keeps the answer attached to the right question. Every request carries the session and the Focus version it was made for. Any Confirm raises the version, cancels the earlier request and removes the earlier answer.
> A failed request is retried once by the service. After that the card shows a message, with no retry button.
> The answer has no write path to the Focus or Live question, and the cue never depends on it.
> The second architecture review said the design carries every commitment and asked for five amendments. The one about a notice before Start was dropped by Pablo's decision on 18 November 2026: the data statements carry that message instead. The other amendments are applied in the architecture pages as drafts.
Source: docs/asdg/05-high-level-design-and-architecture/01.3-proposed-answer.md, docs/asdg/05-high-level-design-and-architecture/03.3-sprint-003-architecture-review-v2.md, docs/asdg/05-high-level-design-and-architecture/01.4-service-start-and-key.md

# Proof of concept

## No POC: the answer delay is learned in the live session
- Pablo chose on 16 November to learn the delay live, not in an experiment of about thirty billable requests
- Refreshed on 18 November for the twelve commitments: still no POC, no new experiment
- The only timing on record is 1482 ms for a one-sentence reply in one synthetic trial
- An answer sends the whole package and returns points plus details
> The Stage 06 decision is that no experiment runs before the build. An experiment could not settle the question alone, because the delay is compared with the pause Pablo takes before answering, and that comes only from a live session.
> The cost is that a delay that is too long is found only after the feature is built. At best the fix is changed settings and a second billable live session. At worst it changes the generator and its tests.
> One risk stays unmeasured: whether the model states something about Pablo that his package does not contain. The live pass rule scores it, so one such statement fails the session. The decision page says he is not recorded as having been asked about this risk separately.
Source: docs/asdg/06-viable-proof-of-concept/03.1-sprint-003-poc-decision.md, docs/asdg/06-viable-proof-of-concept/README.md

## What would send the design back
- Proposed, not agreed: reconsider if the points appear after he has started to answer, or he says they came too late
- First a shorter details limit, then a smaller package limit, each measured again
- Showing partial results or making two calls changes what he selected and is his decision
> This is the return trigger the POC stage proposes for Pablo's agreement, because no limit exists. The delay limit and the trigger stay proposals, outside the live pass rule, so a session can pass while the points arrive late.
> The evidence exists only if the timing points and text-free answer events are built with the feature. The audit log today times Confirm and the end of each utterance, not the moment speech starts, so a speech-start time or a number Pablo states is needed.
> Pablo should decide whether he agrees with this trigger before the live session, or leave it as a proposal.
Source: docs/asdg/06-viable-proof-of-concept/03.1-sprint-003-poc-decision.md

# Sprint plan

## SPRINT-003 restarted with nine criteria
- Same objective and scope; the proposed answer now has points beside it and details below
- New criteria: a details area (8) and a prepared context from his package (9)
- Criterion 5 adds a scripted page check; criteria 2, 3, 4 and 7 are reworded
- The old record was closed as unfinished and restarted on the same branch
> The sprint record was amended because two decisions Pablo made on 16 November were in none of its criteria: the details area and the interview preparation package. There is no amend command, so the old record was closed as unfinished and started again with the amended text.
> The scope is unchanged. The page check in criterion 5 is the one addition Pablo had not named, and he may drop it.
> Pablo should confirm that these nine criteria say what he wants checked, because the plan, the specification and the evaluation all trace to them.
Source: docs/asdg/07-planning/03.7.4-sprint-003-record-amendment.md, docs/asdg/07-planning/03.8-sprint-003-review-brief-v2.md

## Alignment: foundations aligned, documents ready for coding
- Purpose, Use Cases, Evaluation and Architecture agree on all twelve commitments
- Planning's version 5 report says ready for stage 09, for the documentation
- No page has a recorded approval; Pablo's decisions are relayed
- The report names two conditions for coding: skill adapters and the AGENTS.md length
> Four stages reviewed the amended record separately, reconciled six relationships, and the plan and specification were written. Planning's report treats Pablo's 18 November decision as his review of the specification and says plainly that this is not a formal approval of any page.
> The two conditions in the report were true when it was saved. Check whether they are still open before relying on them.
> What is left to Pablo is his own judgment on the running page: the layout, readability at a glance and the live session.
Source: docs/asdg/07-planning/03.11-sprint-003-readiness-report-v5.md, docs/asdg/07-planning/03.11.2-sprint-003-remaining-work.md

## The plan: 26 tasks in one list
- Specification round first, then the preview, which Pablo approves by hash
- Only then may the page change; the service, run script and checks run in parallel
- All checks and the package check pass before the one live session
- Not planned: a POC, a second model call, a collapse control, a package notice
> The plan keeps one task list. Each task names its owner and the commitment it serves. Nothing is coded before ready for stage 09, and the page file stays unchanged until Pablo approves the preview by hash.
> The print option is an accepted default that Pablo may drop. The data statement in the root instructions belongs to Pablo or the ASDG Admin session, because that file is protected.
> Pablo should look at the order: the live session comes last, and it is the only check that shows the feature helps him.
Source: docs/asdg/07-planning/03.9-sprint-003-plan.md, docs/asdg/07-planning/03.9.1-sprint-003-plan-specification.md

## The layout preview was approved by hash
- Approved on 18 November 2026 at 19:09 UTC, as relayed
- Three preview files named by SHA-256; the product page stays unchanged until then
- Covers the layout and where the buttons sit; not the lengths or any document
![The preview with the longest content at 1280 by 900: the cue, Focus and Live panels, the answer card and details](poc/preview/images/preview-shown-long-desktop.png)
> This is the approval record for the layout preview. It names the three preview files by hash, so any later change needs a new approval.
> It covers the layout and the proposed place of the buttons as he saw them. It does not cover bullet and details lengths, which were then fixed from the preview, and it approves no specification page.
Source: docs/asdg/00-governance/03-sprint-003-preview-approval.md

# Detailed design

## UC-04 design: two areas, always in view
- Focus question on top, written only by a successful Confirm
- Live question below, with a small tag: new question or restatement
- Eight panel states are drawn, for desktop and phone width
![UC-04 panel mockup, state 5: a new question waits in Live](docs/asdg/08-low-level-design/images/uc04-state-5-new-question.svg)
> The only detailed design on file is for use case four, the Focus and Live questions, dated 4 November. This mockup shows state five: Focus still holds the earlier question while a new one waits in Live for Pablo to confirm.
> The design comes with eight panel states, a state model and protocol changes. Pablo accepted its five recommendations the same day. That is not approval of the exact document.
> This design describes the panel in the top right corner of the current page. The sprint's new layout moves those areas into cards and a bar.
> Pablo should treat this slide as the starting point that the new layout must preserve, not as the design for this sprint.
Source: docs/asdg/08-low-level-design/03-uc-04-focus-and-live-question.md, docs/asdg/08-low-level-design/03.1-uc-04-panel-states.md, docs/asdg/08-low-level-design/03.4-uc-04-openspec-update.md

## UC-04 live runs passed the core rule
- Run 3: Focus changed only at the two Confirms
- Not verified live: multipart wording, stale or lost confirmations
- Open finding: 5 of 11 agent results were still rejected in run 3
> The verification page records the live runs of 4 November. It was written by the Coding specialist, the implementer, so it is not an independent review, and it still awaits Pablo's review.
> In run three, Focus changed only at the two Confirms and held through two and a half minutes of further speech. Clear live emptied Live and kept Focus.
> Some scenarios rest on unit and browser tests only: multipart wording, stale or lost confirmations, and stopping while thinking. Replay was skipped.
> One finding stays open. Many agent results are rejected, five of eleven in run three, and the causes are not yet known. Pablo should decide whether that needs attention before more is built on top.
Source: docs/asdg/08-low-level-design/02-uc-04-verification.md

## SPRINT-003 specification: 124 rules, each with a check
- Ten contract pages cover the request, controller, labels, health, package, retry, fixtures, page and run script
- 101 checks: 57 service tests, 29 page checks, 15 shell checks
- Every rule has a check and every check a rule
- An OpenSpec change for the sprint carries the same rules and tasks
> The specification turns the stage pages into exact, testable rules for the builder. Each rule has an identifier, one testable statement and its source page.
> The test map lists where each check runs: the service tests in the test file, the page checks in the browser protocol, and the shell checks of the run script. A reverse table shows the checks rule by rule.
> Some things are deliberately not rules because they need a person: whether the cue, question and points are taken in at a glance, whether anything said about him is untrue, and the live pass rule.
Source: docs/asdg/08-low-level-design/03.5-sprint-003-specification.md, docs/asdg/08-low-level-design/03.6-sprint-003-test-map.md

## Fixed values from the approved preview
- Four rows: cue band, Focus, Live, answer card, with fixed heights at each size
- At most three bullets of 120 characters; details up to 1500, scrolling inside themselves
- Cue word and question text no smaller than on the current page
![The layout of the new page as specified](docs/asdg/08-low-level-design/images/s003-layout.svg)
> The limits and layout values were fixed from the preview Pablo approved. The bullet limit of 120 is the nearest round number above the longest sample of 118, because bullets cannot scroll. The details limit of 1500 only bounds the wait and the reading time.
> The reason lines for an oversized, empty or unreadable package, a missing service and a rejected key were not shown in the preview, so Pablo has not seen them rendered.
Source: docs/asdg/08-low-level-design/03.5.11-s003-fixed-layout-values.md

## Ten design choices accepted as written
- After Stop an interrupted answer becomes last known, never empty
- A rejected key shows unavailable only after a session starts; a result that is too long is refused whole
- A 30-second timeout per attempt, so a failure shows after about a minute at most
- The run script may end an older idle service, and never one with a session
> These are choices the specification had to make where the stage pages left something open. Pablo accepted all ten as written on 18 November, as relayed by Governance.
> The 30-second timeout is the one to revisit after the live session, because he set no delay limit.
> The run script's behavior of ending an older idle service was proposed by Architecture and he had not been asked about it before.
Source: docs/asdg/08-low-level-design/03.5.10-s003-review-items.md
