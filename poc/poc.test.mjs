import test from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import WebSocket from 'ws';
import { InterviewSession } from './session.mjs';
import { createPocServer } from './server.mjs';

const proposal = (changes = {}) => ({ reply: 'I heard the question.', phase: 'QUESTION', question: 'Tell me about yourself.', evidenceIds: ['one'], ...changes });
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

test('controller retains an established question throughout an answer', () => {
  const s = makeSession();
  s.observe('one', 'Tell me about yourself.', true);
  assert.equal(s.accept(proposal(), s.snapshot()), true);
  s.observe('two', 'I have worked as a developer.', true);
  assert.equal(s.accept(proposal({ phase: 'ANSWER', question: 'Invented replacement', evidenceIds: ['two'] }), s.snapshot()), true);
  assert.equal(s.state.question, 'Tell me about yourself.');
  assert.equal(s.state.phase, 'ANSWER');
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

test('HTTP exposes only public assets; WebSocket sends audio to transcription and returns a real session event', async t => {
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
    reason: async () => proposal({ phase: 'GREETINGS', question: null, evidenceIds: [] }) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.shutdown());
  const origin = `http://127.0.0.1:${server.address().port}`;
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
