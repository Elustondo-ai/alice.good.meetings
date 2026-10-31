# Meeting Helper browser page

[Source: index.html](index.html)

## What this page is for

Meeting Helper is the screen a person keeps open, on a second monitor or phone, while they answer questions in an interview or meeting. It tells them at a glance whether they are fine to keep talking or should wrap up, so they don't have to watch a clock or lose track of time mid-answer.

The page listens through the microphone and times how long the person has been speaking. The large word in the middle changes as the answer goes on:

- **GOOD** (green): keep going.
- **LAND IT** (yellow): after about 25 seconds of speaking, start concluding.
- **STOP** (red): after about 35 seconds, finish now.

The small panels are for whoever is testing the prototype, not for the speaker during a real conversation. The top-left panel shows the microphone level and how long the current turn has lasted. The bottom-left panel shows what the local server heard and what the reasoning agent replied. The buttons in the bottom-right corner start and stop listening, or set the signal by hand.

![The Meeting Helper page while listening: a full-screen green GOOD signal, a microphone panel at top left, a server panel at bottom left showing the transcribed interview question and answer plus the agent's reply, and Stop listening, Good, Land it and Stop buttons at bottom right.](docs/images/meeting-helper-page.png)

*Screenshot of the actual page, captured on 30 October 2026 at 1280 × 720 in headless Chrome driven by Playwright, connected to the local POC server. The microphone was fake: Chrome played a synthetic speech file made with macOS `say` (a short interview question and answer), and real OpenAI transcription and agent calls produced the text shown. In this run the controller rejected a later agent proposal and kept its earlier reply, so no `question:` line appears. The screenshot shows how the page looks, not that it works; that evidence comes from `poc/browser-smoke.mjs`, which passed the same day. The yellow and red states are not shown.*

This prototype times how long someone talks. It doesn't identify who is speaking or judge whether an answer is good. See [Purpose](docs/asdg/02-purpose/01-purpose.md) for the longer-term goals.

## Responsibilities and collaborators

Owns document structure, responsive inline CSS and the initial GOOD appearance; delegates behavior to app.js.

![Browser document → DOM + inline CSS → app.js event handlers](images/index-flow.svg)

- [app](app.md): Binds click handlers, microphone acquisition, timing and display updates.

## Interface and data

DOM contract: `#panel` is a div, `#debug` and `#server` are pre elements, `#listen` is the Start/Stop listening button, and `#controls button[data-state]` carries good, land or stop. There are no exported programming functions.

| Callable or interface | Contract |
| --- | --- |
| `Document load` | Initializes a green GOOD panel and loads app.js after the DOM elements. |
| `Manual state controls` | Supply data-state values consumed by the script. |
| `Viewport layout` | Uses viewport-relative sizes and fixed overlays; overflow is hidden. |
| `Server response overlay` | A small scrollable status surface shows server counters, transcript and agent output; text is assigned through textContent. |

## Effects and failure behavior

Changing element IDs or data-state values requires a matching JavaScript change. The visible page title is Meeting Helper. Small-window readability and microphone availability depend on the browser and need runtime checks.

## Example

Run `bash poc/start.sh` and open http://127.0.0.1:3000. The original feedback surface remains; the lower overlay provides the server/agent demonstration. See [POC results](poc/RESULTS.md).
