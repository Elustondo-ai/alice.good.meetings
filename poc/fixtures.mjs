import { EventEmitter } from 'node:events';

// Test and page-check hooks (FX-1 to FX-5): scripted transcription and a generator held one request at a time.
// All text here is invented; nothing here reads the benchmark folder or a real preparation package.
export function createFixtures() {
  const calls = [];
  const waiting = [];
  const state = { upstream: null, item: 0 };
  const connect = () => {
    const up = new EventEmitter();
    Object.assign(up, { readyState: 1, bufferedAmount: 0, sent: [] });
    up.send = raw => {
      const event = JSON.parse(raw);
      up.sent.push(event);
      if (event.type === 'session.update') setImmediate(() => up.emit('message', Buffer.from('{"type":"session.updated"}')));
    };
    up.close = () => { up.readyState = 3; up.emit('close'); };
    up.terminate = up.close;
    state.upstream = up;
    setImmediate(() => up.emit('open'));
    return up;
  };
  const emit = event => state.upstream.emit('message', Buffer.from(JSON.stringify(event)));
  // Scripted speech: committed, one delta and the completed transcript, as a real turn would arrive.
  const say = text => {
    const id = `item-${++state.item}`;
    emit({ type: 'input_audio_buffer.committed', item_id: id });
    emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: id, delta: text });
    emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: id, transcript: text });
    return id;
  };
  const generate = (request, { signal, meter } = {}) => new Promise((resolve, reject) => {
    calls.push({ request: structuredClone(request), signal });
    const entry = { resolve, reject, meter };
    waiting.push(entry);
    signal?.addEventListener('abort', () => {
      const i = waiting.indexOf(entry);
      if (i >= 0) waiting.splice(i, 1);
      reject(signal.reason);
    }, { once: true });
  });
  const take = () => {
    const entry = waiting.shift();
    if (!entry) throw new Error('No generator request is waiting');
    return entry;
  };
  return {
    connect, generate, say, calls,
    // `usage`, when given, is reported as the call's token counts before the result (RT5-4); without it there is none.
    release: (result, usage) => { const entry = take(); if (usage) entry.meter?.(usage); entry.resolve(result); },
    fail: error => take().reject(error ?? new Error('fixture failure')),
    waiting: () => waiting.length,
    upstream: () => state.upstream,
  };
}

export default createFixtures;
