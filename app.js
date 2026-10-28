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
const serverEl = document.getElementById('server');
let current = null;
const remote = { status: 'not connected', agent: 'idle', packets: 0, seconds: 0, revision: 0, transcript: '', reply: '', question: '' };

function renderServer() {
  serverEl.textContent = `server: ${remote.status}\nagent: ${remote.agent}\n` +
    `audio received: ${remote.packets} packets / ${remote.seconds.toFixed(1)}s\n` +
    `heard: ${remote.transcript || '—'}\n` +
    (remote.question ? `question: ${remote.question}\n` : '') +
    `reply: ${remote.reply || '—'}`;
}

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
  lastVoice: -Infinity,
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
  const resources = { stream: null, ctx: null, socket: null, timer: null, capture: null, ready: false, sequence: 0 };
  current = resources;
  listenBtn.textContent = 'Stop listening';
  mic.status = 'requesting permission';
  Object.assign(remote, { status: 'waiting for microphone', agent: 'idle', packets: 0, seconds: 0, revision: 0, transcript: '', reply: '', question: '' });
  renderServer();
  renderDebug(0);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (current !== resources) { stream.getTracks().forEach(track => track.stop()); return; }
    resources.stream = stream;
    const ctx = new AudioContext();
    resources.ctx = ctx;
    await ctx.resume();
    if (current !== resources) return;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    mic.lastVoice = -Infinity;
    mic.turnStart = null;
    mic.status = 'listening';
    resources.timer = setInterval(() => tick(analyser, buf), 100);
    stream.getTracks().forEach(track => track.addEventListener('ended', () => {
      if (current === resources) stopListening();
    }));
    void connectServer(resources, source);
  } catch (err) {
    if (current !== resources) return;
    stopListening();
    mic.status = `error: ${err.name}`;
    renderDebug(0);
  }
}

async function connectServer(resources, source) {
  try {
    await resources.ctx.audioWorklet.addModule('/poc/audio-worklet.js');
    if (current !== resources) return;
    const capture = new AudioWorkletNode(resources.ctx, 'pcm-capture');
    resources.capture = capture;
    const mute = resources.ctx.createGain();
    mute.gain.value = 0;
    source.connect(capture).connect(mute).connect(resources.ctx.destination);
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/session`);
    resources.socket = socket;
    remote.status = 'connecting'; renderServer();
    capture.port.onmessage = event => {
      if (current !== resources || !resources.ready || socket.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 96000) {
        remote.status = 'audio backlog; stop and restart listening';
        resources.ready = false; socket.close(); renderServer(); return;
      }
      const samples = new Int16Array(event.data);
      const packet = new ArrayBuffer(8 + samples.byteLength);
      const view = new DataView(packet);
      view.setUint32(0, resources.sequence, true);
      view.setUint32(4, resources.sequence * 2400, true);
      for (let i = 0; i < samples.length; i++) view.setInt16(8 + i * 2, samples[i], true);
      socket.send(packet); resources.sequence += 1;
    };
    socket.onmessage = event => {
      if (current !== resources) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'ready') { resources.ready = true; remote.status = message.status; }
      if (message.type === 'status') remote.status = message.status;
      if (message.type === 'agent') remote.agent = message.status;
      if (message.type === 'audio') { remote.packets = message.packets; remote.seconds = message.seconds; }
      if (message.type === 'transcript') remote.transcript = message.text;
      if (message.type === 'answer' && message.revision > remote.revision) {
        remote.revision = message.revision; remote.reply = message.reply; remote.question = message.question;
        requestAnimationFrame(() => {
          if (current === resources && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'rendered', revision: message.revision }));
          }
        });
      }
      renderServer();
    };
    socket.onerror = () => {
      if (current === resources) { remote.status = 'server connection failed; local meter still running'; renderServer(); }
    };
    socket.onclose = () => {
      resources.ready = false;
      if (current !== resources) return;
      remote.agent = 'disconnected';
      if (['connecting', 'listening on server'].includes(remote.status)) remote.status = 'server disconnected; local meter still running';
      renderServer();
    };
  } catch {
    if (current === resources) {
      remote.status = 'server audio unavailable; local meter still running'; renderServer();
    }
  }
}

function stopListening() {
  const resources = current;
  current = null;
  if (resources) {
    clearInterval(resources.timer);
    resources.capture?.disconnect();
    if (resources.capture) resources.capture.port.onmessage = null;
    resources.stream?.getTracks().forEach(track => track.stop());
    if (resources.ctx && resources.ctx.state !== 'closed') void resources.ctx.close();
    if (resources.socket?.readyState === WebSocket.OPEN) resources.socket.send(JSON.stringify({ type: 'stop' }));
    resources.socket?.close();
  }
  Object.assign(mic, { status: 'off', speaking: false, level: 0, turnStart: null, lastVoice: -Infinity });
  listenBtn.textContent = 'Start Listening';
  remote.status = 'stopped'; remote.agent = 'stopped';
  renderDebug(0); renderServer();
}

listenBtn.addEventListener('click', () => current ? stopListening() : void startListening());
window.addEventListener('beforeunload', stopListening);
renderDebug(0);
renderServer();
