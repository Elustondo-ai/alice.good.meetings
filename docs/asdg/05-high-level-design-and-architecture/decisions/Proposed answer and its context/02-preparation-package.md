# The interview preparation package

The preparation package is Pablo's résumé and the other documents he prepares for an interview. He decided on 16 November 2026 that its text is sent to OpenAI with the Focus question, so answers can draw on his real experience.
This page describes how the service holds and uses it. On 16 November he also selected its location and accepted its format, its size limit and the behavior without a package, as relayed by 00 Governance; each section says what is decided and what remains Architecture's proposal.

```mermaid
flowchart TD
    D["poc/context/interview/<br/>text files, ignored by Git"] --> L{"A session starts:<br/>files found, within the size limit?"}
    L -->|"yes"| M["Text held in memory<br/>for this session only"]
    L -->|"no files"| Q["Answer from the question alone:<br/>structure only, nothing about Pablo"]
    L -->|"over the limit"| V["Package not used;<br/>the page says why"]
    V --> Q
    M --> A["Each answer request:<br/>question, instructions, package text"]
    A --> O["OpenAI reasoning model"]
```

*The location, the size limit and the answer without a package are decided; reading at session start and refusing an oversized package are proposed. The service writes the text nowhere.*

## What leaves the Mac

| When | Sent to OpenAI |
| --- | --- |
| While listening, as today | Microphone audio to live transcription; recent transcript and the session state to the reasoning model |
| At each Confirm, new | The Focus question, fixed instructions and the full package text, to the reasoning model |

The package text never goes to the page, the audit log or a test. Once per session the audit records each file's name, size and digest, as the evaluation strategy asks, and never its content.
Response storage and tracing stay off, as for the interview agent. Those settings do not remove cloud processing.

## Where it is kept

| Option | For | Against |
| --- | --- | --- |
| 1. `poc/context/interview/` in the checkout, ignored by a `.gitignore` inside `poc/context/` | One obvious place; inside the sprint scope, where the root `.gitignore` is not | The checkout is in a Google Drive folder, so the documents sync to Drive |
| 2. A folder outside the checkout, named by a setting in `poc/.env.local` | Personal documents stay out of the working tree and out of Drive | One more setting; the place is less visible |
| 3. Under `docs/` or `eval-data/` | None | Tracked by Git, and `eval-data/` holds evaluation references |

Decided: option 1. On 16 November 2026 Pablo chose "In the project, Git-ignored (Recommended)", with the Drive sync stated to him; option 2 is not selected. Proposed: the service takes the folder as a setting, so tests point at a synthetic folder.
Files are plain text or Markdown, a default Pablo accepted. Proposed detail: they are read in name order, and other formats are ignored and reported. No document parser is added, so he sees exactly the text that is sent; a résumé kept as PDF or Word needs a text copy.

## Size, cost and delay

The whole package travels with every answer request. Input size and cost per confirmed question therefore grow in step with the package, and are paid again for each rewording.
A larger input also delays the start of the answer by an amount nobody has measured; the length of the details adds more.
Decided: a limit of 20,000 characters, about a two-page résumé and six pages of notes, which Pablo accepted as the default. He chose to learn the [answer delay](../../03.2-answer-delay-question.md) in the live session, so no measurement precedes it and he can change the number at the specification review.
Proposed: a package over the limit is not used at all. Cutting it silently would drop documents without Pablo knowing which.
OpenAI may charge less for repeated input. That was not verified and the design does not rely on it.

## No package, and other meetings

Decided: with no package Alice still gives general points from the question alone, labelled as general and saying nothing about Pablo. He accepted this default, the General state of [UC-05](../../../03-system-model-and-use-cases/01.5-proposed-answer.md). Proposed: a package over the limit is treated the same way.
A context kind is a folder under `poc/context/` plus one set of instructions. Only `interview` exists. Another kind of meeting later adds a folder, its instructions and a way to choose the kind when a session starts; the controller, the messages and the page stay as they are. None of that is built now.

[Decision](README.md) · [Where the answer is generated](01-where-answers-are-generated.md) · [Data statements](03-data-statements.md)
