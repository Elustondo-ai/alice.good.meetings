# Meeting Helper browser page

[Source: index.html](index.html)

Provides the full-screen feedback surface, manual controls and diagnostic overlay for the SpeakerCoach prototype.

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
