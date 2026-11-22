import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';
import { createReasoner, publicError } from './agent.mjs';
import { createGenerator, answerTimeout, modelInput, answerModel } from './answer.mjs';
import { createLogStore, LOG_VERSION } from './meeting-log.mjs';
import { execFile } from 'node:child_process';
import { loadPackage, DEFAULT_PACKAGE_DIR, PACKAGE_MAX } from './package-loader.mjs';
import { createPackageStore, buildUpload, BODY_MAX } from './package-store.mjs';
import { InterviewSession } from './session.mjs';
import { extractTerms, hintPrompt } from './vocabulary.mjs';

const root = new URL('../', import.meta.url);
// A pause (silence after speech) is the only trigger for transcription and for asking for guidance. Default 800 ms;
// ALICE_PAUSE_MS tunes it in steps of 100 ms (300 to 5000), the size of one audio packet.
const PAUSE_MS = (value => Number.isFinite(value) ? Math.min(5000, Math.max(300, Math.round(value / 100) * 100)) : 800)(Number(process.env.ALICE_PAUSE_MS || NaN));
// Backstop only (upstream audio buffer limit); a turn never commits mid-speech before this.
const MAX_BUFFER_MS = 120000;
const PRIVATE_WARNING = 'WARNING: ALICE_PRINT_REQUEST is on. The text below is private (question and preparation documents); other tools may read this terminal. Clear it afterwards.';
const assets = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/poc/audio-worklet.js', ['poc/audio-worklet.js', 'text/javascript']],
  ['/preview', ['poc/preview/index.html', 'text/html']],
  ['/preview/preview.css', ['poc/preview/preview.css', 'text/css']],
  ['/preview/preview.js', ['poc/preview/preview.js', 'text/javascript']],
  ['/poc/avatar.js', ['poc/avatar.js', 'text/javascript']],
]);
// AV-7: the avatar's files are a fixed list under poc/vendor (never a directory), served from this origin only.
const VENDOR_FILES = [
  'talkinghead/talkinghead.mjs', 'talkinghead/dynamicbones.mjs', 'talkinghead/retargeter.mjs', 'talkinghead/lipsync-en.mjs',
  'three/build/three.module.js', 'three/build/three.core.js',
  ...['controls/OrbitControls.js', 'curves/NURBSCurve.js', 'curves/NURBSUtils.js', 'environments/RoomEnvironment.js', 'libs/fflate.module.js',
    'libs/meshopt_decoder.module.js', 'libs/stats.module.js', 'loaders/DRACOLoader.js', 'loaders/FBXLoader.js', 'loaders/GLTFLoader.js',
    'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js'].map(f => `three/examples/jsm/${f}`),
  'models/mpfb.glb',
];
for (const file of VENDOR_FILES) assets.set(`/poc/vendor/${file}`, [`poc/vendor/${file}`, file.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript']);
export const VENDOR_ASSETS = VENDOR_FILES.map(f => `/poc/vendor/${f}`);

export function createPocServer({ reason = createReasoner(), apiKey = process.env.OPENAI_API_KEY,
  generate = createGenerator(), now = Date.now, answerTimeoutMs = answerTimeout(), packageDir = process.env.ALICE_PACKAGE_DIR || DEFAULT_PACKAGE_DIR,
  logDir = process.env.ALICE_LOG_DIR || undefined, logMaxBytes, mono, revision, log = console.log, reasonDelayMs = 2500, requirePause = true, autoFocus = true, printRequest = process.env.ALICE_PRINT_REQUEST === '1', stderr = process.stderr,
  transcriptionModel = process.env.TRANSCRIPTION_MODEL || 'gpt-live-transcribe',
  connect = () => new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription', {
    headers: { Authorization: `Bearer ${apiKey}` }, handshakeTimeout: 15000,
  }), audit = (event, data) => console.log(JSON.stringify({ event, at: Date.now(), ...data })) } = {}) {
  const sessions = new Set();
  const store = createPackageStore(packageDir);
  const logs = createLogStore({ dir: logDir, wallNow: now, mono, maxBytes: logMaxBytes });
  // The app revision for the log header: the Git commit, or "unknown"; looked up once, never on the audio path.
  const revisionOnce = (() => { let memo; return () => memo ??= revision !== undefined ? Promise.resolve(revision)
    : new Promise(done => execFile('git', ['rev-parse', '--short', 'HEAD'], { cwd: fileURLToPath(root), timeout: 2000 }, (error, out) => done(error ? 'unknown' : out.trim() || 'unknown'))); })();
  const startedAt = now();
  const configured = typeof apiKey === 'string' && apiKey.trim().length > 0;
  // PR-1 to PR-4: off unless exactly '1'; the assembled input goes to standard error only, with a warning.
  const print = printRequest ? ({ instructions, input }) => stderr.write(`${PRIVATE_WARNING}\n${instructions}\n\n${input}\n`) : undefined;
  if (printRequest) stderr.write(`${PRIVATE_WARNING}\n`);
  const route = async (req, res) => {
    if (!validHost(req.headers.host)) { res.writeHead(403).end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.url === '/package') { await packageRoute(req, res); return; }
    if (req.url === '/log') { await logRoute(req, res); return; }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      const { found, chars } = await loadPackage(packageDir);
      res.end(JSON.stringify({ status: 'alive', service: 'alice-good-meetings', startedAt, configured, sessions: sessions.size, package: { found, chars } }));
      return;
    }
    const asset = assets.get(req.url);
    if (!asset) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(new URL(asset[0], root));
      res.setHeader('Content-Type', asset[1].startsWith('model/') ? asset[1] : `${asset[1]}; charset=utf-8`);
      res.end(body);
    } catch { res.writeHead(500).end('Unable to load page'); }
  };
  // A request that fails part-way, such as an upload cut off mid-body, is answered or dropped; it must never end the service.
  const server = createServer((req, res) => {
    route(req, res).catch(() => { try { if (!res.headersSent) res.writeHead(400); res.end(); } catch { /* the caller is gone */ } });
  });

  // Same caller rule as the session socket (SD-3): this Host, and an Origin that is this page; a change needs the Origin.
  // A browser GET carries no Origin, so it must say it comes from this page or the address bar (Sec-Fetch-Site same-origin
  // or none): another site can then not make the browser fetch or download the log. Tools that send neither header are local.
  function validCaller(req) {
    const { origin } = req.headers, site = req.headers['sec-fetch-site'];
    if (!validHost(req.headers.host)) return false;
    if (origin !== undefined) return origin === `http://${req.headers.host}`;
    return req.method === 'GET' && (site === undefined || site === 'same-origin' || site === 'none');
  }
  const sendJson = (res, status, body) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.writeHead(status).end(JSON.stringify(body)); };
  async function readBody(req) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > BODY_MAX) return null; chunks.push(chunk); }
    return Buffer.concat(chunks).toString('utf8');
  }
  // GET, PUT and DELETE /package (SU-3 to SU-10): counts only come back; text never does (SU-9).
  async function packageRoute(req, res) {
    if (!validCaller(req)) { res.writeHead(403).end(); return; }
    const refuse = async (status, reason, extra = {}) => sendJson(res, status, { result: 'refused', reason, package: await store.status(), skipped: [], ...extra });
    if (req.method === 'GET') { sendJson(res, 200, await store.status()); return; }
    if (req.method !== 'PUT' && req.method !== 'DELETE') { res.writeHead(405).end(); return; }
    if (sessions.size) { await refuse(409, 'listening'); return; }
    if (req.method === 'DELETE') {
      const pkg = await store.remove();
      audit('package_removed', {}); sendJson(res, 200, { result: 'removed', reason: null, package: pkg, skipped: [] }); return;
    }
    if (!/^application\/json\s*(;|$)/i.test(req.headers['content-type'] || '')) { await refuse(415, 'content-type'); return; }
    if (Number(req.headers['content-length']) > BODY_MAX) { await refuse(413, 'body-too-large'); req.destroy(); return; }
    const text = await readBody(req);
    if (text === null) { await refuse(413, 'body-too-large'); return; }
    let body;
    try { body = JSON.parse(text); } catch { await refuse(400, 'refused'); return; }
    const upload = buildUpload(body);
    if (!upload.ok) { await refuse(upload.reason === 'refused' ? 400 : 422, upload.reason, { ...(upload.name ? { name: upload.name } : {}), ...(upload.chars ? { chars: upload.chars, limit: PACKAGE_MAX } : {}) }); return; }
    const status = await store.replace(upload.package);
    audit('package_uploaded', { files: status.files, chars: status.chars, terms: status.terms, skipped: upload.skipped.length });
    sendJson(res, 200, { result: 'loaded', reason: null, package: status, skipped: upload.skipped });
  }

  // GET /log (SD-1, SD-3): the current or most recent meeting log, complete lines only; no list and no other method.
  async function logRoute(req, res) {
    if (!validCaller(req)) { res.writeHead(403).end(); return; }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const found = await logs.read();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (!found) { res.writeHead(404).end('No meeting log yet.'); return; }
    res.setHeader('Content-Disposition', `attachment; filename="${found.filename}"`);
    res.writeHead(200).end(found.text);
  }

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
    let upstream, ready = false, speech = false, silentMs = 0, bufferedMs = 0, closed = false, mlog = null;
    // Pause tracking: the signal that Pablo is thinking and waiting for help is PAUSE_MS of silence after speech.
    let pauseMs = 0, heardSpeech = false;
    const session = new InterviewSession({ reason, audit, record: (type, data) => mlog?.write(type, data), canAsk: () => !requirePause || (heardSpeech && pauseMs >= PAUSE_MS), delayMs: reasonDelayMs, autoFocus, generate, now, answerTimeoutMs, print, emit: event => {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 65536) client.send(JSON.stringify(event));
      else cleanup();
    } });
    sessions.add(session);
    const readyTimer = setTimeout(() => fail('Transcription connection timed out; stop and restart'), 20000);
    const lifetime = setTimeout(() => fail('POC session limit reached (30 minutes); stop and restart', 'limit'), 30 * 60000);
    function cleanup(reason = 'disconnect') {
      if (closed) return;
      closed = true;
      if (mlog) {
        if (heardSpeech && pauseMs >= 800) mlog.write('pause', { startMs: session.packets * 100 - pauseMs, durationMs: pauseMs });
        mlog.write('session_stopped', { reason, seconds: Math.round(session.samples / 240) / 100 });
        mlog.close();
      }
      clearTimeout(readyTimer); clearTimeout(lifetime);
      session.stop(); sessions.delete(session);
      if (upstream?.readyState === WebSocket.CONNECTING) upstream.terminate();
      else upstream?.close();
      client.close();
      audit('session_stopped', { sessionId: session.id, packets: session.packets });
    }
    function fail(message, reason = 'error') {
      session.send('status', { status: message });
      mlog?.write('error', { code: reason, message });
      cleanup(reason);
    }
    session.send('status', { status: 'server connected; opening transcription' });
    if (!configured) { fail('Server needs OPENAI_API_KEY'); return; }
    // The package is read once, before ready, and held in memory for this session only (CT-15, PK-8).
    let hint;
    const openUpstream = () => {
      try { upstream = connect(); } catch { fail('Could not connect to transcription'); return; }
      upstream.on('open', () => upstream.send(JSON.stringify({
        type: 'session.update', session: { type: 'transcription', audio: { input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: { model: transcriptionModel, ...(hint ? { prompt: hint } : {}) }, turn_detection: null,
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
      // A refused key arrives as an HTTP status on the handshake: show only the public error text (NK-3, NK-7).
      upstream.on('unexpected-response', (_request, response) => { fail(publicError({ status: response.statusCode })); response.destroy?.(); });
      upstream.on('error', () => fail('Transcription connection failed; stop and restart'));
      upstream.on('close', () => { if (!closed) fail('Transcription disconnected; stop and restart'); });
    };
    // The package in use at Start is the snapshot of this session (SU-7).
    store.current().then(async ({ source, pkg }) => {
      if (closed) return;
      // Every listening session writes a log; no setting turns it off (ML-13). The header has counts only (ML-14).
      const counts = { source, status: pkg.status, files: pkg.files.length, chars: pkg.chars, terms: pkg.status === 'usable' ? extractTerms(pkg.documents).length : 0 };
      const rev = await revisionOnce();
      if (closed) return;
      mlog = logs.start(session.id, () => session.send('log', { status: 'not saved' }));
      mlog.write('log_started', { version: LOG_VERSION, sessionId: session.id, startedAt: new Date(mlog.startedAt).toISOString(), tzOffsetMin: -new Date(mlog.startedAt).getTimezoneOffset(),
        revision: rev, models: { transcription: transcriptionModel, reader: process.env.OPENAI_MODEL || 'gpt-6-astra', answer: answerModel() }, keyConfigured: configured, pauseMs: PAUSE_MS, package: counts });
      mlog.write('package', { ...counts, skipped: pkg.skipped.length });
      session.answers.setPackage(pkg);
      // Terms are picked locally from the package; they go to transcription as a prompt and, with the documents, to the question reader.
      const terms = pkg.status === 'usable' ? extractTerms(pkg.documents) : [];
      hint = hintPrompt(terms);
      session.setContext({ terms, documents: pkg.documents });
      audit('package_loaded', { sessionId: session.id, source, status: pkg.status, files: pkg.files, chars: pkg.chars, skipped: pkg.skipped, terms: terms.length });
      log(`package: status=${pkg.status} files=${pkg.files.length} chars=${pkg.chars} skipped=${pkg.skipped.join(',') || 'none'}`);
      session.schedule();
      openUpstream();
    });
    client.on('message', (raw, binary) => {
      if (closed) return;
      if (!binary) {
        try {
          const message = JSON.parse(raw.toString());
          if (message.type === 'stop') cleanup('user');
          else if (message.type === 'rendered' && Number.isSafeInteger(message.revision)) {
            // Display evidence only; a rendered Live question is never consent to confirm it.
            const live = typeof message.liveId === 'string' && Number.isSafeInteger(message.liveVersion)
              ? { liveId: message.liveId.slice(0, 100), liveVersion: message.liveVersion } : {};
            const answer = Number.isSafeInteger(message.answerFocusVersion) && typeof message.answerStatus === 'string'
              ? { answerFocusVersion: message.answerFocusVersion, answerStatus: message.answerStatus.slice(0, 20) } : {};
            audit('browser_rendered', { sessionId: session.id, revision: message.revision, ...live, ...answer });
            if (answer.answerStatus) session.rendered(answer);
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
        if (voiced) {
          session.voiced();
          // ML-3: the first speech, and each silence of 800 ms or more with the speech that ends it.
          if (!heardSpeech || pauseMs >= 800) {
            if (heardSpeech) mlog?.write('pause', { startMs: (session.packets - 1) * 100 - pauseMs, durationMs: pauseMs });
            mlog?.write('speech_start', {});
          }
        }
        speech ||= voiced;
        heardSpeech ||= voiced;
        pauseMs = voiced ? 0 : pauseMs + 100;
        silentMs = voiced ? 0 : silentMs + 100;
        bufferedMs += 100;
        upstream.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm.toString('base64') }));
        // Commit only on a pause. MAX_BUFFER_MS is a backstop for the upstream buffer limit, not a trigger.
        if (speech && (silentMs >= PAUSE_MS || bufferedMs >= MAX_BUFFER_MS)) {
          upstream.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          session.commitSent();
          speech = false; bufferedMs = 0; silentMs = 0;
        } else if (!speech && bufferedMs >= 5000) {
          upstream.send(JSON.stringify({ type: 'input_audio_buffer.clear' })); bufferedMs = 0; session.bufferCleared();
        }
      } catch (error) { fail(error.message); }
    });
    client.on('close', () => cleanup());
    client.on('error', () => cleanup());
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
    console.log(`Alice.Good.Meetings POC: http://127.0.0.1:${server.address().port}`);
    if (!process.env.OPENAI_API_KEY?.trim()) console.log('No OpenAI key is set up: question recognition and proposed answers are unavailable.');
  });
  process.once('SIGINT', () => server.shutdown());
  process.once('SIGTERM', () => server.shutdown());
}
