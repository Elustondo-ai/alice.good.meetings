# Vocabulary hints

[vocabulary.mjs](vocabulary.mjs) picks names and terms from the preparation package without any model call, so the transcription step can spell them as the package does ("CIBC", not "BBC").

| Export | Responsibility |
| --- | --- |
| `extractTerms(documents)` | Finds acronyms, camel-case words, multi-word names and capitalised words in mid-sentence; ranks them by how often they occur; returns at most 40 terms within 500 characters when joined |
| `hintPrompt(terms)` | Builds the transcription prompt `Names and terms that may be spoken: ...`, or nothing when there are no terms |

The [server](server.md) runs this once when a session starts, only for a usable package, and gives the prompt to the transcription session and the terms to the [question reader](agent.md). The terms are held in memory for that session and never written to the audit or the log; the audit records only how many there were.
