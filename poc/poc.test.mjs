import test from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { readFile, readdir, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import vm from 'node:vm';
import WebSocket from 'ws';
import { InterviewSession } from './session.mjs';
import { createPocServer as createRealServer } from './server.mjs';
import { createFixtures } from './fixtures.mjs';
import { loadPackage, DEFAULT_PACKAGE_DIR } from './package-loader.mjs';
import { createGenerator, answerModel, buildRequest, modelInput, validateResult, INSTRUCTIONS, BULLET_MAX, DETAILS_MAX } from './answer.mjs';

// The existing cases never read a real preparation package: every server gets an empty temporary folder.
const noPackage = await mkdtemp(join(tmpdir(), 'alice-nopkg-'));
const createPocServer = (options = {}) => createRealServer({ packageDir: noPackage, log: () => {}, ...options });

const proposal = (changes = {}) => ({ reply: 'I heard the question.', phase: 'QUESTION', question: 'Tell me about yourself.', intent: 'new-question', evidenceIds: ['one'], ...changes });
const clarify = (question, evidenceIds) => proposal({ intent: 'clarify', question, evidenceIds });
const makeSession = (options = {}) => new InterviewSession({ reason: async () => proposal(), emit: () => {}, delayMs: 0, ...options });
const packet = sequence => {
  const buffer = Buffer.alloc(4808);
  buffer.writeUInt32LE(sequence, 0); buffer.writeUInt32LE(sequence * 2400, 4);
  return buffer;
};
async function until(predicate, ms = 1500) {
  const deadline = Date.now() + ms;
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

// ---- SPRINT-003 service tests (T27): fixtures only, invented text, no OpenAI ----
const answerOk = (changes = {}) => ({ bullets: ['First point.', 'Second point.'], details: 'Invented details.', ...changes });
const packageOf = (documents, status = 'usable') => ({ status, documents: status === 'usable' ? documents : [], files: [], chars: 0, skipped: [] });
const docs = () => [{ name: 'a.txt', text: 'Alpha sample text.' }, { name: 'b.md', text: 'Beta sample text.' }];
let obsCount = 0;

// A session wired to a fake generator; `confirm(text)` makes Live and then confirms it through control().
function answering({ generate, pkg, now, timeoutMs } = {}) {
  const events = [], audits = [];
  const s = new InterviewSession({ reason: () => new Promise(() => {}), emit: e => events.push(e), delayMs: 0,
    audit: (name, data) => audits.push({ name, ...data }), generate, now, answerTimeoutMs: timeoutMs });
  if (pkg) s.answers.setPackage(pkg);
  const confirm = (text = 'Why this company?') => {
    const id = `obs-${++obsCount}`;
    s.observe(id, text, true);
    assert.equal(s.accept(proposal({ question: text, evidenceIds: [id] }), s.snapshot()), true);
    const live = s.state.live;
    s.control({ type: 'question.confirm', sessionId: s.id, requestId: `c${obsCount}`, liveId: live.id, liveVersion: live.version,
      expectedFocusVersion: s.state.focusVersion, text });
  };
  return { s, events, audits, confirm, named: name => audits.filter(a => a.name === name), proposed: () => events.filter(e => e.type === 'proposed') };
}
const setup = (t, options = {}) => {
  const f = createFixtures();
  const w = answering({ generate: f.generate, pkg: packageOf(docs()), ...options });
  t.after(() => w.s.stop());
  return { f, ...w };
};
const keysOf = value => Object.keys(value).sort();

test('answer request has exactly five fields', async t => {
  const { f, confirm } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  assert.deepEqual(keysOf(f.calls[0].request), ['contextKind', 'documents', 'focusVersion', 'question', 'sessionId']);
  assert.equal(f.calls[0].request.contextKind, 'interview');
});

test('answer request question is the confirmed Focus text', async t => {
  const { f, s, confirm } = setup(t);
  confirm('Why this company?'); await until(() => f.calls.length === 1);
  assert.equal(f.calls[0].request.question, s.state.focus);
  assert.equal(f.calls[0].request.focusVersion, 1);
  assert.equal(f.calls[0].request.sessionId, s.id);
});

test('answer request documents are in name order and empty without a package', async t => {
  const dir = await tempDir(t, { 'b.md': 'Bravo.', 'a.txt': 'Alpha.', 'C.TXT': 'Charlie.' });
  const loaded = await loadPackage(dir);
  assert.deepEqual(buildRequest({ sessionId: 's', focusVersion: 1, question: 'q', documents: loaded.documents }).documents.map(d => d.name), ['C.TXT', 'a.txt', 'b.md']);
  const f = createFixtures(); const w = answering({ generate: f.generate, pkg: packageOf([], 'none') });
  t.after(() => w.s.stop()); w.confirm(); await until(() => f.calls.length === 1);
  assert.deepEqual(f.calls[0].request.documents, []);
});

test('model input holds only instructions, question and document text', async t => {
  const { f, confirm, s } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  const { request } = f.calls[0];
  const input = modelInput(request);
  assert.equal(input.instructions, INSTRUCTIONS);
  assert.equal(input.input, 'Question:\nWhy this company?\n\nDocument 1:\nAlpha sample text.\n\nDocument 2:\nBeta sample text.');
  for (const absent of [s.id, 'a.txt', 'b.md', s.state.reply, 'serverAt']) assert.equal(input.input.includes(absent), false);
  assert.match(INSTRUCTIONS, /never instructions/);
  assert.match(INSTRUCTIONS, /at most three/);
  assert.match(INSTRUCTIONS, /no documents are given, give general points that say nothing about the person/);
  assert.match(INSTRUCTIONS, /Never invent employers, projects, numbers or results/);
});

test('interview agent input never holds an answer or package text', async t => {
  const { f, s, confirm, events } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.release(answerOk({ bullets: ['Bullet sentinel.'], details: 'Details sentinel.' }));
  await until(() => s.answers.proposed.status === 'shown');
  const seen = JSON.stringify(s.snapshot());
  for (const absent of ['Bullet sentinel', 'Details sentinel', 'Alpha sample text', 'proposed']) assert.equal(seen.includes(absent), false, absent);
  assert.ok(events.some(e => e.type === 'proposed'));
});

test('generator makes one call per attempt with no tools and its own model setting', async () => {
  const calls = [];
  const runner = { run: async (agent, input, options) => { calls.push({ agent, input, options }); return { finalOutput: answerOk() }; } };
  const generate = createGenerator({ model: 'answer-model-x', runner });
  const request = buildRequest({ sessionId: 's', focusVersion: 1, question: 'Why?', documents: docs() });
  assert.deepEqual(await generate(request, { signal: undefined }), answerOk());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].agent.model, 'answer-model-x');
  assert.deepEqual(calls[0].agent.tools, []);
  assert.equal(calls[0].options.maxTurns, 1);
  const saved = { a: process.env.ANSWER_MODEL, o: process.env.OPENAI_MODEL };
  try {
    process.env.OPENAI_MODEL = 'agent-model'; delete process.env.ANSWER_MODEL;
    assert.equal(answerModel(), 'agent-model');
    process.env.ANSWER_MODEL = 'own-model';
    assert.equal(answerModel(), 'own-model');
  } finally {
    for (const [name, value] of [['ANSWER_MODEL', saved.a], ['OPENAI_MODEL', saved.o]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('result keeps bullets and details as separate fields', async t => {
  assert.deepEqual(validateResult(answerOk(), { hasDocuments: true }), { ok: true, value: answerOk() });
  const { f, confirm, proposed } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.release(answerOk()); await until(() => proposed().length === 1);
  assert.deepEqual([proposed()[0].proposed.bullets, proposed()[0].proposed.details], [answerOk().bullets, answerOk().details]);
});

test('bullets accept one to three single-line items within the length limit', () => {
  const ok = bullets => validateResult({ bullets, details: 'd' }, { hasDocuments: false }).ok;
  assert.equal(ok(['one']), true);
  assert.equal(ok(['a', 'b', 'c']), true);
  assert.equal(ok('x'.repeat(BULLET_MAX).split('\n')), true);
  for (const bad of [[], ['a', 'b', 'c', 'd'], ['x'.repeat(BULLET_MAX + 1)], [' padded'], ['padded '], [''], ['two\nlines'], ['tab\there'], [5], 'text']) {
    assert.equal(ok(bad), false, JSON.stringify(bad));
  }
});

test('details respect the limit and are required only with documents', () => {
  const check = (details, hasDocuments) => validateResult({ bullets: ['a'], details }, { hasDocuments }).ok;
  assert.equal(check('x'.repeat(DETAILS_MAX), true), true);
  assert.equal(check('x'.repeat(DETAILS_MAX + 1), true), false);
  assert.equal(check('', false), true);
  assert.equal(check('', true), false);
  assert.equal(check('   ', true), false);
  assert.equal(check('line one\nline two', true), true);
  assert.equal(check('bell\u0007', true), false);
  assert.equal(check(7, false), false);
});

test('malformed or oversized results are rejected whole and never cut', async t => {
  const { f, s, confirm, audits, proposed } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.release(answerOk({ bullets: ['x'.repeat(BULLET_MAX + 1), 'ok'] }));
  await until(() => f.calls.length === 2);
  f.release({ bullets: ['fine'], details: 'fine', extra: 'unknown field' });
  await until(() => s.answers.proposed.status === 'failed');
  assert.deepEqual([s.answers.proposed.bullets, s.answers.proposed.details], [[], '']);
  assert.equal(proposed().at(-1).proposed.status, 'failed');
  assert.deepEqual(audits.filter(a => a.name === 'answer_failed').map(a => [a.attempts, a.code]), [[2, 'invalid-result:unknown-field']]);
  assert.equal(validateResult({ bullets: ['x'.repeat(BULLET_MAX + 1)], details: '' }, { hasDocuments: false }).ok, false);
});

test('answer area is empty at ready and uses only the six controller statuses', async t => {
  const { f, s, confirm } = setup(t);
  assert.deepEqual([s.answers.proposed.status, s.answers.proposed.bullets], ['empty', []]);
  const seen = new Set(['empty']);
  const watch = () => seen.add(s.answers.proposed.status);
  confirm(); watch(); await until(() => f.calls.length === 1);
  f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown'); watch();
  s.stop(); watch();
  for (const status of seen) assert.ok(['empty', 'preparing', 'shown', 'general', 'failed', 'last-known'].includes(status), status);
  assert.deepEqual(keysOf(s.answers.view()), ['bullets', 'details', 'focusVersion', 'lastKnown', 'lastStatus', 'reason', 'status']);
});

test('answer area is kept apart from state, snapshots and revision', async t => {
  const { f, s, confirm, events } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  const revision = s.state.revision;
  f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown');
  assert.equal(s.state.revision, revision);
  assert.equal('proposed' in s.state, false);
  assert.equal('proposed' in s.snapshot(), false);
  assert.equal('proposed' in s.snapshot().state, false);
  const result = events.find(e => e.type === 'question.result');
  assert.equal('proposed' in result.state, false);
});

test('Confirm sets Focus, preparing and one request in one update, result first', async t => {
  const { f, s, confirm, events } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  const types = events.map(e => e.type);
  const result = types.indexOf('question.result'), answer = types.lastIndexOf('answer');
  assert.ok(result >= 0 && answer > result);
  assert.deepEqual([events[answer].focus, events[answer].focusVersion, events[answer].proposed.status, events[answer].proposed.focusVersion],
    ['Why this company?', 1, 'preparing', 1]);
  assert.deepEqual([events[answer].proposed.bullets, events[answer].proposed.details], [[], '']);
  assert.equal(f.calls.length, 1);
  assert.equal(s.state.focus, 'Why this company?');
});

test('reworded Confirm replaces the answer and aborts the earlier request', async t => {
  const { f, s, confirm } = setup(t);
  confirm('Why this company?'); await until(() => f.calls.length === 1);
  f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown');
  confirm('Why this company, really?'); await until(() => f.calls.length === 2);
  assert.deepEqual([s.answers.proposed.status, s.answers.proposed.bullets, s.answers.proposed.focusVersion], ['preparing', [], 2]);
  confirm('A third wording of it?'); await until(() => f.calls.length === 3);
  assert.equal(f.calls[1].signal.aborted, true);
  assert.equal(f.waiting(), 1, 'at most one request in flight');
});

test('late result for an earlier version is dropped with its reason', async t => {
  const resolvers = [];
  const generate = () => new Promise(resolve => resolvers.push(resolve));
  const { s, confirm, audits, proposed } = setup(t, { generate });
  confirm('First question here?'); await until(() => resolvers.length === 1);
  confirm('Second question here?'); await until(() => resolvers.length === 2);
  resolvers[0](answerOk({ bullets: ['Late bullet.'] }));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(proposed().length, 0);
  assert.equal(s.answers.proposed.status, 'preparing');
  assert.deepEqual(audits.filter(a => a.name === 'answer_dropped').map(a => [a.focusVersion, a.reason]), [[1, 'stale-version']]);
});

test('accepted result is shown with a package and general with each loader reason', async t => {
  const cases = [['usable', 'shown', null], ['none', 'general', null], ['too-large', 'general', 'too-large'], ['empty', 'general', 'empty'], ['unreadable', 'general', 'unreadable']];
  for (const [status, shown, reason] of cases) {
    const { f, s, confirm } = setup(t, { pkg: packageOf(docs(), status) });
    confirm(); await until(() => f.calls.length === 1);
    f.release(answerOk({ details: status === 'usable' ? 'Needed details.' : '' }));
    await until(() => s.answers.proposed.status === shown);
    assert.equal(s.answers.proposed.reason, reason, status);
    assert.equal(f.calls[0].request.documents.length, status === 'usable' ? 2 : 0);
  }
});

test('result is published as one proposed message with a rising sequence', async t => {
  const { f, confirm, proposed, s } = setup(t);
  confirm('First question here?'); await until(() => f.calls.length === 1);
  f.release(answerOk()); await until(() => proposed().length === 1);
  confirm('Second question here?'); await until(() => f.calls.length === 2);
  f.release(answerOk({ bullets: ['Other.'] })); await until(() => proposed().length === 2);
  const [one, two] = proposed();
  assert.deepEqual(keysOf(one), ['proposed', 'proposedSeq', 'serverAt', 'sessionId', 'type']);
  assert.equal(one.sessionId, s.id);
  assert.ok(two.proposedSeq > one.proposedSeq);
  assert.deepEqual([one.proposed.status, one.proposed.bullets.length, one.proposed.details], ['shown', 2, 'Invented details.']);
  assert.equal(two.proposed.focusVersion, 2);
});

test('result after speech starts is published silently and the cue is unchanged', async t => {
  const { f, s, confirm, events, proposed } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  const before = { ...s.state }, count = events.length;
  s.voiced();
  f.release(answerOk()); await until(() => proposed().length === 1);
  assert.deepEqual(s.state, before);
  assert.deepEqual(events.slice(count).map(e => e.type), ['proposed']);
});

test('answer area cannot write Focus, Live or phase and never stales a Live update', async t => {
  const { f, s, confirm } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  s.observe('late-obs', 'Tell me about leading a team.', true);
  const snapshot = s.snapshot();
  const state = { ...s.state };
  f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown');
  assert.deepEqual(s.state, state);
  assert.equal(s.accept(proposal({ question: 'Tell me about leading a team.', evidenceIds: ['late-obs'] }), snapshot), true);
});

test('two failed attempts give failed and the next Confirm starts afresh', async t => {
  const { f, s, confirm } = setup(t);
  confirm('First question here?'); await until(() => f.calls.length === 1);
  f.fail(new Error('first')); await until(() => f.calls.length === 2);
  f.fail(new Error('second')); await until(() => s.answers.proposed.status === 'failed');
  assert.deepEqual([s.answers.proposed.bullets, s.answers.proposed.details], [[], '']);
  confirm('Second question here?'); await until(() => f.calls.length === 3);
  assert.equal(s.answers.proposed.status, 'preparing');
  f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown');
});

test('Stop drops the pending result and keeps content as last known', async t => {
  const pending = setup(t);
  pending.confirm(); await until(() => pending.f.calls.length === 1);
  pending.s.stop();
  assert.deepEqual([pending.s.answers.proposed.status, pending.s.answers.proposed.lastStatus, pending.s.answers.proposed.bullets], ['last-known', 'preparing', []]);
  assert.equal(pending.f.calls[0].signal.aborted, true);
  assert.equal(pending.proposed().at(-1).proposed.status, 'last-known');
  const kept = [['shown', answerOk()], ['general', answerOk({ details: '' })], ['failed', null]];
  for (const [status, result] of kept) {
    const w = setup(t, { pkg: packageOf(docs(), status === 'general' ? 'none' : 'usable') });
    w.confirm(); await until(() => w.f.calls.length === 1);
    if (result) w.f.release(result); else { w.f.fail(new Error('x')); await until(() => w.f.calls.length === 2); w.f.fail(new Error('y')); }
    await until(() => w.s.answers.proposed.status === status);
    const content = w.s.answers.view();
    w.s.stop();
    const last = w.s.answers.proposed;
    assert.deepEqual([last.status, last.lastKnown, last.lastStatus, last.bullets, last.details, last.reason],
      ['last-known', true, status, content.bullets, content.details, content.reason]);
  }
});

test('new session starts empty after Stop', async t => {
  const { s, f, confirm } = setup(t);
  confirm(); await until(() => f.calls.length === 1); s.stop();
  const fresh = setup(t);
  assert.deepEqual([fresh.s.answers.proposed.status, fresh.s.answers.proposed.bullets, fresh.s.answers.proposed.lastKnown], ['empty', [], false]);
});

// Helpers for the server-level cases below.
async function tempDir(t, files = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'alice-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
  return dir;
}

// A real server on a loopback port driven through its WebSocket, with fixtures for both OpenAI seams.
async function liveServer(t, { files = {}, ...options } = {}) {
  const f = createFixtures(), audits = [], logs = [];
  const packageDir = await tempDir(t, files);
  let connects = 0;
  const server = createRealServer({ apiKey: 'sk-test-sentinel', connect: () => { connects += 1; return f.connect(); }, generate: f.generate, packageDir,
    audit: (name, data) => audits.push({ name, ...data }), log: line => logs.push(line), reasonDelayMs: 0,
    reason: async snapshot => proposal({ question: snapshot.observations.at(-1)?.text ?? null, evidenceIds: snapshot.observations.map(o => o.id) }), ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.shutdown());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const open = async () => {
    const socket = new WebSocket(origin.replace('http:', 'ws:') + '/session', { origin });
    const events = []; socket.on('message', raw => events.push(JSON.parse(raw)));
    await until(() => events.some(e => e.type === 'ready'));
    const sessionId = events[0].sessionId;
    const confirm = async (text = 'Why this company?') => {
      const before = events.filter(e => e.live).length;
      f.say(text);
      await until(() => events.filter(e => e.live).length > before, 4000);
      const { live, focusVersion } = events.filter(e => e.live).at(-1);
      socket.send(JSON.stringify({ type: 'question.confirm', sessionId, requestId: `q${events.length}`, liveId: live.id, liveVersion: live.version, expectedFocusVersion: focusVersion, text: live.text }));
      await until(() => events.some(e => e.type === 'question.result' && e.status === 'confirmed' && e.state.focusVersion > focusVersion));
    };
    return { socket, events, sessionId, confirm };
  };
  const health = async () => (await fetch(origin + '/health')).json();
  return { f, audits, logs, origin, open, health, packageDir, connects: () => connects };
}
const loudPacket = sequence => {
  const buffer = packet(sequence);
  for (let i = 8; i < buffer.length; i += 2) buffer.writeInt16LE(8000, i);
  return buffer;
};
const named = (audits, name) => audits.filter(a => a.name === name);

test('package is read once at session start', async t => {
  const { open, f, audits, health, packageDir } = await liveServer(t, { files: { 'a.txt': 'Original sample text.' } });
  const { confirm } = await open();
  assert.equal(named(audits, 'package_loaded').length, 1);
  await writeFile(join(packageDir, 'a.txt'), 'Changed after the session started.');
  await confirm('First question here?'); await until(() => f.calls.length === 1);
  await confirm('Second question here?'); await until(() => f.calls.length === 2);
  assert.deepEqual(f.calls.map(c => c.request.documents), [[{ name: 'a.txt', text: 'Original sample text.' }], [{ name: 'a.txt', text: 'Original sample text.' }]]);
  assert.equal(named(audits, 'package_loaded').length, 1);
  assert.equal((await health()).package.found, true);
});

test('no key means no session and no request', async t => {
  for (const apiKey of [undefined, '', '   ']) {
    const { origin, f, audits, connects } = await liveServer(t, { apiKey, files: { 'a.txt': 'Sample.' } });
    const socket = new WebSocket(origin.replace('http:', 'ws:') + '/session', { origin });
    const events = []; socket.on('message', raw => events.push(JSON.parse(raw)));
    await once(socket, 'close');
    assert.ok(events.some(e => e.type === 'status' && e.status === 'Server needs OPENAI_API_KEY'));
    assert.deepEqual([connects(), f.calls.length, f.upstream(), named(audits, 'package_loaded').length], [0, 0, null, 0]);
  }
});

test('package folder is a setting and defaults to poc/context/interview', async t => {
  assert.equal(relative(join(DEFAULT_PACKAGE_DIR, '..', '..', '..'), DEFAULT_PACKAGE_DIR).replaceAll('\\', '/'), 'poc/context/interview');
  const dir = await tempDir(t, { 'x.txt': 'Setting sample.' });
  const saved = process.env.ALICE_PACKAGE_DIR;
  process.env.ALICE_PACKAGE_DIR = dir;
  try {
    const server = createRealServer({ apiKey: 'k', log: () => {} });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.shutdown());
    const body = await (await fetch(`http://127.0.0.1:${server.address().port}/health`)).json();
    assert.deepEqual(body.package, { found: true, chars: 'Setting sample.'.length });
  } finally { if (saved === undefined) delete process.env.ALICE_PACKAGE_DIR; else process.env.ALICE_PACKAGE_DIR = saved; }
  const option = await loadPackage(dir);
  assert.equal(option.status, 'usable');
});

test('loader skips README, other extensions, dotfiles, links and subfolders', async t => {
  const dir = await tempDir(t, { 'real.txt': 'Real text.', 'README.md': 'skip', 'notes.pdf': 'skip', '.hidden.txt': 'skip', 'archive.txt.bak': 'skip' });
  await mkdir(join(dir, 'sub')); await writeFile(join(dir, 'sub', 'inner.txt'), 'inner');
  await symlink(join(dir, 'real.txt'), join(dir, 'link.txt'));
  const pkg = await loadPackage(dir);
  assert.deepEqual(pkg.documents, [{ name: 'real.txt', text: 'Real text.' }]);
  assert.deepEqual(pkg.skipped, ['.hidden.txt', 'README.md', 'archive.txt.bak', 'link.txt', 'notes.pdf', 'sub']);
  assert.equal(pkg.chars, 'Real text.'.length);
  assert.equal((await loadPackage(await tempDir(t, { 'Readme.MD': 'skip' }))).status, 'none', 'README.md in any case');
});

test('loader reads in name order as strict UTF-8 and one unreadable file voids the package', async t => {
  const dir = await tempDir(t, { 'b.txt': 'Bravo.', 'a.TXT': 'Alpha ünï.' });
  assert.deepEqual((await loadPackage(dir)).documents.map(d => d.name), ['a.TXT', 'b.txt']);
  await writeFile(join(dir, 'c.md'), Buffer.from([0x41, 0xff, 0xfe]));
  const pkg = await loadPackage(dir);
  assert.deepEqual([pkg.status, pkg.documents, pkg.found], ['unreadable', [], true]);
});

test('package of exactly 20,000 characters is used and 20,001 is not and is never cut', async t => {
  const exact = await loadPackage(await tempDir(t, { 'a.txt': 'a'.repeat(20000) }));
  assert.deepEqual([exact.status, exact.documents[0].text.length], ['usable', 20000]);
  const over = await loadPackage(await tempDir(t, { 'a.txt': 'a'.repeat(20001) }));
  assert.deepEqual([over.status, over.documents, over.chars], ['too-large', [], 20001]);
  const split = await loadPackage(await tempDir(t, { 'a.txt': 'a'.repeat(10000), 'b.txt': 'b'.repeat(10001) }));
  assert.equal(split.status, 'too-large');
  const wide = await loadPackage(await tempDir(t, { 'a.txt': 'é'.repeat(20000) }));
  assert.equal(wide.status, 'usable', 'size is string length, not bytes');
});

test('package status is none, empty, unreadable, too-large or usable in that order', async t => {
  assert.equal((await loadPackage(await tempDir(t))).status, 'none');
  assert.equal((await loadPackage(join(tmpdir(), 'alice-no-such-folder-xyz'))).status, 'none');
  const blank = await loadPackage(await tempDir(t, { 'a.txt': '  \n\t ', 'b.md': '' }));
  assert.deepEqual([blank.status, blank.found], ['empty', true]);
  const bad = await tempDir(t, { 'a.txt': 'a'.repeat(20001) });
  await writeFile(join(bad, 'z.txt'), Buffer.from([0xff]));
  assert.equal((await loadPackage(bad)).status, 'unreadable');
  assert.equal((await loadPackage(await tempDir(t, { 'a.txt': 'a'.repeat(20001) }))).status, 'too-large');
  assert.equal((await loadPackage(await tempDir(t, { 'a.txt': 'fine' }))).status, 'usable');
});

const SENTINEL = 'PKG-SENTINEL-TEXT';
test('package text is held in memory only and never appears in audit, log, health or messages', async t => {
  const stderr = { chunks: [], write(c) { this.chunks.push(c); } };
  const { open, f, audits, logs, health } = await liveServer(t, { files: { 'secret-name.txt': `Reference ${SENTINEL}.` }, stderr });
  const { events, confirm, socket } = await open();
  await confirm(); await until(() => f.calls.length === 1);
  assert.equal(f.calls[0].request.documents[0].text.includes(SENTINEL), true, 'the generator is the one place it goes');
  f.release(answerOk()); await until(() => events.some(e => e.type === 'proposed'));
  const everything = JSON.stringify([audits, logs, await health(), events, stderr.chunks]);
  assert.equal(everything.includes(SENTINEL), false);
  socket.send(JSON.stringify({ type: 'stop' })); await once(socket, 'close');
});

test('package_loaded audit holds names, sizes and digests but no text', async t => {
  const body = `Digest ${SENTINEL}.`;
  const { open, audits, logs } = await liveServer(t, { files: { 'a.txt': body, 'README.md': 'skip me', 'notes.pdf': 'skip' } });
  await open();
  const [event] = named(audits, 'package_loaded');
  assert.deepEqual(event.files, [{ name: 'a.txt', chars: body.length, sha256: createHash('sha256').update(body).digest('hex') }]);
  assert.deepEqual([event.status, event.chars, event.skipped], ['usable', body.length, ['README.md', 'notes.pdf']]);
  assert.equal(JSON.stringify(event).includes(SENTINEL), false);
  assert.deepEqual(logs, [`package: status=usable files=1 chars=${body.length} skipped=README.md,notes.pdf`]);
});

const rawGet = (origin, path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request(origin + path, { method, headers }, res => { let body = ''; res.on('data', d => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); });
  req.on('error', reject); req.end();
});

test('health returns the fixed fields on a GET-only no-store route', async t => {
  const { origin } = await liveServer(t, { now: () => 1234 });
  const reply = await rawGet(origin, '/health');
  assert.equal(reply.headers['cache-control'], 'no-store');
  const body = JSON.parse(reply.body);
  assert.deepEqual(Object.keys(body).sort(), ['configured', 'package', 'service', 'sessions', 'startedAt', 'status']);
  assert.deepEqual([body.status, body.service, body.startedAt, body.sessions], ['alive', 'alice-good-meetings', 1234, 0]);
  assert.deepEqual(Object.keys(body.package).sort(), ['chars', 'found']);
  assert.equal((await rawGet(origin, '/health', {}, 'POST')).status, 405);
  assert.equal((await rawGet(origin, '/health', { host: 'evil.example' })).status, 403);
});

test('health says not configured for an absent or blank key', async t => {
  for (const [apiKey, configured] of [[undefined, false], ['', false], ['  \n', false], ['sk-x', true]]) {
    const { health } = await liveServer(t, { apiKey });
    assert.equal((await health()).configured, configured, JSON.stringify(apiKey));
  }
});

test('health never holds the key, file names, text or errors', async t => {
  const { health } = await liveServer(t, { files: { 'secret-name.txt': `Text ${SENTINEL}`, 'bad.txt': '' } });
  const body = JSON.stringify(await health());
  for (const absent of ['sk-test-sentinel', 'secret-name', SENTINEL, 'bad.txt', 'error', 'Error']) assert.equal(body.includes(absent), false, absent);
});

test('health reports whether a package was found and its size', async t => {
  assert.deepEqual((await (await liveServer(t)).health()).package, { found: false, chars: 0 });
  assert.deepEqual((await (await liveServer(t, { files: { 'a.txt': 'abc', 'b.md': 'de' } })).health()).package, { found: true, chars: 5 });
  assert.deepEqual((await (await liveServer(t, { files: { 'a.txt': 'a'.repeat(20001) } })).health()).package, { found: true, chars: 20001 });
});

test('service starts and listens with no key file', async t => {
  const dir = await tempDir(t);
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, PORT: '0', ALICE_PACKAGE_DIR: dir } });
  t.after(() => child.kill());
  let out = ''; child.stdout.on('data', d => { out += d; });
  await until(() => /http:\/\/127\.0\.0\.1:(\d+)/.test(out), 5000);
  const port = out.match(/127\.0\.0\.1:(\d+)/)[1];
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/health`)).json()).configured, false);
  assert.match(out, /No OpenAI key is set up/);
});

test('rejected key ends the session with the public error text', async t => {
  const { open, f, health, audits } = await liveServer(t);
  const { socket, events } = await open();
  f.upstream().emit('message', Buffer.from(JSON.stringify({ type: 'error', error: { code: 'invalid_api_key', message: 'Incorrect API key provided: sk-secret-from-provider' } })));
  await once(socket, 'close');
  const status = events.filter(e => e.type === 'status').at(-1).status;
  assert.equal(status, 'OpenAI authentication failed');
  assert.equal(JSON.stringify([events, audits]).includes('sk-secret-from-provider'), false);
  assert.equal((await health()).configured, true);
  const second = await open();
  f.upstream().emit('unexpected-response', {}, { statusCode: 401, destroy() {} });
  await once(second.socket, 'close');
  assert.equal(second.events.filter(e => e.type === 'status').at(-1).status, 'OpenAI authentication failed');
});

test('session opened without a key says it needs a key and never connects', async t => {
  const { origin, connects, f } = await liveServer(t, { apiKey: undefined });
  const socket = new WebSocket(origin.replace('http:', 'ws:') + '/session', { origin });
  const events = []; socket.on('message', raw => events.push(JSON.parse(raw)));
  await once(socket, 'close');
  assert.deepEqual(events.filter(e => e.type === 'status').map(e => e.status), ['server connected; opening transcription', 'Server needs OPENAI_API_KEY']);
  assert.deepEqual([connects(), f.calls.length], [0, 0]);
});

test('failed attempt is retried once with the same request', async t => {
  const { f, s, confirm, audits } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.fail(new Error('boom')); await until(() => f.calls.length === 2);
  assert.deepEqual(f.calls[1].request, f.calls[0].request);
  f.release({ bullets: [] }); await until(() => f.calls.length === 3 || s.answers.proposed.status === 'failed');
  assert.equal(f.calls.length, 2, 'never more than two attempts');
  const second = setup(t);
  second.confirm(); await until(() => second.f.calls.length === 1);
  second.f.release({ nonsense: true }); await until(() => second.f.calls.length === 2);
  second.f.release(answerOk()); await until(() => second.s.answers.proposed.status === 'shown');
  assert.equal(named(second.audits, 'answer_accepted')[0].attempts, 2);
  assert.equal(named(audits, 'answer_requested').length, 1);
});

test('second failure gives failed with two attempts and a text-free code', async t => {
  const { f, s, confirm, audits } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.fail(new Error('PROVIDER-SECRET-TEXT one')); await until(() => f.calls.length === 2);
  f.fail(new Error('PROVIDER-SECRET-TEXT two')); await until(() => s.answers.proposed.status === 'failed');
  const [event] = named(audits, 'answer_failed');
  assert.deepEqual([event.attempts, event.code], [2, 'generator-error']);
  assert.equal(JSON.stringify(audits).includes('PROVIDER-SECRET'), false);
});

test('no retry after supersede or Stop', async t => {
  const { f, s, confirm } = setup(t);
  confirm('First question here?'); await until(() => f.calls.length === 1);
  confirm('Second question here?'); await until(() => f.calls.length === 2);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(f.calls.length, 2, 'the superseded request is not retried');
  s.stop();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(f.calls.length, 2, 'a stopped session starts no attempt');
});

test('attempt timeout ends an attempt', async t => {
  const generate = () => new Promise(() => {});
  const { s, confirm, audits } = setup(t, { generate, timeoutMs: 20 });
  const started = Date.now();
  confirm(); await until(() => s.answers.proposed.status === 'failed');
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(named(audits, 'answer_failed').map(a => [a.attempts, a.code]), [[2, 'timeout']]);
});

test('retry sends the page no extra message', async t => {
  const { f, confirm, events, proposed } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  const count = events.length;
  f.fail(new Error('first')); await until(() => f.calls.length === 2);
  assert.equal(events.length, count);
  f.release(answerOk()); await until(() => proposed().length === 1);
  assert.deepEqual(events.slice(count).map(e => e.type), ['proposed']);
});

// A controllable clock: the next call to `clock()` returns the value last set.
function clockAt() { const c = { t: 0 }; c.now = () => c.t; return c; }

test('confirm time t0 and request start t1 use the injected clock', async t => {
  const clock = clockAt();
  const { f, confirm, s } = setup(t, { now: clock.now });
  clock.t = 1000; confirm(); clock.t = 1010; await until(() => f.calls.length === 1);
  assert.equal(s.answers.run.t.t0, 1000);
  assert.equal(s.answers.run.t.t1, 1010);
});

test('answer_timing event holds the derived delays once per version', async t => {
  const clock = clockAt();
  const { f, s, confirm, audits } = setup(t, { now: clock.now });
  clock.t = 1000; confirm('First question here?'); clock.t = 1010; await until(() => f.calls.length === 1);
  clock.t = 1200; s.voiced(); clock.t = 1300; s.voiced();
  clock.t = 1500; f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown');
  clock.t = 1600; s.rendered({ answerFocusVersion: 1, answerStatus: 'shown' });
  s.rendered({ answerFocusVersion: 1, answerStatus: 'shown' });
  const [event] = named(audits, 'answer_timing');
  assert.equal(named(audits, 'answer_timing').length, 1);
  assert.deepEqual([event.t0, event.t1, event.t2, event.t3, event.tS, event.attempts, event.outcome], [1000, 1010, 1500, 1600, 1200, 1, 'shown']);
  assert.deepEqual([event.delayMs, event.generationMs, event.pauseMs, event.visibleBeforeSpeech], [600, 490, 200, false]);
  clock.t = 2000; confirm('Second question here?'); await until(() => f.calls.length === 2);
  clock.t = 2100; confirm('Third question here?'); await until(() => f.calls.length === 3);
  const second = named(audits, 'answer_timing')[1];
  assert.deepEqual([second.focusVersion, second.outcome, second.t3, second.delayMs, second.tS, second.pauseMs, second.visibleBeforeSpeech], [2, 'superseded', null, null, null, null, null]);
});

test('answer audit events carry no text', async t => {
  const { f, s, confirm, audits } = setup(t, { pkg: packageOf([{ name: 'a.txt', text: `Doc ${SENTINEL}` }]) });
  confirm('Question QSENTINEL here?'); await until(() => f.calls.length === 1);
  f.release(answerOk({ bullets: ['Bullet ASENTINEL.'], details: 'Details ASENTINEL.' }));
  await until(() => s.answers.proposed.status === 'shown');
  const names = ['answer_requested', 'answer_accepted', 'answer_dropped', 'answer_failed', 'answer_timing'];
  const text = JSON.stringify(audits.filter(a => names.includes(a.name)));
  for (const absent of ['QSENTINEL', 'ASENTINEL', SENTINEL, 'a.txt']) assert.equal(text.includes(absent), false, absent);
  assert.deepEqual(keysOf(named(audits, 'answer_requested')[0]), ['chars', 'contextKind', 'files', 'focusVersion', 'name', 'sessionId']);
});

test('print option is off by default and on only for exactly 1', async t => {
  const saved = process.env.ALICE_PRINT_REQUEST;
  try {
    for (const [value, on] of [[undefined, false], ['', false], ['0', false], ['true', false], [' 1', false], ['1', true]]) {
      if (value === undefined) delete process.env.ALICE_PRINT_REQUEST; else process.env.ALICE_PRINT_REQUEST = value;
      const stderr = { chunks: [], write(c) { this.chunks.push(c); } };
      const server = createPocServer({ apiKey: 'k', stderr });
      assert.equal(stderr.chunks.length > 0, on, JSON.stringify(value));
      server.close();
    }
  } finally { if (saved === undefined) delete process.env.ALICE_PRINT_REQUEST; else process.env.ALICE_PRINT_REQUEST = saved; }
});

test('print option writes to standard error only, with its warning', async t => {
  const stderr = { chunks: [], write(c) { this.chunks.push(c); } };
  const { open, f, audits, logs, health } = await liveServer(t, { printRequest: true, stderr, files: { 'a.txt': `Printed ${SENTINEL}.` } });
  assert.match(stderr.chunks[0], /WARNING: ALICE_PRINT_REQUEST is on/);
  const { confirm, events } = await open();
  await confirm('Print question here?'); await until(() => f.calls.length === 1);
  f.fail(new Error('retry me')); await until(() => f.calls.length === 2);
  const printed = stderr.chunks.join('');
  assert.equal((printed.match(/Question:\nPrint question here\?/g) || []).length, 1, 'once per request, not per retry');
  assert.equal(printed.includes(SENTINEL), true);
  assert.equal((printed.match(/WARNING: ALICE_PRINT_REQUEST/g) || []).length, 2, 'at startup and before the request');
  f.release(answerOk()); await until(() => events.some(e => e.type === 'proposed'));
  const elsewhere = JSON.stringify([events, audits, logs, await health()]);
  assert.equal(elsewhere.includes(SENTINEL), false);
  assert.equal(elsewhere.includes('Instructions') || elsewhere.includes('You prepare a proposed answer'), false, 'the assembled input appears nowhere else');
});

test('injected generator and transcription replace the defaults', async t => {
  const { open, f, connects } = await liveServer(t);
  const { confirm } = await open();
  await confirm(); await until(() => f.calls.length === 1);
  assert.equal(connects(), 1);
  assert.equal(f.waiting(), 1);
});

test('injected clock and timeout work', async t => {
  const { s, confirm, audits } = setup(t, { now: () => 42, timeoutMs: 15 });
  confirm(); await until(() => s.answers.proposed.status === 'failed');
  assert.equal(named(audits, 'answer_timing')[0].t0, 42);
  const { health } = await liveServer(t, { now: () => 777 });
  assert.equal((await health()).startedAt, 777);
});

test('fixture module returns the documented hooks', async () => {
  const f = createFixtures();
  assert.deepEqual(['calls', 'connect', 'fail', 'generate', 'release', 'say'].filter(k => k in f), ['calls', 'connect', 'fail', 'generate', 'release', 'say']);
  assert.throws(() => f.release(answerOk()), /No generator request/);
  const request = { question: 'q', documents: [] };
  const pending = f.generate(request, {});
  request.question = 'changed';
  assert.equal(f.calls[0].request.question, 'q');
  f.release(answerOk()); assert.deepEqual(await pending, answerOk());
  const bad = f.generate(request, {}); f.fail(new Error('x')); await assert.rejects(bad, /x/);
  const up = f.connect(); const got = [];
  up.on('message', raw => got.push(JSON.parse(raw.toString())));
  f.say('Invented words.');
  assert.deepEqual(got.map(e => e.type), ['input_audio_buffer.committed', 'conversation.item.input_audio_transcription.delta', 'conversation.item.input_audio_transcription.completed']);
});

test('fixtures and synthetic package never touch eval-data', async t => {
  const source = await readFile(new URL('./fixtures.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('eval' + '-data'), false);
  assert.equal(/node:fs|readFile|readdir/.test(source), false, 'fixtures read no files');
  const dir = await tempDir(t);
  assert.equal(dir.startsWith(tmpdir()), true);
});

test('preview route serves its files and they refer to no outside address', async t => {
  const { origin } = await liveServer(t);
  const types = { '/preview': 'text/html', '/preview/preview.css': 'text/css', '/preview/preview.js': 'text/javascript' };
  for (const [path, type] of Object.entries(types)) {
    const reply = await fetch(origin + path);
    assert.equal(reply.status, 200);
    assert.match(reply.headers.get('content-type'), new RegExp(type));
    const body = await reply.text();
    assert.equal(/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(body), false, path);
    assert.equal(/(src|href)=["']\/\//.test(body), false, path);
  }
  assert.equal((await fetch(origin + '/preview/other')).status, 404);
});

test('accepted result time t2 is when the complete result is in hand', async t => {
  const clock = clockAt();
  const { f, s, confirm } = setup(t, { now: clock.now });
  clock.t = 100; confirm(); await until(() => f.calls.length === 1);
  clock.t = 200; f.release({ bullets: [] }); await until(() => f.calls.length === 2);
  assert.equal(s.answers.run.t.t2, null, 'a rejected result is not in hand');
  clock.t = 300; f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown');
  assert.equal(s.answers.run.t.t2, 300);
});

test('render time t3 is the report naming this Focus version with shown or general', async t => {
  const clock = clockAt();
  const { f, s, confirm, audits } = setup(t, { now: clock.now });
  clock.t = 10; confirm(); await until(() => f.calls.length === 1);
  s.rendered({ answerFocusVersion: 1, answerStatus: 'shown' });
  assert.equal(named(audits, 'answer_timing').length, 0, 'nothing has been shown yet');
  clock.t = 20; f.release(answerOk()); await until(() => s.answers.proposed.status === 'shown');
  for (const bad of [{ answerFocusVersion: 2, answerStatus: 'shown' }, { answerFocusVersion: 1, answerStatus: 'preparing' }, { answerFocusVersion: 1, answerStatus: 'failed' }]) s.rendered(bad);
  assert.equal(named(audits, 'answer_timing').length, 0);
  clock.t = 30; s.rendered({ answerFocusVersion: 1, answerStatus: 'shown' });
  assert.deepEqual(named(audits, 'answer_timing').map(a => [a.t3, a.delayMs]), [[30, 20]]);
  const live = await liveServer(t);
  const { socket, confirm: confirmLive, events } = await live.open();
  await confirmLive(); await until(() => live.f.calls.length === 1);
  live.f.release(answerOk()); await until(() => events.some(e => e.type === 'proposed'));
  socket.send(JSON.stringify({ type: 'rendered', revision: 1, answerFocusVersion: 1, answerStatus: 'shown' }));
  await until(() => named(live.audits, 'answer_timing').length === 1);
  assert.equal(named(live.audits, 'answer_timing')[0].outcome, 'shown');
  assert.equal(named(live.audits, 'browser_rendered')[0].answerStatus, 'shown');
});

test('speech start is the first voiced packet after t0, or null', async t => {
  const clock = clockAt();
  const { f, s, confirm, audits } = setup(t, { now: clock.now });
  clock.t = 5; s.voiced();
  clock.t = 10; confirm(); await until(() => f.calls.length === 1);
  assert.equal(s.answers.run.t.tS, null);
  clock.t = 40; s.voiced(); clock.t = 50; s.voiced();
  assert.equal(s.answers.run.t.tS, 40);
  confirm('Another question here?'); await until(() => f.calls.length === 2);
  assert.equal(named(audits, 'answer_timing')[0].tS, 40);
  assert.equal(s.answers.run.t.tS, null, 'a new version starts with no speech start');
  const live = await liveServer(t);
  const { socket, confirm: confirmLive, events } = await live.open();
  await confirmLive(); await until(() => live.f.calls.length === 1);
  socket.send(packet(0));
  await new Promise(resolve => setTimeout(resolve, 30));
  socket.send(loudPacket(1));
  live.f.release(answerOk()); await until(() => events.some(e => e.type === 'proposed'));
  socket.send(JSON.stringify({ type: 'rendered', revision: 1, answerFocusVersion: 1, answerStatus: 'shown' }));
  await until(() => named(live.audits, 'answer_timing').length === 1);
  const [timing] = named(live.audits, 'answer_timing');
  assert.equal(typeof timing.tS, 'number');
  assert.equal(timing.pauseMs, timing.tS - timing.t0);
});

test('no poc source outside poc/review names eval-data, nothing outside poc/review imports the reviewer script, and the allowed 404 probe is listed', async () => {
  const root = new URL('.', import.meta.url).pathname;
  const files = [];
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (['node_modules', 'context', 'review', 'docs', 'preview'].includes(entry.name) && dir === root) continue;
      if (entry.isDirectory()) await walk(join(dir, entry.name));
      else if (/\.(mjs|js|sh)$/.test(entry.name)) files.push(join(dir, entry.name));
    }
  };
  await walk(root);
  assert.ok(files.length >= 8);
  const benchmark = 'eval' + '-data';
  const forbidden = [benchmark, 'package' + '-check'];
  const hits = [];
  for (const file of files) {
    for (const line of (await readFile(file, 'utf8')).split('\n')) {
      // Test titles are fixed by the test map and name the folder in words only; the probe is the one allowed use.
      if (forbidden.some(word => line.includes(word)) && !(file === join(root, 'poc.test.mjs') && line.startsWith("test('"))) hits.push(line.trim());
    }
  }
  assert.deepEqual(hits, [`for (const path of ['/poc/.env.local', '/.git/config', '/poc/server.mjs', '/${benchmark}/secret.mp3']) {`]);
});
