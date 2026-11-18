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
> The second Purpose review of the sprint ends with change required. It asked for five small wording amendments, and the pages are being updated for them. One decision stays with Pablo: whether the page itself must warn him that package text leaves his Mac, or whether the data statements are enough.
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
> The second use case review found three gaps. Two are now answered in the page: an oversized package, and the page with no key. One remains: long details are called collapsed here, while the criterion says they scroll. Pablo should also say whether the package shows as loaded before the interview.
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
- Architecture review, version 2: change required, a notice is missing
> This rule keeps the answer attached to the right question. Every request carries the session and the Focus version it was made for. Any Confirm raises the version, cancels the earlier request and removes the earlier answer.
> A failed request is retried once by the service. After that the card shows a message, with no retry button.
> The answer has no write path to the Focus or Live question, and the cue never depends on it.
> The second architecture review says the design carries every commitment and needs no decision from Pablo. It asks for five amendments. The main one: no architecture page yet tells him, before a session, that package text will leave his Mac.
Source: docs/asdg/05-high-level-design-and-architecture/01.3-proposed-answer.md, docs/asdg/05-high-level-design-and-architecture/03.3-sprint-003-architecture-review-v2.md

# Proof of concept

## No delay experiment runs before the build
- Pablo chose to learn the answer delay in the live session
- The only timing on record: 1482 ms for a one-sentence reply
- Cost: a delay that is too long is found only after building
> Nobody knows how long the points take to appear after Confirm. Pablo was asked whether to measure it first, with about thirty billable requests, or to learn it in his live session. He chose the live session.
> The reasoning is that the delay only matters compared with the pause he takes before answering, and that pause comes from a live session.
> The cost is that a delay that is too long is found only after the feature is built. The fix order is a shorter details limit, then a smaller package limit, then a design change that is his decision.
> One proposal still awaits his agreement: reconsider the design if the points become visible after he has started to answer.
Source: docs/asdg/06-viable-proof-of-concept/03.1-sprint-003-poc-decision.md

## GAP: Stage 06 records no experiment and no result
- Looked in the Proof of concept folder: a README and one decision page
- The README says no experiment or result is documented in this stage yet
- Unmeasured: do instructions alone stop invented statements about him?
> The Proof of concept stage holds one decision page. Its README says that no experiment or result is documented in this stage yet.
> The decision page names one uncertainty that is material and unmeasured: whether instructions alone keep the model from stating something about Pablo that his package does not contain. The stage recommends learning this in steps three and four of the live session. It also says that seven answers can show an invented statement, but cannot show that none will occur.
> Pablo is not recorded as having been asked about this risk separately. Before coding, he should say whether he accepts learning it in the live session. The Proof of concept specialist owns recording that answer.
Source: docs/asdg/06-viable-proof-of-concept/README.md, docs/asdg/06-viable-proof-of-concept/03.1-sprint-003-poc-decision.md

# Sprint plan

## SPRINT-003: a new layout and a proposed answer
- Layout B, cue first: Focus and answer cards, Live bar with Confirm
- Nine criteria; details area and package context are the two new ones
- Pablo approves the layout from a preview before it replaces the page
> The sprint objective is to give Alice a new page design and let her propose an answer to the Focus question: a few short points beside it and supporting details below, built from the question and an interview preparation package.
> The sprint was closed as unfinished and restarted on 18 November with an amended record. It now has nine acceptance criteria and twelve commitments. The scope is unchanged: the page files, the images folder, the service folder and the OpenSpec changes folder.
> The criteria include tests, a run command and one live session.
> Pablo may still drop the scripted page check, which is the only work he did not name himself. He should decide that before coding.
Source: docs/asdg/07-planning/03.8-sprint-003-review-brief-v2.md, docs/asdg/07-planning/03.8.1-sprint-003-brief-v2-direction.md

## Alignment so far: not ready for coding
- Alignment report, version 3: close to aligned, but NOT_READY
- All four second-pass stage reviews end with change required
- The data statements for what goes to OpenAI have no owner
> The alignment report, version three, says the foundations are close to aligned but the sprint is not ready for coding. That report checked the old record, before the restart.
> It listed what must happen first: the sprint record amended, which the restart has now done, accepted defaults marked as decided in Purpose and Architecture, a plan from Planning, a specification from the Specs stage, and an owner for the data statements.
> The second-pass reviews from Purpose, Use Cases, Evaluation and Architecture each end with change required. No reconciled report of that second run is in the Planning folder yet.
> Planning proposes that Pablo assign the root guidance sentence to Governance and the service README to Coding. He should decide that.
Source: docs/asdg/07-planning/03.7-sprint-003-alignment-report.md, docs/asdg/07-planning/03.7.3-sprint-003-amendments.md, docs/asdg/07-planning/03.8.2-sprint-003-brief-v2-prior-reviews.md

## GAP: No SPRINT-003 plan with tasks exists yet
- Looked in the Planning folder: briefs and an alignment report, no plan
- The alignment report says the Stage 07 plan is not started
- The Planning README still names SPRINT-000 as the active sprint
> There is no sprint plan to review. The Planning folder holds the review briefs and the alignment report for this sprint, but no page that lists tasks, their order and their completion evidence.
> The alignment report says so directly: the plan from Stage 07 and the specification from Stage 08 are not started. The evaluation plan also expects Planning to schedule the scripted page check and the shell check.
> The Planning README is stale too. Its status paragraph is dated 28 October and names an earlier sprint as active.
> The Planning specialist owns writing the plan. Pablo should expect it, and review it, before any coding starts.
Source: docs/asdg/07-planning/README.md, docs/asdg/07-planning/03.7-sprint-003-alignment-report.md, docs/asdg/07-planning/03.7.1-sprint-003-coverage.md

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

## GAP: No detailed design for SPRINT-003 exists yet
- Looked in the Detailed design folder: only UC-04 pages are there
- Missing: layout B, answer card, details area, package, run command
- The alignment report says the Stage 08 specification is not started
> The Detailed design folder holds nothing for this sprint. There is no specification for the new layout, the answer card, the details area, the preparation package or the run command.
> Earlier stages already hand work to it. Use Cases leaves exact wording, sizes and positions to Specs and the preview. Architecture lists points for the detailed design, such as a separate field and message name for the answer. The alignment coverage page adds that no OpenSpec change for this sprint exists.
> The folder README also says nothing here is implemented, while the verification page reports live runs of the panel.
> The Specs specialist owns this design. Pablo reviews it, and the preview, before coding.
Source: docs/asdg/08-low-level-design/README.md, docs/asdg/07-planning/03.7.1-sprint-003-coverage.md, docs/asdg/05-high-level-design-and-architecture/01.3-proposed-answer.md
