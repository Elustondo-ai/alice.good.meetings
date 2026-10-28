# Streaming microphone packets

[audio-worklet.js](audio-worklet.js) runs outside the page's UI timer and prepares audio for the local server.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| `PcmCapture` | Averages channels, resamples to 24 kHz and converts to PCM16 | Web Audio input |
| `process(inputs)` | Consumes audio frames; emits one transferred buffer per 2400 output samples | Worklet message port |
| Page handler | Adds sequence and starting-sample headers and sends when the server is ready | [Browser app](../app.md) |

The page loads `/poc/audio-worklet.js` and constructs `new AudioWorkletNode(ctx, 'pcm-capture')`.
The processor uses weighted sample averaging, preserving fractional accumulation across input frames. It clips values to the PCM16 range and emits 100 ms packets.
This simple POC resampler is not a production speech-quality filter. The tests cover duration and amplitude at 24, 44.1 and 48 kHz, not transcription fidelity.
The output graph is muted; microphone audio is not played through the speakers. Local RMS/color processing runs through a separate analyser.
The page disconnects the worklet and closes its AudioContext on Stop. Unsent partial packets are discarded at the end of a session.
