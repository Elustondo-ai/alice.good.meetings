# Data statements to change when this ships

Two pages tell a reader what leaves the Mac: the root `AGENTS.md` and `poc/README.md`. Both become wrong once a proposed answer sends the preparation package to OpenAI.
Architecture owns neither page. This reference gives their owners the exact wording to apply with the code change; nothing here has been applied. Link markup inside a quotation is shown literally. The [decision](README.md) carries the diagram of what is sent.

## Root `AGENTS.md`, project constraints

Today:

> While the POC listens, microphone audio and selected transcript text go to OpenAI (`[POC README](poc/README.md)`).

Proposed replacement:

> While the POC listens, microphone audio and selected transcript text go to OpenAI. Each time a Focus question is confirmed, that question and the text of the interview preparation package (within 20,000 characters, without a `README.md`) also go to OpenAI (`[POC README](poc/README.md)`).

Proposed additions, after the line about the OpenAI key:

> The interview preparation package (Pablo's résumé and other documents) lives only in `poc/context/`, which Git ignores; do not print it, commit it, or copy it into documents, logs or tests.

> The package never contains benchmark recordings, their transcripts, evaluator labels or reference answers.

## `poc/README.md`

Today, under the diagram:

> The server owns the API key. The page receives transcript and agent results, never credentials.

Proposed replacement:

> The server owns the API key and reads the preparation package. The page receives transcript, agent results and proposed answers, never credentials or the package text.

Today, at the end of the Run section:

> Microphone audio and selected transcript text are sent to OpenAI while listening. This is a local single-session POC with no persistent conversation storage.

Proposed replacement:

> Microphone audio and selected transcript text are sent to OpenAI while listening. Each time you confirm a Focus question, that question and the text of the files in `poc/context/interview/` (plain text or Markdown, within 20,000 characters, except `README.md`) are sent to OpenAI to prepare the proposed answer. The service reads those files when a session starts, keeps them in memory for that session and stores nothing. This remains a local single-session POC with no persistent conversation storage.

## Change of 18 November 2026

The automatic flow changes what is sent. At session start, up to 40 terms (500 characters) picked locally from the package go to transcription as a hint. After each pause the transcript text, the state, the terms and the package text go to OpenAI in one request, not only at each Confirm. Replace "each time a Focus question is confirmed" above with "after each pause". The `poc/README.md` working tree already carries this; the root `AGENTS.md` sentence needs Pablo or Admin, who own it, and criterion 9's "only" must follow.

## Scope of "only"

Criterion 9 says only the question and the package are sent. That holds for the answer request alone: the answer generator receives the question, fixed instructions and the package, and no audio or transcript.
Audio and selected transcript text still go to OpenAI for transcription and to the interview agent, as the statements above say. A package over the limit is not sent at all.

## Decision of 18 November 2026

Pablo decided there is no package notice on the page before Start, as relayed by 00 Governance ("Accept both"). Purpose's rule B2 is therefore met by these two statements, which say the package text is sent to OpenAI each time a Focus question is confirmed. No `/health` usable flag is added.

## Conditions

The folder path is the location Pablo selected on 16 November 2026, recorded in [the preparation package](02-preparation-package.md). The wording itself was not put to him and stays a proposal.
The statements describe behavior that does not exist yet. Applying them before the code ships would make the pages wrong in the other direction, so they belong in the same change as the feature.
The Purpose page already records the boundary in Pablo's terms ([draft boundaries](../../../02-purpose/01-purpose.md)); these statements are its operational form.

[Decision](README.md) · [The preparation package](02-preparation-package.md)
