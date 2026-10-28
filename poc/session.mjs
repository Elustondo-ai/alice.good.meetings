import { randomUUID } from 'node:crypto';
import { proposalSchema, publicError } from './agent.mjs';

// Each connection owns its controller and at most one in-flight reasoning request.
export class InterviewSession {
  constructor({ reason, emit, audit = () => {}, delayMs = 2500 }) {
    this.id = randomUUID();
    this.reason = reason;
    this.emit = emit;
    this.audit = audit;
    this.delayMs = delayMs;
    this.state = { revision: 0, phase: 'STARTED', question: null, reply: '' };
    this.observations = new Map();
    this.order = [];
    this.packets = 0;
    this.samples = 0;
    this.active = true;
    this.running = false;
    this.pending = false;
    this.lastRun = 0;
    this.abort = new AbortController();
  }

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

  committed(id, previousId) {
    if (this.order.includes(id)) return;
    const previous = this.order.indexOf(previousId);
    if (previous >= 0) this.order.splice(previous + 1, 0, id);
    else this.order.push(id);
    while (this.order.length > 32) this.observations.delete(this.order.shift());
  }

  observe(id, text, final) {
    if (!this.active || typeof id !== 'string' || typeof text !== 'string') return;
    const previous = this.observations.get(id);
    if (previous?.final) return;
    if (!this.order.includes(id)) this.committed(id);
    const value = { id, text: (final ? text : (previous?.text || '') + text).slice(-4000), final };
    this.observations.set(id, value);
    this.send('transcript', { text: this.snapshot().observations.map(o => o.text).join(' ').slice(-1500), final });
    if (value.text.trim().length >= 8) this.schedule();
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

  accept(proposal, snapshot) {
    if (!this.active || snapshot.sessionId !== this.id || snapshot.baseRevision !== this.state.revision) return false;
    const parsed = proposalSchema.safeParse(proposal);
    if (!parsed.success) return false;
    const p = parsed.data;
    const ids = new Set(snapshot.observations.map(o => o.id));
    if (!p.reply.trim() || p.reply.length > 500 || (p.question?.length || 0) > 600) return false;
    if (p.evidenceIds.some(id => !ids.has(id)) || (ids.size && !p.evidenceIds.length)) return false;
    // A late correction to evidence must not establish a question from obsolete text.
    if (snapshot.observations.some(o => this.observations.get(o.id)?.final && this.observations.get(o.id).text !== o.text)) return false;
    if (p.phase === 'GREETINGS' && ['QUESTION', 'ANSWER', 'CLOSING'].includes(this.state.phase)) return false;
    if (p.phase === 'ANSWER' && !this.state.question) return false;
    const settledQuestion = p.phase === 'QUESTION' && p.question?.trim() &&
      snapshot.observations.some(o => o.final && p.evidenceIds.includes(o.id));
    this.state = {
      revision: this.state.revision + 1,
      phase: ids.size ? p.phase : 'STARTED',
      question: settledQuestion ? p.question.trim() : this.state.question,
      reply: p.reply.trim(),
    };
    this.send('answer', { ...this.state, audioCutoffSamples: snapshot.audioCutoffSamples });
    return true;
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
    this.pending = false;
    this.running = true;
    this.lastRun = Date.now();
    const snapshot = this.snapshot();
    this.send('agent', { status: 'thinking' });
    this.audit('agent_started', { sessionId: this.id, packets: this.packets });
    try {
      const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(30000)]);
      const proposal = await this.reason(snapshot, signal);
      if (this.active) {
        const accepted = this.accept(proposal, snapshot);
        this.send('agent', { status: accepted ? 'ready' : 'proposal rejected; keeping previous answer' });
        this.audit('agent_finished', { sessionId: this.id, accepted, durationMs: Date.now() - this.lastRun, packets: this.packets });
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
    this.active = false;
    clearTimeout(this.timer);
    this.abort.abort();
    this.pending = false;
    this.observations.clear();
    this.order = [];
  }
}
