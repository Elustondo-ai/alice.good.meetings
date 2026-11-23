# System model and use cases: how help would work

This folder turns the product's purpose into understandable interactions: who participates, what happens during an exchange and what the user should experience.

![Interview question → Private visual guidance → Interviewee's answer. Diagram of this stage's purpose, not a completion claim.](images/stage-overview.svg)

## Alice.Good.Meetings today

The saved model describes one meeting-coaching use case, modelled so far through three interview answer scenarios (UC-01 to UC-03); other meeting types reuse the same flow. These are intended behaviors from the 20 October 2026 discussion, not proof that the current application implements them.

The illustrations depict a desired experience. The system overview explains actors, boundaries and shared behavior without choosing a technical meeting integration.
The 4 November 2026 [Focus and Live question use case](01.4-confirm-current-question.md) keeps a Focus question fixed while a Live question follows speech; since 18 November 2026 (draft) a pause sets Focus, and Confirm question remains an optional manual tool. Its panel is in the page at Git revision `7d60c0f`, which this stage read as source and did not run.
For SPRINT-003, the 16 November 2026 [proposed-answer use case](01.5-proposed-answer.md) adds at most three short points for the Focus question, built from the question and the preparation package. It is a draft; code status is tracked in the 18 November handoff, which this stage has not re-read.

## What belongs here as we develop

The scenarios help us discuss interruptions, overlapping speech, changing questions and cues that arrive too late. They give evaluation and design concrete behavior to work from.

## Explore

- [System overview and UML model](01-system-model.md).
- [Direct question](01.1-direct-question.md): pause, reflect and answer.
- [Open question](01.2-open-question.md): develop an answer and stay focused.
- [Experience question](01.3-experience-question.md): recall and tell a relevant story.
- [Keep a Focus question](01.4-confirm-current-question.md): a pause sets Focus; Confirm question and Clear live stay optional.
- [Input channels](01.6-inputs-and-future-channels.md): speech and buttons now, gestures and video planned, none removed.
- [Load the preparation package](01.7-load-preparation-package.md): upload several files, see the status, Stop and Remove.
- [Prepare a meeting](01.10-prepare-a-meeting.md): the preparation agent expands the package into a knowledge base and presets; [exceptions and live use](01.10.1-prepare-exceptions-and-live-use.md).
- [Meeting log](01.8-meeting-log-and-download.md): a time-stamped log of each session, downloadable.
- [New screen](01.9-new-screen.md): the SPRINT-004 screen, its inputs and six situations.
- [See a proposed answer for the Focus question](01.5-proposed-answer.md): short points and details after the pause, replaced whenever Focus changes.
- [Answer states](01.5.1-proposed-answer-states.md): the seven states of the proposed-answer area that the layout preview must show.
- [SPRINT-003 use-case review](03-sprint-003-use-case-review.md): the first-pass check of the sprint's commitments that led to the proposed-answer use case.

Read files in order: **01 Intended**, **02 Current**, **03 Planned**. Additional topics use dotted numbers such as `01.1` or `03.2`; release and sprint plans identify their horizon in the filename and text.
See the [folder guide](../../../asdg/00-governance/docs/stage-layout.md) for consolidation at cycle closeout. Return to [project documentation](../README.md).
