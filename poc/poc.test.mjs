import test from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { readFile, readdir, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import vm from 'node:vm';
import WebSocket from 'ws';
import { InterviewSession } from './session.mjs';
import { createPocServer as createRealServer } from './server.mjs';
import { createFixtures } from './fixtures.mjs';
import { loadPackage, DEFAULT_PACKAGE_DIR } from './package-loader.mjs';
import { MeetingLog, createLogStore, DEFAULT_LOG_DIR } from './meeting-log.mjs';
import { readFile as readFileAsync, stat, appendFile } from 'node:fs/promises';
import { createStateMachine, TIMES as AVATAR_TIMES, MOODS as AVATAR_MOODS } from './avatar.js';
import { VENDOR_ASSETS, listenHost } from './server.mjs';
import { createGenerator, answerModel, buildRequest, modelInput, validateResult, INSTRUCTIONS, BULLET_MAX, answerSchema } from './answer.mjs';

// The existing cases never read a real preparation package: every server gets an empty temporary folder.
const noPackage = await mkdtemp(join(tmpdir(), 'alice-nopkg-'));
const noLogs = await mkdtemp(join(tmpdir(), 'alice-nologs-'));
// The fixtures never answer a commit, so Stop would wait the full 3 seconds for the last words (RT5-6); the cases use a short wait.
const createPocServer = (options = {}) => createRealServer({ packageDir: noPackage, logDir: noLogs, revision: 'test', log: () => {}, requirePause: false, drainMs: 40, ...options });

const proposal = (changes = {}) => ({ phase: 'QUESTION', question: 'Tell me about yourself.', intent: 'new-question', evidenceIds: ['one'], ...changes });
const clarify = (question, evidenceIds) => proposal({ intent: 'clarify', question, evidenceIds });
const makeSession = (options = {}) => new InterviewSession({ reason: async () => proposal(), emit: () => {}, delayMs: 0, autoFocus: false, ...options });
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
  const answer = proposal({ phase: 'ANSWER', question: 'Why this company?', evidenceIds: ['two'] });
  assert.equal(s.accept(answer, s.snapshot()), true, 'a result in ANSWER is no longer rejected whole');
  assert.deepEqual([s.state.phase, s.state.live.text, s.state.focus], ['QUESTION', 'Why this company?', null]);
  s.stop();
});

test('controller rejects stale revisions, unknown evidence and corrected text', () => {
  const s = makeSession();
  s.observe('one', 'Tell me about the moon.', false);
  assert.deepEqual(s.snapshot().observations, [], 'words still being transcribed are not in the snapshot (RT5-1)');
  s.observe('one', 'Tell me about your work.', true);
  const current = s.snapshot();
  // A snapshot holds final words only, so one with other words is built by hand; the guard still refuses it.
  assert.equal(s.accept(proposal(), { ...current, observations: [{ ...current.observations[0], text: 'Tell me about the moon.' }] }), false);
  assert.equal(s.lastRejection.reason, 'corrected-evidence');
  assert.equal(s.accept(proposal({ evidenceIds: ['future'] }), current), false);
  assert.equal(s.accept({ note: 'bad schema' }, current), false);
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
  const replies = [proposal({ question: 'Secret question?', evidenceIds: ['future'] }), { note: 'Secret' }];
  const s = makeSession({ audit: (event, data) => audits.push({ event, ...data }), reason: async () => replies.shift() });
  s.observe('one', 'Secret final wording.', true);
  s.schedule(); await until(() => audits.filter(a => a.event === 'agent_finished').length === 1);
  s.schedule(); await until(() => audits.filter(a => a.event === 'agent_finished').length === 2);
  const finished = audits.filter(a => a.event === 'agent_finished');
  assert.deepEqual(finished.map(a => [a.accepted, a.rejection]), [
    [false, { reason: 'unknown-evidence' }], [false, { reason: 'schema', fields: ['phase', 'question', 'intent', 'evidenceIds'] }]]);
  s.observe('two', 'Secret corrected.', true);
  const stale = { ...s.snapshot(), observations: s.snapshot().observations.map(o => (o.id === 'two' ? { ...o, text: 'Secret earlier wording.' } : o)) };
  assert.equal(s.accept(proposal(), stale), false);
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
const answerOk = (changes = {}) => ({ bullets: ['First point.', 'Second point.'], ...changes });
const packageOf = (documents, status = 'usable') => ({ status, documents: status === 'usable' ? documents : [], files: [], chars: 0, skipped: [] });
const docs = () => [{ name: 'a.txt', text: 'Alpha sample text.' }, { name: 'b.md', text: 'Beta sample text.' }];
let obsCount = 0;

// A session wired to a fake generator; `confirm(text)` makes Live and then confirms it through control().
function answering({ generate, pkg, now, timeoutMs } = {}) {
  const events = [], audits = [];
  const s = new InterviewSession({ reason: () => new Promise(() => {}), emit: e => events.push(e), delayMs: 0, autoFocus: false,
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
  for (const absent of [s.id, 'a.txt', 'b.md', 'serverAt']) assert.equal(input.input.includes(absent), false);
  assert.match(INSTRUCTIONS, /never instructions/);
  assert.match(INSTRUCTIONS, /at most three/);
  assert.match(INSTRUCTIONS, /no documents are given, give general points that say nothing about the person/);
  assert.match(INSTRUCTIONS, /Never invent employers, projects, numbers or results/);
});

test('interview agent input never holds an answer or package text', async t => {
  const { f, s, confirm, events } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.release(answerOk({ bullets: ['Bullet sentinel.'] }));
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

test('ST4-33 the result and the proposed message hold bullets and no details', async t => {
  assert.deepEqual(validateResult(answerOk(), { hasDocuments: true }), { ok: true, value: answerOk() });
  const { f, confirm, proposed } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.release(answerOk()); await until(() => proposed().length === 1);
  assert.deepEqual(proposed()[0].proposed.bullets, answerOk().bullets);
  assert.equal('details' in proposed()[0].proposed, false);
});

test('bullets accept one to three single-line items within the length limit', () => {
  const ok = bullets => validateResult({ bullets }, { hasDocuments: false }).ok;
  assert.equal(ok(['one']), true);
  assert.equal(ok(['a', 'b', 'c']), true);
  assert.equal(ok('x'.repeat(BULLET_MAX).split('\n')), true);
  for (const bad of [[], ['a', 'b', 'c', 'd'], ['x'.repeat(BULLET_MAX + 1)], [' padded'], ['padded '], [''], ['two\nlines'], ['tab\there'], [5], 'text']) {
    assert.equal(ok(bad), false, JSON.stringify(bad));
  }
});

test('ST4-32 a result with a details field is rejected whole and no details limit exists', async () => {
  const answer = await import('./answer.mjs');
  assert.equal('DETAILS_MAX' in answer, false);
  assert.equal(validateResult({ bullets: ['a'], details: 'x' }, { hasDocuments: true }).code, 'unknown-field');
  assert.equal(validateResult({ bullets: ['a'], details: '' }, { hasDocuments: false }).ok, false);
  assert.equal(validateResult({ bullets: ['a'] }, { hasDocuments: true }).ok, true);
});

test('malformed or oversized results are rejected whole and never cut', async t => {
  const { f, s, confirm, audits, proposed } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.release(answerOk({ bullets: ['x'.repeat(BULLET_MAX + 1), 'ok'] }));
  await until(() => f.calls.length === 2);
  f.release({ bullets: ['fine'], extra: 'unknown field' });
  await until(() => s.answers.proposed.status === 'failed');
  assert.deepEqual(s.answers.proposed.bullets, []);
  assert.equal(proposed().at(-1).proposed.status, 'failed');
  assert.deepEqual(audits.filter(a => a.name === 'answer_failed').map(a => [a.attempts, a.code]), [[2, 'invalid-result:unknown-field']]);
  assert.equal(validateResult({ bullets: ['x'.repeat(BULLET_MAX + 1)] }, { hasDocuments: false }).ok, false);
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
  assert.deepEqual(keysOf(s.answers.view()), ['bullets', 'focusVersion', 'lastKnown', 'lastStatus', 'reason', 'status']);
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
  assert.deepEqual(events[answer].proposed.bullets, []);
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
    f.release(answerOk());
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
  assert.deepEqual([one.proposed.status, one.proposed.bullets.length], ['shown', 2]);
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
  assert.deepEqual(s.answers.proposed.bullets, []);
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
  const kept = [['shown', answerOk()], ['general', answerOk()], ['failed', null]];
  for (const [status, result] of kept) {
    const w = setup(t, { pkg: packageOf(docs(), status === 'general' ? 'none' : 'usable') });
    w.confirm(); await until(() => w.f.calls.length === 1);
    if (result) w.f.release(result); else { w.f.fail(new Error('x')); await until(() => w.f.calls.length === 2); w.f.fail(new Error('y')); }
    await until(() => w.s.answers.proposed.status === status);
    const content = w.s.answers.view();
    w.s.stop();
    const last = w.s.answers.proposed;
    assert.deepEqual([last.status, last.lastKnown, last.lastStatus, last.bullets, last.reason],
      ['last-known', true, status, content.bullets, content.reason]);
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
  const logDir = await tempDir(t);
  let connects = 0;
  const server = createRealServer({ apiKey: 'sk-test-sentinel', connect: () => { connects += 1; return f.connect(); }, generate: f.generate, packageDir, logDir, revision: 'test',
    audit: (name, data) => audits.push({ name, ...data }), log: line => logs.push(line), reasonDelayMs: 0, requirePause: false, autoFocus: false, drainMs: 40,
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
  return { f, audits, logs, origin, open, health, packageDir, logDir, connects: () => connects, shutdown: () => server.shutdown() };
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
    const server = createRealServer({ apiKey: 'k', logDir: noLogs, log: () => {} });
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
  f.release(answerOk({ bullets: ['Bullet ASENTINEL.'] }));
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

test('guidance is asked only after a one-second pause; no commit or request happens mid-speech', async t => {
  const sent = []; let upstream, asks = 0;
  class Upstream extends EventEmitter {
    readyState = WebSocket.OPEN;
    bufferedAmount = 0;
    constructor() { super(); upstream = this; setImmediate(() => this.emit('open')); }
    send(raw) {
      const event = JSON.parse(raw); sent.push(event);
      if (event.type === 'session.update') setImmediate(() => this.emit('message', Buffer.from('{"type":"session.updated"}')));
    }
    close() { this.readyState = WebSocket.CLOSED; this.emit('close'); }
  }
  const server = createRealServer({ apiKey: 'test-only', connect: () => new Upstream(), audit: () => {}, packageDir: noPackage, logDir: noLogs, log: () => {}, reasonDelayMs: 0,
    reason: async () => { asks += 1; return proposal(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.shutdown());
  const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/session`, { origin: `http://127.0.0.1:${server.address().port}` });
  const events = []; socket.on('message', raw => events.push(JSON.parse(raw)));
  await until(() => events.some(e => e.type === 'ready'));
  const commits = () => sent.filter(e => e.type === 'input_audio_buffer.commit').length;
  const finish = (id, text) => upstream.emit('message', Buffer.from(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: id, transcript: text })));
  let n = 0;
  const send = (loud) => { socket.send(loud ? loudPacket(n) : packet(n)); n += 1; };
  // Twelve seconds of continuous speech: no commit, and a transcript that arrives meanwhile asks nothing.
  for (let i = 0; i < 120; i += 1) send(true);
  await until(() => sent.filter(e => e.type === 'input_audio_buffer.append').length === 120, 3000);
  assert.equal(commits(), 0);
  finish('mid', 'A transcript that arrives while still speaking.');
  await new Promise(r => setTimeout(r, 150));
  assert.equal(asks, 0);
  // Seven silent packets (700 ms) are not yet a pause; the eighth (800 ms) commits.
  for (let i = 0; i < 7; i += 1) send(false);
  await until(() => sent.filter(e => e.type === 'input_audio_buffer.append').length === 127, 3000);
  assert.equal(commits(), 0);
  send(false);
  await until(() => commits() === 1, 3000);
  // The transcript of that turn, arriving during the pause, asks for guidance.
  finish('after', 'The turn that ended with a pause.');
  await until(() => asks === 1, 3000);
  socket.send(JSON.stringify({ type: 'stop' })); await once(socket, 'close');
});

// ---- Contextual interpretation and the automatic one-call flow (fixture package only, never the private one) ----
import { extractTerms, hintPrompt, MAX_TERMS, MAX_HINT_CHARS } from './vocabulary.mjs';
import { readerInput, modelSchema, proposalSchema, READER_INSTRUCTIONS } from './agent.mjs';

const fixturePackage = [{ name: 'brief.md', text: 'Aurora Bank hired Pat for the CIBC project. The CIBC team and the CPPIB team use OpenData daily. Pat led the Harbor Platform work.' }];
const oneCall = (changes = {}) => proposal({ covered: true, bullets: ['Led the Harbor Platform work.', 'Worked with the CIBC team.'], ...changes });

test('vocabulary hints come from the package locally: acronyms, camel-case words and names, ranked and capped', () => {
  const terms = extractTerms(fixturePackage);
  for (const term of ['CIBC', 'CPPIB', 'OpenData', 'Harbor Platform', 'Aurora Bank']) assert.ok(terms.includes(term), term);
  assert.equal(terms[0], 'CIBC', 'the most frequent term comes first');
  assert.deepEqual(extractTerms([]), []);
  const many = [{ name: 'x.txt', text: Array.from({ length: 200 }, (_, i) => `ABC${String.fromCharCode(65 + i % 26)}${i}`).join(' and ') }];
  const capped = extractTerms(many);
  assert.ok(capped.length <= MAX_TERMS && capped.join(', ').length <= MAX_HINT_CHARS);
  assert.equal(hintPrompt([]), undefined);
  assert.match(hintPrompt(['CIBC']), /CIBC/);
});

test('the transcription session gets the vocabulary hint, and none without a usable package', async t => {
  const withPackage = await liveServer(t, { files: { 'a.txt': fixturePackage[0].text } });
  await withPackage.open();
  const update = withPackage.f.upstream().sent.find(e => e.type === 'session.update');
  assert.match(update.session.audio.input.transcription.prompt, /CIBC/);
  const without = await liveServer(t, { files: {} });
  await without.open();
  assert.equal('prompt' in without.f.upstream().sent.find(e => e.type === 'session.update').session.audio.input.transcription, false);
});

test('the question reader receives the package terms and documents; the audit holds only the term count', async t => {
  const seen = [];
  const { open, audits } = await liveServer(t, { files: { 'a.txt': fixturePackage[0].text },
    reason: async (snapshot, signal, context) => { seen.push(context); return proposal({ phase: 'GREETINGS', question: null, evidenceIds: [] }); } });
  await open();
  await until(() => seen.length > 0);
  assert.deepEqual(seen[0].documents, [{ name: 'a.txt', text: fixturePackage[0].text }]);
  assert.ok(seen[0].terms.includes('CIBC'));
  const loaded = named(audits, 'package_loaded')[0];
  assert.equal(typeof loaded.terms, 'number');
  assert.equal(JSON.stringify(audits).includes('Harbor'), false);
});

test('reader input is the bare snapshot without context and carries the package as reference material with it', () => {
  const snapshot = { sessionId: 's', observations: [] };
  assert.equal(readerInput(snapshot), JSON.stringify(snapshot));
  const input = JSON.parse(readerInput(snapshot, { terms: ['CIBC'], documents: fixturePackage }));
  assert.deepEqual(input.preparationPackage, { terms: ['CIBC'], documents: fixturePackage });
  assert.deepEqual(Object.keys(modelSchema.shape).sort(), ['bullets', 'covered', 'evidenceIds', 'intent', 'phase', 'question']);
  assert.equal(proposalSchema.safeParse(proposal()).success, true, 'a reading without an answer stays valid');
});

test('automatic flow: a clear question after a pause becomes Focus and its answer shows from the same call', () => {
  const f = createFixtures(), events = [];
  const s = new InterviewSession({ reason: async () => proposal(), emit: e => events.push(e), delayMs: 0, generate: f.generate });
  s.answers.setPackage(packageOf(fixturePackage));
  s.observe('o1', 'Tell me about CIBC.', true);
  assert.equal(s.accept(oneCall({ question: 'Tell me about CIBC.', evidenceIds: ['o1'] }), s.snapshot()), true);
  assert.deepEqual([s.state.focus, s.state.focusVersion, s.state.live.text, s.state.phase], ['Tell me about CIBC.', 1, 'Tell me about CIBC.', 'QUESTION']);
  assert.equal(f.calls.length, 0, 'no second model call');
  const answer = events.filter(e => e.type === 'answer').at(-1);
  assert.deepEqual([answer.proposed.status, answer.proposed.focusVersion, answer.proposed.bullets.length, answer.proposed.reason], ['shown', 1, 2, null]);
  s.stop();
});

test('automatic flow: a repeated question, an unrelated reading and speech already used change nothing', () => {
  const s = makeSession({ autoFocus: true });
  s.answers.setPackage(packageOf(fixturePackage));
  s.observe('o1', 'Tell me about CIBC.', true);
  s.accept(oneCall({ question: 'Tell me about CIBC.', evidenceIds: ['o1'] }), s.snapshot());
  const shown = s.answers.view();
  s.observe('o2', 'Tell me about CIBC.', true);
  s.accept(oneCall({ question: 'Tell me about CIBC.', evidenceIds: ['o2'] }), s.snapshot());
  assert.deepEqual([s.state.focusVersion, s.answers.view()], [1, shown], 'same wording keeps the answer');
  s.observe('o3', 'Mm, right.', true);
  s.accept(proposal({ intent: 'none', question: null, evidenceIds: ['o3'] }), s.snapshot());
  assert.deepEqual([s.state.focus, s.state.focusVersion, s.answers.view()], ['Tell me about CIBC.', 1, shown], 'no question: the last good answer stays');
  s.accept(oneCall({ question: 'Something else?', evidenceIds: ['o1'] }), s.snapshot());
  assert.equal(s.state.focusVersion, 1, 'cited speech was already used');
  s.stop();
});

test('automatic flow: a later pause replaces the earlier reading, and covered false gives a general answer', () => {
  const s = makeSession({ autoFocus: true });
  s.answers.setPackage(packageOf(fixturePackage));
  s.observe('o1', 'Tell me about the BBC.', true);
  s.accept(oneCall({ question: 'Tell me about the BBC.', evidenceIds: ['o1'] }), s.snapshot());
  s.observe('o2', 'I said CIBC. Tell me about CIBC.', true);
  s.accept(oneCall({ intent: 'clarify', question: 'Tell me about CIBC.', evidenceIds: ['o2'], covered: false }), s.snapshot());
  const view = s.answers.view();
  assert.deepEqual([s.state.focus, s.state.focusVersion, s.state.exchangeId, view.status, view.reason], ['Tell me about CIBC.', 2, 1, 'general', 'not-covered']);
  s.stop();
});

test('automatic flow: an invalid answer in the one call falls back to the separate answer request', async () => {
  const f = createFixtures();
  const s = new InterviewSession({ reason: async () => proposal(), emit: () => {}, delayMs: 0, generate: f.generate });
  s.answers.setPackage(packageOf(fixturePackage));
  s.observe('o1', 'Tell me about CIBC.', true);
  s.accept(oneCall({ question: 'Tell me about CIBC.', evidenceIds: ['o1'], bullets: [] }), s.snapshot());
  assert.equal(s.answers.view().status, 'preparing');
  await until(() => f.calls.length === 1);
  s.stop();
});

test('ST4-31 the reader call asks for bullets only in its instructions and reply schema', () => {
  assert.doesNotMatch(READER_INSTRUCTIONS, /details/i);
  assert.match(READER_INSTRUCTIONS, /covered and bullets/);
  assert.equal('details' in modelSchema.shape, false);
});

test('ST4-32 a reader reply with a details field gives its reading but not its answer, which falls back', async () => {
  const f = createFixtures();
  const s = new InterviewSession({ reason: async () => proposal(), emit: () => {}, delayMs: 0, generate: f.generate });
  s.answers.setPackage(packageOf(fixturePackage));
  s.observe('o1', 'Tell me about CIBC.', true);
  s.accept(oneCall({ question: 'Tell me about CIBC.', evidenceIds: ['o1'], details: 'extra' }), s.snapshot());
  assert.equal(s.state.focus, 'Tell me about CIBC.');
  assert.equal(s.answers.view().status, 'preparing');
  await until(() => f.calls.length === 1);
  s.stop();
});

test('ST4-38 the fallback request asks for bullets only', () => {
  assert.doesNotMatch(INSTRUCTIONS, /details/i);
  assert.equal(answerSchema.safeParse({ bullets: ['a'] }).success, true);
  assert.equal(answerSchema.safeParse({ bullets: ['a'], details: 'x' }).success, false);
});

test('ST4-39 a fallback result with a details field is rejected whole', async t => {
  const { f, s, confirm, audits } = setup(t);
  confirm(); await until(() => f.calls.length === 1);
  f.release({ bullets: ['fine'], details: 'x' }); await until(() => f.calls.length === 2);
  f.release({ bullets: ['fine'], details: 'x' });
  await until(() => s.answers.proposed.status === 'failed');
  assert.deepEqual(audits.filter(a => a.name === 'answer_failed').map(a => a.code), ['invalid-result:unknown-field']);
});

// SPRINT-004: package status, upload and Remove (ST4-01 to ST4-08, ST4-29, ST4-35 to ST4-37, ST4-40).
const putPackage = (ctx, body, { headers = {}, raw } = {}) => fetch(ctx.origin + '/package', { method: 'PUT',
  headers: { 'Content-Type': 'application/json', Origin: ctx.origin, ...headers }, body: raw ?? JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
const getPackage = ctx => fetch(ctx.origin + '/package').then(r => r.json());
const deletePackage = ctx => fetch(ctx.origin + '/package', { method: 'DELETE', headers: { Origin: ctx.origin } }).then(async r => ({ status: r.status, body: await r.json() }));
const upload = (...files) => ({ files: files.map(([name, text]) => ({ name, text })) });

test('GET package returns source, counts and terms but no text', async t => {
  const none = await liveServer(t);
  assert.deepEqual(await getPackage(none), { source: 'none', status: 'none', files: 0, chars: 0, terms: 0 });
  const ctx = await liveServer(t, { files: { 'a.md': 'Worked at CIBC on TrustCore.', 'b.txt': 'More text.' } });
  const status = await getPackage(ctx);
  assert.deepEqual([status.source, status.status, status.files, status.chars], ['folder', 'usable', 2, 38]);
  assert.ok(status.terms >= 1);
  assert.deepEqual(Object.keys(status).sort(), ['chars', 'files', 'source', 'status', 'terms']);
  assert.ok(!JSON.stringify(status).includes('CIBC') && !JSON.stringify(status).includes('a.md'));
});

test('PUT package loads several md and txt files and replaces the package', async t => {
  const ctx = await liveServer(t, { files: { 'old.md': 'Folder text.' } });
  const first = await putPackage(ctx, upload(['b.md', 'Hello CIBC'], ['a.txt', 'World'], ['README.md', 'skip me'], ['.hidden.md', 'x'], ['pic.png', 'x']));
  assert.equal(first.status, 200);
  assert.deepEqual([first.body.result, first.body.reason, first.body.package.source, first.body.package.files, first.body.package.chars], ['loaded', null, 'uploaded', 2, 15]);
  assert.deepEqual(first.body.skipped.map(s => s.name).sort(), ['.hidden.md', 'README.md', 'pic.png']);
  const second = await putPackage(ctx, upload(['c.md', 'Only this.']));
  assert.deepEqual([second.body.package.files, second.body.package.chars], [1, 10]);
  assert.deepEqual(await getPackage(ctx), second.body.package);
});

test('upload limits for body, files, types, names, README and total characters', async t => {
  const ctx = await liveServer(t);
  const many = upload(...Array.from({ length: 21 }, (_, i) => [`f${i}.md`, 'x']));
  assert.equal((await putPackage(ctx, many)).body.reason, 'too-many-files');
  assert.equal((await putPackage(ctx, upload(...Array.from({ length: 20 }, (_, i) => [`f${i}.md`, 'x'])))).body.result, 'loaded');
  const big = await putPackage(ctx, upload(['a.md', 'a'.repeat(10001)], ['b.md', 'b'.repeat(10000)]));
  assert.deepEqual([big.status, big.body.reason, big.body.chars], [422, 'too-large', 20001]);
  assert.equal((await putPackage(ctx, upload(['a.md', 'a'.repeat(10000)], ['b.md', 'b'.repeat(10000)]))).body.result, 'loaded');
  const huge = await putPackage(ctx, null, { raw: JSON.stringify(upload(['a.md', 'x'.repeat(210000)])) });
  assert.deepEqual([huge.status, huge.body.reason], [413, 'body-too-large']);
  assert.equal((await putPackage(ctx, upload(['README.md', 'x'], ['n.png', 'x']))).body.reason, 'empty');
  assert.equal((await putPackage(ctx, upload(['a.md', '  \n']))).body.reason, 'empty');
  assert.equal((await putPackage(ctx, null, { raw: 'not json' })).body.reason, 'refused');
  assert.equal((await putPackage(ctx, { files: 'nope' })).body.reason, 'refused');
});

test('refused upload keeps the previous package and gives its reason', async t => {
  const ctx = await liveServer(t);
  const good = (await putPackage(ctx, upload(['keep.md', 'Keep this text.']))).body.package;
  for (const body of [upload(['x.md', 'a'.repeat(20001)]), upload(['../x.md', 'a']), upload(['x.md', 'bad�']), { files: [] }]) {
    const refused = await putPackage(ctx, body);
    assert.equal(refused.body.result, 'refused');
    assert.ok(refused.body.reason);
    assert.deepEqual(refused.body.package, good);
    assert.deepEqual(await getPackage(ctx), good);
  }
});

test('upload while listening is refused with the listening reason', async t => {
  const ctx = await liveServer(t, { files: { 'a.md': 'Folder text.' } });
  const before = await getPackage(ctx);
  const session = await ctx.open();
  const refused = await putPackage(ctx, upload(['x.md', 'new']));
  assert.deepEqual([refused.status, refused.body.result, refused.body.reason], [409, 'refused', 'listening']);
  assert.deepEqual(await getPackage(ctx), before);
  session.socket.close();
});

test('uploaded package survives Stop and is replaced by the next upload', async t => {
  const ctx = await liveServer(t);
  await putPackage(ctx, upload(['one.md', 'First package about CIBC.']));
  const session = await ctx.open();
  assert.equal(ctx.audits.find(a => a.name === 'package_loaded').source, 'uploaded', 'the session takes the uploaded package at Start');
  session.socket.send(JSON.stringify({ type: 'stop' }));
  await until(async () => (await ctx.health()).sessions === 0);
  assert.deepEqual((await getPackage(ctx)).source, 'uploaded');
  const next = await putPackage(ctx, upload(['two.md', 'Second.']));
  assert.deepEqual([next.status, next.body.package.files, next.body.package.chars], [200, 1, 7]);
});

test('package text is never returned, written or logged, and no uploaded file name reaches the audit or console', async t => {
  const sentinel = 'SENTINEL-PACKAGE-TEXT-7731';
  const ctx = await liveServer(t);
  const loaded = await putPackage(ctx, upload(['secret-name.md', `Alice ${sentinel} details.`], ['skipped-secret.pdf', 'x'], ['README.md', 'y']));
  assert.deepEqual(loaded.body.skipped.map(s => s.name).sort(), ['README.md', 'skipped-secret.pdf'], 'names appear only in the answer to the page');
  assert.ok(!JSON.stringify(loaded.body).includes(sentinel));
  assert.ok(!JSON.stringify(await getPackage(ctx)).includes(sentinel));
  const session = await ctx.open();
  session.socket.close();
  await new Promise(r => setTimeout(r, 60));
  assert.ok(!JSON.stringify(ctx.audits).includes(sentinel) && !ctx.logs.join('\n').includes(sentinel));
  assert.ok(!JSON.stringify(session.events).includes(sentinel));
  // SU-9: counts and reasons only; no name of an uploaded file, kept or skipped, in the audit or on the console.
  for (const name of ['secret-name', 'skipped-secret', 'README.md']) {
    assert.ok(!JSON.stringify(ctx.audits).includes(name), `audit holds ${name}`);
    assert.ok(!ctx.logs.join('\n').includes(name), `console holds ${name}`);
  }
  const started = named(ctx.audits, 'package_loaded')[0];
  assert.deepEqual([started.source, started.files, started.skipped, started.chars > 0], ['uploaded', 1, 2, true]);
  assert.ok(ctx.logs.some(line => /^package: status=usable files=1 chars=\d+ skipped=2$/.test(line)), ctx.logs.join(' | '));
  assert.deepEqual(await readdir(ctx.packageDir), [], 'nothing is written to the package folder');
  // PK-9 is unchanged: the folder package's start-up audit keeps its names.
  const folder = await liveServer(t, { files: { 'folder-name.txt': 'Folder text.', 'README.md': 'not used' } });
  (await folder.open()).socket.close();
  await new Promise(r => setTimeout(r, 60));
  const fromFolder = named(folder.audits, 'package_loaded')[0];
  assert.deepEqual([fromFolder.source, fromFolder.files.map(f => f.name), fromFolder.skipped], ['folder', ['folder-name.txt'], ['README.md']]);
});

test('package and log routes refuse a wrong Host or Origin', async t => {
  const ctx = await liveServer(t);
  const port = new URL(ctx.origin).port;
  const call = (method, headers, path = '/package') => new Promise(resolve => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', () => resolve('error')); req.end(method === 'PUT' ? JSON.stringify(upload(['a.md', 'x'])) : undefined);
  });
  const json = { 'Content-Type': 'application/json' };
  assert.equal(await call('GET', { Host: 'evil.test' }), 403);
  assert.equal(await call('GET', { Host: `127.0.0.1:${port}`, Origin: 'http://evil.test' }), 403);
  assert.equal(await call('PUT', { ...json, Host: `127.0.0.1:${port}`, Origin: 'http://evil.test' }), 403);
  assert.equal(await call('PUT', { ...json, Host: `127.0.0.1:${port}` }), 403, 'a change without an Origin is refused');
  assert.equal(await call('DELETE', { Host: `127.0.0.1:${port}`, Origin: 'http://evil.test' }), 403);
  assert.equal(await call('PUT', { ...json, Host: `127.0.0.1:${port}`, Origin: ctx.origin }), 200);
  assert.equal(await call('GET', { Host: 'evil.test' }, '/log'), 403);
});

test('DELETE package clears the loaded package, folder one included, until restart and is refused while listening', async t => {
  const ctx = await liveServer(t, { files: { 'a.md': 'Folder text.' } });
  assert.equal((await getPackage(ctx)).source, 'folder');
  const session = await ctx.open();
  const refused = await deletePackage(ctx);
  assert.deepEqual([refused.status, refused.body.reason], [409, 'listening']);
  session.socket.send(JSON.stringify({ type: 'stop' }));
  await until(async () => (await ctx.health()).sessions === 0);
  const removed = await deletePackage(ctx);
  assert.deepEqual([removed.status, removed.body.result, removed.body.package.source], [200, 'removed', 'none']);
  assert.deepEqual(await getPackage(ctx), { source: 'none', status: 'none', files: 0, chars: 0, terms: 0 });
  await putPackage(ctx, upload(['u.md', 'Uploaded.']));
  assert.equal((await deletePackage(ctx)).body.package.source, 'none', 'Remove clears an uploaded package and the folder one stays cleared');
});

test('a name with a slash, backslash, dot-dot, drive letter, control character or over 255 characters refuses the whole upload as refused and names the file', async t => {
  const ctx = await liveServer(t);
  const good = (await putPackage(ctx, upload(['keep.md', 'Keep.']))).body.package;
  for (const name of ['a/b.md', 'a\\b.md', '..md', 'x..y.md', 'C:evil.md', 'bad\u0001.md', 'nul\u0000.md', `${'n'.repeat(256)}.md`]) {
    const refused = await putPackage(ctx, upload(['fine.md', 'ok'], [name, 'x']));
    assert.deepEqual([refused.status, refused.body.result, refused.body.reason], [400, 'refused', 'refused'], JSON.stringify(name));
    assert.equal(refused.body.name, name.slice(0, 80));
    assert.deepEqual(refused.body.package, good);
  }
});

test('an upload without the JSON content type is refused as content-type', async t => {
  const ctx = await liveServer(t);
  for (const type of ['text/plain', 'multipart/form-data', 'application/zip', '']) {
    const refused = await putPackage(ctx, null, { headers: { 'Content-Type': type }, raw: JSON.stringify(upload(['a.md', 'x'])) });
    assert.deepEqual([refused.status, refused.body.reason], [415, 'content-type'], type);
  }
  assert.equal((await putPackage(ctx, upload(['a.md', 'x']), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })).body.result, 'loaded');
});

test('text holding U+FFFD or NUL is refused as unreadable', async t => {
  const ctx = await liveServer(t);
  for (const text of ['broken � text', 'nul \u0000 text']) {
    const refused = await putPackage(ctx, upload(['good.md', 'fine'], ['bad.md', text]));
    assert.deepEqual([refused.status, refused.body.reason, refused.body.name], [422, 'unreadable', 'bad.md']);
  }
  assert.equal((await getPackage(ctx)).status, 'none');
});

test('after a restart the status shows the folder package or no package', async t => {
  const ctx = await liveServer(t, { files: { 'a.md': 'Folder text.' } });
  await deletePackage(ctx);
  await putPackage(ctx, upload(['u.md', 'Uploaded.']));
  assert.equal((await getPackage(ctx)).source, 'uploaded');
  const again = await liveServer(t, { packageDir: ctx.packageDir });
  assert.deepEqual([(await getPackage(again)).source, (await getPackage(again)).files], ['folder', 1]);
  const empty = await liveServer(t);
  assert.equal((await getPackage(empty)).source, 'none');
});

// SPRINT-004: the meeting log and its download (ST4-09 to ST4-28, ST4-30, ST4-34, ST4-41, ST4-42, ST4-11).
const getLog = ctx => fetch(ctx.origin + '/log');
const readLines = async ctx => {
  const res = await getLog(ctx);
  assert.equal(res.status, 200);
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line));
};
const stopped = async (ctx, session) => {
  session.socket.send(JSON.stringify({ type: 'stop' }));
  await until(async () => true);
  await until(() => ctx.audits.some(a => a.name === 'session_stopped'));
};
const sendPackets = async (session, voiced, from, count) => {
  for (let i = from; i < from + count; i += 1) session.socket.send(voiced ? loudPacket(i) : packet(i));
  await new Promise(r => setTimeout(r, 40));
};
const control = (session, message) => session.socket.send(JSON.stringify({ sessionId: session.sessionId, ...message }));
const typesOf = lines => lines.map(l => l.type);

test('GET log returns the current log with its headers, complete lines only', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  const res = await getLog(ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="alice-meeting-\d{8}T\d{6}Z\.jsonl"$/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.ok((await res.text()).endsWith('\n'));
  await stopped(ctx, session);
  const name = (await readdir(ctx.logDir)).find(n => n.endsWith('.jsonl'));
  await appendFile(join(ctx.logDir, name), '{"t":"partial');
  const text = await (await getLog(ctx)).text();
  assert.ok(text.endsWith('\n') && !text.includes('partial'), 'an unfinished line is left out');
  assert.ok(text.split('\n').filter(Boolean).every(line => JSON.parse(line).type));
});

test('GET log answers 404 with no log', async t => {
  const ctx = await liveServer(t);
  const res = await getLog(ctx);
  assert.deepEqual([res.status, await res.text()], [404, 'No meeting log yet.']);
});

test('transcript message is a replace-whole snapshot of the last 30 seconds with item ids and ms offsets within limits', () => {
  const clock = clockAt(); const sent = [];
  const s = makeSession({ now: clock.now, emit: m => sent.push(m) });
  const last = () => sent.filter(m => m.type === 'transcript').at(-1);
  s.observe('one', 'First item.', true);
  clock.t = 5000; s.observe('two', 'Second', false);
  clock.t = 6000; s.observe('two', ' still going', false);
  assert.deepEqual(last().items.map(i => [i.id, i.text, i.final, i.at]), [['one', 'First item.', true, 0], ['two', 'Second still going', false, 5000]]);
  clock.t = 31000; s.observe('three', 'Third.', true);
  assert.deepEqual(last().items.map(i => i.id), ['two', 'three'], 'items older than 30 seconds leave the snapshot');
  for (let i = 0; i < 12; i += 1) { clock.t += 100; s.observe(`n${i}`, `Item ${i}.`, true); }
  assert.ok(last().items.length <= 8);
  clock.t += 100; s.observe('long', 'x'.repeat(2000), true);
  const total = last().items.reduce((sum, i) => sum + i.text.length, 0);
  assert.ok(total <= 1500 && last().items.at(-1).id === 'long');
  assert.ok(last().items.every(i => Number.isInteger(i.at) && typeof i.final === 'boolean'));
  s.stop();
});

test('log starts with log_started holding the version and every line has time, ms and type', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  ctx.f.say('Why this company?');
  await until(() => session.events.some(e => e.live));
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  assert.equal(lines[0].type, 'log_started');
  assert.equal(lines[0].version, 1);
  assert.deepEqual(lines.filter(l => 'version' in l && l.type !== 'live_question').map(l => l.type), ['log_started'], 'the schema version is in the first line only');
  for (const l of lines) {
    assert.match(l.t, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(Number.isFinite(l.ms) && l.ms >= 0 && typeof l.type === 'string');
  }
});

test('session stop event with its reason and seconds, and no separate session_started', async t => {
  const ctx = await liveServer(t);
  const one = await ctx.open();
  await sendPackets(one, false, 0, 20);
  await stopped(ctx, one);
  let lines = await readLines(ctx);
  assert.ok(!typesOf(lines).includes('session_started'));
  assert.deepEqual([lines.at(-1).type, lines.at(-1).reason, lines.at(-1).seconds], ['session_stopped', 'user', 2]);
  ctx.audits.length = 0;
  const two = await ctx.open();
  two.socket.close();
  await until(() => ctx.audits.some(a => a.name === 'session_stopped'));
  lines = await readLines(ctx);
  assert.equal(lines.at(-1).reason, 'disconnect');
  const three = await ctx.open();
  ctx.audits.length = 0;
  ctx.f.upstream().emit('message', Buffer.from(JSON.stringify({ type: 'error', error: { code: 'x' } })));
  await until(() => ctx.audits.some(a => a.name === 'session_stopped'));
  lines = await readLines(ctx);
  assert.equal(lines.at(-1).reason, 'error');
  assert.ok(three);
});

test('speech start and pause events for silences of 800 ms or more', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  await sendPackets(session, true, 0, 5);
  await sendPackets(session, false, 5, 7);
  await sendPackets(session, true, 12, 2);
  await sendPackets(session, false, 14, 10);
  await sendPackets(session, true, 24, 1);
  await stopped(ctx, session);
  const lines = (await readLines(ctx)).filter(l => ['speech_start', 'pause'].includes(l.type));
  assert.deepEqual(lines.map(l => l.type), ['speech_start', 'pause', 'speech_start']);
  const pause = lines.find(l => l.type === 'pause');
  assert.deepEqual([pause.startMs, pause.durationMs], [1400, 1000]);
});

test('only final transcript items are logged', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  ctx.f.upstream().emit('message', Buffer.from(JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'p1', delta: 'PARTIAL-ONLY-TEXT' })));
  ctx.f.say('A final sentence about the project.');
  await until(() => session.events.some(e => e.type === 'transcript' && e.final));
  await stopped(ctx, session);
  const text = JSON.stringify(await readLines(ctx));
  assert.ok(!text.includes('PARTIAL-ONLY-TEXT'));
  const items = (await readLines(ctx)).filter(l => l.type === 'transcript');
  assert.equal(items.length, 1);
  assert.deepEqual([items[0].text, typeof items[0].itemId, Number.isInteger(items[0].audioStartMs), Number.isInteger(items[0].audioEndMs)], ['A final sentence about the project.', 'string', true, true]);
});

test('live question and cleared events', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  ctx.f.say('Why this company?');
  await until(() => session.events.some(e => e.live));
  const { live } = session.events.find(e => e.live);
  control(session, { type: 'question.reset', requestId: 'r1', via: 'escape' });
  await until(() => session.events.some(e => e.type === 'question.result'));
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  const q = lines.find(l => l.type === 'live_question');
  assert.deepEqual([q.liveId, q.version, q.kind, q.text], [live.id, 1, 'new', 'Why this company?']);
  assert.deepEqual(lines.find(l => l.type === 'live_cleared').by, 'clear');
});

test('focus changes log their source', async t => {
  const auto = await liveServer(t, { autoFocus: true });
  const one = await auto.open();
  auto.f.say('Tell me about your last project.');
  await until(() => one.events.some(e => e.focusVersion === 1));
  await stopped(auto, one);
  const focus = (await readLines(auto)).find(l => l.type === 'focus_changed');
  assert.deepEqual([focus.source, focus.focusVersion, focus.text, typeof focus.exchangeId], ['pause', 1, 'Tell me about your last project.', 'number']);
  const manual = await liveServer(t);
  const two = await manual.open();
  await two.confirm('First question here?');
  await stopped(manual, two);
  assert.equal((await readLines(manual)).find(l => l.type === 'focus_changed').source, 'confirm-button');
});

test('confirm and clear controls log how they were used: button, space or escape', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  const say = async text => { const n = session.events.filter(e => e.live).length; ctx.f.say(text); await until(() => session.events.filter(e => e.live).length > n); return session.events.filter(e => e.live).at(-1); };
  let e = await say('First question here?');
  control(session, { type: 'question.confirm', requestId: 'c1', via: 'space', liveId: e.live.id, liveVersion: e.live.version, expectedFocusVersion: e.focusVersion, text: e.live.text });
  await until(() => session.events.some(m => m.requestId === 'c1'));
  e = await say('Second question there?');
  control(session, { type: 'question.reset', requestId: 'c2', via: 'escape' });
  await until(() => session.events.some(m => m.requestId === 'c2'));
  control(session, { type: 'question.confirm', requestId: 'c3', liveId: 'nope', liveVersion: 1, expectedFocusVersion: 1, text: 'x' });
  await until(() => session.events.some(m => m.requestId === 'c3'));
  await stopped(ctx, session);
  const controls = (await readLines(ctx)).filter(l => l.type === 'control');
  assert.deepEqual(controls.map(c => [c.control, c.via, c.result]), [['confirm', 'space', 'confirmed'], ['clear', 'escape', 'reset'], ['confirm', 'button', 'invalid']]);
  assert.equal((await readLines(ctx)).find(l => l.type === 'focus_changed').source, 'confirm-space');
});

test('answer shown, failed and dropped events', async t => {
  const ctx = await liveServer(t, { files: { 'a.md': 'Some package text.' } });
  const session = await ctx.open();
  await session.confirm('First question here?');
  await until(() => ctx.f.waiting() === 1);
  await session.confirm('Second question there?');
  await until(() => ctx.f.waiting() === 1);
  ctx.f.release(answerOk({ bullets: ['Quoted bullet one.', 'Bullet two.'] }));
  await until(() => session.events.some(e => e.type === 'proposed' && e.proposed.status === 'shown'));
  await session.confirm('Third question here?');
  await until(() => ctx.f.waiting() === 1);
  ctx.f.fail(); await until(() => ctx.f.waiting() === 1); ctx.f.fail();
  await until(() => session.events.some(e => e.type === 'proposed' && e.proposed.status === 'failed'));
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  const shown = lines.find(l => l.type === 'answer_shown');
  assert.deepEqual([shown.focusVersion, shown.status, shown.bullets, Number.isFinite(shown.delayMs)], [2, 'shown', ['Quoted bullet one.', 'Bullet two.'], true]);
  assert.equal(lines.find(l => l.type === 'answer_dropped').reason, 'stale-version');
  assert.deepEqual([lines.find(l => l.type === 'answer_failed').focusVersion, lines.find(l => l.type === 'answer_failed').attempts], [3, 2]);
  assert.ok(!JSON.stringify(lines.filter(l => l.type === 'answer_failed')).includes('fixture failure'));
});

test('package and upload events hold counts and no names', async t => {
  const ctx = await liveServer(t, { files: { 'secret-resume-name.md': 'Worked at ExampleCorp on TrustCore.', 'notes-file.txt': 'More.' } });
  const session = await ctx.open();
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  const pkg = lines.find(l => l.type === 'package');
  assert.deepEqual([pkg.source, pkg.status, pkg.files, pkg.chars, typeof pkg.terms, pkg.skipped], ['folder', 'usable', 2, 40, 'number', 0]);
  assert.deepEqual(lines[0].package, { source: 'folder', status: 'usable', files: 2, chars: 40, terms: pkg.terms });
  const text = JSON.stringify(lines);
  assert.ok(!text.includes('secret-resume-name') && !text.includes('notes-file'));
  const up = await liveServer(t);
  await putPackage(up, upload(['named-upload.md', 'Uploaded text.']));
  const two = await up.open();
  await stopped(up, two);
  const upLines = await readLines(up);
  assert.equal(upLines.find(l => l.type === 'package').source, 'uploaded');
  assert.ok(!JSON.stringify(upLines).includes('named-upload'));
});

test('error events hold the public message', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  ctx.f.upstream().emit('message', Buffer.from(JSON.stringify({ type: 'error', error: { status: 429, message: 'SECRET-PROVIDER-DETAIL' } })));
  await until(() => session.events.some(e => e.type === 'status' && /OpenAI|rate|request/i.test(e.status)));
  await until(() => ctx.audits.some(a => a.name === 'session_stopped'));
  const shown = session.events.filter(e => e.type === 'status').at(-1).status;
  const lines = await readLines(ctx);
  const error = lines.find(l => l.type === 'error');
  assert.equal(error.message, shown);
  assert.ok(error.code);
  assert.ok(!JSON.stringify(lines).includes('SECRET-PROVIDER-DETAIL'));
});

test('log never holds the key, prompts, replies, package text or audio', async t => {
  const ctx = await liveServer(t, { files: { 'a.md': 'Package sentence SENTINEL-PKG-9917 about Harbor Platform.' },
    reason: async snapshot => proposal({ reply: 'SENTINEL-AGENT-REPLY', question: snapshot.observations.at(-1)?.text ?? null, evidenceIds: snapshot.observations.map(o => o.id) }) });
  const session = await ctx.open();
  await sendPackets(session, true, 0, 3);
  await session.confirm('Tell me about Harbor Platform.');
  await until(() => ctx.f.waiting() === 1);
  ctx.f.release(answerOk({ bullets: ['A point.'] }));
  await until(() => session.events.some(e => e.type === 'proposed' && e.proposed.status === 'shown'));
  await stopped(ctx, session);
  const text = (await (await getLog(ctx)).text());
  for (const banned of ['sk-test-sentinel', 'SENTINEL-PKG-9917', 'SENTINEL-AGENT-REPLY', 'Names and terms that may be spoken', 'Invented details', 'instructions', 'audio/pcm']) assert.ok(!text.includes(banned), banned);
  const base64 = Buffer.from(loudPacket(0).subarray(8)).toString('base64').slice(0, 40);
  assert.ok(!text.includes(base64));
});

test('log is complete and ordered, and a write failure does not stop the session', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  for (let i = 0; i < 6; i += 1) { ctx.f.say(`Sentence number ${i} here.`); await new Promise(r => setTimeout(r, 5)); }
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  assert.equal(lines.filter(l => l.type === 'transcript').length, 6);
  assert.ok(lines.every((l, i) => i === 0 || l.ms >= lines[i - 1].ms), 'ms never goes back');
  assert.ok(lines.every((l, i) => i === 0 || l.t >= lines[i - 1].t));
  const blocker = join(await tempDir(t), 'file-not-folder');
  await writeFile(blocker, 'x');
  const broken = await liveServer(t, { logDir: join(blocker, 'logs') });
  const second = await broken.open();
  await until(() => second.events.some(e => e.type === 'log' && e.status === 'not saved'));
  await sendPackets(second, true, 0, 3);
  broken.f.say('Still working?');
  await until(() => second.events.some(e => e.type === 'transcript' && e.final));
  assert.ok(second.events.some(e => e.type === 'ready'));
  assert.equal((await getLog(broken)).status, 404);
  // A slow disk never holds the caller: 50 writes return at once and still land in order.
  const dir = await tempDir(t);
  const log = new MeetingLog({ dir, sessionId: 'abcdef012345' });
  await log.chain;
  const append = log.handle.appendFile.bind(log.handle);
  log.handle.appendFile = async line => { await new Promise(r => setTimeout(r, 5)); return append(line); };
  const start = performance.now();
  for (let i = 0; i < 50; i += 1) log.write('event', { i });
  assert.ok(performance.now() - start < 50, 'write returns without waiting for the disk');
  await log.close();
  const written = (await readFileAsync(log.path, 'utf8')).trim().split('\n').map(l => JSON.parse(l).i);
  assert.deepEqual(written, Array.from({ length: 50 }, (_, i) => i));
});

test('log folder defaults to poc/logs, is moved by a setting and file names follow the pattern', async t => {
  assert.ok(DEFAULT_LOG_DIR.replace(/\\/g, '/').endsWith('/poc/logs/'));
  const moved = await tempDir(t);
  const before = process.env.ALICE_LOG_DIR;
  process.env.ALICE_LOG_DIR = moved;
  try { assert.equal(createLogStore().dir, moved); } finally { if (before === undefined) delete process.env.ALICE_LOG_DIR; else process.env.ALICE_LOG_DIR = before; }
  const ctx = await liveServer(t);
  const session = await ctx.open();
  await stopped(ctx, session);
  const [name] = (await readdir(ctx.logDir)).filter(n => n.endsWith('.jsonl'));
  assert.match(name, /^meeting-\d{8}T\d{6}Z-[0-9a-f]{8}\.jsonl$/);
  assert.equal(name.slice(-14, -6), session.sessionId.slice(0, 8));
});

test('log folder and files have modes 0700 and 0600', async t => {
  const dir = join(await tempDir(t), 'fresh', 'logs');
  const ctx = await liveServer(t, { logDir: dir });
  const session = await ctx.open();
  await stopped(ctx, session);
  assert.equal((await stat(dir)).mode & 0o777, 0o700);
  const [name] = (await readdir(dir)).filter(n => n.endsWith('.jsonl'));
  assert.equal((await stat(join(dir, name))).mode & 0o777, 0o600);
});

test('a log is complete up to its cap and then ends with one log_full event', async t => {
  const dir = await tempDir(t);
  const log = new MeetingLog({ dir, sessionId: 'fedcba987654', maxBytes: 1500 });
  for (let i = 0; i < 100; i += 1) log.write('transcript', { itemId: `i${i}`, text: 'Sample words for the cap.', n: i });
  await log.close();
  const lines = (await readFileAsync(log.path, 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.at(-1).type, 'log_full');
  assert.equal(lines.filter(l => l.type === 'log_full').length, 1);
  assert.ok(lines.slice(0, -1).every((l, i) => l.n === i), 'nothing before the cap is lost or reordered');
  assert.ok((await stat(log.path)).size <= 1500);
  assert.equal(log.write('x'), undefined);
  assert.equal((await readFileAsync(log.path, 'utf8')).trim().split('\n').length, lines.length);
  assert.equal((await stat(log.path)).mode & 0o777, 0o600);
});

test('only the service writes logs and no route lists or deletes them', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  await stopped(ctx, session);
  const name = (await readdir(ctx.logDir)).find(n => n.endsWith('.jsonl'));
  for (const path of ['/logs', '/log/', `/poc/logs/${name}`, '/poc/logs/', `/${name}`]) assert.equal((await fetch(ctx.origin + path)).status, 404, path);
  for (const method of ['PUT', 'POST', 'DELETE', 'PATCH']) assert.equal((await fetch(ctx.origin + '/log', { method, headers: { Origin: ctx.origin } })).status, 405, method);
  assert.equal((await readdir(ctx.logDir)).filter(n => n.endsWith('.jsonl')).length, 1);
});

test('nothing from a log is sent to OpenAI', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  await session.confirm('Tell me about the project.');
  await until(() => ctx.f.waiting() === 1);
  ctx.f.release(answerOk());
  await stopped(ctx, session);
  const sent = JSON.stringify([ctx.f.calls, ctx.f.upstream().sent]);
  for (const marker of ['log_started', 'tzOffsetMin', 'answer_shown', 'session_stopped', 'meeting-', '.jsonl']) assert.ok(!sent.includes(marker), marker);
  const read = await Promise.all(['server.mjs', 'session.mjs', 'answer.mjs', 'answer-area.mjs', 'agent.mjs'].map(f => readFileAsync(new URL(f, import.meta.url), 'utf8')));
  assert.ok(read.every(src => !/readFile\(.*log/i.test(src)), 'no module but the log store reads a log file');
});

test('old logs are never deleted, rotated or expired by a new session', async t => {
  const ctx = await liveServer(t);
  const old = ['meeting-20250101T000000Z-aaaaaaaa.jsonl', 'meeting-20250102T000000Z-bbbbbbbb.jsonl', 'notes-by-pablo.txt'];
  for (const name of old) await writeFile(join(ctx.logDir, name), `old ${name}\n`);
  for (let i = 0; i < 2; i += 1) { const s = await ctx.open(); ctx.audits.length = 0; await stopped(ctx, s); }
  const names = await readdir(ctx.logDir);
  for (const name of old) assert.equal(await readFileAsync(join(ctx.logDir, name), 'utf8'), `old ${name}\n`);
  assert.equal(names.filter(n => n.startsWith('meeting-2026') || /^meeting-\d{8}T\d{6}Z-[0-9a-f]{8}/.test(n)).length, 4);
});

test('every listening session writes a log and there is no way to turn logging off', async t => {
  const saved = { a: process.env.ALICE_LOG, b: process.env.ALICE_LOG_OFF, c: process.env.ALICE_NO_LOG };
  Object.assign(process.env, { ALICE_LOG: 'off', ALICE_LOG_OFF: '1', ALICE_NO_LOG: '1' });
  try {
    const ctx = await liveServer(t);
    for (let i = 0; i < 2; i += 1) { const s = await ctx.open(); ctx.audits.length = 0; await stopped(ctx, s); }
    const files = (await readdir(ctx.logDir)).filter(n => n.endsWith('.jsonl'));
    assert.equal(files.length, 2);
    for (const file of files) assert.equal(JSON.parse((await readFileAsync(join(ctx.logDir, file), 'utf8')).split('\n')[0]).type, 'log_started');
  } finally { for (const [k, v] of [['ALICE_LOG', saved.a], ['ALICE_LOG_OFF', saved.b], ['ALICE_NO_LOG', saved.c]]) if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

test('the header holds version, session, UTC start and offset, revision, models, key state, pause setting and package source with counts, and no cue thresholds', async t => {
  const ctx = await liveServer(t, { files: { 'a.md': 'Some package text.' } });
  const session = await ctx.open();
  await stopped(ctx, session);
  const [head] = await readLines(ctx);
  assert.deepEqual(Object.keys(head).sort(), ['keyConfigured', 'models', 'ms', 'package', 'pauseMs', 'revision', 'sessionId', 'startedAt', 't', 'type', 'tzOffsetMin', 'version']);
  assert.deepEqual([head.version, head.sessionId, head.revision, head.keyConfigured, head.pauseMs], [1, session.sessionId, 'test', true, 800]);
  assert.ok(Math.abs(Date.parse(head.t) - Date.parse(head.startedAt)) < 100, 'the header line is written at the start');
  assert.ok(Number.isInteger(head.tzOffsetMin));
  assert.deepEqual(Object.keys(head.models).sort(), ['answer', 'reader', 'transcription']);
  assert.deepEqual([head.package.source, head.package.files, head.package.chars], ['folder', 1, 18]);
  assert.ok(!/cue|hold|threshold|limit/i.test(JSON.stringify(Object.keys(head))));
});

test('version 1 holds no cue events and no transcription confidence', async t => {
  const ctx = await liveServer(t, { autoFocus: true });
  const session = await ctx.open();
  await sendPackets(session, true, 0, 3);
  ctx.f.upstream().emit('message', Buffer.from(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'c1', transcript: 'Tell me about it?', logprobs: [{ logprob: -0.1 }], confidence: 0.9 })));
  await until(() => session.events.some(e => e.type === 'transcript' && e.final));
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  const allowed = new Set(['log_started', 'package', 'speech_start', 'pause', 'transcript', 'live_question', 'live_cleared', 'focus_changed', 'control', 'answer_shown', 'answer_failed', 'answer_dropped', 'error', 'session_stopped', 'log_full',
    'model_call', 'question_timing', 'speech_lost']);
  assert.ok(lines.every(l => allowed.has(l.type)), JSON.stringify(typesOf(lines)));
  assert.ok(!typesOf(lines).some(type => /cue/.test(type)));
  assert.ok(!JSON.stringify(lines).match(/confidence|logprob/));
});

// SPRINT-004 avatar: ST4-43 (fixed file list) and the pinned hashes of SH4-3, and the avatar's state machine (AV-2, AV-3).
test('ST4-43 the fixed file list serves poc/vendor files, poc/avatar.js and nothing else new', async t => {
  const { origin } = await liveServer(t);
  const status = async path => { const r = await fetch(origin + path); await r.body?.cancel(); return [r.status, r.headers.get('content-type')]; };
  assert.deepEqual(await status('/poc/avatar.js'), [200, 'text/javascript; charset=utf-8']);
  for (const path of VENDOR_ASSETS) {
    const [code, type] = await status(path);
    assert.equal(code, 200, path);
    assert.equal(type, path.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript; charset=utf-8', path);
  }
  assert.equal(VENDOR_ASSETS.length, 19);
  for (const path of ['/poc/vendor/', '/poc/vendor/models/mpfb.LICENSE.txt', '/poc/vendor/VENDOR.md', '/poc/vendor/three/LICENSE', '/poc/vendor/../server.mjs',
    '/poc/vendor/%2e%2e/server.mjs', '/poc/server.mjs', '/poc/vendor/talkinghead/playback-worklet.js']) assert.equal((await status(path))[0], 404, path);
});

test('SH4-3 every vendored file matches its recorded SHA-256 and each group has its licence beside it', async () => {
  const record = await readFile(new URL('./vendor/VENDOR.md', import.meta.url), 'utf8');
  const hashes = new Map([...record.matchAll(/^\| `([^`]+)` \| [\d,]+ \| `([0-9a-f]{64})` \|$/gm)].map(m => [m[1], m[2]]));
  for (const path of VENDOR_ASSETS) {
    const file = path.replace('/poc/vendor/', '');
    const bytes = await readFile(new URL(`./vendor/${file}`, import.meta.url));
    assert.equal(hashes.get(file), createHash('sha256').update(bytes).digest('hex'), file);
  }
  for (const licence of ['talkinghead/LICENSE', 'three/LICENSE', 'models/mpfb.LICENSE.txt']) assert.ok((await readFile(new URL(`./vendor/${licence}`, import.meta.url))).length > 100, licence);
  await readFile(new URL('./avatar.md', import.meta.url));
});

const avatarClock = () => { const clock = { t: 0 }; return { clock, machine: createStateMachine(() => clock.t) }; };
const snap = (changes = {}) => ({ listening: false, candidate: false, focusVersion: 0, answerStatus: 'empty', errorCause: false, ...changes });

test('avatar states follow the screen states with the closest built-in mood (AV-2)', () => {
  const { clock, machine } = avatarClock();
  assert.equal(machine.update(snap()), 'idle');
  assert.equal(machine.update(snap({ listening: true })), 'listening');
  assert.equal(machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'preparing' })), 'researching');
  assert.equal(machine.update(snap({ listening: true, focusVersion: 1, errorCause: true })), 'error');
  clock.t = 10000;
  assert.equal(machine.update(snap({ listening: false, focusVersion: 1, answerStatus: 'last-known' })), 'idle');
  assert.deepEqual(Object.keys(AVATAR_MOODS).sort(), ['error', 'idle', 'listening', 'question', 'ready', 'researching']);
});

test('question lasts 1.5 s, ready 2.5 s, a failed answer shows error for 3 s and none restarts within 3 s (AV-3)', () => {
  assert.deepEqual([AVATAR_TIMES.question, AVATAR_TIMES.ready, AVATAR_TIMES.error, AVATAR_TIMES.gap], [1500, 2500, 3000, 3000]);
  let { clock, machine } = avatarClock();
  machine.update(snap({ listening: true }));
  assert.equal(machine.update(snap({ listening: true, candidate: true })), 'question');
  clock.t = 1499; assert.equal(machine.update(snap({ listening: true, candidate: true })), 'question');
  clock.t = 1500; assert.equal(machine.update(snap({ listening: true, candidate: true })), 'listening');
  ({ clock, machine } = avatarClock());
  machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'preparing' }));
  clock.t = 4000; assert.equal(machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'shown' })), 'ready');
  clock.t = 6499; assert.equal(machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'shown' })), 'ready');
  clock.t = 6500; assert.equal(machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'shown' })), 'listening');
  ({ clock, machine } = avatarClock());
  machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'preparing' }));
  clock.t = 4000; assert.equal(machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'failed' })), 'error');
  clock.t = 6999; assert.equal(machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'failed' })), 'error');
  clock.t = 7000; assert.equal(machine.update(snap({ listening: true, focusVersion: 1, answerStatus: 'failed' })), 'listening');
  // No restart within 3 s of the last timed start: a candidate 1 s after a ready shows no question state.
  ({ clock, machine } = avatarClock());
  clock.t = 10000; machine.update(snap({ listening: true, answerStatus: 'shown' }));
  clock.t = 12600; assert.equal(machine.update(snap({ listening: true, answerStatus: 'shown', candidate: true })), 'listening');
});

test('error outranks researching, which outranks a timed state (AV-3)', () => {
  const { clock, machine } = avatarClock();
  clock.t = 5000; machine.update(snap({ listening: true, candidate: true }));
  assert.equal(machine.update(snap({ listening: true, candidate: true, answerStatus: 'preparing' })), 'researching');
  assert.equal(machine.update(snap({ listening: true, candidate: true, answerStatus: 'preparing', errorCause: true })), 'error');
});

// Fixes from the review of 21 November 2026: empty transcript items, an upload cut off mid-body, and cross-site GET.
test('an item with no words is skipped and does not cut the transcript snapshot (SA-17)', () => {
  const clock = clockAt(); const sent = [];
  const s = makeSession({ now: clock.now, emit: m => sent.push(m) });
  const last = () => sent.filter(m => m.type === 'transcript').at(-1);
  s.observe('one', 'First real words.', true);
  clock.t = 1000; s.observe('two', 'Second real words.', true);
  clock.t = 2000; s.observe('noise', '', true);
  assert.deepEqual(last().items.map(i => i.id), ['one', 'two'], 'an empty final item');
  clock.t = 3000; s.observe('blank', ' \n', true);
  assert.deepEqual(last().items.map(i => i.id), ['one', 'two'], 'a final item of white space');
  clock.t = 4000; s.observe('open', '', false);
  assert.deepEqual(last().items.map(i => i.id), ['one', 'two'], 'an open item with no text yet');
  clock.t = 5000; s.observe('three', 'Third.', true);
  assert.deepEqual(last().items.map(i => i.id), ['one', 'two', 'three']);
  s.stop();
});

test('an upload cut off mid-body does not end the service', async t => {
  const ctx = await liveServer(t);
  const port = Number(new URL(ctx.origin).port);
  await new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`PUT /package HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${ctx.origin}\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{"files":[`);
      setTimeout(() => { socket.destroy(); resolve(); }, 100);
    });
    socket.on('error', reject);
  });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal((await fetch(ctx.origin + '/health')).status, 200, 'the service still answers');
  assert.equal((await getPackage(ctx)).source, 'none', 'and nothing was loaded');
});

test('a browser GET from another site is refused on log and package; this page and the address bar are not (SD-3)', async t => {
  const ctx = await liveServer(t);
  const get = (path, site) => new Promise((resolve, reject) => {
    http.get(ctx.origin + path, { headers: site ? { 'Sec-Fetch-Site': site } : {} }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  for (const site of ['cross-site', 'same-site']) assert.deepEqual([await get('/log', site), await get('/package', site)], [403, 403], site);
  for (const site of ['same-origin', 'none', undefined]) assert.deepEqual([await get('/log', site), await get('/package', site)], [404, 200], String(site));
});

// Second pass of review fixes (22 November 2026): the log's last line, missing events, control order, unknown reader fields, older logs.
test('the log_full line holds nothing of the event that did not fit and the file stays under its cap (MS-4)', async t => {
  const dir = await tempDir(t);
  const log = new MeetingLog({ dir, sessionId: 'abcdef12-0000-0000', maxBytes: 1500 });
  log.write('log_started', { version: 1 });
  log.write('transcript', { itemId: 'big', text: 'x'.repeat(2000) });
  log.write('transcript', { itemId: 'later', text: 'never written' });
  await log.close();
  const text = await readFile(log.path, 'utf8');
  const lines = text.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(lines.map(l => l.type), ['log_started', 'log_full']);
  assert.deepEqual(Object.keys(lines[1]).sort(), ['maxBytes', 'ms', 't', 'type']);
  assert.ok(Buffer.byteLength(text) <= 1500, `file is ${Buffer.byteLength(text)} bytes`);
});

test('an answer still being prepared at Stop is logged as dropped before the last line (ML-8)', async t => {
  const ctx = await liveServer(t, { files: { 'a.md': 'Some package text.' } });
  const session = await ctx.open();
  await session.confirm('Why this company?');
  await until(() => ctx.f.calls.length === 1);
  await stopped(ctx, session);
  const lines = await readLines(ctx), types = typesOf(lines);
  assert.deepEqual(lines.filter(l => l.type === 'answer_dropped').map(l => l.reason), ['stopped']);
  assert.ok(types.indexOf('answer_dropped') < types.indexOf('session_stopped'));
  assert.equal(types.at(-1), 'session_stopped');
  assert.equal(named(ctx.audits, 'answer_dropped').length, 1, 'and it is audited once');
});

test('a failed reading is logged as an error with its public message only (ML-10)', async t => {
  const ctx = await liveServer(t, { reason: async () => { throw Object.assign(new Error('PROVIDER-DETAIL-SENTINEL'), { status: 429 }); } });
  const session = await ctx.open();
  ctx.f.say('Tell me about this project please.');
  await until(() => ctx.audits.some(a => a.name === 'agent_failed'));
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  // The reader may also be asked once at the start of the session, so there can be more than one failure.
  const errors = lines.filter(l => l.type === 'error');
  assert.ok(errors.length >= 1 && errors.every(l => l.code === 'reader' && l.message === 'OpenAI quota or rate limit reached'), JSON.stringify(errors));
  assert.equal(JSON.stringify(lines).includes('PROVIDER-DETAIL-SENTINEL'), false);
});

test('a control is logged before its own effects, and a refused one is logged as invalid (ML-7, ML-12)', async t => {
  const ctx = await liveServer(t);
  const session = await ctx.open();
  ctx.f.say('First question here?');
  await until(() => session.events.some(e => e.live));
  const e = session.events.filter(m => m.live).at(-1);
  const results = () => session.events.filter(m => m.type === 'question.result');
  control(session, { type: 'question.confirm', requestId: 'c1', liveId: e.live.id, liveVersion: e.live.version, expectedFocusVersion: e.focusVersion, text: e.live.text });
  await until(() => results().length === 1);
  control(session, { type: 'question.confirm', requestId: 'c1', liveId: 'other', liveVersion: 9, expectedFocusVersion: 9, text: 'a changed retry' });
  await until(() => results().length === 2);
  control(session, { type: 'question.reset', via: 'escape' });
  await until(() => results().length === 3);
  assert.deepEqual(results().map(r => r.status), ['confirmed', 'invalid', 'invalid']);
  await stopped(ctx, session);
  const lines = await readLines(ctx), types = typesOf(lines);
  assert.ok(types.indexOf('control') < types.indexOf('live_cleared') && types.indexOf('control') < types.indexOf('focus_changed'), types.join(','));
  assert.deepEqual(lines.filter(l => l.type === 'control').map(c => [c.control, c.via, c.result]),
    [['confirm', 'button', 'confirmed'], ['confirm', 'button', 'invalid'], ['clear', 'escape', 'invalid']]);
});

test('a reader reply with any unknown field gives its reading but not its answer, which falls back (AD-3)', async () => {
  const f = createFixtures();
  const s = new InterviewSession({ reason: async () => proposal(), emit: () => {}, delayMs: 0, generate: f.generate });
  s.answers.setPackage(packageOf(fixturePackage));
  s.observe('o1', 'Tell me about CIBC.', true);
  s.accept(oneCall({ question: 'Tell me about CIBC.', evidenceIds: ['o1'], notes: 'not in the contract' }), s.snapshot());
  assert.equal(s.state.focus, 'Tell me about CIBC.');
  assert.equal(s.answers.view().status, 'preparing', 'the bullets were not shown');
  await until(() => f.calls.length === 1);
  s.stop();
});

test('GET log offers the most recent older log when the newest file is gone (SD-1)', async t => {
  const dir = await tempDir(t, { 'meeting-20261101T000000Z-aaaaaaaa.jsonl': '{"type":"log_started","older":1}\n', 'meeting-20261102T000000Z-bbbbbbbb.jsonl': '{"type":"log_started","older":2}\n' });
  const store = createLogStore({ dir });
  const log = store.start('cccccccc-0000-0000');
  log.write('log_started', { version: 1 });
  await log.close();
  assert.match((await store.read()).text, /"version":1/);
  await rm(log.path);
  const older = await store.read();
  assert.deepEqual([older.filename, older.text], ['alice-meeting-20261102T000000Z.jsonl', '{"type":"log_started","older":2}\n']);
});

// Hosted mode (ALICE_PUBLIC_HOST, ALICE_ACCESS_CODE, ALICE_LOG, ALICE_AVATAR). With none of them set the service is local,
// as every case above shows; these cases turn one setting on at a time.
const HOSTED = 'alice-test-abc.a.run.app';
const hostedRequest = (ctx, path, { host = HOSTED, proto = 'https', headers = {}, method = 'GET', body } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: new URL(ctx.origin).port, path, method, headers: { Host: host, ...(proto ? { 'X-Forwarded-Proto': proto } : {}), ...headers } }, res => {
    let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode, text }));
  });
  req.on('error', reject); req.end(body);
});
// Resolves with {ready, protocol} when the session is ready, or {status} when the handshake is refused.
const socketOutcome = (ctx, { protocols = [], origin = ctx.origin, headers = {} } = {}) => new Promise(resolve => {
  const ws = new WebSocket(ctx.origin.replace('http:', 'ws:') + '/session', protocols, { origin, headers });
  ws.on('unexpected-response', (req, res) => { resolve({ status: res.statusCode }); req.destroy(); });
  ws.on('message', raw => { if (JSON.parse(raw).type === 'ready') { resolve({ ready: true, protocol: ws.protocol }); ws.close(); } });
  ws.on('error', () => {});
});

test('hosted: the public host is served over https only, beside the local one, and the socket takes its https origin', async t => {
  assert.deepEqual([listenHost({}), listenHost({ ALICE_PUBLIC_HOST: '  ' }), listenHost({ ALICE_PUBLIC_HOST: HOSTED })], ['127.0.0.1', '127.0.0.1', '0.0.0.0']);
  const ctx = await liveServer(t, { publicHost: `${HOSTED}, second.example.run.app` });
  assert.equal((await hostedRequest(ctx, '/')).status, 200);
  assert.equal((await hostedRequest(ctx, '/', { host: 'second.example.run.app' })).status, 200, 'a second named host');
  assert.equal((await hostedRequest(ctx, '/', { proto: 'http' })).status, 403, 'plain http on the public host');
  assert.equal((await hostedRequest(ctx, '/', { proto: null })).status, 403, 'no scheme reported');
  assert.equal((await hostedRequest(ctx, '/', { host: 'evil.example' })).status, 403, 'another host');
  assert.equal((await fetch(ctx.origin + '/')).status, 200, 'the local address still works');
  const body = JSON.stringify(upload(['a.md', 'Hosted text.']));
  const put = origin => hostedRequest(ctx, '/package', { method: 'PUT', body, headers: { 'Content-Type': 'application/json', Origin: origin } });
  assert.deepEqual([(await put(`http://${HOSTED}`)).status, (await put('https://evil.example')).status, (await put(`https://${HOSTED}`)).status], [403, 403, 200]);
  const hosted = { headers: { Host: HOSTED, 'X-Forwarded-Proto': 'https' } };
  assert.deepEqual(await socketOutcome(ctx, { ...hosted, origin: `http://${HOSTED}` }), { status: 403 });
  assert.deepEqual(await socketOutcome(ctx, { ...hosted, origin: `https://${HOSTED}` }), { ready: true, protocol: '' });
});

test('hosted: with an access code the package, the log and the session need it; the code is never logged or echoed', async t => {
  const code = 'correct horse 42';
  const ctx = await liveServer(t, { accessCode: ` ${code}\n` });
  const withCode = value => ({ 'X-Alice-Code': value });
  const status = async (path, init) => (await fetch(ctx.origin + path, init)).status;
  assert.deepEqual([await status('/'), await status('/app.js'), await status('/health')], [200, 200, 200], 'the page itself needs no code');
  assert.deepEqual([await status('/package'), await status('/package', { headers: withCode('wrong') }), await status('/package', { headers: withCode(code) })], [401, 401, 200]);
  assert.deepEqual([await status('/log'), await status('/log', { headers: withCode(code) })], [401, 404]);
  const change = (method, headers) => status('/package', { method, headers: { 'Content-Type': 'application/json', Origin: ctx.origin, ...headers }, body: method === 'PUT' ? JSON.stringify(upload(['a.md', 'Text.'])) : undefined });
  assert.deepEqual([await change('PUT', {}), await change('DELETE', {}), await change('PUT', withCode(code)), await change('DELETE', withCode(code))], [401, 401, 200, 200]);
  const offer = value => ['alice', `alice-code.${Buffer.from(value).toString('base64url')}`];
  assert.deepEqual(await socketOutcome(ctx), { status: 401 }, 'no code');
  assert.deepEqual(await socketOutcome(ctx, { protocols: offer('wrong') }), { status: 401 });
  assert.deepEqual(await socketOutcome(ctx, { protocols: offer(code) }), { ready: true, protocol: 'alice' }, 'only the plain subprotocol is echoed');
  await new Promise(resolve => setTimeout(resolve, 60));
  const written = JSON.stringify(ctx.audits) + ctx.logs.join('\n') + JSON.stringify(await (await fetch(ctx.origin + '/health')).json());
  for (const secret of [code, Buffer.from(code).toString('base64url')]) assert.equal(written.includes(secret), false);
});

test('hosted: ALICE_LOG=off writes no meeting log and Download log answers 404; on a local service it changes nothing', async t => {
  const hosted = await liveServer(t, { publicHost: HOSTED, logOff: true });
  const session = await hosted.open();
  hosted.f.say('Words that would have been logged.');
  await until(() => session.events.some(e => e.type === 'transcript'));
  await stopped(hosted, session);
  const res = await getLog(hosted);
  assert.deepEqual([res.status, await res.text()], [404, 'No meeting log yet.']);
  assert.deepEqual(await readdir(hosted.logDir), [], 'no file is created');
  assert.equal(session.events.some(e => e.type === 'log'), false);
  const local = await liveServer(t, { logOff: true });
  await stopped(local, await local.open());
  assert.equal((await readdir(local.logDir)).filter(n => n.endsWith('.jsonl')).length, 1, 'a local service logs every session (ML-13)');
});

test('ALICE_AVATAR=off serves no avatar file, and the rest of the page is served', async t => {
  const ctx = await liveServer(t, { avatarOff: true });
  const status = async path => { const r = await fetch(ctx.origin + path); await r.body?.cancel(); return r.status; };
  assert.deepEqual([await status('/poc/avatar.js'), await status(VENDOR_ASSETS[0]), await status(VENDOR_ASSETS.at(-1))], [404, 404, 404]);
  assert.deepEqual([await status('/'), await status('/app.js'), await status('/poc/audio-worklet.js')], [200, 200, 200]);
});

test('the publish list holds what the hosted service imports and serves, and nothing private or test-only', async () => {
  const root = new URL('../', import.meta.url);
  const list = (await readFile(new URL('./deploy/publish-files.txt', import.meta.url), 'utf8')).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  for (const path of list) await stat(new URL(path, root));
  // Every module reachable from the service by a relative import is listed.
  const seen = new Set(), queue = ['poc/server.mjs'];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(new URL(file, root), 'utf8');
    for (const match of source.matchAll(/from\s+'(\.\/[^']+)'/g)) queue.push(`poc/${match[1].slice(2)}`);
  }
  assert.deepEqual([...seen].filter(file => !list.includes(file)), [], 'modules missing from the list');
  for (const needed of ['index.html', 'app.js', 'poc/audio-worklet.js', 'poc/avatar.js', 'poc/vendor', 'poc/package.json', 'poc/pnpm-lock.yaml']) assert.ok(list.includes(needed), needed);
  // The benchmark folder's name is put together here, because no poc source may name it.
  const banned = new RegExp(['\\.env', 'context', 'logs', 'docs', 'asdg', 'openspec', 'eval' + '-data', '\\.test\\.', 'browser-', 'fixtures', 'live-capture', 'node_modules', 'preview', '\\.\\.', '^/'].join('|'));
  for (const path of list) assert.doesNotMatch(path, banned, path);
  const dockerfile = await readFile(new URL('./deploy/Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /--prod --frozen-lockfile --ignore-scripts/);
  assert.doesNotMatch(dockerfile, /OPENAI_API_KEY=|ALICE_ACCESS_CODE=/, 'no secret is set in the image');
});

// ---- SPRINT-005, logging alone (RT5-4, RT5-5, RT5-8): ST5-5, ST5-6, ST5-7 and ST5-11. Fixtures and invented text only; no OpenAI. ----
import { Runner, OpenAIResponsesModel } from '@openai/agents';
import { createReasoner, usageOf, failureReason, callEvent, EFFORT } from './agent.mjs';
import { LOG_VERSION } from './meeting-log.mjs';

const CALL_FIELDS = ['cachedTokens', 'callId', 'durationMs', 'effort', 'inputTokens', 'kind', 'model', 'outcome', 'outputTokens', 'reason', 'startMs'];
const TIMING_FIELDS = ['answerEndMs', 'answerStartMs', 'bulletsMs', 'finalMs', 'focusVersion', 'outcome', 'questionMs', 'readerEndMs', 'readerStartMs', 'speechEndMs', 'toBulletsMs', 'toQuestionMs'];
const USAGE = { inputTokens: 5000, cachedTokens: 4096, outputTokens: 120 };
const NO_TOKENS = { inputTokens: null, cachedTokens: null, outputTokens: null };
const READER = { kind: 'reader', model: 'reader-model-x', effort: 'low' };
const ANSWER = { kind: 'answer', model: 'answer-model-x', effort: 'low' };
const NO_FOCUS = { focusVersion: null, questionMs: null, answerStartMs: null, answerEndMs: null, bulletsMs: null, toQuestionMs: null, toBulletsMs: null };

// A session on a hand-moved clock. Its reader calls wait in `readings` until the test answers them, and every
// meeting-log line it writes is kept in `lines`.
function measured(t, options = {}) {
  const lines = [], readings = [], clock = clockAt();
  const reason = Object.assign((snapshot, signal, context, meter) => new Promise((resolve, reject) => readings.push({ meter, resolve, reject })), { model: READER.model, effort: READER.effort });
  const generate = options.generate && Object.assign(options.generate, { model: ANSWER.model, effort: ANSWER.effort });
  const s = new InterviewSession({ reason, emit: () => {}, delayMs: 0, now: clock.now, record: (type, data) => lines.push({ type, ...structuredClone(data) }), ...options, generate });
  t.after(() => s.stop());
  const of = type => lines.filter(l => l.type === type).map(({ type: _type, ...data }) => data);
  // Speech ends at `at`, and its final transcript arrives at `finalAt`; resolves when the reader call for it has started.
  const hear = async (at, id, text, finalAt = at) => {
    clock.t = at; s.voiced();
    clock.t = finalAt; s.observe(id, text, true);
    await until(() => readings.length === 1);
  };
  // Answers the reading in flight at clock time `at`, with token counts when `usage` is given.
  const read = async (at, reply, usage) => {
    const before = of('model_call').length, reading = readings.shift();
    clock.t = at;
    if (usage) reading.meter(usage);
    if (reply instanceof Error) reading.reject(reply); else reading.resolve(reply);
    await until(() => of('model_call').length > before);
  };
  return { s, lines, clock, readings, of, hear, read };
}

test('ST5-5 ST5-7 a reading refused and the one kept in the same pause: two model_call lines and one question_timing', async t => {
  const { s, lines, clock, readings, of, hear, read } = measured(t);
  s.answers.setPackage(packageOf(fixturePackage));
  await hear(1000, 'a', 'Tell me about your work', 1900);
  clock.t = 2600; s.observe('b', 'at Aurora Bank.', true);
  await read(4000, oneCall({ question: 'Tell me about your work', evidenceIds: ['not-heard'] }), USAGE);
  await until(() => readings.length === 1);
  assert.deepEqual(of('question_timing'), [], 'the turn is not over while more of the same pause waits to be read');
  await read(7000, oneCall({ question: 'Tell me about your work at Aurora Bank.', evidenceIds: ['a', 'b'] }));
  const calls = of('model_call');
  assert.deepEqual(calls.map(c => Object.keys(c).sort()), [CALL_FIELDS, CALL_FIELDS]);
  assert.deepEqual(calls, [
    { ...READER, callId: 1, startMs: 1900, durationMs: 2100, outcome: 'rejected', reason: 'unknown-evidence', ...USAGE },
    { ...READER, callId: 2, startMs: 4000, durationMs: 3000, outcome: 'question', reason: null, ...NO_TOKENS }]);
  const timing = of('question_timing');
  assert.deepEqual(timing.map(q => Object.keys(q).sort()), [TIMING_FIELDS]);
  assert.deepEqual(timing, [{ speechEndMs: 1000, finalMs: 2600, readerStartMs: 4000, readerEndMs: 7000, focusVersion: 1, questionMs: 7000,
    answerStartMs: null, answerEndMs: null, bulletsMs: 7000, outcome: 'bullets', toQuestionMs: 6000, toBulletsMs: 6000 }]);
  assert.deepEqual(typesOf(lines).slice(-5), ['model_call', 'live_question', 'focus_changed', 'answer_shown', 'question_timing'], 'a call is logged before what it changed');
});

test('ST5-6 ST5-7 a turn with no Focus has no Focus version, no question time and no differences, and without usage the tokens are null', async t => {
  const { of, hear, read } = measured(t);
  await hear(10000, 'b', 'So I worked there for three years.', 11000);
  await read(13000, proposal({ intent: 'answer', question: null, evidenceIds: ['b'] }));
  assert.deepEqual(of('model_call'), [{ ...READER, callId: 1, startMs: 11000, durationMs: 2000, outcome: 'no-question', reason: null, ...NO_TOKENS }]);
  assert.deepEqual(of('question_timing'), [{ speechEndMs: 10000, finalMs: 11000, readerStartMs: 11000, readerEndMs: 13000, ...NO_FOCUS, outcome: 'no-question' }]);
});

test('ST5-5 ST5-7 each attempt of the answer request is one model_call, and the turn has its answer times', async t => {
  const f = createFixtures();
  const { lines, clock, of, hear, read } = measured(t, { generate: f.generate });
  await hear(1000, 'a', 'Why this company?', 2000);
  await read(5000, proposal({ question: 'Why this company?', evidenceIds: ['a'] }), USAGE);
  await until(() => f.waiting() === 1);
  clock.t = 6000; f.fail(Object.assign(new Error('PROVIDER-DETAIL-SENTINEL'), { status: 429 }));
  await until(() => f.calls.length === 2 && f.waiting() === 1);
  clock.t = 8000; f.release(answerOk(), { inputTokens: 4800, cachedTokens: 0, outputTokens: 60 });
  await until(() => of('question_timing').length === 1);
  assert.deepEqual(of('model_call'), [
    { ...READER, callId: 1, startMs: 2000, durationMs: 3000, outcome: 'question', reason: null, ...USAGE },
    { ...ANSWER, callId: 2, startMs: 5000, durationMs: 1000, outcome: 'failed', reason: 'rate-limit', ...NO_TOKENS },
    { ...ANSWER, callId: 3, startMs: 6000, durationMs: 2000, outcome: 'question', reason: null, inputTokens: 4800, cachedTokens: 0, outputTokens: 60 }]);
  assert.deepEqual(of('question_timing'), [{ speechEndMs: 1000, finalMs: 2000, readerStartMs: 2000, readerEndMs: 5000, focusVersion: 1, questionMs: 5000,
    answerStartMs: 5000, answerEndMs: 8000, bulletsMs: 8000, outcome: 'bullets', toQuestionMs: 4000, toBulletsMs: 7000 }]);
  // No text: the two new events hold numbers, null and fixed words, and nothing of the question, the answer or the error.
  const added = lines.filter(l => ['model_call', 'question_timing'].includes(l.type));
  for (const line of added) for (const [key, value] of Object.entries(line)) assert.ok(value === null || Number.isFinite(value) || /^[a-z][a-z_0-9:.-]*$/.test(value), `${key}=${value}`);
  for (const text of ['company', 'First point', 'PROVIDER-DETAIL-SENTINEL']) assert.equal(JSON.stringify(added).includes(text), false, text);
});

test('ST5-5 ST5-7 a failed reading, an answer overtaken by a new question and Stop are logged as failed, dropped and stopped', async t => {
  const f = createFixtures();
  const { s, clock, readings, of, hear, read } = measured(t, { generate: f.generate });
  await hear(1000, 'a', 'Tell me about your last project.');
  await read(1500, Object.assign(new Error('PROVIDER-DETAIL-SENTINEL'), { name: 'TimeoutError' }));
  await hear(2000, 'b', 'Why this company?');
  await read(2500, proposal({ question: 'Why this company?', evidenceIds: ['b'] }));
  await until(() => f.waiting() === 1);
  await hear(3000, 'c', 'And why this team?');
  await read(3500, proposal({ question: 'And why this team?', evidenceIds: ['c'] }));
  await until(() => f.calls.length === 2 && of('question_timing').length === 2);
  await hear(4000, 'd', 'What would you change?');
  clock.t = 4200; s.stop();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(of('model_call').map(c => [c.kind, c.callId, c.startMs, c.durationMs, c.outcome, c.reason]), [
    ['reader', 1, 1000, 500, 'failed', 'timeout'], ['reader', 2, 2000, 500, 'question', null], ['reader', 4, 3000, 500, 'question', null],
    ['answer', 3, 2500, 1000, 'dropped', 'stale-version'], ['answer', 5, 3500, 700, 'dropped', 'stopped'], ['reader', 6, 4000, 200, 'dropped', 'stopped']]);
  assert.ok(of('model_call').every(c => c.outcome === 'question' || c.inputTokens === null));
  assert.deepEqual(of('question_timing'), [
    { speechEndMs: 1000, finalMs: 1000, readerStartMs: 1000, readerEndMs: 1500, ...NO_FOCUS, outcome: 'failed' },
    { speechEndMs: 2000, finalMs: 2000, readerStartMs: 2000, readerEndMs: 2500, focusVersion: 1, questionMs: 2500, answerStartMs: 2500, answerEndMs: 3500, bulletsMs: null, outcome: 'superseded', toQuestionMs: 500, toBulletsMs: null },
    { speechEndMs: 3000, finalMs: 3000, readerStartMs: 3000, readerEndMs: 3500, focusVersion: 2, questionMs: 3500, answerStartMs: 3500, answerEndMs: 4200, bulletsMs: null, outcome: 'stopped', toQuestionMs: 500, toBulletsMs: null },
    { speechEndMs: 4000, finalMs: 4000, readerStartMs: 4000, readerEndMs: null, ...NO_FOCUS, outcome: 'stopped' }]);
  assert.equal(readings.length, 1, 'the reading in flight at Stop was never answered, and nothing was written for it twice');
});

test('ST5-7 in the manual flow the turn waits for Confirm, and a candidate left unconfirmed ends as superseded', async t => {
  const f = createFixtures();
  const { s, clock, of, hear, read } = measured(t, { generate: f.generate, autoFocus: false });
  await hear(1000, 'a', 'Why this company?');
  await read(2000, proposal({ question: 'Why this company?', evidenceIds: ['a'] }));
  assert.equal(of('model_call')[0].outcome, 'question', 'a candidate on the screen is something shown');
  assert.deepEqual(of('question_timing'), []);
  clock.t = 5000;
  s.control({ type: 'question.confirm', sessionId: s.id, requestId: 'c1', liveId: s.state.live.id, liveVersion: s.state.live.version, expectedFocusVersion: 0, text: s.state.live.text });
  await until(() => f.waiting() === 1);
  clock.t = 6000; f.release(answerOk());
  await until(() => of('question_timing').length === 1);
  assert.deepEqual(of('question_timing')[0], { speechEndMs: 1000, finalMs: 1000, readerStartMs: 1000, readerEndMs: 2000, focusVersion: 1, questionMs: 5000,
    answerStartMs: 5000, answerEndMs: 6000, bulletsMs: 6000, outcome: 'bullets', toQuestionMs: 4000, toBulletsMs: 5000 });
  await hear(7000, 'b', 'And why this team?');
  await read(7500, proposal({ question: 'And why this team?', evidenceIds: ['b'] }));
  await hear(9000, 'c', 'Thanks, that is all for today.');
  assert.deepEqual(of('question_timing')[1], { speechEndMs: 7000, finalMs: 7000, readerStartMs: 7000, readerEndMs: 7500, ...NO_FOCUS, outcome: 'superseded' });
});

test('ST5-6 token counts are null when a reply carries no usage, a count never throws, and no text can enter a model_call', () => {
  const broken = { get rawResponses() { throw new Error('unreadable'); } };
  const zero = { rawResponses: [{ usage: { inputTokens: 0, outputTokens: 0, inputTokensDetails: [{}] } }] };
  for (const none of [undefined, null, {}, { rawResponses: [] }, { rawResponses: [{}] }, zero, broken]) assert.deepEqual(usageOf(none), NO_TOKENS);
  assert.deepEqual(usageOf({ rawResponses: [{ usage: { inputTokens: 5000, outputTokens: 120, inputTokensDetails: [{ cached_tokens: 4096 }] } }] }), USAGE);
  assert.deepEqual(usageOf({ rawResponses: [{ usage: { inputTokens: 900, outputTokens: 40, inputTokensDetails: [{}] } }] }),
    { inputTokens: 900, cachedTokens: null, outputTokens: 40 }, 'usage with no cache count');
  const event = callEvent({ kind: 'reader', callId: 1, startMs: 10, model: { text: 'SENTINEL' }, effort: 7, usage: { inputTokens: 'SENTINEL', cachedTokens: NaN, outputTokens: 5, prompt: 'SENTINEL' } },
    30, 'failed', { message: 'SENTINEL' });
  assert.deepEqual(event, { kind: 'reader', callId: 1, startMs: 10, durationMs: 20, outcome: 'failed', reason: null, model: null, effort: null, inputTokens: null, cachedTokens: null, outputTokens: 5 });
  const reasons = [[{ status: 401 }, 'auth'], [{ code: 'insufficient_quota' }, 'rate-limit'], [{ status: 403 }, 'model-access'], [{ name: 'TimeoutError' }, 'timeout'], [{ name: 'AbortError' }, 'aborted'],
    [{ code: 'invalid-result', detail: 'bullets-count' }, 'invalid-result:bullets-count'], [new Error('PROVIDER-DETAIL-SENTINEL'), 'error'], ['superseded', 'error'], [undefined, 'error']];
  for (const [error, word] of reasons) assert.equal(failureReason(error), word);
});

test('ST5-5 the Agents SDK passes the usage of a Responses reply to the meter: input, cached and output tokens (stub client, no network)', async () => {
  const sent = [];
  const reply = (text, usage) => ({ id: 'resp_stub', object: 'response', created_at: 0, status: 'completed', model: 'stub', ...(usage ? { usage } : {}),
    output: [{ id: 'msg_stub', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }] });
  const runnerFor = (text, usage) => new Runner({ tracingDisabled: true, modelProvider: { getModel: async name => new OpenAIResponsesModel(
    { baseURL: 'http://stub.invalid', responses: { create: async body => { sent.push(body); return reply(text, usage); } } }, name) } });
  const usage = { input_tokens: 5000, input_tokens_details: { cached_tokens: 4096 }, output_tokens: 120, output_tokens_details: { reasoning_tokens: 64 }, total_tokens: 5120 };
  const reading = { phase: 'QUESTION', question: null, intent: 'none', evidenceIds: [], covered: false, bullets: [] };
  const metered = [];
  const reason = createReasoner('stub-reader', { runner: runnerFor(JSON.stringify(reading), usage) });
  assert.deepEqual(await reason({ observations: [] }, undefined, {}, counts => metered.push(counts)), reading);
  assert.deepEqual(metered, [USAGE]);
  assert.deepEqual([reason.model, reason.effort, sent[0].model, sent[0].reasoning.effort], ['stub-reader', EFFORT, 'stub-reader', EFFORT], 'the model and effort logged are the ones sent');
  assert.deepEqual(await reason({ observations: [] }), reading, 'and a call without a meter is unchanged');
  const generate = createGenerator({ model: 'stub-answer', runner: runnerFor('{"bullets":["One."]}') });
  const request = buildRequest({ sessionId: 's', focusVersion: 1, question: 'Why?', documents: [] });
  assert.deepEqual(await generate(request, { meter: counts => metered.push(counts) }), { bullets: ['One.'] });
  assert.deepEqual(metered[1], NO_TOKENS, 'a reply with no usage gives null, not zero');
  assert.deepEqual([generate.model, generate.effort, sent[2].model, sent[2].reasoning.effort], ['stub-answer', EFFORT, 'stub-answer', EFFORT]);
});

test('ST5-7 ST5-11 on the service the new lines use the log clock, each turn writes one question_timing and the header stays at version 1', async t => {
  const ctx = await liveServer(t, { autoFocus: true, files: { 'a.md': 'Some package text.' } });
  const session = await ctx.open();
  await sendPackets(session, true, 0, 5);
  await sendPackets(session, false, 5, 9);
  ctx.f.say('Why this company?');
  await until(() => ctx.f.waiting() === 1);
  ctx.f.release(answerOk(), USAGE);
  await until(() => session.events.some(e => e.type === 'proposed' && e.proposed.status === 'shown'));
  await stopped(ctx, session);
  const lines = await readLines(ctx);
  assert.deepEqual([LOG_VERSION, lines[0].type, lines[0].version], [1, 'log_started', 1]);
  const calls = lines.filter(l => l.type === 'model_call'), timing = lines.filter(l => l.type === 'question_timing');
  assert.deepEqual(calls.map(c => [c.kind, c.callId, c.outcome, c.inputTokens, c.cachedTokens, c.outputTokens]),
    [['reader', 1, 'no-question', null, null, null], ['reader', 2, 'question', null, null, null], ['answer', 3, 'question', 5000, 4096, 120]]);
  assert.deepEqual(calls.map(c => Object.keys(c).sort()), calls.map(() => [...CALL_FIELDS, 'ms', 't', 'type'].sort()));
  assert.equal(timing.length, 1, 'the call at the start of the session reads no speech and is no turn');
  const [q] = timing, ms = type => lines.find(l => l.type === type).ms, near = (a, b) => Math.abs(a - b) <= 3;
  assert.deepEqual(Object.keys(q).sort(), [...TIMING_FIELDS, 'ms', 't', 'type'].sort());
  assert.ok(ms('speech_start') <= q.speechEndMs && q.speechEndMs <= q.finalMs && q.finalMs <= q.readerStartMs && q.readerStartMs <= q.readerEndMs, JSON.stringify(q));
  assert.ok(q.readerEndMs <= q.questionMs && q.questionMs <= q.answerStartMs && q.answerStartMs <= q.answerEndMs && q.answerEndMs <= q.bulletsMs && q.bulletsMs <= q.ms, JSON.stringify(q));
  assert.ok(near(q.finalMs, ms('transcript')) && near(q.questionMs, ms('focus_changed')) && near(q.bulletsMs, ms('answer_shown')), 'the times are on the clock of each line');
  assert.deepEqual([q.focusVersion, q.outcome, q.toQuestionMs, q.toBulletsMs], [1, 'bullets', q.questionMs - q.speechEndMs, q.bulletsMs - q.speechEndMs]);
  assert.ok(near(calls[1].startMs, q.readerStartMs) && near(calls[2].startMs, q.answerStartMs) && near(calls[2].startMs + calls[2].durationMs, q.answerEndMs));
  for (const line of [...calls, ...timing]) for (const [key, value] of Object.entries(line)) if (key !== 't') assert.ok(value === null || Number.isFinite(value) || /^[a-z][a-z_0-9:.-]*$/.test(value), `${key}=${value}`);
});

test('ST5-11 a line of an unknown type or with an unknown field does not stop the log being read', async t => {
  const store = createLogStore({ dir: await tempDir(t) });
  const log = store.start('dddddddd-0000-0000');
  log.write('log_started', { version: LOG_VERSION });
  log.write('event_of_a_later_version', { anything: { nested: [1, 2] } });
  log.write('transcript', { itemId: 'i1', text: 'Words.', fieldOfALaterVersion: 7 });
  await log.close();
  const read = (await store.read()).text.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(read.map(l => [l.type, l.version ?? l.fieldOfALaterVersion ?? l.anything.nested.length]), [['log_started', 1], ['event_of_a_later_version', 2], ['transcript', 7]]);
});

// ---- SPRINT-005, step S5-08 (RT5-3): the package comes first in the reader's input. ST5-4. ----
// Kept apart from the steps after it, so this step can be reverted alone if the measurement shows no gain.
import { packagePart } from './agent.mjs';

test('ST5-4 two reader inputs of one session share the same package part byte for byte, and the snapshot comes after it', async t => {
  const inputs = [];
  const files = { 'b-notes.md': 'Pat led the Harbor Platform work.', 'a-brief.md': 'Aurora Bank hired Pat for the CIBC project.' };
  const ctx = await liveServer(t, { files, reason: async (snapshot, signal, context) => { inputs.push(readerInput(snapshot, context)); return proposal({ question: snapshot.observations.at(-1)?.text ?? null, evidenceIds: snapshot.observations.map(o => o.id) }); } });
  const session = await ctx.open();
  ctx.f.say('Tell me about the CIBC project.');
  await until(() => inputs.length === 2);
  ctx.f.say('And who led the Harbor Platform work?');
  await until(() => inputs.length === 3);
  const part = JSON.stringify(packagePart({ terms: JSON.parse(inputs[0]).preparationPackage.terms, documents: Object.entries(files).map(([name, text]) => ({ name, text })) }));
  const head = `{"preparationPackage":${part},`;
  for (const input of inputs) assert.ok(input.startsWith(head), 'every input starts with the same package bytes');
  assert.deepEqual(JSON.parse(part).documents.map(d => d.name), ['a-brief.md', 'b-notes.md'], 'documents in name order');
  assert.ok(head.length > 100 && new Set(inputs.map(input => input.slice(head.length))).size === 3, 'and only what follows differs');
  for (const input of inputs) assert.deepEqual(Object.keys(JSON.parse(input)), ['preparationPackage', 'sessionId', 'baseRevision', 'event', 'audioCutoffSamples', 'state', 'observations']);
  assert.equal(JSON.parse(inputs[2]).sessionId, session.sessionId);
  // An upload of the same files in another order gives the same bytes, and the content is what it was before.
  const other = { terms: ['CIBC'], documents: [{ name: 'b.md', text: 'Bee.', sha256: 'x' }, { name: 'a.md', text: 'Ay.' }] };
  assert.equal(JSON.stringify(packagePart(other)), '{"terms":["CIBC"],"documents":[{"name":"a.md","text":"Ay."},{"name":"b.md","text":"Bee."}]}');
  assert.deepEqual(other.documents.map(d => d.name), ['b.md', 'a.md'], 'the caller\'s list is not reordered');
  assert.equal(readerInput({ sessionId: 's' }), '{"sessionId":"s"}', 'with no package the input is the bare snapshot');
});

test('ST5-4 the request sent through the Agents SDK begins with the instructions and then the package (stub client, no network)', async () => {
  const sent = [];
  const text = JSON.stringify({ phase: 'QUESTION', question: null, intent: 'none', evidenceIds: [], covered: false, bullets: [] });
  const runner = new Runner({ tracingDisabled: true, modelProvider: { getModel: async name => new OpenAIResponsesModel({ baseURL: 'http://stub.invalid', responses: { create: async body => {
    sent.push(body); return { id: 'resp_stub', object: 'response', created_at: 0, status: 'completed', model: 'stub', output: [{ id: 'msg_stub', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }] };
  } } }, name) } });
  const reason = createReasoner('stub-reader', { runner });
  const context = { terms: ['CIBC'], documents: fixturePackage };
  await reason({ sessionId: 's', baseRevision: 0, observations: [] }, undefined, context);
  await reason({ sessionId: 's', baseRevision: 4, observations: [{ id: 'o1', text: 'Tell me about CIBC.', final: true }] }, undefined, context);
  const head = `{"preparationPackage":${JSON.stringify(packagePart(context))},`;
  for (const body of sent) {
    assert.equal(body.instructions, READER_INSTRUCTIONS);
    assert.deepEqual([body.input.length, body.input[0].role], [1, 'user']);
    assert.ok(body.input[0].content.startsWith(head));
  }
  assert.notEqual(sent[0].input[0].content, sent[1].input[0].content);
});

// ---- SPRINT-005, step S5-06 (RT5-1): the reader starts on final words only. ST5-1 and ST5-2. ----
test('ST5-1 partial words start no reading; the final transcript starts exactly one', async t => {
  const snapshots = [];
  const ctx = await liveServer(t, { reason: async snapshot => { snapshots.push(snapshot); return proposal({ question: snapshot.observations.at(-1)?.text ?? null, evidenceIds: snapshot.observations.map(o => o.id) }); } });
  const session = await ctx.open();
  await until(() => snapshots.length === 1);
  const up = event => ctx.f.upstream().emit('message', Buffer.from(JSON.stringify(event)));
  up({ type: 'input_audio_buffer.committed', item_id: 'q1' });
  for (const delta of ['Tell me about ', 'the project you ', 'are most proud of']) up({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'q1', delta });
  await until(() => session.events.filter(e => e.type === 'transcript').length === 3);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(snapshots.length, 1, 'no reading while the words are partial');
  const shown = session.events.filter(e => e.type === 'transcript').at(-1);
  assert.deepEqual([shown.final, shown.text, shown.items.map(i => [i.text, i.final])], [false, 'Tell me about the project you are most proud of', [['Tell me about the project you are most proud of', false]]], 'the page still gets the partial words (SA-17)');
  up({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'q1', transcript: 'Tell me about the project you are most proud of.' });
  await until(() => snapshots.length === 2);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(snapshots.length, 2, 'exactly one reading after the final transcript');
  assert.deepEqual(snapshots[1].observations, [{ id: 'q1', text: 'Tell me about the project you are most proud of.', final: true }]);
  up({ type: 'input_audio_buffer.committed', item_id: 'q2' });
  up({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'q2', transcript: 'Yes.' });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(snapshots.length, 2, 'a final item under 8 characters starts none');
});

test('ST5-2 the snapshot for the reader holds final items only, and the corrected-evidence guard stays', async t => {
  const { s, readings, of, read } = measured(t);
  s.observe('a', 'A first final sentence.', true);
  s.observe('b', 'Words still being', false);
  assert.deepEqual(s.snapshot().observations.map(o => [o.id, o.final]), [['a', true]]);
  assert.deepEqual(s.recent().map(o => o.id), ['a', 'b'], 'the page text still has both');
  for (let i = 0; i < 7; i += 1) s.observe(`f${i}`, `Final sentence number ${i}.`, true);
  assert.deepEqual(s.snapshot().observations.map(o => o.id), ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'], 'the last six final items');
  assert.equal(s.snapshot().event, 'audio');
  assert.equal(makeSession().snapshot().event, 'connected');
  // The guard: a snapshot whose words differ from the final ones is refused, in accept() and in the call's log line.
  const current = s.snapshot();
  assert.equal(s.accept(proposal({ evidenceIds: ['f6'] }), { ...current, observations: current.observations.map(o => ({ ...o, text: `${o.text} changed` })) }), false);
  assert.equal(s.lastRejection.reason, 'corrected-evidence');
  await until(() => readings.length === 1);
  s.observations.set('f6', { id: 'f6', text: 'Other words, set by this test.', final: true });
  await read(500, proposal({ evidenceIds: ['not-heard'] }));
  assert.deepEqual([of('model_call')[0].outcome, of('model_call')[0].reason, s.lastRejection.reason], ['rejected', 'corrected-evidence', 'unknown-evidence']);
});

// ---- SPRINT-005, step S5-07 (RT5-2): the model is not asked for a reply. ST5-3. ----
test('ST5-3 no reply in the schema, the instructions, the state or the page messages; the Question and bullets are shown as before', async () => {
  assert.equal('reply' in modelSchema.shape, false);
  assert.equal(proposalSchema.safeParse(oneCall()).success, true, 'a reading without a reply is valid');
  assert.doesNotMatch(READER_INSTRUCTIONS, /reply|event connected|agent is ready/i);
  const f = createFixtures(), events = [];
  const s = new InterviewSession({ reason: async () => proposal(), emit: e => events.push(e), delayMs: 0, generate: f.generate });
  s.answers.setPackage(packageOf(fixturePackage));
  s.observe('o1', 'Tell me about CIBC.', true);
  assert.equal(s.accept(oneCall({ question: 'Tell me about CIBC.', evidenceIds: ['o1'] }), s.snapshot()), true);
  const answer = events.filter(e => e.type === 'answer').at(-1);
  assert.deepEqual([answer.focus, answer.focusVersion, answer.proposed.status, answer.proposed.bullets], ['Tell me about CIBC.', 1, 'shown', ['Led the Harbor Platform work.', 'Worked with the CIBC team.']]);
  assert.deepEqual(['reply' in answer, 'reply' in s.state, 'reply' in s.snapshot().state], [false, false, false]);
  assert.equal(f.calls.length, 0, 'still one call for the reading and the answer');
  // A reading that still carries a reply has a field the contract does not name: its reading is kept and its answer falls back (AD-3).
  s.observe('o2', 'And the Harbor Platform work?', true);
  assert.equal(s.accept(oneCall({ reply: 'Not asked for.', question: 'And the Harbor Platform work?', evidenceIds: ['o2'] }), s.snapshot()), true);
  assert.deepEqual([s.state.focus, s.answers.view().status], ['And the Harbor Platform work?', 'preparing']);
  await until(() => f.calls.length === 1);
  s.stop();
});

// ---- SPRINT-005, step S5-09 (RT5-6): Stop loses no speech. ST5-8 and ST5-9. ----
import { DRAIN_MS } from './server.mjs';
const commits = ctx => ctx.f.upstream().sent.filter(e => e.type === 'input_audio_buffer.commit').length;
const ended = ctx => ctx.audits.some(a => a.name === 'session_stopped');

test('ST5-8 Stop with buffered speech sends a final commit and logs its transcript before session_stopped, with no reading, Focus or answer from it', async t => {
  const snapshots = [];
  const ctx = await liveServer(t, { autoFocus: true, drainMs: 2000,
    reason: async snapshot => { snapshots.push(snapshot); return oneCall({ question: snapshot.observations.at(-1)?.text ?? null, evidenceIds: snapshot.observations.map(o => o.id) }); } });
  const session = await ctx.open();
  await until(() => snapshots.length === 1);
  await sendPackets(session, true, 0, 6);
  assert.equal(commits(ctx), 0, 'he is still speaking: nothing is committed yet');
  const at = Date.now();
  session.socket.send(JSON.stringify({ type: 'stop' }));
  await until(() => commits(ctx) === 1);
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.deepEqual([session.socket.readyState, ended(ctx)], [WebSocket.OPEN, false], 'the service waits for the last words');
  // While it waits, more audio is not taken and a control changes nothing.
  session.socket.send(loudPacket(6));
  control(session, { type: 'question.reset', requestId: 'late' });
  await until(() => session.events.some(e => e.requestId === 'late'));
  assert.equal(session.events.find(e => e.requestId === 'late').status, 'unavailable');
  ctx.f.say('And my last words were about the launch date?');
  await until(() => ended(ctx));
  assert.ok(Date.now() - at < 1500, 'it closes when the words arrive, not after the full wait');
  await until(() => session.socket.readyState === WebSocket.CLOSED);
  const lines = await readLines(ctx), types = typesOf(lines);
  assert.deepEqual(lines.filter(l => l.type === 'transcript').map(l => [l.text, l.audioStartMs, l.audioEndMs]), [['And my last words were about the launch date?', 0, 600]]);
  assert.ok(types.indexOf('transcript') < types.indexOf('session_stopped') && types.at(-1) === 'session_stopped');
  assert.deepEqual([lines.at(-1).reason, lines.at(-1).seconds], ['user', 0.6]);
  for (const absent of ['speech_lost', 'focus_changed', 'live_question', 'answer_shown', 'question_timing']) assert.equal(types.includes(absent), false, absent);
  assert.deepEqual([snapshots.length, lines.filter(l => l.type === 'model_call').length, ctx.f.calls.length], [1, 1, 0], 'no reading and no answer request from the last words');
  const shown = session.events.filter(e => e.type === 'transcript').at(-1);
  assert.deepEqual([shown.final, shown.items.at(-1).text], [true, 'And my last words were about the launch date?'], 'the page is sent the last words');
  assert.equal(session.events.some(e => e.focus), false);
});

test('ST5-8 the session limit waits for the last words in the same way', async t => {
  const ctx = await liveServer(t, { drainMs: 2000, sessionLimitMs: 250 });
  const session = await ctx.open();
  await sendPackets(session, true, 0, 4);
  await until(() => commits(ctx) === 1, 3000);
  assert.equal(session.events.filter(e => e.type === 'status').at(-1).status, 'POC session limit reached (30 minutes); stop and restart');
  assert.equal(ended(ctx), false);
  ctx.f.say('The last thing said before the limit.');
  await until(() => ended(ctx));
  const lines = await readLines(ctx);
  assert.deepEqual(lines.filter(l => ['error', 'transcript', 'session_stopped'].includes(l.type)).map(l => [l.type, l.code ?? l.reason ?? l.text]),
    [['error', 'limit'], ['transcript', 'The last thing said before the limit.'], ['session_stopped', 'limit']]);
});

test('ST5-9 when the last words do not arrive in time, speech_lost with its audio is logged and the session ends', async t => {
  assert.equal(DRAIN_MS, 3000, 'the service waits 3 seconds');
  const ctx = await liveServer(t, { drainMs: 200 });
  const session = await ctx.open();
  await sendPackets(session, true, 0, 6);
  const at = Date.now();
  session.socket.send(JSON.stringify({ type: 'stop' }));
  await until(() => ended(ctx));
  assert.ok(Date.now() - at >= 180, 'after the wait, not before');
  await until(() => session.socket.readyState === WebSocket.CLOSED);
  let lines = await readLines(ctx);
  assert.deepEqual(lines.slice(-2).map(l => [l.type, l.audioMs ?? l.reason]), [['speech_lost', 600], ['session_stopped', 'user']]);
  assert.deepEqual(Object.keys(lines.at(-2)).sort(), ['audioMs', 'ms', 't', 'type']);
  assert.equal(session.events.some(e => /lost|captured/i.test(JSON.stringify(e))), false, 'the page is told nothing (Pablo: log only)');
  // A disconnect and an error cannot wait: what was spoken and not transcribed is logged as lost at once.
  for (const [reason, end] of [['disconnect', s => s.socket.close()], ['error', () => ctx.f.upstream().emit('message', Buffer.from(JSON.stringify({ type: 'error', error: { code: 'x' } })))]]) {
    ctx.audits.length = 0;
    const next = await ctx.open();
    await sendPackets(next, true, 0, 3);
    end(next);
    await until(() => ended(ctx));
    lines = await readLines(ctx);
    assert.deepEqual(lines.slice(-2).map(l => [l.type, l.audioMs ?? l.reason]), [['speech_lost', 300], ['session_stopped', reason]], reason);
  }
  // Nothing spoken, nothing lost.
  ctx.audits.length = 0;
  const quiet = await ctx.open();
  await sendPackets(quiet, false, 0, 5);
  await stopped(ctx, quiet);
  assert.equal(typesOf(await readLines(ctx)).includes('speech_lost'), false);
});

test('ST5-8 ST5-9 the session counts what is still awaited, and a page that leaves during the wait frees its place', async t => {
  const s = makeSession();
  assert.deepEqual(s.awaited(), { items: 0, audioMs: 0 });
  for (let i = 0; i < 5; i += 1) s.audio(packet(i));
  s.commitSent();
  assert.deepEqual(s.awaited(), { items: 1, audioMs: 500 }, 'a commit the transcription service has not answered');
  s.committed('one'); s.observe('one', 'Half a sent', false);
  assert.deepEqual(s.awaited(), { items: 1, audioMs: 500 }, 'an item still being transcribed');
  s.drain();
  assert.deepEqual([s.attending, s.active, s.accept(proposal(), s.snapshot()), s.lastRejection.reason], [false, true, false, 'stopped']);
  s.observe('one', 'Half a sentence, now whole.', true);
  assert.deepEqual([s.awaited(), s.pending, s.state.revision], [{ items: 0, audioMs: 0 }, false, 0], 'the final words are taken and start nothing');
  s.stop();
  const ctx = await liveServer(t, { drainMs: 600 });
  const first = await ctx.open();
  await sendPackets(first, true, 0, 3);
  first.socket.send(JSON.stringify({ type: 'stop' }));
  first.socket.close();
  await until(async () => true);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.deepEqual([ended(ctx), (await ctx.health()).sessions], [false, 0], 'still waiting, but no longer counted as listening');
  const second = await ctx.open();
  assert.ok(second.sessionId && second.sessionId !== first.sessionId, 'a new session can start at once');
  await until(() => named(ctx.audits, 'session_stopped').length === 1);
  // Shutting the service down does not wait: the session ends at once and what was not transcribed is logged as lost.
  const long = await liveServer(t, { drainMs: 60000 });
  const third = await long.open();
  await sendPackets(third, true, 0, 3);
  third.socket.send(JSON.stringify({ type: 'stop' }));
  await until(() => commits(long) === 1);
  long.shutdown();
  await until(() => ended(long));
  const name = (await readdir(long.logDir)).find(n => n.endsWith('.jsonl'));
  await until(async () => true);
  await new Promise(resolve => setTimeout(resolve, 50));
  const last = (await readFileAsync(join(long.logDir, name), 'utf8')).trim().split('\n').map(line => JSON.parse(line)).slice(-2);
  assert.deepEqual(last.map(l => [l.type, l.audioMs ?? l.reason]), [['speech_lost', 300], ['session_stopped', 'user']]);
});
