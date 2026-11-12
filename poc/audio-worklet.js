// This processor emits 100 ms PCM16 packets at 24 kHz, independent of UI ticks.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 24000;
    this.weight = 0;
    this.sum = 0;
    this.packet = new Int16Array(2400);
    this.offset = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] / channels.length;
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, this.ratio - this.weight);
        this.sum += sample * take;
        this.weight += take;
        remaining -= take;
        if (this.weight >= this.ratio - 1e-9) {
          const value = Math.max(-1, Math.min(1, this.sum / this.ratio));
          this.packet[this.offset++] = Math.round(value * (value < 0 ? 32768 : 32767));
          this.weight = 0; this.sum = 0;
          if (this.offset === this.packet.length) {
            this.port.postMessage(this.packet.buffer, [this.packet.buffer]);
            this.packet = new Int16Array(2400); this.offset = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
