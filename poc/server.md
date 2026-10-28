# Local browser and transcription service

[server.mjs](server.mjs) connects the existing page to live transcription and one server agent.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| HTTP server | Serves four explicitly listed public paths and `/health` | Existing HTML/JS and capture worklet |
| `/session` WebSocket | Accepts one same-origin browser session at a time | [Session](session.md) |
| Transcription socket | Streams PCM and forwards partial/final text | OpenAI Realtime transcription |
| Agent/controller | Generates and validates display proposals | [Agent](agent.md) |

`createPocServer({reason?, apiKey?, transcriptionModel?, connect?, audit?})` returns a Node HTTP server. Tests inject reasoning and the upstream transport; normal execution uses real OpenAI connections.
The executable binds `127.0.0.1`, using `PORT` or 3000. `/health` reports process availability, credential presence and connection count; it does not prove OpenAI availability.
Only `/`, `/index.html`, `/app.js` and `/poc/audio-worklet.js` are served. Repository files and credentials are inaccessible through the static server.
HTTP Host and WebSocket Origin must match localhost or 127.0.0.1 and the listening port.

The upstream connection uses `session.update` for 24 kHz PCM transcription. Start sending browser audio after the `ready` event; audio spoken during connection setup is not transmitted.
Server RMS above 0.012 marks speech. A turn commits after 800 ms silence or eight seconds of buffered audio containing speech. Pure silence buffers clear every five seconds.
Agent reasoning can start from partial transcription. Audio intake continues while that request runs.
Audio send backlog above two seconds closes the connection with a degraded status. Sessions have a 30-minute POC limit and must be explicitly restarted after failures.
`stop`, socket closure, SIGINT and SIGTERM release sessions and pending work. Public errors omit provider request details and credentials.
Audit stdout contains event names, times, counts and revisions, without audio, transcripts or API keys. `browser_rendered` is a client acknowledgement, not a human acceptance decision.
See [live transcription guidance](https://developers.openai.com/api/docs/guides/realtime-transcription).
