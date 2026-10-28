import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Explicitly opt into a live API test by supplying synthetic audio and a running server.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = process.argv[2];
if (!fixture) throw new Error('Usage: node browser-smoke.mjs /absolute/path/to/synthetic.wav');
const origin = process.env.POC_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${resolve(fixture)}`],
});
try {
  const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const events = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framereceived', frame => {
    try { events.push({ at: Date.now(), event: JSON.parse(frame.payload.toString()) }); } catch {}
  }));
  await page.goto(origin);
  await page.getByRole('button', { name: 'Land it', exact: true }).click();
  assert.equal(await page.locator('#panel').textContent(), 'LAND IT');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  assert.equal(await page.locator('#panel').textContent(), 'STOP');
  await page.getByRole('button', { name: 'Good', exact: true }).click();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  const deadline = Date.now() + 60000;
  while (!events.some(({ event }) => event.type === 'answer' && event.audioCutoffSamples > 0)) {
    if (Date.now() > deadline) throw new Error('No audio-dependent answer: ' + await page.locator('#server').textContent());
    await page.waitForTimeout(250);
  }
  assert.match(await page.locator('#debug').textContent(), /mic:\s+listening/);
  assert.ok(events.some(({ event }) => event.type === 'audio' && event.packets > 0));
  const answer = events.find(({ event }) => event.type === 'answer' && event.audioCutoffSamples > 0);
  assert.ok((await page.locator('#server').textContent()).includes(answer.event.reply));
  const timerStates = await page.evaluate(() => {
    const states = [];
    for (const seconds of [26, 36, 0]) {
      mic.turnStart = performance.now() - seconds * 1000;
      tick({ getFloatTimeDomainData: buffer => buffer.fill(0.1) }, new Float32Array(2048));
      states.push({ label: panel.textContent, color: panel.style.background });
    }
    window.testStream = current.stream; window.testContext = current.ctx;
    return states;
  });
  assert.deepEqual(timerStates.map(s => s.label), ['LAND IT', 'STOP', 'GOOD']);
  assert.deepEqual(timerStates.map(s => s.color), ['gold', 'red', 'green']);
  await page.screenshot({ path: '/tmp/speakercoach-poc-browser.png' });
  const displayed = await page.locator('#server').textContent();
  await page.getByRole('button', { name: 'Stop listening', exact: true }).click();
  await page.waitForFunction(() => window.testContext.state === 'closed' && window.testStream.getTracks().every(t => t.readyState === 'ended'));
  await page.waitForTimeout(300);
  assert.equal((await (await fetch(origin + '/health')).json()).sessions, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', fixture: 'synthetic speech through browser microphone',
    timerStates, displayed, answer, audioEvents: events.filter(({ event }) => event.type === 'audio').length,
    captureStopped: true, serverSessionsAfterStop: 0, pageErrors: errors }, null, 2));
} finally { await browser.close(); }
