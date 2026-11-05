# System model and use cases: how help would work

This folder turns the product's purpose into understandable interactions: who participates, what happens during an exchange and what the user should experience.

![Interview question → Private visual guidance → Interviewee's answer. Diagram of this stage's purpose, not a completion claim.](images/stage-overview.svg)

## SpeakerCoach today

The saved model describes one interview-coaching use case with three answer scenarios. These are intended behaviors from the 20 October 2026 discussion, not proof that the current application implements them.

The illustrations depict a desired experience. The system overview explains actors, boundaries and shared behavior without choosing a technical meeting integration.
The 4 November 2026 [Focus and Live question use case](01.4-confirm-current-question.md) keeps a confirmed Focus question fixed while a Live question follows speech, and Confirm question copies Live into Focus; its controls are not asserted as implemented.

## What belongs here as we develop

The scenarios help us discuss interruptions, overlapping speech, changing questions and cues that arrive too late. They give evaluation and design concrete behavior to work from.

## Explore

- [System overview and UML model](01-system-model.md).
- [Direct question](01.1-direct-question.md): pause, reflect and answer.
- [Open question](01.2-open-question.md): develop an answer and stay focused.
- [Experience question](01.3-experience-question.md): recall and tell a relevant story.
- [Keep a Focus question and confirm each new one](01.4-confirm-current-question.md): the Focus/Live cycle with Confirm question.

Read files in order: **01 Intended**, **02 Current**, **03 Planned**. Additional topics use dotted numbers such as `01.1` or `03.2`; release and sprint plans identify their horizon in the filename and text.
See the [folder guide](../../../asdg/00-governance/docs/stage-layout.md) for consolidation at cycle closeout. Return to [project documentation](../README.md).
