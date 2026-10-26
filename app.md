# Speaking-duration feedback

[Source: app.js](app.js)

Turns microphone volume into glanceable GOOD, LAND IT and STOP signals. This is a browser prototype of duration feedback; it does not identify the speaker or judge answer quality.

## Responsibilities and collaborators

Owns audio sampling, detected-turn timing, display state and microphone/debug UI updates.

![Microphone / Web Audio → RMS + turn timer → Panel and debug text](images/app-flow.svg)

- [index](index.md): Provides panel, debug and listen elements plus data-state controls.

## Interface and data

`STATES` maps `good | land | stop` to text/background/foreground. `mic` holds status:string, level:number, speaking:boolean, turnStart:number|null and lastVoice:number; timestamps use performance.now() milliseconds.

| Callable or interface | Contract |
| --- | --- |
| `setState(name: 'good' \| 'land' \| 'stop'): void` | Updates panel text and colors; other names are invalid. |
| `renderDebug(durationS: number): void` | Renders mic state, elapsed seconds and RMS level. |
| `tick(analyser: AnalyserNode, buf: Float32Array): void` | Reads samples, updates mic state, ends turns after silence, and renders feedback. |
| `startListening(): Promise<void>` | Requests audio access, resumes AudioContext and schedules tick every 100 ms. Catches startup errors in the UI. |

## Effects and failure behavior

The DOM must exist before this script runs. RMS must exceed 0.02; short pauses count toward elapsed time. LAND IT begins above 25 s, STOP above 35 s; silence ends a turn above 2500 ms. Manual states may be overwritten by the next tick. There is no stop-listening control or explicit cleanup after partial startup failure.

## Example

Load `index.html` in a browser with microphone access and press Start Listening. Source inspection establishes these settings; browser behavior and usefulness still need runtime validation.
