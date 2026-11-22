# Speaking-duration feedback and the meeting screen

[Source: app.js](app.js)

Turns microphone volume into glanceable GOOD, LAND IT and STOP signals. This is a browser prototype of duration feedback; it does not identify the speaker or judge answer quality.

## Responsibilities and collaborators

Owns audio sampling, detected-turn timing, the cue (timer or held key), display state, explicit capture cleanup, the server readout, the Question, candidate, bullets and "What I hear" areas, the package line and the log download.

![Microphone / Web Audio → RMS + turn timer → Panel and debug text](images/app-flow.svg)

- [index](index.md): Provides the bar, error row, Question, candidate line and two columns.
- [Capture worklet](poc/audio-worklet.md): Supplies PCM packets independently of the UI timer.
- [Local server](poc/server.md): Receives audio and returns transcript, state, agent responses and proposed answers through `/session`, and answers `/health`.

## Interface and data

`STATES` maps `good | land | stop` to text and bar colour (white text always). `mic` holds status:string, level:number, speaking:boolean, turnStart:number|null and lastVoice:number; timestamps use performance.now() milliseconds.

| Callable or interface | Contract |
| --- | --- |
| `renderCue()` / `holdCue(name)` | The bar shows a held cue for `CUE_HOLD_MS` (10,000) on `performance.now()`, else the timer's cue (LAND IT above 25 s, STOP above 35 s, GOOD when not listening). A later key restarts the hold; nothing else ends it. A 250 ms timer lets the hold expire when idle. |
| `renderDebug(durationS: number): void` | Renders mic state, elapsed seconds and RMS level. |
| `tick(analyser: AnalyserNode, buf: Float32Array): void` | Reads samples, updates mic state, ends turns after silence, and renders feedback. |
| `startListening(): Promise<void>` | Requests audio access, resumes AudioContext, schedules tick every 100 ms and starts server connection setup. |
| `connectServer(resources, source): Promise<void>` | Sends ordered PCM after server readiness; renders transcript and increasing answer revisions. Errors preserve local audio feedback. |
| `stopListening(): void` | Invalidates the capture generation, stops tracks/timers, closes AudioContext and sockets; ignores late callbacks. |
| `renderServer(): void` | Renders connection/agent status, server audio counts, transcript and reply using textContent, then the question panel. |
| `renderControls()` / `renderAnswer()` | Start is disabled while listening, before `/health` answers and while recognition is unavailable; the reason line shows the reason or the live status. The Alice column shows the seven states (LB-1 to LB-7) with the reason lines, as plain text; the tag is "from your package" for a shown answer. No details area exists. |
| `applyProposed(message): boolean` | Applies a `proposed` or `answer` message's `proposed` only with a higher `proposedSeq` and the displayed Focus version; a new Focus shows Preparing at once. |
| `markLastKnown()` | On Stop or disconnect keeps content as last known; an interrupted Preparing keeps none. |
| `readHealth()` | One `/health` request on load; only `service` and `configured` are used, and anything else makes Start unavailable (no key, or no service). |
| `renderQuestion(): void` | Shows Focus, Live with its tag (or the submitted wording while a confirmation is pending), feedback, the disabled-Confirm hint and button availability. |
| `applyState(state): boolean` | Copies Focus, its version, Live and reply only when the revision is newer than displayed; clears old feedback when Live changes. |
| `confirmHint(live): string` | The reason Confirm is disabled, in the design's order, or empty when it is enabled. |
| `resetLive(): void` | Sends `question.reset` with a new `requestId`. |
| `confirmQuestion(): void` | Sends `question.confirm` for Live exactly as rendered; when uncertain, resends that same request. |
| `questionResult(message): void` | Offers its state to `applyState`, then settles only the matching pending request or latest Clear live. |

## Effects and failure behavior

The DOM must exist before this script runs. RMS must exceed 0.02; short pauses count toward elapsed time. LAND IT begins above 25 s, STOP above 35 s; silence ends a turn above 2500 ms. A key holds its cue for 10 seconds; after that the timer's cue returns.
The local analyser runs independently of OpenAI requests. Audio transmission starts only after server readiness; a two-second send backlog stops transmission with visible degraded status.
Stop preserves the displayed reply, labelled stopped. A new Start resets remote results and counters. Capture generation checks prevent an older permission request or socket from updating a newer session.
Focus changes only from a `confirmed` result. Confirm needs `ready`, no unsettled request, and Live text that differs from Focus; a hint names the missing condition. While pending, the submitted wording stays on screen and a note marks newer Live wording. After 5000 ms without a result the page says the confirmation is uncertain and offers an identical retry; it never assumes approval.
The first event on a socket fixes `remote.sessionId`; events naming another session are ignored. A disconnect or Stop marks Focus "last known, not live" and reports an unanswered confirmation as possibly unsaved. A new Start clears question memory and pending requests; nothing is replayed.
`acknowledgeRender(state)` sends `rendered` after the next paint for every newly applied state or answer, with the Live id and version when Live is displayed and the answer's `answerFocusVersion` and `answerStatus`; it records display, not consent.
A status of `OpenAI authentication failed` makes recognition unavailable (key rejected) and Start stays disabled until the page is reloaded. See [question controls](poc/docs/04.1-question-controls.md).

## Example

Run `bash poc/start.sh`, open http://127.0.0.1:3000 and press Start listening. See [POC results](poc/RESULTS.md) for observed synthetic-browser behavior and physical-microphone limitations.

## Automatic focus (18 November 2026)

The Confirm and Clear live buttons and `confirmHint` are unchanged and stay visible as an optional second tool. `GENERAL_REASONS` gains `not-covered`, and the empty answer wording no longer mentions confirming.

## Package and meeting log (SPRINT-004, 20 November 2026)

| Callable or interface | Contract |
| --- | --- |
| `readPackage()` | `GET /package` on load and after every Stop; sets the foot line "Package: 3 files · 18,843 chars · uploaded" (or "· folder", or "No package"). It shows counts only, never names or text. |
| `uploadPackage(fileList)` | Decodes each file as strict UTF-8 (a failure names the file and sends nothing), then `PUT /package` with `{files:[{name, text}]}`. Shows "Package loaded: …" with any skipped names, or "Not loaded: <reason>. Your previous package is still in use." |
| `removePackage()` | `DELETE /package`; shows "Package removed." Upload and Remove are disabled while listening ("Stop listening to load a package.") and while a request is in flight. |
| `downloadLog()` | `GET /log` from this origin, saved with the file name of `Content-Disposition`; a 404 shows "No meeting log yet." in the monitor line for six seconds. Always enabled. |

A `log` message with status `not saved` adds "log not saved" to the monitor line for the rest of the session. The page now sends `via` on Confirm and Clear.

## Keys, bar and areas (SPRINT-004, 20 November 2026)

| Callable or interface | Contract |
| --- | --- |
| keydown handler | G, L and S hold the cue in every state; Space confirms and Esc clears only while a candidate is present. Nothing acts in a button, link or text field or with Ctrl, Meta, Alt or Shift; Space then presses the focused button. Start, Stop, Confirm, Clear, Upload and Download release their focus after a press so Space is free. |
| `confirmQuestion(via)` / `resetLive(via)` | Send `question.confirm` and `question.reset` with the field `via` (`button`, `space` or `escape`), used only by the meeting log. The request is otherwise identical. |
| `renderQuestion()` | The Question (size by length; tag "confirmed HH:MM:SS · by pause, by Confirm or by Space", or "Last known, not live"), the candidate with its hint ("Space confirms" or the reason), and the answer, hear and cue areas. "No new question heard." shows after 4 seconds without voice, with no candidate and the reader not working. |
| `errorCause()` | The one cause shown in the bold error row, from the health result, the microphone, or the status text. |
| `renderHear()` | Draws the service's `items` snapshot: the item still being transcribed, else the latest final one, is bold; earlier items are faded; after Stop none is bold. |
| `renderMonitor()` | "● listening on server · heard 00:42 · answer ready 1.8 s"; adds "preparing an answer", "log not saved" and the download notice. |

The Question's confirmation time and source come from the page: it records the clock when Focus rises and which control it sent (`pause` when none). Remaining from before: the monitor shows seconds the service heard (`audio` message), not the local meter.

## The avatar (SPRINT-004, 21 November 2026)

| Callable or interface | Contract |
| --- | --- |
| `loadAvatar()` | After the page has loaded, imports [poc/avatar.js](poc/avatar.md) and creates the avatar in `#avatar`. The box is sized but invisible while loading. Any failure within 5 s (`AVATAR_LOAD_MS`), or the system's reduced-motion setting, calls `dropAvatar()`, which removes the box and `#avatar-toggle` silently, with no message. Loading never delays Start, Upload or Download. |
| `updateAvatar()` | Every render and every 250 ms, hands the adapter a deep-frozen `{listening, candidate, focusVersion, answerStatus, errorCause}`; a throwing adapter is dropped and nothing else is affected. |
| `toggleAvatar()` | The button `#avatar-toggle` (`aria-pressed`) and the key A switch it; the choice is kept in `localStorage` under `alice.avatar` (default on, also when storage fails). With the avatar shown the name is an 11 px caption under it (`has-avatar` on `#bar-left`); without it the name is 20 px bold. |

## Fixes after the review of 21 November 2026

- **Candidate.** `freshLive()` treats the service's Live wording as a candidate only while it differs from the Question. After an automatic Question the candidate area is therefore cleared (SS-4): it shows "Waiting for a question", Confirm and Clear are off, and Space and Esc send nothing.
- **"No new question heard."** shows only after 4 seconds without voice (`PAUSE_NOTICE_MS`) and while the reader is not working, so it never shows while a question is still being read.
- **What I hear.** Items with no words are ignored, so an empty item from the service cannot blank the column.
- **Error row.** A refused microphone now shows "Microphone access was refused." at once (another microphone error shows "The microphone could not be opened."), and any service status outside a normal session (quota, model access, time-out) shows the service's own public text in the row.
- **Wording.** Feedback lines say "candidate", not "Live"; an old upload result is cleared at Start so "Stop listening to load a package." shows.
