import test from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import WebSocket from 'ws';
import { InterviewSession } from './session.mjs';
import { createPocServer } from './server.mjs';

const proposal = (changes = {}) => ({ reply: 'I heard the question.', phase: 'QUESTION', question: 'Tell me about yourself.', intent: 'new-question', evidenceIds: ['one'], ...changes });
const clarify = (question, evidenceIds) => proposal({ intent: 'clarify', question, evidenceIds });
const makeSession = (options = {}) => new InterviewSession({ reason: async () => proposal(), emit: () => {}, delayMs: 0, ...options });
const packet = sequence => {
  const buffer = Buffer.alloc(4808);
  buffer.writeUInt32LE(sequence, 0); buffer.writeUInt32LE(sequence * 2400, 4);
  return buffer;
};
async function until(predicate) {
  const deadline = Date.now() + 1500;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Condition timed out');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

test('audio packets reject gaps, malformed sizes and stale sessions', () => {
  const s = makeSession();
  assert.equal(s.audio(packet(0)).length, 4800);
  assert.throws(() => s.audio(packet(2)), /sequence gap/);
  assert.throws(() => s.audio(Buffer.alloc(4)), /Invalid/);
  assert.equal(s.audio(packet(1)).length, 4800);
  s.stop(); assert.throws(() => s.audio(packet(2)), /Invalid/);
});

test('model output fills Live but never writes Focus; without Focus, ANSWER holds the phase but keeps Live', () => {
  const s = makeSession();
  s.observe('one', 'Tell me about yourself.', true);
  assert.equal(s.accept(proposal(), s.snapshot()), true);
  assert.deepEqual([s.state.focus, s.state.focusVersion], [null, 0]);
  assert.deepEqual([s.state.live.text, s.state.live.version, s.state.live.kind], ['Tell me about yourself.', 1, 'new']);
  s.observe('two', 'I have worked as a developer. Why this company?', true);
  const answer = proposal({ phase: 'ANSWER', question: 'Why this company?', evidenceIds: ['two'], reply: 'New reply.' });
  assert.equal(s.accept(answer, s.snapshot()), true, 'a result in ANSWER is no longer rejected whole');
  assert.deepEqual([s.state.phase, s.state.live.text, s.state.reply, s.state.focus], ['QUESTION', 'Why this company?', 'New reply.', null]);
  s.stop();
});

test('controller rejects stale revisions, unknown evidence and corrected text', () => {
  const s = makeSession();
  s.observe('one', 'Tell me about the moon.', false);
  const partial = s.snapshot();
  s.observe('one', 'Tell me about your work.', true);
  assert.equal(s.accept(proposal(), partial), false);
  const current = s.snapshot();
  assert.equal(s.accept(proposal({ evidenceIds: ['future'] }), current), false);
  assert.equal(s.accept({ reply: 'bad schema' }, current), false);
  assert.equal(s.accept(proposal(), current), true);
  assert.equal(s.accept(proposal(), current), false);
  s.stop();
});

test('Live follows corrections, multipart wording and new questions; other intents leave it alone', async () => {
  const s = makeSession();
  s.observe('one', 'Tell me about your career.', true);
  s.accept(proposal({ question: 'Tell me about your career.' }), s.snapshot());
  const { id } = s.state.live;
  s.observe('two', 'No, my career and why I left my last job.', true);
  s.accept(clarify('Tell me about your career and why you left your last job.', ['two']), s.snapshot());
  assert.deepEqual([s.state.live.id, s.state.live.version, s.state.live.kind], [id, 2, 'new']);
  assert.equal(s.state.live.text, 'Tell me about your career and why you left your last job.');
  s.accept(clarify('Tell me about your career and why you left your last job.', ['two']), s.snapshot());
  assert.equal(s.state.live.version, 2);
  s.observe('three', 'Why this company?', true);
  s.accept(proposal({ question: 'Why this company?', evidenceIds: ['three'] }), s.snapshot());
  assert.deepEqual([s.state.live.text, s.state.live.version], ['Why this company?', 3]);
  for (const intent of ['answer', 'none']) {
    s.accept(proposal({ intent, phase: 'GREETINGS', question: 'Ignored wording.', evidenceIds: ['three'] }), s.snapshot());
    assert.equal(s.state.live.text, 'Why this company?');
  }
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(s.state.focus, null);
  s.stop();
});

test('proposals without a known intent are rejected', () => {
  const s = makeSession();
  s.observe('one', 'Tell me about yourself.', true);
  const { intent, ...missing } = proposal();
  assert.equal(s.accept(missing, s.snapshot()), false);
  assert.equal(s.accept(proposal({ intent: 'confirm' }), s.snapshot()), false);
  assert.equal(s.state.revision, 0);
  s.stop();
});

// A session plus helpers that send controls and return the latest question.result event.
function liveSession() {
  const events = [];
  const s = makeSession({ emit: event => events.push(event) });
  const result = () => events.filter(e => e.type === 'question.result').at(-1);
  const payload = (changes = {}) => ({ type: 'question.confirm', sessionId: s.id, liveId: s.state.live?.id ?? 'none',
    liveVersion: s.state.live?.version ?? 0, expectedFocusVersion: s.state.focusVersion, text: s.state.live?.text ?? 'x', ...changes });
  const send = (requestId, message) => (s.control({ ...message, requestId }), result());
  const confirm = (requestId, changes) => send(requestId, payload(changes));
  const reset = requestId => send(requestId, { type: 'question.reset', sessionId: s.id });
  const hear = (id, text, intent = 'new-question') => {
    s.observe(id, text, true);
    return s.accept(proposal({ intent, question: text, evidenceIds: [id] }), s.snapshot());
  };
  return { s, events, payload, send, confirm, reset, hear };
}

test('Confirm copies exactly the displayed Live into Focus and reports it before the broadcast', () => {
  const { s, events, confirm, hear } = liveSession();
  hear('one', 'Tell me about a project you are proud of.');
  const before = events.length;
  const result = confirm('c1');
  assert.deepEqual([result.status, result.liveVersion, result.focusVersion], ['confirmed', 1, 1]);
  assert.deepEqual(events.slice(before).map(e => e.type), ['question.result', 'answer']);
  assert.deepEqual([s.state.focus, s.state.live, s.state.phase, s.state.exchangeId],
    ['Tell me about a project you are proud of.', null, 'QUESTION', 1]);
  s.stop();
});

test('4 November regression: a new question after Confirm fills Live and leaves Focus unchanged', () => {
  const { s, confirm, hear } = liveSession();
  hear('one', 'How can I lose weight safely?');
  const preConfirmation = s.snapshot();
  confirm('c1');
  assert.equal(s.accept(proposal({ question: 'Stale wording.', evidenceIds: ['one'] }), preConfirmation), false);
  s.accept(proposal({ question: 'Old speech again.', evidenceIds: ['one'] }), s.snapshot());
  assert.equal(s.state.live, null, 'speech before the confirmation cannot refill Live');
  s.observe('answer', 'How can I lose weight safely? I would start with sleep.', true);
  s.accept(proposal({ intent: 'answer', phase: 'ANSWER', question: null, evidenceIds: ['answer'] }), s.snapshot());
  assert.deepEqual([s.state.phase, s.state.focus, s.state.exchangeId, s.state.live],
    ['ANSWER', 'How can I lose weight safely?', 1, null], 'answer evidence, not confirmation, starts ANSWER');
  hear('two', 'How do I lose weight?');
  assert.deepEqual([s.state.focus, s.state.focusVersion], ['How can I lose weight safely?', 1]);
  assert.deepEqual([s.state.live.text, s.state.live.kind], ['How do I lose weight?', 'new']);
  assert.equal(confirm('c2').status, 'confirmed');
  assert.deepEqual([s.state.focus, s.state.exchangeId], ['How do I lose weight?', 2]);
  s.stop();
});

test('a confirmed restatement keeps the exchange; Live equal to Focus is ignored or unavailable', () => {
  const { s, confirm, hear } = liveSession();
  hear('one', 'Why do you want this role?');
  confirm('c1');
  hear('two', 'Why do you want this role?', 'clarify');
  assert.equal(s.state.live, null, 'a restatement equal to Focus is ignored');
  hear('three', 'Why do you want this particular role?', 'clarify');
  assert.equal(s.state.live.kind, 'restatement');
  hear('four', 'Why do you want this role?', 'clarify');
  assert.equal(confirm('same').status, 'unavailable');
  hear('five', 'Why do you want this role here?', 'clarify');
  assert.equal(confirm('c2').status, 'confirmed');
  assert.deepEqual([s.state.focusVersion, s.state.exchangeId], [2, 1]);
  s.stop();
});

test('Clear live clears Live, moves its cutoff, retires its id and never touches Focus', () => {
  const { s, payload, send, confirm, reset, hear } = liveSession();
  hear('one', 'Tell me about yourself.');
  confirm('c1');
  hear('two', 'Misheard words.');
  const old = payload();
  const revision = s.state.revision;
  assert.equal(reset('r1').status, 'reset');
  assert.deepEqual([s.state.live, s.state.focus, s.state.revision], [null, 'Tell me about yourself.', revision + 1]);
  assert.equal(reset('r2').status, 'reset');
  assert.equal(s.state.revision, revision + 2, 'reset with Live empty still moves the cutoff');
  s.accept(proposal({ question: 'Misheard words.', evidenceIds: ['two'] }), s.snapshot());
  assert.equal(s.state.live, null);
  assert.equal(send('old', old).status, 'stale');
  s.stop();
});

test('confirmation rejects unknown, stale, altered, malformed and wrong-session requests', () => {
  const { s, confirm, hear } = liveSession();
  assert.equal(confirm('never', { liveId: 'never-issued' }).status, 'invalid');
  hear('one', 'How do you prioritize work?');
  hear('two', 'How do you prioritize your work?', 'clarify');
  assert.equal(confirm('old-live', { liveVersion: 1 }).status, 'stale');
  assert.equal(confirm('old-focus', { expectedFocusVersion: 3 }).status, 'stale');
  assert.equal(confirm('altered', { text: 'How do you prioritize?' }).status, 'invalid');
  assert.equal(confirm('session', { sessionId: 'other' }).status, 'invalid');
  assert.equal(confirm('malformed', { liveVersion: -1 }).status, 'invalid');
  assert.equal(confirm('too-long', { text: 'x'.repeat(601) }).status, 'invalid');
  assert.deepEqual([s.state.focus, s.state.focusVersion], [null, 0]);
  assert.equal(confirm('malformed').status, 'confirmed');
  s.stop();
});

test('identical retries return the original result; changed retries and the cap never commit', () => {
  const { s, payload, send, hear } = liveSession();
  hear('one', 'Tell me about yourself.');
  const request = payload();
  // serverAt records each send, so a re-sent result differs only there.
  const status = (...args) => { const { serverAt, ...result } = send(...args); return result; };
  const first = status('c1', request);
  assert.deepEqual(status('c1', request), first);
  assert.deepEqual([s.state.focusVersion, s.state.exchangeId], [1, 1]);
  assert.equal(status('c1', { ...request, text: 'Different text.' }).status, 'invalid');
  for (let i = s.requests.size; i < 256; i++) s.control({ type: 'question.reset', sessionId: s.id, requestId: `r${i}` });
  assert.equal(status('new-request', request).status, 'limit');
  assert.deepEqual(status('c1', request), first);
  assert.equal(s.state.focusVersion, 1);
  s.stop();
});

test('audit records final transcripts and question controls without any text', () => {
  const audits = [];
  const s = makeSession({ audit: (event, data) => audits.push({ event, ...data }) });
  s.observe('one', 'Secret partial', false);
  s.observe('one', 'Secret final wording.', true);
  s.accept(proposal({ question: 'Secret final wording.' }), s.snapshot());
  const confirm = { type: 'question.confirm', sessionId: s.id, requestId: 'confirm', liveId: s.state.live.id,
    liveVersion: 1, expectedFocusVersion: 0, text: 'Secret final wording.' };
  s.control(confirm); s.control(confirm);
  s.control({ type: 'question.reset', sessionId: s.id, requestId: 'reset' });
  s.control({ type: 'question.confirm', sessionId: s.id, requestId: 'bad' });
  assert.deepEqual(audits.filter(a => a.event === 'transcript_final').map(a => a.itemId), ['one']);
  const controls = audits.filter(a => a.event === 'question_control');
  assert.deepEqual(controls.map(a => [a.requestId, a.type, a.status, a.replayed]), [
    ['confirm', 'question.confirm', 'confirmed', false], ['confirm', 'question.confirm', 'confirmed', true],
    ['reset', 'question.reset', 'reset', false], ['bad', null, 'invalid', false]]);
  assert.deepEqual([controls[0].liveVersion, controls[0].focusVersion], [1, 1]);
  assert.equal(JSON.stringify(audits).includes('Secret'), false);
  s.stop();
});

test('a rejected agent result is audited with a text-free reason', async () => {
  const audits = [];
  const replies = [proposal({ reply: 'Secret reply', question: 'Secret question?', evidenceIds: ['future'] }), { reply: 'Secret' }];
  const s = makeSession({ audit: (event, data) => audits.push({ event, ...data }), reason: async () => replies.shift() });
  s.observe('one', 'Secret final wording.', true);
  s.schedule(); await until(() => audits.filter(a => a.event === 'agent_finished').length === 1);
  s.schedule(); await until(() => audits.filter(a => a.event === 'agent_finished').length === 2);
  const finished = audits.filter(a => a.event === 'agent_finished');
  assert.deepEqual(finished.map(a => [a.accepted, a.rejection]), [
    [false, { reason: 'unknown-evidence' }], [false, { reason: 'schema', fields: ['phase', 'question', 'intent', 'evidenceIds'] }]]);
  s.observe('two', 'Secret partial', false);
  const stale = s.snapshot(); s.observe('two', 'Secret corrected.', true);
  assert.equal(s.accept(proposal(), { ...stale, baseRevision: s.state.revision }), false);
  assert.deepEqual(s.lastRejection, { reason: 'corrected-evidence' });
  assert.equal(s.accept(proposal(), s.snapshot()), true);
  assert.equal(s.lastRejection, null);
  assert.equal(JSON.stringify(audits).includes('Secret'), false);
  s.stop();
});

test('transcript deltas reconcile once and completion order follows commits', () => {
  const s = makeSession();
  s.committed('one'); s.committed('two', 'one');
  s.observe('two', 'Second turn.', true);
  s.observe('one', 'First ', false); s.observe('one', 'turn.', false);
  s.observe('one', 'First corrected turn.', true);
  s.observe('one', 'Duplicate ignored', true);
  assert.deepEqual(s.snapshot().observations.map(o => o.text), ['First corrected turn.', 'Second turn.']);
  s.stop();
});

test('reasoning coalesces new input while audio intake continues', async () => {
  const calls = [];
  const resolvers = [];
  const s = makeSession({ reason: snapshot => new Promise(resolve => { calls.push(snapshot); resolvers.push(resolve); }) });
  s.schedule(); await until(() => calls.length === 1);
  s.observe('one', 'First observation.', true);
  s.observe('two', 'Second observation.', true);
  for (let i = 0; i < 30; i++) s.audio(packet(i));
  assert.equal(calls.length, 1); assert.equal(s.samples, 72000);
  resolvers.shift()(proposal({ phase: 'GREETINGS', question: null, evidenceIds: [] }));
  await until(() => calls.length === 2);
  assert.equal(calls[1].observations.length, 2);
  assert.equal(calls[1].audioCutoffSamples, 72000);
  s.stop(); resolvers.shift()(proposal());
});

test('Stop aborts requests and suppresses late answers', async () => {
  const events = []; let finish, signal;
  const s = makeSession({ emit: event => events.push(event), reason: (_, token) => {
    signal = token; return new Promise(resolve => { finish = resolve; });
  } });
  s.schedule(); await until(() => finish);
  s.stop(); assert.equal(signal.aborted, true);
  finish(proposal({ evidenceIds: [] }));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(events.some(e => e.type === 'answer'), false);
});

test('audio worklet resamples and packets one second at common browser rates', async () => {
  const source = await readFile(new URL('audio-worklet.js', import.meta.url), 'utf8');
  for (const rate of [24000, 44100, 48000]) {
    let Processor; const outputs = [];
    vm.runInNewContext(source, {
      sampleRate: rate,
      AudioWorkletProcessor: class { constructor() { this.port = { postMessage: buffer => outputs.push(new Int16Array(buffer)) }; } },
      registerProcessor: (_, type) => { Processor = type; },
    });
    const processor = new Processor();
    for (let i = 0; i < rate; i += 128) processor.process([[new Float32Array(Math.min(128, rate - i)).fill(0.5)]]);
    assert.equal(outputs.length, 10, `packet count at ${rate}`);
    assert.equal(outputs[0][0], 16384);
    assert.equal(outputs.at(-1).length, 2400);
  }
});

// Starts the real server on a loopback port with a fake transcription socket that records what it is sent.
async function startServer(t, options = {}) {
  const sent = [];
  class Upstream extends EventEmitter {
    readyState = WebSocket.OPEN;
    bufferedAmount = 0;
    constructor() { super(); setImmediate(() => this.emit('open')); }
    send(raw) {
      const event = JSON.parse(raw); sent.push(event);
      if (event.type === 'session.update') setImmediate(() => this.emit('message', Buffer.from('{"type":"session.updated"}')));
    }
    close() { this.readyState = WebSocket.CLOSED; this.emit('close'); }
  }
  const server = createPocServer({ apiKey: 'test-only', connect: () => new Upstream(), audit: () => {},
    reason: async () => proposal({ phase: 'GREETINGS', question: null, evidenceIds: [] }), ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.shutdown());
  return { sent, origin: `http://127.0.0.1:${server.address().port}` };
}

test('HTTP exposes only public assets; WebSocket sends audio to transcription and returns a real session event', async t => {
  const { sent, origin } = await startServer(t);
  assert.equal((await fetch(origin + '/health')).status, 200);
  for (const path of ['/poc/.env.local', '/.git/config', '/poc/server.mjs', '/eval-data/secret.mp3']) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
  const denied = new WebSocket(origin.replace('http:', 'ws:') + '/session', { origin: 'https://example.org' });
  const [error] = await once(denied, 'error'); assert.match(error.message, /403/);
  const socket = new WebSocket(origin.replace('http:', 'ws:') + '/session', { origin });
  const events = []; socket.on('message', raw => events.push(JSON.parse(raw)));
  await until(() => events.some(e => e.type === 'ready'));
  socket.send(packet(0));
  await until(() => sent.some(e => e.type === 'input_audio_buffer.append'));
  assert.equal(Buffer.from(sent.find(e => e.type === 'input_audio_buffer.append').audio, 'base64').length, 4800);
  await until(() => events.some(e => e.type === 'answer'));
  socket.send(JSON.stringify({ type: 'stop' })); await once(socket, 'close');
  assert.equal((await (await fetch(origin + '/health')).json()).sessions, 0);
});

test('WebSocket question controls answer per request while audio continues and late model output is rejected', async t => {
  let release;
  const { sent, origin } = await startServer(t, { reason: () => new Promise(resolve => { release = resolve; }) });
  const socket = new WebSocket(origin.replace('http:', 'ws:') + '/session', { origin });
  const events = []; socket.on('message', raw => events.push(JSON.parse(raw)));
  await until(() => events.some(e => e.type === 'ready') && release);
  const sessionId = events[0].sessionId;
  const result = async requestId => (await until(() => events.some(e => e.requestId === requestId)), events.find(e => e.requestId === requestId));
  const appends = () => sent.filter(e => e.type === 'input_audio_buffer.append').length;
  socket.send(JSON.stringify({ type: 'question.reset', sessionId, requestId: 'reset' }));
  socket.send(packet(0));
  assert.equal((await result('reset')).status, 'reset');
  await until(() => appends() === 1);
  const confirm = { type: 'question.confirm', sessionId, liveId: 'unknown', liveVersion: 1, expectedFocusVersion: 0, text: 'x' };
  socket.send(JSON.stringify({ ...confirm, requestId: 'unknown' }));
  socket.send(JSON.stringify({ type: 'question.confirm', sessionId, requestId: 'bad' }));
  socket.send(JSON.stringify({ ...confirm, sessionId: 'old-session', requestId: 'wrong' }));
  assert.deepEqual([(await result('unknown')).status, (await result('bad')).status, (await result('wrong')).status],
    ['invalid', 'invalid', 'invalid']);
  // The reset moved the revision, so the model output started before it is rejected.
  release(proposal({ question: 'Late wording.', evidenceIds: [] }));
  await until(() => events.some(e => e.type === 'agent' && /rejected/.test(e.status)));
  socket.send(packet(1));
  await until(() => appends() === 2);
  assert.equal(socket.readyState, WebSocket.OPEN);
  assert.deepEqual([events.filter(e => e.type === 'answer').at(-1).live, events.filter(e => e.type === 'answer').at(-1).focus], [null, null]);
  // A browser disconnect, unlike stop, is noticed by the server asynchronously.
  socket.close(); await once(socket, 'close');
  let sessions = 1;
  for (let i = 0; i < 50 && sessions; i++) {
    sessions = (await (await fetch(origin + '/health')).json()).sessions;
    if (sessions) await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(sessions, 0);
});
