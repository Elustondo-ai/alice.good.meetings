# Server interview agent

[agent.mjs](agent.mjs) defines the real OpenAI Agents SDK integration. It has no shell, filesystem, or external tools.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| `createReasoner(model?)` | Returns an async function accepting a snapshot and AbortSignal | Agents SDK `Agent` and `Runner` |
| `proposalSchema` | Parses reply, phase, optional question, intent (`none`, `clarify`, `new-question`, `answer`) and evidence IDs | [Session controller](session.md) |
| `publicError(error)` | Produces a limited public status without copying request headers or secrets | [Server](server.md) |

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
