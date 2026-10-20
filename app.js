const STATES = {
  good: { text: 'GOOD', bg: 'green', fg: 'white' },
  land: { text: 'LAND IT', bg: 'gold', fg: 'black' },
  stop: { text: 'STOP', bg: 'red', fg: 'white' },
};

const LAND_AFTER_S = 25;
const STOP_AFTER_S = 35;
const SILENCE_END_MS = 2500;
const SPEECH_RMS_THRESHOLD = 0.02;
const SPEAKING_HOLD_MS = 300;

const panel = document.getElementById('panel');
const debugEl = document.getElementById('debug');
const listenBtn = document.getElementById('listen');

function setState(name) {
  const s = STATES[name];
  panel.textContent = s.text;
  panel.style.background = s.bg;
  panel.style.color = s.fg;
}

document.querySelectorAll('#controls button[data-state]').forEach((btn) => {
  btn.addEventListener('click', () => setState(btn.dataset.state));
});

const mic = {
  status: 'off',
  level: 0,
  speaking: false,
  turnStart: null,
  lastVoice: 0,
};

function renderDebug(durationS) {
  debugEl.textContent =
    `mic:      ${mic.status}\n` +
    `speaking: ${mic.speaking ? 'speaking' : 'not speaking'}\n` +
    `duration: ${durationS.toFixed(1)}s\n` +
    `level:    ${mic.level.toFixed(3)}`;
}

function tick(analyser, buf) {
  const now = performance.now();
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  mic.level = Math.sqrt(sum / buf.length);

  if (mic.level > SPEECH_RMS_THRESHOLD) {
    mic.lastVoice = now;
    if (mic.turnStart === null) mic.turnStart = now;
  }
  mic.speaking = now - mic.lastVoice < SPEAKING_HOLD_MS;

  if (mic.turnStart !== null && now - mic.lastVoice > SILENCE_END_MS) {
    mic.turnStart = null;
  }

  const durationS = mic.turnStart === null ? 0 : (now - mic.turnStart) / 1000;
  if (durationS > STOP_AFTER_S) setState('stop');
  else if (durationS > LAND_AFTER_S) setState('land');
  else setState('good');
  renderDebug(durationS);
}

async function startListening() {
  listenBtn.disabled = true;
  mic.status = 'requesting permission';
  renderDebug(0);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    mic.status = 'listening';
    setInterval(() => tick(analyser, buf), 100);
    listenBtn.textContent = 'Listening';
  } catch (err) {
    mic.status = `error: ${err.name}`;
    listenBtn.disabled = false;
    renderDebug(0);
  }
}

listenBtn.addEventListener('click', startListening);
renderDebug(0);
