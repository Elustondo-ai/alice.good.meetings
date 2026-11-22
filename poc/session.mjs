import { randomUUID } from 'node:crypto';
import { proposalSchema, publicError } from './agent.mjs';
import { AnswerArea } from './answer-area.mjs';
import { validateResult } from './answer.mjs';

// Each connection owns its controller and at most one in-flight reasoning request.
export class InterviewSession {
  constructor({ reason, emit, audit = () => {}, delayMs = 2500, generate, now = Date.now, answerTimeoutMs, print, canAsk = () => true, autoFocus = true, record = () => {} }) {
    // Text events for the meeting log (poc/meeting-log.mjs); it never blocks and never reaches the audit.
    this.record = record;
    this.clock = now;
    this.startedAt = now();
    this.seen = new Map();
    this.spans = [];
    this.spanOf = new Map();
    this.bufferStart = 0;
    // true: a clear question read after a pause becomes Focus with no Confirm. false: the manual Live then Confirm path only.
    this.autoFocus = autoFocus;
    this.id = randomUUID();
    // The guidance request goes out only while Pablo is pausing; the server passes the pause test, tests default to always.
    this.canAsk = canAsk;
    this.reason = reason;
    this.emit = emit;
    this.audit = audit;
    this.delayMs = delayMs;
    // Focus is the question Pablo confirmed; Live is the agent's current reading of the question.
    this.state = {
      revision: 0, phase: 'STARTED', reply: '',
      focus: null, focusVersion: 0, exchangeId: null, live: null,
    };
    this.exchanges = 0;
    // The package terms and documents for this session only: given to the question reader, never kept in state.
    this.context = { terms: [], documents: [] };
    // Observations present at the last Confirm or Clear live; they can never refill Live.
    this.liveCutoff = new Set();
    this.liveIds = new Set();
    this.retiredLiveIds = new Set();
    this.requests = new Map();
    this.observations = new Map();
    this.order = [];
    this.packets = 0;
    this.samples = 0;
    this.active = true;
    this.running = false;
    this.pending = false;
    this.lastRun = 0;
    this.abort = new AbortController();
    // The proposed answer is kept apart from `state`: never in snapshots, cached results or revisions.
    this.answers = new AnswerArea({ sessionId: this.id, generate, now, timeoutMs: answerTimeoutMs, audit, print,
      focusVersion: () => this.state.focusVersion,
      record, publish: (proposed, proposedSeq) => this.send('proposed', { proposed, proposedSeq }) });
  }

  setContext(context) { this.context = context; }

  answerFields() { return { proposed: this.answers.view(), proposedSeq: this.answers.seq }; }

  // Service hooks: the first voiced packet (tS) and the page's render report (t3).
  voiced() { this.answers.voiced(); }

  rendered(message) { this.answers.rendered(message); }

  send(type, data = {}) {
    if (this.active) this.emit({ type, sessionId: this.id, serverAt: Date.now(), ...data });
  }

  audio(buffer) {
    if (!this.active || buffer.length !== 4808) throw new Error('Invalid audio packet');
    if (buffer.readUInt32LE(0) !== this.packets || buffer.readUInt32LE(4) !== this.samples) {
      throw new Error('Audio sequence gap; stop and restart listening');
    }
    this.packets += 1;
    this.samples += 2400;
    if (this.packets % 10 === 0) this.send('audio', { packets: this.packets, seconds: this.samples / 24000 });
    return buffer.subarray(8);
  }

  // The server calls these when it sends a commit or clears the buffer, so each item knows its audio span (ML-4).
  commitSent() {
    this.spans.push({ audioStartMs: Math.round(this.bufferStart / 24), audioEndMs: Math.round(this.samples / 24) });
    this.bufferStart = this.samples;
  }

  bufferCleared() { this.bufferStart = this.samples; }

  committed(id, previousId) {
    if (this.order.includes(id)) return;
    this.spanOf.set(id, this.spans.shift() ?? { audioStartMs: Math.round(this.bufferStart / 24), audioEndMs: Math.round(this.samples / 24) });
    const previous = this.order.indexOf(previousId);
    if (previous >= 0) this.order.splice(previous + 1, 0, id);
    else this.order.push(id);
    while (this.order.length > 32) { const old = this.order.shift(); this.observations.delete(old); this.seen.delete(old); this.spanOf.delete(old); }
  }

  observe(id, text, final) {
    if (!this.active || typeof id !== 'string' || typeof text !== 'string') return;
    const previous = this.observations.get(id);
    if (previous?.final) return;
    if (!this.order.includes(id)) this.committed(id);
    if (!this.seen.has(id)) this.seen.set(id, this.clock() - this.startedAt);
    const value = { id, text: (final ? text : (previous?.text || '') + text).slice(-4000), final };
    this.observations.set(id, value);
    // Timing evidence only: the audit never receives transcript text.
    if (final) {
      this.audit('transcript_final', { sessionId: this.id, itemId: id, revision: this.state.revision });
      this.record('transcript', { itemId: id, text: value.text, ...this.spanOf.get(id) });
    }
    this.send('transcript', { text: this.snapshot().observations.map(o => o.text).join(' ').slice(-1500), final, items: this.items() });
    if (value.text.trim().length >= 8) this.schedule();
  }

  // SA-17: the last 30 seconds, at most 8 items and 1,500 characters; each message replaces the last. `at` is ms from the session start.
  items() {
    const nowMs = this.clock() - this.startedAt;
    const items = [];
    let chars = 0;
    for (const id of [...this.order].reverse()) {
      const o = this.observations.get(id), at = this.seen.get(id);
      // An item with no words (a noise-only commit comes back empty) is skipped; it must not cut the list.
      if (!o || at === undefined || nowMs - at > 30000 || !o.text.trim()) continue;
      if (items.length >= 8 || chars >= 1500) break;
      const text = o.text.slice(-(1500 - chars));
      items.unshift({ id, text, final: o.final, at });
      chars += text.length;
    }
    return items;
  }

  snapshot() {
    return {
      sessionId: this.id,
      baseRevision: this.state.revision,
      event: this.observations.size ? 'audio' : 'connected',
      audioCutoffSamples: this.samples,
      state: { ...this.state },
      observations: this.order.slice(-6).map(id => this.observations.get(id)).filter(Boolean),
    };
  }

  // Returns the checked proposal, or a text-free reason for the audit log.
  validate(proposal, snapshot) {
    if (!this.active) return { reason: 'stopped' };
    if (snapshot.sessionId !== this.id) return { reason: 'wrong-session' };
    if (snapshot.baseRevision !== this.state.revision) return { reason: 'stale-revision' };
    const parsed = proposalSchema.safeParse(proposal);
    if (!parsed.success) return { reason: 'schema', fields: [...new Set(parsed.error.issues.map(i => String(i.path[0] ?? '')))].slice(0, 8) };
    const p = parsed.data;
    this.proposalIntent = p.intent;
    const ids = new Set(snapshot.observations.map(o => o.id));
    if (!p.reply.trim() || p.reply.length > 500 || (p.question?.length || 0) > 600) return { reason: 'length' };
    if (p.evidenceIds.some(id => !ids.has(id))) return { reason: 'unknown-evidence' };
    if (ids.size && !p.evidenceIds.length) return { reason: 'missing-evidence' };
    // A late correction to evidence must not establish a question from obsolete text.
    if (snapshot.observations.some(o => this.observations.get(o.id)?.final && this.observations.get(o.id).text !== o.text)) return { reason: 'corrected-evidence' };
    if (p.phase === 'GREETINGS' && ['QUESTION', 'ANSWER', 'CLOSING'].includes(this.state.phase)) return { reason: 'greetings-after-question' };
    return { p };
  }

  // Model output can change the reply, the phase and Live. No path here writes Focus.
  accept(proposal, snapshot) {
    const { p, ...rejection } = this.validate(proposal, snapshot);
    this.lastRejection = p ? null : rejection;
    if (!p) return false;
    const next = { ...this.state, revision: this.state.revision + 1, reply: p.reply.trim() };
    this.adopted = false;
    if (!snapshot.observations.length) next.phase = 'STARTED';
    else {
      // ANSWER needs a Focus question. Without one the phase is held, but the Live update and reply still apply.
      next.phase = p.phase === 'ANSWER' && !this.state.focus ? this.state.phase : p.phase;
      this.adopted = this.adopt(next, p);
      if (!this.adopted) this.updateLive(next, p);
    }
    const before = this.state;
    this.state = next;
    this.recordChanges(before, next, 'pause');
    if (this.adopted) this.startAnswer(p);
    this.send('answer', { ...this.state, audioCutoffSamples: snapshot.audioCutoffSamples, ...this.answerFields() });
    return true;
  }

  // Live and Focus wording changes, with where a Focus change came from (ML-5, ML-6).
  recordChanges(before, next, source) {
    if (next.live && (next.live.id !== before.live?.id || next.live.version !== before.live?.version)) {
      this.record('live_question', { liveId: next.live.id, version: next.live.version, kind: next.live.kind, text: next.live.text });
    }
    if (next.focusVersion > before.focusVersion) {
      this.record('focus_changed', { focusVersion: next.focusVersion, text: next.focus, exchangeId: next.exchangeId, source });
    }
  }

  // The automatic flow: a clear question read after a pause becomes the Focus question at once, with no Confirm.
  // A question that repeats the Focus wording, or cites only speech already used, changes nothing.
  adopt(next, p) {
    const text = p.question?.trim();
    if (!this.autoFocus || !text || !['clarify', 'new-question'].includes(p.intent)) return false;
    if (!p.evidenceIds.some(id => !this.liveCutoff.has(id)) || text === this.state.focus) return false;
    const keep = p.intent === 'clarify' && this.state.focus;
    // Live keeps showing what was heard, so Pablo sees the reading; its id is retired because Focus already holds it.
    const live = { id: randomUUID(), version: (this.state.live?.version ?? 0) + 1, text, kind: p.intent === 'new-question' ? 'new' : 'restatement' };
    Object.assign(next, { phase: 'QUESTION', focus: text, focusVersion: this.state.focusVersion + 1,
      exchangeId: keep ? this.state.exchangeId : ++this.exchanges, live });
    if (this.state.live) this.retiredLiveIds.add(this.state.live.id);
    this.liveIds.add(live.id); this.retiredLiveIds.add(live.id);
    this.liveCutoff = new Set(this.order);
    return true;
  }

  // One call produced the reading and the answer. A valid answer is shown as it is; anything else uses the answer request.
  startAnswer(p) {
    const check = validateResult({ bullets: p.bullets, ...('details' in p ? { details: p.details } : {}) }, { hasDocuments: this.answers.package.documents.length > 0 });
    const { focus, focusVersion } = this.state;
    if (check.ok) this.answers.present(focus, focusVersion, check.value, p.covered !== false);
    else this.answers.begin(focus, focusVersion);
  }

  // Only clarify and new-question with text, citing speech after the Live cutoff, change Live.
  updateLive(next, p) {
    const text = p.question?.trim();
    const live = this.state.live;
    if (!text || !['clarify', 'new-question'].includes(p.intent)) return;
    if (!p.evidenceIds.some(id => !this.liveCutoff.has(id))) return;
    if (live) {
      if (text === live.text) return;
      next.live = { ...live, version: live.version + 1, text, kind: p.intent === 'new-question' ? 'new' : live.kind };
      return;
    }
    if (text === this.state.focus) return;
    const id = randomUUID();
    this.liveIds.add(id);
    next.live = { id, version: 1, text, kind: p.intent === 'new-question' ? 'new' : 'restatement' };
  }

  // Clears Live and moves its cutoff so only later speech can refill it. Never touches Focus.
  resetLive() {
    if (!this.active) return { status: 'unavailable' };
    if (this.state.live) { this.retiredLiveIds.add(this.state.live.id); this.record('live_cleared', { by: 'clear' }); }
    this.state = { ...this.state, revision: this.state.revision + 1, live: null };
    this.liveCutoff = new Set(this.order);
    return { status: 'reset', changed: true };
  }

  // The only writer of Focus: commits exactly the Live wording the browser displayed, or says why not.
  confirm({ liveId, liveVersion, expectedFocusVersion, text, via }) {
    const { live, focus, focusVersion } = this.state;
    if (!this.active) return { status: 'unavailable' };
    if (!this.liveIds.has(liveId)) return { status: 'invalid' };
    if (this.retiredLiveIds.has(liveId) || live?.id !== liveId) return { status: 'stale' };
    if (live.version !== liveVersion || focusVersion !== expectedFocusVersion) return { status: 'stale' };
    if (live.text !== text) return { status: 'invalid' };
    if (live.text === focus) return { status: 'unavailable' };
    // A confirmed restatement keeps the exchange; anything else starts one. Phase QUESTION leaves time to reflect.
    const exchangeId = live.kind === 'restatement' && focus ? this.state.exchangeId : ++this.exchanges;
    this.retiredLiveIds.add(live.id);
    this.state = {
      ...this.state, revision: this.state.revision + 1, phase: 'QUESTION',
      focus: live.text, focusVersion: focusVersion + 1, exchangeId, live: null,
    };
    this.liveCutoff = new Set(this.order);
    this.record('live_cleared', { by: 'confirm' });
    this.record('focus_changed', { focusVersion: this.state.focusVersion, text: this.state.focus, exchangeId, source: via === 'space' ? 'confirm-space' : 'confirm-button' });
    this.answers.begin(this.state.focus, this.state.focusVersion);
    return { status: 'confirmed', changed: true, liveId, liveVersion, focusVersion: this.state.focusVersion };
  }

  // Browser question controls. Well-formed requests are cached by requestId, so an identical retry
  // returns the original result and a changed payload is invalid. The result precedes any broadcast.
  control(message) {
    const request = parseControl(message, this.id);
    const requestId = request?.requestId ?? (typeof message?.requestId === 'string' ? message.requestId.slice(0, 100) : null);
    const reply = (result, replayed = false) => {
      this.send('question.result', result);
      // Versions and statuses only; the audit never receives Focus or Live text.
      this.audit('question_control', { sessionId: this.id, requestId, type: request?.type ?? null, status: result.status,
        replayed, liveVersion: request?.liveVersion ?? null, focusVersion: this.state.focusVersion, revision: this.state.revision });
    };
    if (!request) return reply({ requestId, status: 'invalid', state: { ...this.state } });
    const cached = this.requests.get(request.requestId);
    if (cached) {
      if (cached.fingerprint === request.fingerprint) return reply(cached.result, true);
      return reply({ requestId, status: 'invalid', state: { ...this.state } });
    }
    if (this.requests.size >= 256) return reply({ requestId, status: 'limit', state: { ...this.state } });
    const { changed, ...outcome } = request.type === 'question.reset' ? this.resetLive() : this.confirm(request);
    const result = { requestId, ...outcome, state: { ...this.state } };
    this.record('control', { control: request.type === 'question.confirm' ? 'confirm' : 'clear', via: request.via, result: outcome.status === 'limit' ? 'invalid' : outcome.status });
    this.requests.set(request.requestId, { fingerprint: request.fingerprint, result });
    reply(result);
    if (changed) this.send('answer', { ...this.state, audioCutoffSamples: this.samples, ...this.answerFields() });
  }

  schedule() {
    if (!this.active) return;
    this.pending = true;
    if (this.running || this.timer) return;
    const wait = Math.max(0, this.lastRun + this.delayMs - Date.now());
    this.timer = setTimeout(() => { this.timer = null; void this.run(); }, wait);
  }

  async run() {
    if (!this.active || this.running || !this.pending) return;
    // Not pausing: keep the request pending; the next transcript after a pause schedules it again.
    if (!this.canAsk()) return;
    this.pending = false;
    this.running = true;
    this.lastRun = Date.now();
    const snapshot = this.snapshot();
    this.send('agent', { status: 'thinking' });
    this.audit('agent_started', { sessionId: this.id, packets: this.packets });
    try {
      const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(30000)]);
      const proposal = await this.reason(snapshot, signal, this.context);
      if (this.active) {
        const accepted = this.accept(proposal, snapshot);
        this.send('agent', { status: !accepted ? 'proposal rejected; keeping previous answer'
          : this.adopted || this.proposalIntent === 'answer' ? 'ready' : 'no question heard; keeping the last answer' });
        this.audit('agent_finished', { sessionId: this.id, accepted, ...(accepted ? {} : { rejection: this.lastRejection }), durationMs: Date.now() - this.lastRun, packets: this.packets });
      }
    } catch (error) {
      this.send('agent', { status: publicError(error) });
      this.audit('agent_failed', { sessionId: this.id, status: error?.status || null, code: publicError(error) });
    } finally {
      this.running = false;
      if (this.active && this.pending) this.schedule();
    }
  }

  stop() {
    this.answers.stop();
    this.active = false;
    clearTimeout(this.timer);
    this.abort.abort();
    this.pending = false;
    this.observations.clear();
    this.order = [];
    this.liveCutoff.clear();
    this.liveIds.clear();
    this.retiredLiveIds.clear();
    this.requests.clear();
  }
}

const boundedId = value => typeof value === 'string' && value.length > 0 && value.length <= 100;
const version = value => Number.isSafeInteger(value) && value >= 0;

// Returns null for any malformed or wrong-session control; otherwise the fields that identify it.
function parseControl(message, sessionId) {
  if (!message || message.sessionId !== sessionId || !boundedId(message.requestId)) return null;
  const via = ['button', 'space', 'escape'].includes(message.via) ? message.via : 'button';
  if (message.type === 'question.reset') {
    return { type: message.type, requestId: message.requestId, via, fingerprint: message.type };
  }
  const { liveId, liveVersion, expectedFocusVersion, text } = message;
  if (message.type !== 'question.confirm' || !boundedId(liveId) || !version(liveVersion) ||
    !version(expectedFocusVersion) || typeof text !== 'string' || !text || text.length > 600) return null;
  const fields = { liveId, liveVersion, expectedFocusVersion, text };
  return { type: message.type, requestId: message.requestId, via, ...fields, fingerprint: JSON.stringify([message.type, fields]) };
}
