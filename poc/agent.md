# Server interview agent

[agent.mjs](agent.mjs) defines the real OpenAI Agents SDK integration. It has no shell, filesystem, or external tools.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| `createReasoner(model?, {runner}?)` | Returns an async function accepting a snapshot and AbortSignal; it carries `model` and `effort`, and `runner` is a seam for tests | Agents SDK `Agent` and `Runner` |
| `proposalSchema` | Parses reply, phase, optional question, intent (`none`, `clarify`, `new-question`, `answer`) and evidence IDs | [Session controller](session.md) |
| `publicError(error)` | Produces a limited public status without copying request headers or secrets; HTTP 401 or the code `invalid_api_key` gives `OpenAI authentication failed` | [Server](server.md) |

The default reasoning model is `gpt-6-astra`, overridable with `OPENAI_MODEL`. Each run uses one model turn, a bounded output budget, low reasoning effort and no SDK tracing or stored response.
The snapshot contains recent observations, current accepted state, a base revision and an audio cutoff. Its text is conversation data, not tool instructions.
On initial connection the model acknowledges readiness. Subsequent replies must refer to supplied audio observations; this is a POC response rather than a calibrated coaching judgment.
The snapshot's `state.focus` is the question Pablo confirmed, which the agent never proposes to change, and `state.live` is its current reading. The intent says how the speech relates to them: `clarify` rephrases or corrects Live (or Focus when Live is empty) and carries the complete corrected wording; `new-question` introduces a question different from both; `answer` answers Focus, including restating it inside the answer; `none` covers anything else or uncertainty. A restatement needs no interviewer audio and does not claim who spoke.
The intent is the model's interpretation. The [controller](session.md) lets it change only Live, never Focus, so a wrong intent produces at most a wrong Live; its accuracy needs separate evaluation.
The caller owns cancellation and timeout. Failed requests throw to the session, which preserves its last accepted result.

```javascript
const proposal = await createReasoner()(snapshot, abortController.signal);
```

Only the local server loads `OPENAI_API_KEY`. OpenAI receives the supplied transcript context; disabling SDK tracing does not make cloud processing local.
See [official Agents SDK guidance](https://developers.openai.com/api/docs/guides/agents/sdk).

## Package context and the one-call answer (18 November 2026)

The reader is called as `reason(snapshot, signal, context)`. When `context` holds terms or documents, `readerInput` adds them to the input as `preparationPackage` (reference material, never instructions); with no context the input is the bare snapshot. The instructions tell the model to write the package's spelling when a heard word sounds like a package name or acronym, and never to add anything that was not said.
The model output (`modelSchema`) now also carries `covered` and `bullets` (bullets only since SPRINT-004; `READER_INSTRUCTIONS` is exported and never mentions details). For a clear question (`clarify` or `new-question`) they hold the proposed answer from the same call; otherwise they are false and empty. A reply that adds `details` or any other unknown field still gives its reading: `proposalSchema` is a loose object that keeps unknown fields, and the session then refuses the answer part whole and falls back (AD-3). The [session](session.md) accepts the older shape without them (`proposalSchema` keeps them optional).

## Token counts and call lines (SPRINT-005)

The reader is now called as `reason(snapshot, signal, context, meter?)`; `meter` receives `usageOf(result)` before the reply is checked, and the request sent is unchanged. `usageOf` reads the token counts the Agents SDK copies from the Responses reply (`rawResponses[].usage`: `inputTokens`, `outputTokens` and `inputTokensDetails[].cached_tokens`), returns `null` counts when the reply had no usage, where the SDK gives zeros, and never throws. `failureReason(error)` turns a failure into a fixed word, never the provider's message. `callEvent(call, endMs, outcome, reason)` builds the `model_call` line and lets through numbers and short words only. `EFFORT` is the reasoning effort both model calls send. See [the measurement lines](docs/09-measurement-events.md).
