// SA-4: the bar colours; text on the bar is always white.
const STATES = {
  good: { text: 'GOOD', bg: '#1b7f2a' },
  land: { text: 'LAND IT', bg: '#a35c00' },
  stop: { text: 'STOP', bg: '#b3261e' },
};

const LAND_AFTER_S = 25;
const STOP_AFTER_S = 35;
const SILENCE_END_MS = 2500;
const SPEECH_RMS_THRESHOLD = 0.02;
const SPEAKING_HOLD_MS = 300;
const PAUSE_NOTICE_MS = 4000;

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
const errorRowEl = document.getElementById('error-row');
const hearEl = document.getElementById('hear-text');
const packageLineEl = document.getElementById('package-line');
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
const uploadBtn = document.getElementById('upload-package');
const downloadBtn = document.getElementById('download-log');
const fileInput = document.getElementById('package-file');
const removeBtn = document.getElementById('remove-package');
const packageTextEl = document.getElementById('package-text');
const packageNoticeEl = document.getElementById('package-notice');
const avatar = { api: null, on: true, failed: false };
// Hosted mode only: a published service may ask for an access code by answering 401. A local service never does, and none of this shows.
const ACCESS_KEY = 'alice.code';
const access = { code: '', needed: false };
try { access.code = sessionStorage.getItem(ACCESS_KEY) || ''; } catch { /* no storage: the code is asked once per page load */ }
const packageState = { info: null, busy: false, notice: '', logNotice: '' };
const CONFIRM_UNCERTAIN_MS = 5000;
const LIVE_TAGS = { new: 'new question', restatement: 'restatement' };
// Wording of the seven answer states (LB-1 to LB-7) and the reason lines (LB-9).
const LB = {
  empty: 'An answer appears when Alice hears a question and you pause.',
  preparing: 'Preparing an answer for this question.',
  failed: 'No proposed answer for this question.',
  unavailable: 'Question recognition and proposed answers are unavailable.',
  liveUnavailable: 'Question recognition is unavailable.',
  generalTag: 'General points, not from your documents',
  shownTag: 'from your package',
  lastKnownTag: 'Last known, not live',
  lastKnownNone: 'No answer arrived before listening stopped.',
};
const GENERAL_REASONS = {
  null: 'No preparation package was found.',
  'too-large': 'The package is over 20,000 characters and was not used.',
  empty: 'The package is empty and was not used.',
  unreadable: 'The package could not be read and was not used.',
  'not-covered': 'Your documents do not cover this question.',
};
const UNAVAILABLE_REASONS = {
  'no-key': 'No OpenAI key is set up.',
  'no-service': 'The Alice service is not running.',
  'key-rejected': 'OpenAI did not accept the key.',
};
const REJECTED_KEY_STATUS = 'OpenAI authentication failed';
const emptyAnswer = (status = 'empty', focusVersion = 0) => ({ status, focusVersion, bullets: [], reason: null, lastKnown: false, lastStatus: null });
// `answer` is the proposed answer area; `unavailable` is a page state (no-key, no-service, key-rejected) before or after a session.
const view = { answer: emptyAnswer(), seq: 0, unavailable: null, healthKnown: false };
let current = null;
const freshRemote = () => ({
  status: 'not connected', agent: 'idle', packets: 0, seconds: 0, revision: 0, transcript: '', items: [], reply: '', focusAt: null, focusSource: null, focusPerf: 0, answerMs: null,
  sessionId: null, logNotSaved: false, focus: null, focusVersion: 0, live: null, historical: false,
});
const remote = freshRemote();
// The confirmation in flight ({message, timer, uncertain}) and the latest Clear live request.
const ask = { pending: null, resetId: null, feedback: '' };

// SA-6: the monitor line shows a dot that lights while audio arrives, the status, seconds heard and the last answer delay.
const monitorEl = document.getElementById('monitor');
let monitorLastPackets = 0;
let monitorLastAt = 0;
const mmss = ms => { const t = Math.floor(ms / 1000); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function renderMonitor() {
  if (!monitorEl) return;
  const live = remote.status === 'listening on server';
  if (remote.packets !== monitorLastPackets) { monitorLastPackets = remote.packets; monitorLastAt = Date.now(); }
  const notes = [remote.logNotSaved ? 'log not saved' : '', packageState.logNotice];
  if (!live) {
    const idle = !current ? 'not listening' : remote.status;
    monitorEl.textContent = [idle, ...notes].filter(Boolean).join(' · ');
    return;
  }
  const dot = document.createElement('span');
  dot.className = Date.now() - monitorLastAt < 1500 ? 'dot on' : 'dot';
  const answer = view.answer.status === 'preparing' ? 'preparing an answer' : remote.answerMs !== null ? `answer ready ${(remote.answerMs / 1000).toFixed(1)} s` : '';
  const text = [`listening on server`, `heard ${mmss(remote.seconds * 1000)}`, answer, ...notes].filter(Boolean).join(' · ');
  monitorEl.replaceChildren(dot, text);
}
setInterval(renderMonitor, 1000);

function renderServer() {
  serverEl.textContent = `server: ${remote.status}\nagent: ${remote.agent}\n` +
    `audio received: ${remote.packets} packets / ${remote.seconds.toFixed(1)}s\n` +
    `heard: ${remote.transcript || '—'}\n` +
    `reply: ${remote.reply || '—'}`;
  renderMonitor();
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
  // After an automatic Question the service keeps Live equal to it; that is not a candidate (SS-4).
  if (!live?.text || live.text === remote.focus) return `Confirm becomes available when a ${remote.focus ? 'new ' : ''}question is heard.`;
  return '';
}

// The candidate is what the page shows as Live: the submitted wording while a confirmation is pending (SS-3).
// The Live wording counts as a candidate only while it differs from the Question.
const freshLive = () => (connected() && remote.live?.text && remote.live.text !== remote.focus ? remote.live : null);
const candidateText = () => (ask.pending ? ask.pending.message.text : freshLive()?.text || '');
const candidatePresent = () => Boolean(candidateText());

// SA-8: the Question grows with its text and never truncates it.
function questionClass(text) { return text.length > 180 ? 'long' : text.length > 90 ? 'medium' : ''; }
const clock = d => d.toTimeString().slice(0, 8);
const SOURCES = { pause: 'by pause', button: 'by Confirm', space: 'by Space' };

// Focus changes only from a confirmed result. While a confirmation is pending, the candidate shows the submitted wording.
function renderQuestion() {
  const { live, focus } = remote;
  const pending = ask.pending?.message;
  focusEl.textContent = focus || 'No question yet';
  focusEl.className = `question-text ${focus ? questionClass(focus) : 'idle'} ${focus && remote.historical ? 'historical' : ''}`.trim().replace(/\s+/g, ' ');
  focusStatusEl.textContent = !focus ? '' : remote.historical ? 'Last known, not live'
    : `confirmed ${remote.focusAt ? clock(remote.focusAt) : ''}${remote.focusSource ? ` · ${SOURCES[remote.focusSource]}` : ''}`.trim();
  const shownLive = freshLive();
  // The notice waits for a real pause and for the reader to finish, so it never shows while a question is still being read.
  const idleLive = view.unavailable ? LB.liveUnavailable : connected() ? ((mic.paused && remote.agent !== 'thinking') ? 'No new question heard.' : 'Waiting for a question') : 'Not listening';
  liveEl.textContent = pending ? pending.text : shownLive?.text || idleLive;
  liveTagEl.textContent = pending ? 'confirming…' : LIVE_TAGS[shownLive?.kind] || '';
  const newer = pending && live && (live.id !== pending.liveId || live.version !== pending.liveVersion);
  liveNoteEl.textContent = newer ? 'Newer wording arrived; review it after this result.' : '';
  feedbackEl.textContent = ask.feedback;
  const hint = confirmHint(live);
  confirmBtn.disabled = Boolean(hint);
  hintEl.textContent = hint || 'Space confirms';
  confirmBtn.textContent = ask.pending?.uncertain ? 'Retry confirmation' : 'Confirm';
  clearLiveBtn.disabled = !candidatePresent() || Boolean(ask.pending);
  renderControls();
  renderAnswer();
  renderHear();
  renderCue();
  updateAvatar();
}

// SS-6: one bold row between the bar and the Question with the cause; it clears when the cause goes.
const NORMAL_STATUS = new Set(['not connected', 'waiting for microphone', 'connecting', 'server connected; opening transcription', 'listening on server', 'stopped']);
function errorCause() {
  const status = remote.status;
  if (view.unavailable) return UNAVAILABLE_REASONS[view.unavailable];
  if (/^error: (NotAllowed|Security)/.test(mic.status)) return 'Microphone access was refused.';
  if (/^error: /.test(mic.status)) return 'The microphone could not be opened.';
  if (/session limit reached/i.test(status)) return 'Session limit reached (30 minutes); stop and restart.';
  if (/authentication failed/i.test(status)) return UNAVAILABLE_REASONS['key-rejected'];
  if (/OPENAI_API_KEY/.test(status)) return UNAVAILABLE_REASONS['no-key'];
  if (/local meter still running|Transcription (connection|disconnected)|Could not connect|backlog/i.test(status)) return 'Connection to transcription was lost; stop and restart.';
  // Any other status outside a normal session is the service's own public error text (quota, model access, time-out).
  if (!NORMAL_STATUS.has(status)) return status;
  return '';
}

// Start is disabled while listening, while health is unknown and while recognition is unavailable (LB-6, NK-5).
function renderControls() {
  const listening = Boolean(current);
  renderPackage();
  listenBtn.disabled = listening || !view.healthKnown || Boolean(view.unavailable) || access.needed;
  stopBtn.disabled = !listening;
  const cause = errorCause();
  errorRowEl.textContent = cause;
  errorRowEl.hidden = !cause;
}

// SA-12, SA-17: "What I hear" shows the service's snapshot; the item still being transcribed, else the latest final one, is bold.
function renderHear() {
  if (!connected() && !remote.items.some(item => typeof item.text === 'string' && item.text.trim())) { hearEl.replaceChildren(Object.assign(document.createElement('span'), { className: 'idle', textContent: current ? 'Listening…' : 'Not listening' })); return; }
  const items = remote.items.filter(item => typeof item.text === 'string' && item.text.trim());
  if (!items.length) { hearEl.replaceChildren(Object.assign(document.createElement('span'), { className: 'idle', textContent: 'Listening…' })); return; }
  const open = items.findIndex(item => !item.final);
  const newest = !connected() ? -1 : open >= 0 ? open : items.length - 1;
  hearEl.replaceChildren(...items.map((item, i) => Object.assign(document.createElement('p'), { className: i === newest ? 'new' : 'old', textContent: item.text })));
}

// What the Alice column holds for the current answer and page state.
function answerContent() {
  const a = view.answer;
  if (view.unavailable) return { cls: 'unavailable', message: LB.unavailable, reasonLine: UNAVAILABLE_REASONS[view.unavailable], bullets: [], tag: '' };
  const kept = a.lastKnown ? a.lastStatus : a.status;
  const base = { cls: a.lastKnown ? 'last-known' : '', message: '', reasonLine: '', bullets: [], tag: '' };
  if (a.status === 'empty') return { ...base, message: LB.empty };
  if (a.status === 'preparing') return { ...base, message: LB.preparing };
  if (a.lastKnown && kept === 'preparing') return { ...base, message: LB.lastKnownNone, tag: LB.lastKnownTag };
  const lastTag = a.lastKnown ? LB.lastKnownTag : '';
  if (kept === 'failed') return { ...base, cls: a.lastKnown ? 'last-known' : 'failed', message: LB.failed, tag: lastTag };
  const general = kept === 'general';
  return { ...base, bullets: a.bullets, reasonLine: general ? GENERAL_REASONS[String(a.reason)] || '' : '',
    tag: [general ? LB.generalTag : LB.shownTag, lastTag].filter(Boolean).join(' · ') };
}

// Plain text only (PG-12); content is replaced in place with no animation (PG-6).
function renderAnswer() {
  const c = answerContent();
  answerEl.className = `box column answer ${c.cls}`;
  answerTagEl.textContent = c.tag;
  answerMessageEl.textContent = c.message;
  answerMessageEl.hidden = !c.message;
  bulletsEl.replaceChildren(...c.bullets.map(text => Object.assign(document.createElement('li'), { textContent: text })));
  answerReasonEl.textContent = c.reasonLine;
  answerReasonEl.hidden = !c.reasonLine;
}

// A proposed message applies only with a higher sequence and the displayed Focus version (CT-9, PG-10).
function applyProposed(message) {
  const { proposed, proposedSeq } = message;
  if (!proposed || !Number.isSafeInteger(proposedSeq) || proposedSeq <= view.seq || proposed.focusVersion !== remote.focusVersion) return false;
  view.seq = proposedSeq;
  view.answer = { ...emptyAnswer(), ...proposed };
  if (['shown', 'general'].includes(proposed.status) && remote.focusPerf) remote.answerMs = Math.round(performance.now() - remote.focusPerf);
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
  if (newFocus) {
    view.answer = emptyAnswer('preparing', focusVersion);
    Object.assign(remote, { focusAt: new Date(), focusSource: ask.pending?.via || 'pause', focusPerf: performance.now(), answerMs: null, historical: false });
  }
  return true;
}

const RESULT_FEEDBACK = {
  reset: 'Candidate cleared; say the question again.',
  confirmed: 'Confirmed. Take a moment before you answer.',
  stale: 'The candidate changed before it was confirmed. Review the newer wording and confirm again.',
  invalid: 'Confirmation was not accepted. Review the candidate and try again.',
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

function resetLive(via = 'button') {
  if (!connected() || ask.pending || clearLiveBtn.disabled) return;
  ask.resetId = crypto.randomUUID();
  sendControl({ type: 'question.reset', sessionId: remote.sessionId, requestId: ask.resetId, via });
  renderQuestion();
}

// Sends the Live question exactly as rendered. An uncertain request is retried unchanged, never re-read.
function confirmQuestion(via = 'button') {
  const live = remote.live;
  if (confirmBtn.disabled) return;
  if (ask.pending?.uncertain) {
    ask.pending.uncertain = false;
    ask.feedback = 'Checking the confirmation again…';
  } else {
    ask.pending = { message: { type: 'question.confirm', sessionId: remote.sessionId, requestId: crypto.randomUUID(),
      liveId: live.id, liveVersion: live.version, expectedFocusVersion: remote.focusVersion, text: live.text, via }, via };
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

// The cue follows the speaking timer alone. No key or button sets it: Pablo removed the G, L and S keys on 22 November 2026.
let cueShown = null;
const timerCue = () => (mic.turnS > STOP_AFTER_S ? 'stop' : mic.turnS > LAND_AFTER_S ? 'land' : 'good');
function renderCue() {
  const name = timerCue();
  if (name === cueShown) return;
  cueShown = name;
  const s = STATES[name];
  panel.textContent = s.text;
  bandEl.style.setProperty('--cue-bg', s.bg);
  bandEl.style.setProperty('--cue-fg', '#fff');
  bandEl.setAttribute('aria-label', `Cue: ${s.text}`);
}
setInterval(() => { renderCue(); updateAvatar(); }, 250);

const mic = {
  status: 'off',
  level: 0,
  speaking: false,
  turnStart: null,
  lastVoice: -Infinity,
  paused: false,  // silence of PAUSE_NOTICE_MS or more after speech, so "No new question heard." can show
  turnS: 0,       // seconds of the current speaking turn (what drives GOOD / LAND IT / STOP)
  totalMs: 0,     // speaking time accumulated since Start listening
  lastTickAt: null,
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
  if (mic.speaking && mic.lastTickAt !== null) mic.totalMs += Math.min(now - mic.lastTickAt, 250);
  mic.lastTickAt = now;

  if (mic.turnStart !== null && now - mic.lastVoice > SILENCE_END_MS) {
    mic.turnStart = null;
  }

  const durationS = mic.turnStart === null ? 0 : (now - mic.turnStart) / 1000;
  mic.turnS = durationS;
  const paused = mic.totalMs > 0 && !mic.speaking && now - mic.lastVoice >= PAUSE_NOTICE_MS;
  if (paused !== mic.paused) { mic.paused = paused; renderQuestion(); }
  renderCue();
  renderDebug(durationS);
}

async function startListening() {
  const resources = { stream: null, ctx: null, socket: null, timer: null, capture: null, ready: false, sequence: 0 };
  current = resources;
  view.answer = emptyAnswer(); view.seq = 0;
  packageState.notice = ''; // an old upload result must not hide "Stop listening to load a package."
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
    mic.turnS = 0; mic.totalMs = 0; mic.lastTickAt = null; mic.paused = false;
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
    renderServer(); // shows the cause in the error row (SS-6)
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
    const address = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/session`;
    // A held access code travels as a subprotocol header, never in the address, which a hosting platform would record.
    const socket = access.code ? new WebSocket(address, ['alice', `alice-code.${b64url(access.code)}`]) : new WebSocket(address);
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
      if (message.type === 'log' && message.status === 'not saved') remote.logNotSaved = true;
      if (message.type === 'agent') remote.agent = message.status;
      if (message.type === 'audio') { remote.packets = message.packets; remote.seconds = message.seconds; }
      if (message.type === 'transcript') { remote.transcript = message.text; if (Array.isArray(message.items)) remote.items = message.items; }
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
  Object.assign(mic, { status: 'off', paused: false, speaking: false, level: 0, turnStart: null, lastVoice: -Infinity, turnS: 0, totalMs: 0, lastTickAt: null });
  remote.status = 'stopped'; remote.agent = 'stopped';
  markLastKnown();
  endQuestionSession('Stopped');
  renderDebug(0); renderServer();
  void readPackage();
}

listenBtn.addEventListener('click', () => { if (!current) void startListening(); listenBtn.blur(); });
stopBtn.addEventListener('click', () => { if (current) stopListening(); stopBtn.blur(); });
clearLiveBtn.addEventListener('click', () => { resetLive('button'); clearLiveBtn.blur(); });
confirmBtn.addEventListener('click', () => { confirmQuestion('button'); confirmBtn.blur(); });
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

// Hosted mode: every call to the service goes through here. A held code is sent in a header; a 401 means a code is wanted.
const b64url = text => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function api(path, init = {}) {
  const response = await fetch(path, access.code ? { ...init, headers: { ...init.headers, 'X-Alice-Code': access.code } } : init);
  if (response.status === 401) askForCode(access.code ? 'That code was not accepted.' : '');
  return response;
}

// One plain row, built only when the service asks: a password field, so the code is not readable from across the room.
function askForCode(message) {
  access.needed = true; access.code = '';
  try { sessionStorage.removeItem(ACCESS_KEY); } catch { /* nothing was stored */ }
  let form = document.getElementById('access-form');
  if (!form) {
    form = Object.assign(document.createElement('form'), { id: 'access-form', className: 'box' });
    form.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:18px';
    const input = Object.assign(document.createElement('input'), { id: 'access-code', type: 'password', autocomplete: 'off', required: true });
    input.setAttribute('autocapitalize', 'off');
    input.style.cssText = 'font-size:18px;padding:4px 8px';
    const label = Object.assign(document.createElement('label'), { textContent: 'Access code ' });
    label.append(input);
    const button = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Enter' });
    button.style.cssText = 'font-size:16px;padding:4px 12px';
    const note = Object.assign(document.createElement('span'), { id: 'access-note' });
    note.setAttribute('role', 'status'); note.style.fontWeight = '700';
    form.append(label, button, note);
    form.addEventListener('submit', event => { event.preventDefault(); void submitCode(input, note); });
    errorRowEl.before(form);
  }
  form.hidden = false;
  form.querySelector('#access-note').textContent = message;
  renderControls();
}

// The code is checked against the service before it is kept, and kept for this tab only (sessionStorage).
async function submitCode(input, note) {
  const code = input.value.trim();
  if (!code) return;
  note.textContent = 'Checking…';
  let status = 0;
  try { status = (await fetch('/package', { cache: 'no-store', headers: { 'X-Alice-Code': code } })).status; } catch { /* no answer */ }
  if (status !== 200) { note.textContent = status === 401 ? 'That code was not accepted.' : 'The Alice service did not answer.'; return; }
  access.code = code; access.needed = false;
  try { sessionStorage.setItem(ACCESS_KEY, code); } catch { /* kept in memory for this page only */ }
  input.value = ''; note.textContent = '';
  document.getElementById('access-form').hidden = true;
  renderControls();
  void readPackage();
}

// The package: GET /package gives counts only (SU-8); Upload and Remove are disabled while listening (SU-6, SU-10).
const PACKAGE_REFUSALS = {
  'too-many-files': 'more than 20 files',
  'body-too-large': 'the files are too large (over 200 KB)',
  empty: 'no .md or .txt text was found',
  unreadable: 'a file could not be read as text',
  refused: 'a file name was not accepted',
  'content-type': 'the request was not accepted',
  listening: 'Stop listening to load a package',
};
const fmt = n => Number(n).toLocaleString('en-US');

function packageLine() {
  const info = packageState.info;
  if (packageState.busy) return 'Loading package…';
  if (!info) return '';
  if (info.source === 'none' || info.status === 'none') return 'No package';
  if (info.status === 'too-large') return 'Package over 20,000 characters, not used.';
  if (info.status === 'empty') return 'Package is empty, not used.';
  if (info.status === 'unreadable') return 'Package could not be read, not used.';
  const files = `${info.files} ${info.files === 1 ? 'file' : 'files'}`;
  return `Package: ${files} · ${fmt(info.chars)} chars · ${info.source}`;
}

function renderPackage() {
  const listening = Boolean(current);
  packageTextEl.textContent = packageLine();
  const loaded = Boolean(packageState.info) && packageState.info.source !== 'none';
  removeBtn.hidden = !loaded;
  removeBtn.disabled = listening || packageState.busy;
  uploadBtn.disabled = listening || packageState.busy || !view.healthKnown || Boolean(view.unavailable) || access.needed;
  packageNoticeEl.textContent = listening && !packageState.notice ? 'Stop listening to load a package.' : packageState.notice;
}

async function readPackage() {
  try {
    const response = await api('/package', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (response.ok) packageState.info = await response.json();
  } catch { /* the line keeps what it had */ }
  renderPackage();
}

async function readTextFiles(files) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const out = [];
  for (const file of files) {
    try { out.push({ name: file.name, text: decoder.decode(await file.arrayBuffer()) }); }
    catch { return { failed: file.name }; }
  }
  return { files: out };
}

function refusalText(body, status) {
  const reason = body?.reason;
  if (reason === 'too-large') return `over 20,000 characters (${fmt(body.chars)})`;
  if (reason === 'refused' && body.name) return `the file name ${body.name} was not accepted`;
  return PACKAGE_REFUSALS[reason] || `the service answered ${status}`;
}

async function uploadPackage(fileList) {
  const files = [...fileList];
  if (!files.length || current) return;
  packageState.busy = true; packageState.notice = ''; renderPackage();
  const read = await readTextFiles(files);
  if (read.failed) {
    packageState.notice = `Not loaded: ${read.failed} could not be read as text. Your previous package is still in use.`;
  } else {
    try {
      const response = await api('/package', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: read.files }) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.result === 'loaded') {
        packageState.info = body.package;
        const p = body.package;
        const skipped = (body.skipped || []).map(s => `${s.name} (${s.reason})`).join(', ');
        packageState.notice = `Package loaded: ${p.files} ${p.files === 1 ? 'file' : 'files'}, ${fmt(p.chars)} of 20,000 characters, ${p.terms} terms.${skipped ? ` Skipped: ${skipped}.` : ''}`;
      } else {
        if (body?.package) packageState.info = body.package;
        packageState.notice = `Not loaded: ${refusalText(body, response.status)}. Your previous package is still in use.`;
      }
    } catch { packageState.notice = 'Not loaded: the Alice service did not answer. Your previous package is still in use.'; }
  }
  packageState.busy = false;
  renderPackage();
}

async function removePackage() {
  if (current || packageState.busy) return;
  packageState.busy = true; packageState.notice = ''; renderPackage();
  try {
    const response = await api('/package', { method: 'DELETE' });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.result === 'removed') { packageState.info = body.package; packageState.notice = 'Package removed.'; }
    else packageState.notice = `Not removed: ${refusalText(body, response.status)}.`;
  } catch { packageState.notice = 'Not removed: the Alice service did not answer.'; }
  packageState.busy = false;
  renderPackage();
}

uploadBtn.addEventListener('click', () => { if (!uploadBtn.disabled) { fileInput.value = ''; fileInput.click(); } uploadBtn.blur(); });
fileInput.addEventListener('change', () => { void uploadPackage(fileInput.files); });
removeBtn.addEventListener('click', () => { void removePackage(); });
void readPackage();

// Download log: always enabled; fetches /log from this origin and saves the file (SD-1, SD-2).
const LOG_NOTICE_MS = 6000;
let logNoticeTimer = null;
function showLogNotice(text) {
  packageState.logNotice = text; renderMonitor();
  clearTimeout(logNoticeTimer);
  logNoticeTimer = setTimeout(() => { packageState.logNotice = ''; renderMonitor(); }, LOG_NOTICE_MS);
}
async function downloadLog() {
  try {
    const response = await api('/log', { cache: 'no-store' });
    if (response.status === 404) { showLogNotice('No meeting log yet.'); return; }
    if (!response.ok) { showLogNotice('The meeting log could not be downloaded.'); return; }
    const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'alice-meeting.jsonl';
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch { showLogNotice('The meeting log could not be downloaded.'); }
}
downloadBtn.addEventListener('click', () => { void downloadLog(); downloadBtn.blur(); });

// SC-3, SC-10: Space and Esc act only while a candidate is present and A switches the avatar; never in a button, link or field, or with a modifier.
// Every other key, G, L and S included, does nothing.
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat && event.key === ' ') return;
  const target = event.target;
  if (target instanceof Element && target.closest('button, a, input, textarea, select, [contenteditable]')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'a' || key === 'A') { if (avatar.api && !avatar.failed) toggleAvatar(); return; }
  if ((key === ' ' || key === 'Spacebar') && candidatePresent() && !confirmBtn.disabled) { event.preventDefault(); confirmQuestion('space'); }
  else if (key === 'Escape' && candidatePresent() && !clearLiveBtn.disabled) { event.preventDefault(); resetLive('escape'); }
});

// The avatar (AV-1 to AV-8): loaded after the page is ready from poc/avatar.js, which gets only a frozen copy of the page state.
// Any failure within 5 s, or reduced motion, removes the box and its toggle silently and the name shows at 20 px bold again.
const avatarBox = document.getElementById('avatar');
const avatarToggle = document.getElementById('avatar-toggle');
const barLeftEl = document.getElementById('bar-left');
const AVATAR_KEY = 'alice.avatar';
const AVATAR_LOAD_MS = 5000;
try { avatar.on = localStorage.getItem(AVATAR_KEY) !== 'off'; } catch { avatar.on = true; }

function dropAvatar() {
  avatar.failed = true;
  try { avatar.api?.dispose(); } catch { /* nothing left to free */ }
  avatar.api = null;
  avatarBox.remove(); avatarToggle.remove();
  barLeftEl.classList.remove('has-avatar');
}

function renderAvatar() {
  if (avatar.failed || !avatar.api) return;
  const shown = avatar.on;
  avatarBox.hidden = !shown;
  barLeftEl.classList.toggle('has-avatar', shown);
  avatarToggle.hidden = false;
  avatarToggle.setAttribute('aria-pressed', String(shown));
  try { avatar.api.setActive(shown); } catch { dropAvatar(); }
}

function toggleAvatar() {
  avatar.on = !avatar.on;
  try { localStorage.setItem(AVATAR_KEY, avatar.on ? 'on' : 'off'); } catch { /* the choice just is not remembered */ }
  renderAvatar();
  updateAvatar();
}

avatarToggle.addEventListener('click', () => { toggleAvatar(); avatarToggle.blur(); });

const freezeDeep = value => { Object.values(value).forEach(v => { if (v && typeof v === 'object') freezeDeep(v); }); return Object.freeze(value); };
function updateAvatar() {
  if (!avatar.api || avatar.failed || !avatar.on) return;
  try {
    avatar.api.update(freezeDeep({ listening: Boolean(current), candidate: candidatePresent(), focusVersion: remote.focusVersion,
      answerStatus: view.answer.status, errorCause: Boolean(errorCause()) }));
  } catch { dropAvatar(); }
}

async function loadAvatar() {
  const timer = setTimeout(dropAvatar, AVATAR_LOAD_MS);
  avatarBox.hidden = false; avatarBox.classList.add('loading'); // sized but invisible while it loads
  try {
    const { createAvatar } = await import('/poc/avatar.js');
    const api = await createAvatar({ box: avatarBox, now: () => performance.now() });
    if (avatar.failed) { api.dispose(); return; }
    avatar.api = api;
    avatarBox.classList.remove('loading');
    renderAvatar(); updateAvatar();
  } catch { dropAvatar(); } finally { clearTimeout(timer); }
}

if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) dropAvatar();
else if (document.readyState === 'complete') setTimeout(loadAvatar, 0);
else window.addEventListener('load', () => setTimeout(loadAvatar, 0));
