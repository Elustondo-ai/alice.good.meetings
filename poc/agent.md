# Server interview agent

[agent.mjs](agent.mjs) defines the real OpenAI Agents SDK integration. It has no shell, filesystem, or external tools.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| `createReasoner(model?)` | Returns an async function accepting a snapshot and AbortSignal | Agents SDK `Agent` and `Runner` |
| `proposalSchema` | Parses reply, phase, optional question and evidence IDs | [Session controller](session.md) |
| `publicError(error)` | Produces a limited public status without copying request headers or secrets | [Server](server.md) |

The default reasoning model is `gpt-6-astra`, overridable with `OPENAI_MODEL`. Each run uses one model turn, a bounded output budget, low reasoning effort and no SDK tracing or stored response.
The snapshot contains recent observations, current accepted state, a base revision and an audio cutoff. Its text is conversation data, not tool instructions.
On initial connection the model acknowledges readiness. Subsequent replies must refer to supplied audio observations; this is a POC response rather than a calibrated coaching judgment.
The caller owns cancellation and timeout. Failed requests throw to the session, which preserves its last accepted result.

```javascript
const proposal = await createReasoner()(snapshot, abortController.signal);
```

Only the local server loads `OPENAI_API_KEY`. OpenAI receives the supplied transcript context; disabling SDK tracing does not make cloud processing local.
See [official Agents SDK guidance](https://developers.openai.com/api/docs/guides/agents/sdk).
