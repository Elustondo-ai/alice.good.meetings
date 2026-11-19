# A local interview helper with cloud reasoning

Alice.Good.Meetings should retain the interviewer's question while Pablo answers and propose an answer to it, using brief private visual guidance that preserves his attention.
This intended architecture is a proposal from the 25 October 2026 discussion, amended on 16 November 2026 for SPRINT-003. Question capture and retention exist as a [proof of concept](02-current-architecture.md); the proposed answer and its preparation package are designed here and not built.

![On the MacBook, the web page exchanges audio and display updates with a local service that holds audio intake, the interview agent, the answer generator, the preparation package and the state controller; the service connects to cloud transcription and a reasoning model.](images/deployment.svg)

## Where the parts run

One local Alice.Good.Meetings service serves the web page on localhost and owns the interview session. The browser captures microphone audio and renders updates.
The service uses the OpenAI Agents SDK for one interview agent. Model inference runs through the OpenAI API in the cloud, separately from the ChatGPT application.
Cloud transcription supplies incremental text. The interview agent sends permitted conversation context to a reasoning model, and the answer generator sends the Focus question with the preparation package. These are separate operations and may use different models.
Audio, selected text and, with SPRINT-003, the text of Pablo's preparation package therefore leave the Mac. Running transcription or reasoning entirely locally remains an alternative requiring performance evidence.

| Component | Responsibility and interface |
| --- | --- |
| Browser page | Sends timed audio, question controls and declared P-toggle events; receives versioned question, phase, proposed-answer, connection-status and visual updates. It computes the timing cue itself. |
| Audio intake | Accepts live or replay packets, checks order and coverage, and normalizes audio for the selected transcription service. |
| Speech interpretation | Combines incremental text with separately obtained speaker estimates, uncertainty and manual turn hints. Recognition placement remains open. |
| Interview agent | Reads permitted observations and current state; proposes a phase and a Live question with supporting observation references. |
| Answer generator | Makes one bounded model call per Focus version from the question, fixed instructions and the preparation package; returns bullets and details. See [proposed answer](01.3-proposed-answer.md). |
| Preparation package | Pablo's documents as text files on local disk, read by the service and never sent to the page. See the [decision record](decisions/Proposed%20answer%20and%20its%20context/README.md). |
| State controller | Owns accepted session state in memory, validates updates, and rejects obsolete proposals and late answers before publishing to the page. |
| Cloud adapters | Connect to transcription and reasoning APIs, handle errors and retain provider credentials on the local service. |

These are logical components within a small service, not separately deployed services. A database is not required; any retained evaluation trace is a separate, explicit output.

## What each model call owns

The interview agent interprets meaning: a greeting, a developing question, an answer, a clarification or a closing exchange.
It receives recent observations plus the retained question and session context and, since 18 November 2026, the package terms and text as reference material; it does not own audio transport, render the page or directly overwrite accepted state.
Since 18 November 2026 a clear question read after a pause also sets the Focus question, through the controller; Confirm stays as an optional command ([automatic flow](01.7-automatic-question-flow.md), [input channels](01.6-input-channels.md)).
The answer generator turns one question and the package into text; it is now the fallback when the reader's own answer is not valid. It has no tools, sees no audio or transcript, and may state about Pablo only what the package contains.
Both return bounded proposals. The controller owns the transition rules and revision checks described in [interview state](01.2-interview-state.md).
Speaker identity remains an estimate unless established by suitable evidence; the Agents SDK itself does not solve speaker recognition.

## Runtime choice and development tools

The Agents SDK was [selected for the POC](decisions/Use%20Open%20AI%20Agent%20SDK/README.md) because its loop runs inside application code while the application controls tools and state. [Official SDK documentation](https://developers.openai.com/api/docs/guides/agents/sdk).
Codex SDK and app-server remain alternatives; [planned decisions](03-planned-decisions.md) explains when their capabilities would be useful.
Codex's desktop app supports development, debugging and replay inspection. The interview service launches independently and does not require an open Codex chat.
The local service must remain running during a session; Start and Stop must control capture, connections and cleanup explicitly. [Service start and key](01.4-service-start-and-key.md) states what the run command and the page do with and without a key.

## Scope and basis

The initial capture assumption is a microphone that can hear both participants. Capturing meeting audio when headphones are used requires a separate input decision.
The [Purpose priority](../02-purpose/03-planned-improvements.md) and [use-case model](../03-system-model-and-use-cases/01-system-model.md) supply the desired behavior.
No acceptance is recorded for those pages or for this one. The basis for this amendment is Pablo's direction of 16 November 2026, as relayed in the Stage 07 [brief addendum](../07-planning/03.6.3-sprint-003-brief-addendum.md).
[Current implementation](02-current-architecture.md) · [Streaming and replay](01.1-streaming-and-replay.md) · [Proposed answer](01.3-proposed-answer.md) · [Architecture index](README.md)
