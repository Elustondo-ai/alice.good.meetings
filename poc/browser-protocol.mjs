import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';

// Deterministic page checks for the UC-04 Focus and Live question panel. The page and its scripts are real;
// the /session WebSocket is scripted here, so no POC service or OpenAI request is involved.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../', import.meta.url);
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']],
  ['/poc/audio-worklet.js', ['poc/audio-worklet.js', 'text/javascript']]]);
const multipart = 'Tell me about your last two jobs, and why you left the second one, and what you would do differently.';

// Static files come from a loopback server because Playwright routing does not see AudioWorklet module loads.
const assets = createServer(async (req, res) => {
  const file = files.get(req.url);
  if (!file) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': file[1] }).end(await readFile(new URL(file[0], root)));
});
assets.listen(0, '127.0.0.1'); await once(assets, 'listening');
const origin = `http://127.0.0.1:${assets.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [], sockets = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(`${origin.replace('http:', 'ws:')}/session`, ws => {
    const socket = { ws, controls: [], rendered: [] };
    ws.onMessage(raw => {
      if (typeof raw !== 'string') return;
      const message = JSON.parse(raw);
      (message.type === 'rendered' ? socket.rendered : socket.controls).push(message);
    });
    sockets.push(socket);
  });
  await page.clock.install();
  await page.goto(`${origin}/`);
  const until = async predicate => {
    for (let i = 0; i < 300 && !(await predicate()); i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(await predicate(), 'condition timed out');
  };
  const text = selector => page.locator(selector).textContent();
  const disabled = selector => page.locator(selector).isDisabled();
  const emit = (socket, type, data = {}, sessionId = socket.id) =>
    socket.ws.send(JSON.stringify({ type, sessionId, serverAt: Date.now(), ...data }));
  const state = (revision, changes = {}) => ({ revision, phase: 'QUESTION', reply: 'ok', focus: null,
    focusVersion: 0, exchangeId: null, live: null, ...changes });
  const live = (id, version, value, kind = 'new') => ({ id, version, text: value, kind });
  const lastControl = socket => socket.controls.at(-1);
  const results = { layout: {} };
  // Measures the current panel state at desktop and phone widths: no overflow, no overlapping panels.
  const checkLayout = async name => {
    for (const [width, size] of [['desktop', { width: 1280, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
      await page.setViewportSize(size);
      // Let the resized page repaint (animation frames run on the fake clock) before measuring or capturing.
      await page.clock.runFor(50);
      await new Promise(resolve => setTimeout(resolve, 200));
      const layout = await page.evaluate(() => {
        const box = id => document.getElementById(id).getBoundingClientRect();
        const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const q = document.getElementById('question');
        return { pageOverflow: document.documentElement.scrollWidth > innerWidth, questionOverflow: q.scrollWidth > q.clientWidth,
          overlaps: ['debug', 'server', 'controls'].filter(id => overlap(box('question'), box(id))) };
      });
      assert.deepEqual([layout.pageOverflow, layout.questionOverflow, layout.overlaps], [false, false, []], `${name} ${width}`);
      await page.screenshot({ path: `/tmp/speakercoach-uc04-${name}-${width}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    results.layout[name] = 'PASS';
  };

  // Ready: both areas show their empty text; Confirm is disabled with a hint, Clear live is available.
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await until(() => sockets.length === 1);
  const one = sockets[0]; one.id = 'session-1';
  emit(one, 'status', { status: 'server connected' });
  assert.equal(await text('#confirm-hint'), 'Start listening to continue.');
  emit(one, 'ready', { status: 'listening on server' });
  await until(async () => (await text('#live-question')) === 'Listening for a question…');
  assert.equal(await text('#focus-question'), 'No focus question yet');
  assert.equal(await text('#confirm-hint'), 'Confirm becomes available when a question is heard.');
  assert.ok(await disabled('#confirm-question') && !(await disabled('#clear-live')));
  results.ready = 'PASS';
  await checkLayout('1-ready');

  // A heard question fills Live with its tag; keyboard Confirm sends exactly the displayed Live.
  emit(one, 'answer', state(1, { live: live('L1', 1, multipart) }));
  await until(async () => (await text('#live-question')) === multipart);
  assert.deepEqual([await text('#live-tag'), await text('#confirm-hint')], ['new question', '']);
  await checkLayout('2-heard');
  await page.clock.runFor(100);
  await until(() => one.rendered.some(r => r.revision === 1 && r.liveId === 'L1' && r.liveVersion === 1));
  await page.locator('#confirm-question').focus();
  await page.keyboard.press('Enter');
  await until(() => lastControl(one)?.type === 'question.confirm');
  const first = lastControl(one);
  assert.deepEqual([first.liveId, first.liveVersion, first.expectedFocusVersion, first.text, first.sessionId],
    ['L1', 1, 0, multipart, 'session-1']);
  assert.equal(await text('#confirm-hint'), 'Waiting for the server…');
  assert.ok(await disabled('#clear-live'), 'Clear live waits for the pending result');
  results.keyboardConfirm = 'PASS';

  // A newer Live during the request keeps the submitted wording visible; a stale result asks for review.
  const corrected = 'Tell me about your last two jobs and why you left the second one.';
  emit(one, 'answer', state(2, { live: live('L1', 2, corrected) }));
  await until(async () => (await text('#live-note')).startsWith('Newer wording'));
  assert.deepEqual([await text('#live-question'), await text('#live-tag')], [multipart, 'confirming…']);
  emit(one, 'question.result', { requestId: first.requestId, status: 'stale', state: state(2, { live: live('L1', 2, corrected) }) });
  await until(async () => (await text('#live-question')) === corrected);
  assert.match(await text('#question-feedback'), /changed before it was confirmed/);
  results.staleNewerLive = 'PASS';

  // A lost acknowledgement becomes uncertain after five seconds; the retry resends the identical request.
  await page.getByRole('button', { name: 'Confirm question' }).click();
  await until(() => lastControl(one).requestId !== first.requestId);
  const second = lastControl(one);
  await page.clock.runFor(5100);
  await until(async () => (await text('#question-feedback')).startsWith('Confirmation uncertain'));
  await checkLayout('6-uncertain');
  await page.getByRole('button', { name: 'Retry confirmation' }).click();
  await until(() => one.controls.length === 3);
  assert.deepEqual(lastControl(one), second);
  results.uncertainRetry = 'PASS';

  // Only the confirmed result sets Focus; older or other-session events cannot roll the display back.
  emit(one, 'answer', state(1, { focus: 'Rolled back?' }));
  emit(one, 'answer', state(99, { focus: 'Other session' }), 'session-0');
  const confirmed = state(3, { focus: corrected, focusVersion: 1, exchangeId: 1 });
  emit(one, 'question.result', { requestId: second.requestId, status: 'confirmed', liveId: 'L1', liveVersion: 2, focusVersion: 1, state: confirmed });
  await until(async () => (await text('#focus-question')) === corrected);
  await page.clock.runFor(50);
  await until(() => one.rendered.some(r => r.revision === 3 && !('liveId' in r)));
  assert.deepEqual([await text('#live-question'), await text('#live-tag')], ['Listening for a question…', '']);
  assert.match(await text('#question-feedback'), /^Confirmed/);
  assert.equal(await text('#confirm-hint'), 'Confirm becomes available when a new question is heard.');
  await checkLayout('3-confirmed');
  emit(one, 'question.result', { requestId: first.requestId, status: 'stale', state: state(2, { live: live('L1', 2, corrected) }) });
  await page.clock.runFor(100);
  assert.deepEqual([await text('#focus-question'), await text('#live-question')], [corrected, 'Listening for a question…']);
  results.confirmNoRollback = 'PASS';

  // 4 November case: a new question while answering fills Live, Focus stays, and old feedback clears.
  emit(one, 'answer', state(4, { phase: 'ANSWER', focus: corrected, focusVersion: 1, exchangeId: 1 }));
  await until(async () => (await text('#live-question')) === 'Listening for a question…' && (await text('#question-feedback')) !== '');
  // Answering: drive the timer to LAND IT the same way the live smoke does; Focus stays on screen.
  await page.evaluate(() => { mic.turnStart = performance.now() - 26000; tick({ getFloatTimeDomainData: b => b.fill(0.1) }, new Float32Array(2048)); });
  assert.deepEqual([await text('#panel'), await text('#focus-question')], ['LAND IT', corrected]);
  await checkLayout('4-answering');
  emit(one, 'answer', state(5, { phase: 'ANSWER', focus: corrected, focusVersion: 1, exchangeId: 1, live: live('L2', 1, 'How do I lose weight?') }));
  await until(async () => (await text('#live-question')) === 'How do I lose weight?');
  assert.deepEqual([await text('#focus-question'), await text('#question-feedback')], [corrected, '']);
  assert.ok(!(await disabled('#confirm-question')));
  await checkLayout('5-new-question');
  emit(one, 'answer', state(6, { phase: 'ANSWER', focus: corrected, focusVersion: 1, exchangeId: 1, live: live('L3', 1, corrected, 'restatement') }));
  await until(async () => (await text('#confirm-hint')) === 'Live matches the focus question.');
  assert.equal(await text('#live-tag'), 'restatement');
  results.newQuestionKeepsFocus = 'PASS';

  // Clear live sends its control and shows the cleared Live from the result.
  await page.getByRole('button', { name: 'Clear live' }).click();
  await until(() => lastControl(one).type === 'question.reset');
  emit(one, 'question.result', { requestId: lastControl(one).requestId, status: 'reset', state: state(7, { phase: 'ANSWER', focus: corrected, focusVersion: 1, exchangeId: 1 }) });
  await until(async () => (await text('#question-feedback')).startsWith('Live cleared'));
  assert.deepEqual([await text('#focus-question'), await text('#live-question')], [corrected, 'Listening for a question…']);
  results.resetLive = 'PASS';

  // A long three-part Live question stays complete at both widths.
  emit(one, 'answer', state(8, { focus: corrected, focusVersion: 1, exchangeId: 1, live: live('L4', 1, multipart) }));
  await until(async () => (await text('#live-question')) === multipart);
  await checkLayout('5-long-live');

  // Disconnect while pending: Focus becomes last known and the unanswered request stays unknown.
  await page.getByRole('button', { name: 'Confirm question' }).click();
  await until(() => lastControl(one).type === 'question.confirm' && lastControl(one).liveId === 'L4');
  await one.ws.close();
  await until(async () => (await text('#question-feedback')).startsWith('Disconnected before the server replied'));
  assert.deepEqual([await text('#focus-status'), await text('#live-question'), await text('#live-tag'), await text('#confirm-hint')],
    ['(last known, not live)', 'Not listening', '', 'Start listening to continue.']);
  assert.ok(await disabled('#confirm-question') && await disabled('#clear-live'));
  results.disconnectPending = 'PASS';
  await checkLayout('7-disconnected');

  // Restart: a new session begins with empty Focus and Live and replays nothing.
  await page.getByRole('button', { name: 'Stop listening' }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await until(() => sockets.length === 2);
  const two = sockets[1]; two.id = 'session-2';
  emit(two, 'ready', { status: 'listening on server' });
  emit(two, 'answer', state(50, { focus: 'Late from session one' }), 'session-1');
  await until(async () => !(await disabled('#clear-live')));
  await page.clock.runFor(100);
  assert.deepEqual([await text('#focus-question'), await text('#live-question'), await text('#question-feedback'), two.controls.length],
    ['No focus question yet', 'Listening for a question…', '', 0]);
  assert.equal(await text('#panel'), 'GOOD');
  results.restart = 'PASS';

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', fixture: 'scripted /session protocol; no OpenAI', results, pageErrors: errors }, null, 2));
} finally { await browser.close(); assets.close(); }
