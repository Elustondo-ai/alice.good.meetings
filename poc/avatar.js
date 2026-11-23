// The small avatar of Alice (SPRINT-004, AV-1 to AV-8). It reads a frozen snapshot of the page state and draws a face in its own box;
// it has no write path to the cue, timer, audio, service or log, makes no sound and no speech, and the page runs it inside try/catch.

export const MOODS = { idle: 'neutral', listening: 'neutral', question: 'love', researching: 'neutral', ready: 'happy', error: 'sad' };
export const TIMES = { question: 1500, ready: 2500, error: 3000, gap: 3000 };
export const FPS = 15;
const SHOWN = new Set(['shown', 'general']);

// The six states from a snapshot {listening, candidate, focusVersion, answerStatus, errorCause} (AV-2, AV-3).
// `now` is the page clock (performance.now), so the page check can advance it.
export function createStateMachine(now = () => performance.now()) {
  let prev = { candidate: false, focusVersion: 0, answerStatus: 'empty' };
  let timed = null; // { state, until }
  let lastStart = -Infinity;
  const start = (state, t) => {
    if (t - lastStart < TIMES.gap) return; // a timed state cannot start again within 3 s
    lastStart = t; timed = { state, until: t + TIMES[state] };
  };
  return {
    update(snapshot) {
      const t = now();
      const s = snapshot;
      const answerEdge = s.answerStatus !== prev.answerStatus;
      if (answerEdge && s.answerStatus === 'failed') start('error', t);
      else if (answerEdge && SHOWN.has(s.answerStatus)) start('ready', t);
      else if ((s.candidate && !prev.candidate) || s.focusVersion > prev.focusVersion) start('question', t);
      prev = { candidate: s.candidate, focusVersion: s.focusVersion, answerStatus: s.answerStatus };
      if (timed && t >= timed.until) timed = null;
      // Priority, highest first: error, researching, question or ready, listening, idle.
      if (s.errorCause || timed?.state === 'error') return 'error';
      if (s.answerStatus === 'preparing') return 'researching';
      if (timed) return timed.state;
      return s.listening ? 'listening' : 'idle';
    },
  };
}

// Loads TalkingHead and the model from the page's own origin and returns {update, setActive, dispose}; it throws on any failure.
export async function createAvatar({ box, base = '/poc/vendor/', now = () => performance.now() }) {
  const { TalkingHead } = await import(`${base}talkinghead/talkinghead.mjs`);
  const head = new TalkingHead(box, {
    lipsyncModules: ['en'], cameraView: 'head', cameraRotateEnable: false, cameraPanEnable: false, cameraZoomEnable: false,
    modelFPS: FPS, modelPixelRatio: 1, avatarMood: 'neutral', avatarIdleEyeContact: 0.2, avatarIdleHeadMove: 0,
  });
  let frames = 0;
  const render = head.renderer.render.bind(head.renderer);
  head.renderer.render = (...args) => { frames += 1; box.dataset.avatarFrames = String(frames); return render(...args); };
  await head.showAvatar({ url: `${base}models/mpfb.glb`, body: 'F', lipsyncLang: 'en', avatarMood: 'neutral' });
  const machine = createStateMachine(now);
  let state = null, active = false, mood = null;
  const apply = snapshot => {
    const next = machine.update(snapshot);
    if (next === state) return;
    state = next;
    box.dataset.avatarState = next;
    if (MOODS[next] !== mood) { mood = MOODS[next]; head.setMood(mood); }
  };
  const run = () => { if (active && !document.hidden) head.start(); else head.stop(); };
  document.addEventListener('visibilitychange', run);
  return {
    update(snapshot) { if (active) apply(snapshot); },
    setActive(on) { active = on; run(); },
    dispose() { active = false; document.removeEventListener('visibilitychange', run); try { head.stop(); head.dispose(); } catch { /* nothing left to free */ } },
  };
}
