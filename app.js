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
const bandEl = document.getElementById('cue-band');
const debugEl = document.getElementById('debug');
const listenBtn = document.getElementById('listen');
const stopBtn = document.getElementById('stop-listen');
const listenReasonEl = document.getElementById('listen-reason');
const answerEl = document.getElementById('answer');
const answerTagEl = document.getElementById('answer-tag');
const answerMessageEl = document.getElementById('answer-message');
const bulletsEl = document.getElementById('bullets');
const answerReasonEl = document.getElementById('answer-reason');
const detailsEl = document.getElementById('details-text');
const serverEl = document.getElementById('server');
const focusEl = document.getElementById('focus-question');
const focusStatusEl = document.getElementById('focus-status');
const liveEl = document.getElementById('live-question');
const liveTagEl = document.getElementById('live-tag');
const liveNoteEl = document.getElementById('live-note');
const feedbackEl = document.getElementById('question-feedback');
const hintEl = document.getElementById('confirm-hint');
const confirmBtn = document.getElementById('confirm-question');
const clearLiveBtn = document.getElementById('clear-live');
const CONFIRM_UNCERTAIN_MS = 5000;
const LIVE_TAGS = { new: 'new question', restatement: 'restatement' };
// Wording of the seven answer states (LB-1 to LB-7) and the reason lines (LB-9).
const LB = {
  empty: 'An answer appears after you confirm a question.',
  preparing: 'Preparing an answer for this question.',
  failed: 'No proposed answer for this question.',
  unavailable: 'Question recognition and proposed answers are unavailable.',
  liveUnavailable: 'Question recognition is unavailable.',
  generalTag: 'General points, not from your documents',
  lastKnownTag: 'Last known, not live',
  lastKnownNone: 'No answer arrived before listening stopped.',
};
const GENERAL_REASONS = {
  null: 'No preparation package was found.',
  'too-large': 'The package is over 20,000 characters and was not used.',
  empty: 'The package is empty and was not used.',
  unreadable: 'The package could not be read and was not used.',
};
const UNAVAILABLE_REASONS = {
  'no-key': 'No OpenAI key is set up.',
  'no-service': 'The Alice service is not running.',
  'key-rejected': 'OpenAI did not accept the key.',
};
const REJECTED_KEY_STATUS = 'OpenAI authentication failed';
const emptyAnswer = (status = 'empty', focusVersion = 0) => ({ status, focusVersion, bullets: [], details: '', reason: null, lastKnown: false, lastStatus: null });
// `answer` is the proposed answer area; `unavailable` is a page state (no-key, no-service, key-rejected) before or after a session.
const view = { answer: emptyAnswer(), seq: 0, unavailable: null, healthKnown: false };
let current = null;
const freshRemote = () => ({
  status: 'not connected', agent: 'idle', packets: 0, seconds: 0, revision: 0, transcript: '', reply: '',
  sessionId: null, focus: null, focusVersion: 0, live: null, historical: false,
});
const remote = freshRemote();
// The confirmation in flight ({message, timer, uncertain}) and the latest Clear live request.
const ask = { pending: null, resetId: null, feedback: '' };

function renderServer() {
  serverEl.textContent = `server: ${remote.status}\nagent: ${remote.agent}\n` +
    `audio received: ${remote.packets} packets / ${remote.seconds.toFixed(1)}s\n` +
    `heard: ${remote.transcript || '—'}\n` +
    `reply: ${remote.reply || '—'}`;
  renderQuestion();
}

function connected() {
  return Boolean(current?.ready && current.socket?.readyState === WebSocket.OPEN);
}

// Why Confirm is disabled, in the design's order of precedence; empty when it is enabled.
function confirmHint(live) {
  if (view.unavailable && !connected()) return UNAVAILABLE_REASONS[view.unavailable];
  if (!connected()) return 'Start listening to continue.';
  if (ask.pending && !ask.pending.uncertain) return 'Waiting for the server…';
  if (ask.pending) return '';
  if (!live?.text) return `Confirm becomes available when a ${remote.focus ? 'new ' : ''}question is heard.`;
  if (live.text === remote.focus) return 'Live matches the focus question.';
  return '';
}

// Focus changes only from a confirmed result. While a confirmation is pending, Live shows the submitted wording.
function renderQuestion() {
  const { live, focus } = remote;
  const pending = ask.pending?.message;
  focusEl.textContent = focus || 'No focus question yet';
  focusStatusEl.textContent = focus && remote.historical ? '(last known, not live)' : '';
  focusEl.classList.toggle('historical', remote.historical);
  // Without a live session, Live shows nothing heard: the panel no longer listens.
  const shownLive = connected() ? live : null;
  const idleLive = view.unavailable ? LB.liveUnavailable : connected() ? 'Listening for a question…' : 'Not listening';
  liveEl.textContent = pending ? pending.text : shownLive?.text || idleLive;
  liveTagEl.textContent = pending ? 'confirming…' : LIVE_TAGS[shownLive?.kind] || '';
  const newer = pending && live && (live.id !== pending.liveId || live.version !== pending.liveVersion);
  liveNoteEl.textContent = newer ? 'Newer wording arrived; review it after this result.' : '';
  feedbackEl.textContent = ask.feedback;
  const hint = confirmHint(live);
  hintEl.textContent = hint;
  confirmBtn.disabled = Boolean(hint);
  confirmBtn.textContent = ask.pending?.uncertain ? 'Retry confirmation' : 'Confirm';
  clearLiveBtn.disabled = !connected() || Boolean(ask.pending);
  renderControls();
  renderAnswer();
}

// Start is disabled while listening, while health is unknown and while recognition is unavailable (LB-6, NK-5).
function renderControls() {
  const listening = Boolean(current);
  listenBtn.disabled = listening || !view.healthKnown || Boolean(view.unavailable);
  stopBtn.disabled = !listening;
  listenReasonEl.textContent = view.unavailable && !listening ? UNAVAILABLE_REASONS[view.unavailable] : listening ? remote.status : '';
}

// What the answer card and details area hold for the current answer and page state.
function answerContent() {
  const a = view.answer;
  if (view.unavailable) return { cls: 'unavailable', message: LB.unavailable, reasonLine: UNAVAILABLE_REASONS[view.unavailable], bullets: [], details: '', tag: '' };
  const kept = a.lastKnown ? a.lastStatus : a.status;
  const base = { cls: a.lastKnown ? 'last-known' : '', message: '', reasonLine: '', bullets: [], details: '', tag: '' };
  if (a.status === 'empty') return { ...base, message: LB.empty };
  if (a.status === 'preparing') return { ...base, message: LB.preparing };
  if (a.lastKnown && kept === 'preparing') return { ...base, message: LB.lastKnownNone, tag: LB.lastKnownTag };
  const lastTag = a.lastKnown ? LB.lastKnownTag : '';
  if (kept === 'failed') return { ...base, cls: a.lastKnown ? 'last-known' : 'failed', message: LB.failed, tag: lastTag };
  const general = kept === 'general';
  return { ...base, bullets: a.bullets, details: a.details, reasonLine: general ? GENERAL_REASONS[String(a.reason)] || '' : '',
    tag: [general ? LB.generalTag : '', lastTag].filter(Boolean).join(' · ') };
}

// Plain text only (PG-12); content is replaced in place with no animation (PG-6).
function renderAnswer() {
  const c = answerContent();
  answerEl.className = `card answer ${c.cls}`;
  answerTagEl.textContent = c.tag;
  answerMessageEl.textContent = c.message;
  answerMessageEl.hidden = !c.message;
  bulletsEl.replaceChildren(...c.bullets.map(text => Object.assign(document.createElement('li'), { textContent: text })));
  answerReasonEl.textContent = c.reasonLine;
  answerReasonEl.hidden = !c.reasonLine;
  detailsEl.textContent = c.details;
}

// A proposed message applies only with a higher sequence and the displayed Focus version (CT-9, PG-10).
function applyProposed(message) {
  const { proposed, proposedSeq } = message;
  if (!proposed || !Number.isSafeInteger(proposedSeq) || proposedSeq <= view.seq || proposed.focusVersion !== remote.focusVersion) return false;
  view.seq = proposedSeq;
  view.answer = { ...emptyAnswer(), ...proposed };
  return true;
}

// Stop or disconnect: content stays as last known; an interrupted Preparing keeps no content (CT-13).
function markLastKnown() {
  const a = view.answer;
  if (a.lastKnown || a.status === 'empty') return;
  view.answer = a.status === 'preparing' ? { ...emptyAnswer('last-known', a.focusVersion), lastKnown: true, lastStatus: 'preparing' }
    : { ...a, status: 'last-known', lastKnown: true, lastStatus: a.status };
}

// Applies server state only when it is newer than what is displayed, so old results cannot roll back.
// Feedback about an earlier action clears once Live shows different wording.
function applyState(state) {
  if (!state || state.revision <= remote.revision) return false;
  const { revision, reply, focus, focusVersion, live } = state;
  if (!ask.pending && (live?.id !== remote.live?.id || live?.version !== remote.live?.version)) ask.feedback = '';
  const newFocus = focusVersion > remote.focusVersion;
  Object.assign(remote, { revision, reply, focus, focusVersion, live });
  // A new Focus shows Preparing and none of the earlier answer in the same render (PG-9).
  if (newFocus) view.answer = emptyAnswer('preparing', focusVersion);
  return true;
}

const RESULT_FEEDBACK = {
  reset: 'Live cleared; say the question again.',
  confirmed: 'Confirmed. Take a moment before you answer.',
  stale: 'The Live question changed before it was confirmed. Review the newer wording and confirm again.',
  invalid: 'Confirmation was not accepted. Review the Live question and try again.',
  unavailable: 'Nothing new to confirm yet.',
  limit: 'Too many question requests in this session; stop and restart listening.',
};

// A result settles only its own request; results for other requests just offer newer state.
function questionResult(message) {
  if (applyState(message.state)) acknowledgeRender(message.state);
  if (ask.pending?.message.requestId === message.requestId) {
    clearTimeout(ask.pending.timer);
    ask.pending = null;
    ask.feedback = RESULT_FEEDBACK[message.status] || '';
  } else if (ask.resetId === message.requestId) {
    ask.feedback = RESULT_FEEDBACK[message.status] || '';
  }
}

// After the next paint, tells the server which revision (and Live version) is on screen. Display evidence only.
function acknowledgeRender(state) {
  const resources = current;
  const live = state.live ? { liveId: state.live.id, liveVersion: state.live.version } : {};
  requestAnimationFrame(() => {
    if (current === resources && resources?.socket?.readyState === WebSocket.OPEN) {
      // After paint: the answer's Focus version and status sit beside the revision fields (PG-8).
      resources.socket.send(JSON.stringify({ type: 'rendered', revision: state.revision, ...live,
        answerFocusVersion: view.answer.focusVersion, answerStatus: view.answer.status }));
    }
  });
}

function sendControl(message) {
  current.socket.send(JSON.stringify(message));
}

function resetLive() {
  if (!connected() || ask.pending) return;
  ask.resetId = crypto.randomUUID();
  sendControl({ type: 'question.reset', sessionId: remote.sessionId, requestId: ask.resetId });
  renderQuestion();
}

// Sends the Live question exactly as rendered. An uncertain request is retried unchanged, never re-read.
function confirmQuestion() {
  const live = remote.live;
  if (confirmBtn.disabled) return;
  if (ask.pending?.uncertain) {
    ask.pending.uncertain = false;
    ask.feedback = 'Checking the confirmation again…';
  } else {
    ask.pending = { message: { type: 'question.confirm', sessionId: remote.sessionId, requestId: crypto.randomUUID(),
      liveId: live.id, liveVersion: live.version, expectedFocusVersion: remote.focusVersion, text: live.text } };
    ask.feedback = 'Confirming…';
  }
  const pending = ask.pending;
  sendControl(pending.message);
  pending.timer = setTimeout(() => {
    if (ask.pending !== pending) return;
    pending.uncertain = true;
    ask.feedback = 'Confirmation uncertain: no reply from the server yet. Retry to check.';
    renderQuestion();
  }, CONFIRM_UNCERTAIN_MS);
  renderQuestion();
}

// After a disconnect or Stop the Focus question is history, and an unanswered confirmation stays unknown.
function endQuestionSession(reason) {
  remote.historical = true;
  if (ask.pending) {
    clearTimeout(ask.pending.timer);
    ask.pending = null;
    ask.feedback = `${reason} before the server replied; the confirmation may not have been saved.`;
  }
}

function setState(name) {
  const s = STATES[name];
  panel.textContent = s.text;
  bandEl.style.setProperty('--cue-bg', s.bg);
  bandEl.style.setProperty('--cue-fg', s.fg);
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
  view.answer = emptyAnswer(); view.seq = 0;
  mic.status = 'requesting permission';
  // A new session starts with no question memory and no pending controls from the previous one.
  clearTimeout(ask.pending?.timer);
  Object.assign(ask, { pending: null, resetId: null, feedback: '' });
  Object.assign(remote, freshRemote(), { status: 'waiting for microphone' });
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
      // One socket is one server session; events naming another session are ignored.
      remote.sessionId ??= message.sessionId;
      if (message.sessionId !== remote.sessionId) return;
      if (message.type === 'ready') { resources.ready = true; remote.status = message.status; }
      if (message.type === 'question.result') questionResult(message);
      if (message.type === 'status') remote.status = message.status;
      if (message.type === 'agent') remote.agent = message.status;
      if (message.type === 'audio') { remote.packets = message.packets; remote.seconds = message.seconds; }
      if (message.type === 'transcript') remote.transcript = message.text;
      if (message.type === 'answer') {
        const changed = applyState(message);
        if (applyProposed(message) || changed) acknowledgeRender({ revision: remote.revision, live: remote.live });
      }
      if (message.type === 'proposed' && applyProposed(message)) acknowledgeRender({ revision: remote.revision, live: remote.live });
      // A refused key ends the session with the public error text; recognition is then unavailable (NK-3).
      if (message.type === 'status' && message.status === REJECTED_KEY_STATUS) view.unavailable = 'key-rejected';
      renderServer();
    };
    socket.onerror = () => {
      if (current === resources) { remote.status = 'server connection failed; local meter still running'; renderServer(); }
    };
    socket.onclose = () => {
      resources.ready = false;
      if (current !== resources) return;
      remote.agent = 'disconnected';
      markLastKnown();
      endQuestionSession('Disconnected');
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
  remote.status = 'stopped'; remote.agent = 'stopped';
  markLastKnown();
  endQuestionSession('Stopped');
  renderDebug(0); renderServer();
}

listenBtn.addEventListener('click', () => { if (!current) void startListening(); });
stopBtn.addEventListener('click', () => { if (current) stopListening(); });
clearLiveBtn.addEventListener('click', resetLive);
confirmBtn.addEventListener('click', confirmQuestion);
window.addEventListener('beforeunload', stopListening);
if (location.hash === '#diagnostics') { debugEl.hidden = false; serverEl.hidden = false; }
renderDebug(0);
renderServer();

// One health request on load (HL-6): only `service` and `configured` are used; the package fact is never read.
async function readHealth() {
  try {
    const health = await (await fetch('/health', { cache: 'no-store', signal: AbortSignal.timeout(3000) })).json();
    if (health?.service !== 'alice-good-meetings') view.unavailable = 'no-service';
    else if (health.configured !== true) view.unavailable = 'no-key';
  } catch { view.unavailable = 'no-service'; }
  view.healthKnown = true;
  renderServer();
}
void readHealth();
