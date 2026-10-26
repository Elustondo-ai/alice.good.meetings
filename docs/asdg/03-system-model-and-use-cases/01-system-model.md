# Speaker Coach system and UML use cases

Speaker Coach supports one main use case: help an interviewee answer questions during a meeting through brief private visual coaching.
The model covers intended product behavior from the 20 October 2026 discussion, without selecting a meeting provider or implementation architecture.

## Actors and system boundary

The interviewee is the primary actor who receives cues and decides what to say. The interviewer is an external actor whose questions and follow-ups enter through the meeting conversation.
Speaker Coach is the system inside the boundary, rather than another actor. It follows the meeting and presents coaching privately; technical meeting participation is undecided.
Question recognition, question retention and cue preparation belong inside the boundary. Human answers, hiring decisions and the meeting service itself remain outside it.

## UML use case model

![UML use-case diagram with two external actors, a Speaker Coach boundary, three specialized scenarios, included shared behaviors and conditional corrective guidance.](images/system-use-cases.png)

[Vector diagram](images/system-use-cases.svg) · [Editable PlantUML source](system-use-cases.puml)

Solid actor associations show participation, not screen access. The interviewer contributes speech; coaching is delivered to the interviewee.
Hollow-triangle arrows point from each specialized scenario to the general coaching use case. Dashed «include» arrows point to shared required behavior.
Dashed «extend» arrows point from conditional corrective guidance to the open-answer and experience-story use cases. Their condition is that correction is warranted while an answer is underway.
The diagram describes behavior and relationships, not execution order, software components or a technical connection to the meeting.

| Scenario | Interviewee goal | Distinctive coach behavior |
| --- | --- | --- |
| [UC-01 Direct question](01.1-direct-question.md) | Give a focused answer. | Offer up to three relevant cues during reflection or answering. |
| [UC-02 Open question](01.2-open-question.md) | Develop a coherent explanation. | Allow elaboration and signal drift, repetition or a suitable conclusion. |
| [UC-03 Experience question](01.3-experience-question.md) | Tell a relevant, genuine story. | Support recall when grounded context exists and track context, personal action and result. |

## Domain model and shared behavior

An interview session contains participants and question-answer exchanges. Each exchange has a current question, the interviewee's developing response and any associated cues.
A question can contain several parts and invite more than one answer flow. A cue is a brief private visual prompt tied to the current exchange; grounded personal context is optional supporting material.
All flows identify and retain the question, allow reflection, prepare brief cues and follow the answer. A pause or restatement helps but is not required to activate support.
The coach should keep the question stable during the interviewee's speech, preserve relevant multipart content and replace stale cues when a genuine follow-up changes the exchange.
Unclear questions, overlapping speech, late cues, unavailable context and mixed flows require graceful fallback. Specific fallback proposals appear in each scenario document.

## Actual evidence and planned work

[The accepted purpose](../02-purpose/01-purpose.md) prioritizes attention, focus, recall and visual guidance. [Current capabilities](../02-purpose/02-current-capabilities.md) record stakeholder reports of duration-based signals; the richer behaviors here remain unverified.
[The selected next improvement](../02-purpose/03-planned-improvements.md) is distinguishing speakers and keeping the interviewer question visible. This scenario package expands the intended model without changing that priority or creating an implementation commitment.
Review should resolve exact versus summarized question text, cue timing, relevance and duration criteria, personal-context sources and mixed-flow transitions. These are candidate decisions; no Stage 07 work item, owner or schedule is established.

Source: the user's scenario discussion on 20 October 2026, the linked Purpose baseline and the documentation-only authorization. The UML relationships and fallback details are modeling proposals; saving the package does not record lifecycle acceptance.

[Use-case package](README.md) · [Illustration prompts](images/illustration-prompts.json)
