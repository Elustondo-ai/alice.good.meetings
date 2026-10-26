AI-MODIFIED - 2026-10-21T16:13Z

# Speaker Coach Benchmark and Evaluation Strategy

**Draft 0.1 for Pablo's review · ASDG Step 04 · 21 October 2026**

Speaker Coach will be evaluated through a permanent automatic replay harness and microphone-based Air QA, followed by validation during real interviews. An initial set of ten recorded conversations will provide repeatable test inputs. Live use will also capture new recordings that can become additional test cases after review.

## Intended evaluation mechanisms

| Mechanism | Input and execution | What it evaluates |
| --- | --- | --- |
| Automatic replay testing | A harness feeds a recorded conversation progressively into the application's audio-processing path at normal conversation speed. | Repeatable evaluation of speaker identification, question understanding, coaching behavior and response timing across versions. |
| Air QA | Speaker Coach listens through the real microphone while an interview takes place on another computer, or a recording plays aloud through a loudspeaker. | The physical audio path, room conditions, capture quality and the complete application experience. A person operates and assesses the session. |
| Live interview validation | Speaker Coach listens, analyzes and provides assistance during an actual interview, while recording the conversation when recording is agreed and enabled. | Practical usefulness under authentic conditions, including whether guidance helps the user retain the question and answer effectively. |

## Automatic replay harness

The harness will remain available throughout development and maintenance. Relevant feature changes will be evaluated against the versioned recording suite to identify improvements and regressions. Each run will retain the application and model configuration, case version, delivered-input timeline, outputs, errors and evaluation results.

The harness may hold the complete MP3, but the analyzing agent receives only the audio whose playback time has arrived. It receives no complete recording, future transcript, interviewer script, answer reference or accessible path to the source file. Permitted background, such as the job description and user voice profile, is supplied explicitly and consistently across comparable runs.

“Word by word” means preserving the conversation's progression through timed audio chunks, including natural pauses and overlapping speech. It does not require cutting audio at individual word boundaries or replacing audio with precomputed text. The agent must recognize and react as the conversation unfolds, with no access to future input.

Replay and microphone input should join the same downstream processing path at a defined boundary. The harness knows it is running a test; the analyzing agent does not need advance knowledge of the case or its future content. The boundary must be enforced by input delivery and access controls, then checked through delivery logs. An instruction asking the agent not to look ahead is insufficient.

## Initial set of ten recordings

Build ten distinct interview recordings covering varied question types, speakers and circumstances. Include direct, open and experience questions; multipart questions and follow-ups; short and long answers; hesitation, interruptions and overlapping speech; and differing capture or background-noise conditions. These are coverage goals for selecting the recordings, not ten completed cases.

Each admitted case will retain an identifier and version, original audio, capture conditions, permitted background, a checked transcript with speaker labels, question boundaries and meaning, and expected coaching criteria. Store evaluator references separately from runtime inputs. A separately recorded user voice sample can support identity recognition; it must not disclose later speech from the case.

Keep a stable core suite for regression comparisons and reserve some cases for checks after development. When new cases are admitted, version the suite so a change in test data is distinguishable from a change in application performance. Recordings already used to tune behavior should be identified as such.

## Evaluation criteria and evidence

| Criterion | Evidence to examine |
| --- | --- |
| Speaker attribution | Correct identification of the user and other speakers, mistaken assignments and appropriate handling of uncertainty. |
| Question handling | Detection of actual questions, preservation of multipart meaning, stability during the user's answer and correct replacement on follow-up. |
| Coaching quality | Relevant, grounded suggestions that respect the user's real background and do not invent experience or achievements. |
| Timing and reliability | Audio delivery time, question completion time, output availability, missed input, errors and whether assistance arrives while it can still help. |
| Attention and usefulness | In Air QA and live use, whether cues are understandable at a glance and help without derailing the user's thought. |

The harness automates execution and evidence capture. Objective checks can be scored automatically; judgments about relevance and usefulness initially require a defined rubric and human review. Acceptance thresholds remain to be agreed. Replay alone cannot establish whether a suggestion improves an answer, because a recorded answer cannot respond to the suggestion.

## Live use expands the dataset

Each live assistance session with recording enabled and agreed will create a new candidate recording and associated application-output trace. Recording should run alongside analysis without intentionally delaying assistance. A saved session is one new data point; it becomes a benchmark case only after checking capture completeness, labeling speakers and questions, defining expectations and deciding its appropriate use.

Preserve the original recording and restrict access to the intended evaluation purpose. Review sensitive material before sharing or admitting a real interview to a wider test collection. Collecting sessions supplies evidence for improving the application; it does not itself retrain the model or establish that the application's outputs are correct.

## Planned proof of concept and review

The POC will take one recorded conversation, feed its audio progressively at normal speed, obtain reactions before the recording ends, and save enough input/output timing evidence to demonstrate the enforced no-look-ahead boundary. A useful additional check uses two recordings with an identical opening and different continuations: until the divergence, the agent must receive the same input and have access to neither future continuation. Generated outputs need not be identical across runs.

Pablo has completed mock-interview trials and selected this evaluation direction. The ten-case suite, replay harness, simultaneous live recording and measured results are planned outcomes; this draft does not establish that they exist or work. No implementation sprint or release commitment is created here. Review this first-round Step 04 strategy before deciding whether to accept it and proceed to the next stage; the POC's design and execution remain subsequent work.

Source: Pablo's Speaker Coach discussions and strategy statement, 21 October 2026. The fixed ten-recording target, automatic progressive replay, Air QA, live validation and accumulating session recordings come from that statement; case admission, evidence details and the comparison check are supporting proposals for review.
