import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';
import { createReasoner, publicError } from './agent.mjs';
import { InterviewSession } from './session.mjs';

const root = new URL('../', import.meta.url);
const assets = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/poc/audio-worklet.js', ['poc/audio-worklet.js', 'text/javascript']],
]);

export function createPocServer({ reason = createReasoner(), apiKey = process.env.OPENAI_API_KEY,
  transcriptionModel = process.env.TRANSCRIPTION_MODEL || 'gpt-live-transcribe',
  connect = () => new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription', {
    headers: { Authorization: `Bearer ${apiKey}` }, handshakeTimeout: 15000,
  }), audit = (event, data) => console.log(JSON.stringify({ event, at: Date.now(), ...data })) } = {}) {
  const sessions = new Set();
  const server = createServer(async (req, res) => {
    if (!validHost(req.headers.host)) { res.writeHead(403).end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'alive', configured: Boolean(apiKey), sessions: sessions.size }));
      return;
    }
    const asset = assets.get(req.url);
    if (!asset) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(new URL(asset[0], root));
      res.setHeader('Content-Type', `${asset[1]}; charset=utf-8`);
      res.end(body);
    } catch { res.writeHead(500).end('Unable to load page'); }
  });

  function validHost(host) {
    return ['127.0.0.1', 'localhost'].some(name => host === `${name}:${server.address()?.port}`);
  }
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    if (req.url !== '/session' || !validHost(req.headers.host) || origin !== `http://${req.headers.host}` || sessions.size) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, client => wss.emit('connection', client));
  });

  wss.on('connection', client => {
    let upstream, ready = false, speech = false, silentMs = 0, bufferedMs = 0, closed = false;
    const session = new InterviewSession({ reason, audit, emit: event => {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 65536) client.send(JSON.stringify(event));
      else cleanup();
    } });
    sessions.add(session);
    const readyTimer = setTimeout(() => fail('Transcription connection timed out; stop and restart'), 20000);
    const lifetime = setTimeout(() => fail('POC session limit reached (30 minutes); stop and restart'), 30 * 60000);
    function cleanup() {
      if (closed) return;
      closed = true;
      clearTimeout(readyTimer); clearTimeout(lifetime);
      session.stop(); sessions.delete(session);
      if (upstream?.readyState === WebSocket.CONNECTING) upstream.terminate();
      else upstream?.close();
      client.close();
      audit('session_stopped', { sessionId: session.id, packets: session.packets });
    }
    function fail(message) {
      session.send('status', { status: message });
      cleanup();
    }
    session.send('status', { status: 'server connected; opening transcription' });
    if (!apiKey) { fail('Server needs OPENAI_API_KEY'); return; }
    session.schedule();
    try { upstream = connect(); } catch { fail('Could not connect to transcription'); return; }
    upstream.on('open', () => upstream.send(JSON.stringify({
      type: 'session.update', session: { type: 'transcription', audio: { input: {
        format: { type: 'audio/pcm', rate: 24000 },
        transcription: { model: transcriptionModel }, turn_detection: null,
      } } },
    })));
    upstream.on('message', raw => {
      if (closed) return;
      let event;
      try { event = JSON.parse(raw.toString()); } catch { fail('Invalid transcription response'); return; }
      if (event.type === 'session.updated') {
        ready = true; clearTimeout(readyTimer);
        session.send('ready', { status: 'listening on server' });
      } else if (event.type === 'input_audio_buffer.committed') {
        session.committed(event.item_id, event.previous_item_id);
      } else if (event.type === 'conversation.item.input_audio_transcription.delta') {
        session.observe(event.item_id, event.delta, false);
      } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
        session.observe(event.item_id, event.transcript, true);
      } else if (event.type === 'error' || event.type === 'conversation.item.input_audio_transcription.failed') {
        audit('transcription_failed', { code: event.error?.code || 'unknown' });
        fail(publicError(event.error));
      }
    });
    upstream.on('error', () => fail('Transcription connection failed; stop and restart'));
    upstream.on('close', () => { if (!closed) fail('Transcription disconnected; stop and restart'); });
    client.on('message', (raw, binary) => {
      if (closed) return;
      if (!binary) {
        try {
          const message = JSON.parse(raw.toString());
          if (message.type === 'stop') cleanup();
          else if (message.type === 'rendered' && Number.isSafeInteger(message.revision)) {
            // Display evidence only; a rendered Live question is never consent to confirm it.
            const live = typeof message.liveId === 'string' && Number.isSafeInteger(message.liveVersion)
              ? { liveId: message.liveId.slice(0, 100), liveVersion: message.liveVersion } : {};
            audit('browser_rendered', { sessionId: session.id, revision: message.revision, ...live });
          } else if (typeof message.type === 'string' && message.type.startsWith('question.')) {
            // Malformed question controls get an invalid result; they never end the session.
            session.control(message);
          } else fail('Invalid control message');
        } catch { fail('Invalid control message'); }
        return;
      }
      if (!ready) { fail('Audio arrived before transcription was ready'); return; }
      if (upstream.bufferedAmount > 96000) { fail('Audio backlog exceeded two seconds; stop and restart'); return; }
      try {
        const pcm = session.audio(raw);
        let sum = 0;
        for (let i = 0; i < pcm.length; i += 2) sum += (pcm.readInt16LE(i) / 32768) ** 2;
        const voiced = Math.sqrt(sum / 2400) > 0.012;
        speech ||= voiced;
        silentMs = voiced ? 0 : silentMs + 100;
        bufferedMs += 100;
        upstream.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm.toString('base64') }));
        if (speech && (silentMs >= 800 || bufferedMs >= 8000)) {
          upstream.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          speech = false; bufferedMs = 0; silentMs = 0;
        } else if (!speech && bufferedMs >= 5000) {
          upstream.send(JSON.stringify({ type: 'input_audio_buffer.clear' })); bufferedMs = 0;
        }
      } catch (error) { fail(error.message); }
    });
    client.on('close', cleanup);
    client.on('error', cleanup);
  });
  server.shutdown = () => {
    for (const client of wss.clients) client.close();
    wss.close(); server.close();
  };
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createPocServer();
  server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => {
    console.log(`SpeakerCoach POC: http://127.0.0.1:${server.address().port}`);
  });
  process.once('SIGINT', () => server.shutdown());
  process.once('SIGTERM', () => server.shutdown());
}
