import { buildRequest, modelInput, validateResult, failureCode, DEFAULT_ANSWER_TIMEOUT_MS } from './answer.mjs';
import { reasonOf } from './package-loader.mjs';
import { callEvent, failureReason } from './agent.mjs';

const EMPTY = { status: 'empty', focusVersion: 0, bullets: [], reason: null, lastKnown: false, lastStatus: null };
const NO_PACKAGE = { status: 'none', documents: [], files: [], chars: 0, skipped: [] };

// Rejects when the signal aborts, so a generator that ignores its signal cannot hold an attempt open.
const race = (promise, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return; }
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  promise.then(resolve, reject);
});

// The proposed-answer area of one session: kept apart from `state`, one request in flight, one retry.
export class AnswerArea {
  constructor({ sessionId, generate, publish, audit = () => {}, now = Date.now, timeoutMs = DEFAULT_ANSWER_TIMEOUT_MS,
    print, focusVersion = () => 0, record = () => {}, elapsed = () => 0, callId = (n => () => ++n)(0), stage = () => {} }) {
    // RT5-4, RT5-5: `elapsed` is the log's clock, `callId` numbers the session's model calls, and `stage` tells the
    // session what happened to the answer of a Focus version. All three only feed the meeting log.
    Object.assign(this, { sessionId, generate, publish, audit, record, now, timeoutMs, print, currentVersion: focusVersion, elapsed, callId, stage });
    this.proposed = { ...EMPTY };
    this.seq = 0;
    this.run = null;
    this.stopped = false;
    this.package = NO_PACKAGE;
  }

  view() { return { ...this.proposed, bullets: [...this.proposed.bullets] }; }

  setPackage(pkg) { this.package = pkg; }

  set(patch) { this.proposed = { ...this.proposed, ...patch }; this.seq += 1; }

  // Every Confirm replaces the earlier answer and request in the same update (CT-3, CT-4).
  begin(question, version) {
    if (!this.generate || this.stopped) return;
    const old = this.run;
    this.finishTiming(old, 'superseded');
    old?.abort.abort('superseded');
    const request = buildRequest({ sessionId: this.sessionId, focusVersion: version, question, documents: this.package.documents });
    const run = { version, request, abort: new AbortController(), attempts: 0, timed: false, dropped: false, call: null,
      t: { t0: this.now(), t1: null, t2: null, t3: null, tS: null } };
    this.run = run;
    this.set({ ...EMPTY, status: 'preparing', focusVersion: version });
    queueMicrotask(() => this.launch(run));
  }

  // The one-call flow: the reader already returned a valid answer, so no second request goes out.
  // The caller publishes the view with the Focus update; covered false means the package says nothing on the question.
  present(question, version, value, covered = true) {
    if (this.stopped) return;
    const old = this.run;
    this.finishTiming(old, 'superseded');
    old?.abort.abort('superseded');
    const request = buildRequest({ sessionId: this.sessionId, focusVersion: version, question, documents: this.package.documents });
    const t = this.now();
    const run = { version, request, abort: new AbortController(), attempts: 0, timed: false, dropped: false, call: null,
      t: { t0: t, t1: t, t2: t, t3: null, tS: null } };
    this.run = run;
    const usable = this.package.status === 'usable';
    this.set({ ...EMPTY, status: usable && covered ? 'shown' : 'general', focusVersion: version, ...value,
      reason: !usable ? reasonOf(this.package.status) : covered ? null : 'not-covered' });
    this.audit('answer_accepted', { sessionId: this.sessionId, focusVersion: version, durationMs: 0, attempts: 0, oneCall: true });
    this.recordShown(version, 0);
  }

  // ML-8: the answer shown, with its bullets, for the meeting log.
  recordShown(focusVersion, delayMs) {
    const { status, reason, bullets } = this.proposed;
    this.record('answer_shown', { focusVersion, status, reason, bullets: [...bullets], delayMs });
    this.stage(focusVersion, { bulletsMs: this.elapsed() }, 'bullets');
  }

  live(run) { return !this.stopped && this.run === run && !run.abort.signal.aborted; }

  async launch(run) {
    if (!this.live(run)) { this.drop(run); return; }
    const { documents } = run.request;
    this.audit('answer_requested', { sessionId: this.sessionId, focusVersion: run.version, contextKind: 'interview',
      files: documents.length, chars: documents.reduce((sum, d) => sum + d.text.length, 0) });
    this.print?.(modelInput(run.request));
    let failure;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (!this.live(run)) { this.drop(run); return; }
      run.attempts = attempt;
      if (attempt === 1) run.t.t1 = this.now();
      let value;
      try { value = await this.attempt(run); } catch (error) { failure = error; continue; }
      this.accept(run, value);
      return;
    }
    if (!this.live(run)) this.drop(run); else this.fail(run, failure);
  }

  async attempt(run) {
    const signal = AbortSignal.any([run.abort.signal, AbortSignal.timeout(this.timeoutMs)]);
    // RT5-4: each attempt is one model call. Its line is written once, when the attempt ends.
    const call = run.call = { kind: 'answer', callId: this.callId(), startMs: this.elapsed(), model: this.generate.model, effort: this.generate.effort, usage: null };
    this.stage(run.version, { answerStartMs: call.startMs });
    try {
      const result = await race((async () => this.generate(run.request, { signal, meter: usage => { call.usage = usage; } }))(), signal);
      const check = validateResult(result, { hasDocuments: run.request.documents.length > 0 });
      if (!check.ok) throw Object.assign(new Error('invalid result'), { code: 'invalid-result', detail: check.code });
      return check.value;
    } catch (error) {
      if (this.live(run)) this.endCall(run, 'failed', failureReason(error)); else this.endCall(run, 'dropped', this.dropReason(run));
      throw error;
    }
  }

  // RT5-4: the `model_call` line of the attempt in flight; a second call for the same attempt writes nothing.
  // A fault here is dropped: the log line must never disturb the answer.
  endCall(run, outcome, reason = null) {
    const call = run.call;
    if (!call) return;
    run.call = null;
    try {
      const endMs = this.elapsed();
      this.stage(run.version, { answerEndMs: endMs });
      this.record('model_call', callEvent(call, endMs, outcome, reason));
    } catch { /* measurement only */ }
  }

  dropReason(run) { return this.stopped ? 'stopped' : run.version !== this.currentVersion() ? 'stale-version' : 'superseded'; }

  accept(run, value) {
    if (!this.live(run)) { this.endCall(run, 'dropped', this.dropReason(run)); this.drop(run); return; }
    run.t.t2 = this.now();
    const usable = this.package.status === 'usable';
    this.set({ ...EMPTY, status: usable ? 'shown' : 'general', focusVersion: run.version, ...value,
      reason: usable ? null : reasonOf(this.package.status) });
    this.publish(this.view(), this.seq);
    this.endCall(run, 'question');
    this.audit('answer_accepted', { sessionId: this.sessionId, focusVersion: run.version, durationMs: run.t.t2 - run.t.t1, attempts: run.attempts });
    this.recordShown(run.version, run.t.t2 - run.t.t0);
  }

  fail(run, error) {
    this.set({ ...EMPTY, status: 'failed', focusVersion: run.version });
    this.publish(this.view(), this.seq);
    this.audit('answer_failed', { sessionId: this.sessionId, focusVersion: run.version, attempts: 2, code: failureCode(error) });
    this.record('answer_failed', { focusVersion: run.version, attempts: 2, code: failureCode(error) });
    this.finishTiming(run, 'failed');
    this.stage(run.version, {}, 'failed');
  }

  drop(run) {
    if (run.dropped) return;
    run.dropped = true;
    const reason = this.dropReason(run);
    this.audit('answer_dropped', { sessionId: this.sessionId, focusVersion: run.version, reason });
    this.record('answer_dropped', { focusVersion: run.version, reason });
    this.finishTiming(run, reason);
    this.stage(run.version, {}, reason === 'stopped' ? 'stopped' : 'superseded');
  }

  // tS: the first voiced packet after t0, from any speaker.
  voiced() {
    const run = this.run;
    if (run && !run.timed && run.t.tS === null) run.t.tS = this.now();
  }

  // t3: the page reports it painted this Focus version's shown or general answer.
  rendered({ answerFocusVersion, answerStatus }) {
    const run = this.run;
    if (!run || run.timed || run.t.t2 === null || answerFocusVersion !== run.version) return;
    if (answerStatus !== 'shown' && answerStatus !== 'general') return;
    run.t.t3 = this.now();
    this.finishTiming(run, answerStatus);
  }

  // One text-free timing event per Focus version (TM-6, TM-7).
  finishTiming(run, outcome) {
    if (!run || run.timed) return;
    run.timed = true;
    const { t0, t1, t2, t3, tS } = run.t;
    const gap = (a, b) => (a === null || b === null ? null : a - b);
    this.audit('answer_timing', { sessionId: this.sessionId, focusVersion: run.version, t0, t1, t2, t3, tS,
      attempts: run.attempts, outcome, delayMs: gap(t3, t0), generationMs: gap(t2, t1), pauseMs: gap(tS, t0),
      visibleBeforeSpeech: t3 === null || tS === null ? null : t3 < tS });
  }

  // Stop or disconnect: abort, never show a late result, keep content as last known (CT-13).
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    const run = this.run;
    this.finishTiming(run, 'stopped');
    // Recorded now, not when the aborted request settles: by then the meeting log is closed (ML-8).
    if (run) this.endCall(run, 'dropped', 'stopped');
    if (run && !run.dropped && this.proposed.status === 'preparing') this.drop(run);
    run?.abort.abort('stopped');
    const { status } = this.proposed;
    if (status === 'preparing') this.set({ ...EMPTY, status: 'last-known', focusVersion: this.proposed.focusVersion, lastKnown: true, lastStatus: 'preparing' });
    else if (['shown', 'general', 'failed'].includes(status)) this.set({ status: 'last-known', lastKnown: true, lastStatus: status });
    else return;
    this.publish(this.view(), this.seq);
  }
}
