# How we will evaluate Alice.Good.Meetings

Alice.Good.Meetings must understand an unfolding conversation and help a person without interrupting their thinking. We need different evidence for each.

![Replay compares product behavior, Air QA checks real audio capture, and live interviews test usefulness.](images/evaluation-strategy.svg)

## Three complementary ways to learn

| Method | How it works | What we learn |
| --- | --- | --- |
| **Automatic replay** | Feed a recorded conversation progressively through the product at normal speed. | Whether speaker attribution, question handling and coaching improve or regress across versions. |
| **Air QA** | Play a recording aloud, or interview on another device, while the app listens through its real microphone. | Whether capture, room conditions and the visible experience work together. |
| **Live interview** | A person answers fresh questions while receiving guidance. | Whether the guidance is understandable, timely and helpful without distracting them. |

Replay is a permanent development tool, not a one-off demonstration. Air QA and live trials complement it throughout development.
A recorded answer cannot react to new coaching: replay alone cannot demonstrate improved answering.

## Test the conversation as it unfolds

The replay controller may hold the complete recording; analysis receives only audio whose playback time has arrived.
Timed chunks preserve pauses and overlap. “Word by word” means progressive delivery, not word-sized files or a prepared transcript.
Replay and microphone input should join the same downstream processing path at a documented boundary; its technical design remains open.
No analysis component—including transcription, retrieval and coaching—may access future audio, private transcripts, evaluator labels or reference answers.
List permitted background explicitly and keep it constant across comparisons. A voice sample must be independently recorded and reveal no future case speech.
The proposed-answer generator is one of these components. Its declared inputs are the Focus question, fixed instructions and the interview preparation package: Pablo's résumé and other documents he prepares, whose text is sent to OpenAI.
The package is permitted background: plain text or Markdown up to 20,000 characters, kept in `poc/context/interview/` and ignored by Git. List its files and digests for each run. It never contains benchmark recordings, their transcripts, evaluator labels or reference answers.
Two checks enforce this: the request body is asserted to hold only the declared inputs, and the package's file list and digests are compared with `eval-data/` before each run (see the [plan](03.6-sprint-003-evaluation-plan.md)).
Decided by Pablo on 18 November 2026: the package is also not written from a benchmark case's questions, or it would work as reference answers.
Each input channel (speech, buttons, later gesture and video) is also an input: it is measured alone, then in combination, under the same isolation ([automatic flow and channels page](03.9-sprint-003-automatic-flow-and-channels.md)).
Enforce the boundary through delivery and resource access, then inspect both access and timing evidence. An instruction not to look ahead is insufficient.

## Build a small collection that lasts

Begin with **one recording**, then grow toward the user-selected target of **ten varied recordings**.
Version cases and retain configurations, delivered-input timelines, outputs, errors and evaluation results so comparisons can be explained.
Live sessions recorded with agreement and recording enabled become candidate cases; they join the benchmark only after review.
The [collection guide](01.1-benchmark-collection.md) explains coverage and admission.

## Decide what success means

Use the [evaluation scorecard](01.2-evaluation-criteria.md) to assess attribution, question handling, coaching, timing, reliability and usefulness.
The first feature was [keeping the interviewer's question visible](../02-purpose/03-planned-improvements.md). SPRINT-003 adds a proposed answer: its criteria are in the scorecard and its checks in the [SPRINT-003 evaluation plan](03.6-sprint-003-evaluation-plan.md).
First demonstrate valid progressive replay; then assess feature quality; use real answering to assess benefit. These are separate conclusions.
Numeric thresholds and the detailed first-case protocol remain [pilot proposals](03-release-single-recording-evaluation.md), not approved product policy.

## Basis and status

Reorganized from the [original strategy draft](sources/strategy-draft-0.1.md) and subsequent review discussions.
Replay, Air QA, live validation and the ten-recording target reflect the user's selected direction; detailed scoring and protocols are proposals.
The declared inputs of the answer generator and the package's form and place follow Pablo's decisions of 16 November 2026, as relayed by 00 Governance.
No benchmark execution or measured result is established by these documents. See [current evidence](02-evidence-and-reconciliation.md).
[Review index](README.md)
