# Response time: where the seconds go and how to cut them

Alice helps only if the Question and its bullets are on screen while the question is still fresh. On 21 November 2026 Pablo ran three real sessions with the SPRINT-004 build and asked seven questions. On average the Question and its answer appeared 8.6 seconds after he stopped speaking, and never in under 6.4 seconds. This analysis measures where that time goes, names the causes in the code, and proposes a design that should show the Question in about 2 seconds and the first bullets in 3 to 4. It is evidence and a proposal for the next sprint; nothing here is built.

```mermaid
flowchart LR
    A["Pablo stops speaking"] -->|"0.8 s<br/>pause rule"| B["Audio committed"]
    B -->|"about 1.6 s<br/>transcription"| C["Final transcript"]
    C -->|"0 to 4.1 s<br/>a reading that is thrown away"| D["Second reading starts"]
    D -->|"2.7 to 4.8 s<br/>one model call"| E["Question and answer shown"]
```

*Today's path with the measured times of the seven questions; the third arrow was zero for two of them.*

## The short version

| | Today, measured | After the cheap fixes, estimated | Proposed design, estimated |
| --- | --- | --- | --- |
| Question on screen | 6.4 to 10.3 s (mean 8.6) | about 5 s | about 2 s |
| First bullets | the same moment | about 6 s | 3 to 4 s, at once when a prepared answer matches |
| Model calls that produce nothing shown | 16 of 23 | about half of that | few, and small |

- **A third of the delay is waste.** On five of seven questions the reader was called on unfinished words, its reply was thrown away, and a second call was needed. That cost 3.3 seconds each time.
- **Half of the model time bought nothing.** Twelve of the 23 calls were rejected, and each carried the whole preparation package.
- **One call does two jobs.** It decides whether a question was asked and writes the answer, so the Question cannot show before the bullets are written.
- **The Mac can do the first steps itself.** It is an Apple M5 Pro with 24 GB: speech to text and "was that a question" can run locally, which removes network waits and keeps the audio on the Mac.

## Pages

| Page | Content |
| --- | --- |
| [08.1 Measured times](08.1-measured-times.md) | The seven questions, the parts of each delay and the 23 model calls |
| [08.2 Causes](08.2-causes.md) | Eight causes, each tied to a line of code or marked as a hypothesis |
| [08.3 Proposed design](08.3-proposed-design.md) | A fast lane and a smart lane, with the rules that keep the screen calm |
| [08.4 Local models](08.4-local-models.md) | What can run on this Mac, the expected gain and what is unknown |
| [08.5 Plan and experiments](08.5-plan-and-experiments.md) | Order of work, expected saving per step and how to measure it |

## Status

Written on 21 November 2026 by 09 Coding at Pablo's request, from his three meeting logs and the service's timing lines. The logs' text is not reproduced here, only times and counts. Measured values, estimates and hypotheses are marked as such on each page. It approves nothing and changes no code; the architecture, the log fields and the evaluation method belong to stages 05, 08 and 04. Return to the [solution guide](README.md).
