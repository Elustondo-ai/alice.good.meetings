import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPocServer } from './server.mjs';
import { createFixtures } from './fixtures.mjs';

// Deterministic page checks for the UC-04 Focus and Live question panel. The page and its scripts are real;
// the /session WebSocket is scripted here, so no POC service or OpenAI request is involved.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../', import.meta.url);
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']],
  ['/poc/audio-worklet.js', ['poc/audio-worklet.js', 'text/javascript']]]);
// Runs in the page: boxes of the glance rows, anything clipped or overlapping, and page scrolling.
function measureGlance() {
  const ids = ['cue-band', 'focus', 'live', 'answer'];
  const box = id => document.getElementById(id).getBoundingClientRect();
  const clipIds = [...ids, 'focus-question', 'live-question'];
  const clipped = clipIds.filter(id => { const e = document.getElementById(id); return e && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1); });
  const overlaps = [];
  ids.forEach((a, i) => ids.slice(i + 1).forEach(b => { const p = box(a), q = box(b); if (p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom - 0.5) overlaps.push(`${a}/${b}`); }));
  return { clipped, overlaps, sideways: document.documentElement.scrollWidth > innerWidth,
    pageScroll: document.documentElement.scrollHeight > innerHeight + 1,
    rows: ids.map(id => Math.round(box(id).height)), boxes: Object.fromEntries(ids.map(id => [id, [box(id).x, box(id).y + scrollY, box(id).width, box(id).height].map(Math.round).join(',')])) };
}
const multipart = 'Tell me about your last two jobs, and why you left the second one, and what you would do differently.';

// Static files come from a loopback server because Playwright routing does not see AudioWorklet module loads.
const assets = createServer(async (req, res) => {
  // The scripted part answers /health like a configured service; the page reads it once on load.
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ service: 'alice-good-meetings', configured: true })); return; }
  const file = files.get(req.url);
  if (!file) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': file[1] }).end(await readFile(new URL(file[0], root)));
});
assets.listen(0, '127.0.0.1'); await once(assets, 'listening');
const origin = `http://127.0.0.1:${assets.address().port}`;

// ---- SPRINT-003 page check (T28): the real page against the real service with fixtures, at two sizes ----
// Reported apart from `node --test`. The microphone is a synthetic tone stream stubbed into the page, because
// headless Chrome's fake device did not deliver audio on the development machine; no real microphone is used.
const FAKE_MIC = () => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext(), tone = ctx.createOscillator(), gain = ctx.createGain(), out = ctx.createMediaStreamDestination();
    gain.gain.value = 0.3; tone.connect(gain).connect(out); tone.start();
    return out.stream;
  };
};
const SIZES = { desktop: { width: 1280, height: 900 }, narrow: { width: 390, height: 844 } };
const ROWS = { desktop: [160, 124, 96, 232], narrow: [188, 190, 196, 460] };
const BASELINE = { cueWord: 128, text: 19.8 }; // PG-3 at 1280 x 900, from the 7d60c0f page rules
const CUE_COLORS = { good: 'rgb(0, 128, 0)', 'land-it': 'rgb(255, 215, 0)', stop: 'rgb(255, 0, 0)' };
const LBTEXT = { empty: 'An answer appears after you confirm a question.', preparing: 'Preparing an answer for this question.',
  failed: 'No proposed answer for this question.', unavailable: 'Question recognition and proposed answers are unavailable.',
  liveUnavailable: 'Question recognition is unavailable.', general: 'General points, not from your documents', lastKnown: 'Last known, not live',
  lastKnownNone: 'No answer arrived before listening stopped.' };
const REASONS = { none: 'No preparation package was found.', 'too-large': 'The package is over 20,000 characters and was not used.',
  empty: 'The package is empty and was not used.', unreadable: 'The package could not be read and was not used.',
  'no-key': 'No OpenAI key is set up.', 'no-service': 'The Alice service is not running.', 'key-rejected': 'OpenAI did not accept the key.' };
const words = n => 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango '.repeat(80).slice(0, n - 1).trimEnd().padEnd(n - 1, 'x') + '.';
const SHORT = { bullets: ['First.', 'Second.', 'Third.'], details: 'Short invented details.' };
const LONG = { bullets: [words(118), words(116), words(112)], details: Array.from({ length: 6 }, (_, i) => words(240 + i)).join('\n\n').slice(0, 1480) };
const LONG_FOCUS = 'Tell me about a project that went off track. (1) What did you notice first? (2) How did you bring the people involved back together? (3) What would you change if it happened again?';
const SENTINEL = 'PACKAGE-SENTINEL-TEXT';

async function service({ files = {}, apiKey = 'sk-test-fixture' } = {}) {
  const f = createFixtures(), audits = [];
  const packageDir = await mkdtemp(join(tmpdir(), 'alice-pagecheck-'));
  for (const [name, content] of Object.entries(files)) await writeFile(join(packageDir, name), content);
  const server = createPocServer({ apiKey, connect: f.connect, generate: f.generate, packageDir, log: () => {}, reasonDelayMs: 0,
    audit: (name, data) => audits.push({ name, ...data }),
    reason: async snap => snap.observations.length
      ? { reply: 'ok', phase: 'QUESTION', question: snap.observations.at(-1).text, intent: 'new-question', evidenceIds: snap.observations.map(o => o.id) }
      : { reply: 'ok', phase: 'GREETINGS', question: null, intent: 'none', evidenceIds: [] } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { f, audits, server, packageDir, origin: `http://127.0.0.1:${server.address().port}`, close: () => server.shutdown() };
}
const WITH_PACKAGE = { 'a.txt': `Synthetic reference. ${SENTINEL}` };

async function openPage(browser, origin, size = SIZES.desktop, path = '/') {
  const context = await browser.newContext({ viewport: size });
  await context.addInitScript(FAKE_MIC);
  const page = await context.newPage();
  Object.assign(page, { requests: [], frames: [], errors: [], ctx: context });
  page.on('request', r => page.requests.push(r.url()));
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('websocket', ws => { page.requests.push(ws.url()); ws.on('framesent', e => page.frames.push(String(e.payload))); ws.on('framereceived', e => page.frames.push(String(e.payload))); });
  await page.goto(origin + path);
  return page;
}
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 });
const textOf = (page, selector) => page.locator(selector).textContent();
const ready = page => wait(page, () => document.getElementById('listen').disabled === false || document.getElementById('listen-reason').textContent !== '');
async function listen(page) {
  await ready(page);
  await page.click('#listen');
  await wait(page, () => document.getElementById('listen-reason').textContent.includes('listening on server'));
}
// Says a question, waits for it in Live and confirms it; the generator request is then held by the fixture.
async function ask(page, svc, question) {
  svc.f.say(question);
  await wait(page, q => document.getElementById('live-question').textContent === q, question);
  await page.click('#confirm-question');
  await wait(page, q => document.getElementById('focus-question').textContent === q, question);
}
const waitCalls = (svc, n) => until(() => svc.f.calls.length >= n);
async function until(predicate) {
  for (let i = 0; i < 500 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), 'condition timed out');
}
// Reaches one of the answer states (LB-1 to LB-7) on a fresh page and service.
async function reach(browser, state, { size = SIZES.desktop, result = SHORT, files = WITH_PACKAGE, apiKey } = {}) {
  const svc = await service({ files, apiKey });
  const page = await openPage(browser, svc.origin, size);
  if (state === 'unavailable') { await ready(page); return { svc, page }; }
  await listen(page);
  if (state === 'empty') return { svc, page };
  await ask(page, svc, state === 'shown-long' ? LONG_FOCUS : 'Why this company?');
  if (state === 'preparing') { await waitCalls(svc, 1); return { svc, page }; }
  await waitCalls(svc, 1);
  if (state === 'failed') { svc.f.fail(new Error('x')); await waitCalls(svc, 2); svc.f.fail(new Error('y')); }
  else svc.f.release(state === 'shown-long' ? LONG : result);
  const expected = state === 'failed' ? LBTEXT.failed : null;
  await wait(page, e => e === null ? document.querySelectorAll('#bullets li').length > 0 : document.getElementById('answer-message').textContent === e, expected);
  if (state === 'last-known') { await page.click('#stop-listen'); await wait(page, () => document.getElementById('answer-tag').textContent.includes('Last known')); }
  return { svc, page };
}
const closeAll = async ({ svc, page }) => { await page.ctx.close(); svc.close(); };
const measure = page => page.evaluate(measureGlance);
const stopTimer = page => page.evaluate(() => { if (current) clearInterval(current.timer); });
const rectOf = (page, selector) => page.locator(selector).evaluate(e => { const b = e.getBoundingClientRect(); return [b.x, b.y + scrollY, b.width, b.height].map(Math.round); });

async function sprint003Checks(browser, assetsOrigin) {
  const outcome = {};
  const shots = process.env.SCREENSHOT_DIR || tmpdir();
  const check = async (id, name, body) => {
    try { await body(); outcome[id] = { name, result: 'PASS' }; } catch (error) { outcome[id] = { name, result: 'FAIL', why: String(error.message).split('\n').slice(0, 4).join(' | ') }; }
  };
  const answerText = page => page.evaluate(() => ({ message: document.getElementById('answer-message').textContent, tag: document.getElementById('answer-tag').textContent,
    bullets: [...document.querySelectorAll('#bullets li')].map(li => li.textContent), reason: document.getElementById('answer-reason').textContent,
    details: document.getElementById('details-text').textContent, live: document.getElementById('live-question').textContent }));
  const sweep = []; // every state's glance rows at both sizes, read by PC-28

  await check('PC-01', 'empty state on ready', async () => {
    const r = await reach(browser, 'empty');
    const a = await answerText(r.page);
    assert.deepEqual([a.message, a.bullets, a.details], [LBTEXT.empty, [], '']);
    await closeAll(r);
  });
  await check('PC-02', 'preparing state shows no earlier text', async () => {
    const r = await reach(browser, 'shown-long');
    assert.equal((await answerText(r.page)).bullets.length, 3);
    await ask(r.page, r.svc, 'A different question altogether?');
    const a = await answerText(r.page);
    assert.deepEqual([a.message, a.bullets, a.details], [LBTEXT.preparing, [], '']);
    await closeAll(r);
  });
  await check('PC-03', 'shown with the shortest content', async () => {
    const r = await reach(browser, 'shown-short');
    const a = await answerText(r.page);
    assert.deepEqual([a.bullets, a.details, a.tag, a.message], [SHORT.bullets, SHORT.details, '', '']);
    sweep.push(['shown-short', 'desktop', (await measure(r.page)).rows]);
    await r.page.screenshot({ path: join(shots, 'page-shown-short-desktop.png') });
    await closeAll(r);
  });
  const longChecks = {};
  for (const [size, dims] of Object.entries(SIZES)) {
    for (const cue of ['good', 'land', 'stop']) {
      const id = size === 'desktop' ? 'PC-04' : 'PC-05';
      if (size === 'narrow' && cue !== 'good') continue;
      longChecks[`${id}:${cue}`] = async () => {
        const r = await reach(browser, 'shown-long', { size: dims });
        await stopTimer(r.page);
        await r.page.click(`#controls button[data-state="${cue}"]`);
        const m = await measure(r.page);
        assert.deepEqual([m.clipped, m.overlaps, m.sideways], [[], [], false], `${size} ${cue}`);
        if (size === 'desktop') assert.equal(m.pageScroll, false);
        sweep.push([`shown-long-${cue}`, size, m.rows]);
        await r.page.screenshot({ path: join(shots, `page-shown-long-${cue}-${size}.png`) });
        await closeAll(r);
      };
    }
  }
  await check('PC-04', 'shown with the longest content at 1280 by 900 with each cue: four elements visible, unclipped, not overlapped', async () => {
    for (const cue of ['good', 'land', 'stop']) await longChecks[`PC-04:${cue}`]();
  });
  await check('PC-05', 'shown with the longest content at 390 by 844', async () => { await longChecks['PC-05:good'](); });
  await check('PC-06', 'general state with each of four reasons', async () => {
    const dirs = [['none', {}], ['empty', { 'a.txt': '   ' }], ['too-large', { 'a.txt': 'a'.repeat(20001) }], ['unreadable', null]];
    for (const [reason, files] of dirs) {
      const svc = await service({ files: files ?? {} });
      if (files === null) { const { writeFile: w } = await import('node:fs/promises'); await w(join(svc.packageDir, 'bad.txt'), Buffer.from([0xff, 0xfe])); }
      const page = await openPage(browser, svc.origin);
      await listen(page); await ask(page, svc, 'Why this company?'); await waitCalls(svc, 1);
      svc.f.release({ bullets: ['General point.'], details: '' });
      await wait(page, () => document.getElementById('answer-reason').textContent !== '');
      const a = await answerText(page);
      assert.deepEqual([a.tag, a.reason, a.bullets], [LBTEXT.general, REASONS[reason], ['General point.']], reason);
      assert.equal(JSON.stringify(a).includes('a.txt') || JSON.stringify(a).includes('bad.txt'), false, 'no file name (LB-9)');
      sweep.push([`general-${reason}`, 'desktop', (await measure(page)).rows]);
      await closeAll({ svc, page });
    }
  });
  await check('PC-07', 'failed state has no retry control', async () => {
    const r = await reach(browser, 'failed');
    assert.equal((await answerText(r.page)).message, LBTEXT.failed);
    assert.equal(await r.page.locator('#answer button, #answer a, #answer [role=button]').count(), 0);
    await closeAll(r);
  });
  await check('PC-08', 'unavailable on load with no key shows the Unavailable text and reason', async () => {
    const r = await reach(browser, 'unavailable', { apiKey: '' });
    const a = await answerText(r.page);
    assert.deepEqual([a.message, a.reason, a.live, await r.page.locator('#listen').isDisabled(), await textOf(r.page, '#listen-reason')],
      [LBTEXT.unavailable, REASONS['no-key'], LBTEXT.liveUnavailable, true, REASONS['no-key']]);
    await r.page.screenshot({ path: join(shots, 'page-unavailable-no-key-desktop.png') });
    await closeAll(r);
  });
  await check('PC-09', 'unavailable on load with no service', async () => {
    // The page is served by the scripted static server; its /health is answered with something that is not Alice's service.
    const context = await browser.newContext({ viewport: SIZES.desktop });
    await context.route('**/health', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>not json</p>' }));
    const page = await context.newPage(); page.ctx = context;
    await page.goto(assetsOrigin + '/'); await ready(page);
    const a = await answerText(page);
    assert.deepEqual([a.reason, await page.locator('#listen').isDisabled()], [REASONS['no-service'], true]);
    await context.close();
  });
  await check('PC-10', 'unavailable after a rejected key', async () => {
    const r = await reach(browser, 'empty');
    r.svc.f.upstream().emit('message', Buffer.from(JSON.stringify({ type: 'error', error: { code: 'invalid_api_key' } })));
    await wait(r.page, () => document.getElementById('answer-reason').textContent === 'OpenAI did not accept the key.');
    const a = await answerText(r.page);
    assert.deepEqual([a.message, await r.page.locator('#listen').isDisabled()], [LBTEXT.unavailable, true]);
    await closeAll(r);
  });
  await check('PC-11', 'last known after Stop and after a disconnect, with the Focus question\'s own last-known mark', async () => {
    const r = await reach(browser, 'last-known');
    let a = await answerText(r.page);
    assert.deepEqual([a.tag, a.bullets], [LBTEXT.lastKnown, SHORT.bullets]);
    assert.equal(await textOf(r.page, '#focus-status'), '(last known, not live)');
    await closeAll(r);
    const d = await reach(browser, 'shown-short');
    d.svc.f.upstream().emit('close');
    await wait(d.page, () => document.getElementById('answer-tag').textContent.includes('Last known'));
    a = await answerText(d.page);
    assert.deepEqual([a.tag, a.bullets], [LBTEXT.lastKnown, SHORT.bullets]);
    assert.equal(await textOf(d.page, '#focus-status'), '(last known, not live)');
    await closeAll(d);
    const p = await reach(browser, 'preparing');
    await p.page.click('#stop-listen');
    await wait(p.page, () => document.getElementById('answer-message').textContent !== '' && document.getElementById('answer-tag').textContent.includes('Last known'));
    assert.equal((await answerText(p.page)).message, LBTEXT.lastKnownNone);
    await closeAll(p);
  });
  await check('PC-12', 'failed and unavailable are worded differently', async () => {
    assert.notEqual(LBTEXT.failed.split('.')[0], LBTEXT.unavailable.split('.')[0]);
    const f = await reach(browser, 'failed'), u = await reach(browser, 'unavailable', { apiKey: '' });
    const [fa, ua] = [await answerText(f.page), await answerText(u.page)];
    assert.notEqual(fa.message, ua.message);
    assert.equal(ua.reason !== '' && fa.reason === '', true);
    await closeAll(f); await closeAll(u);
  });
  await check('PC-13', 'reworded Confirm replaces the answer and the render report names its version', async () => {
    const r = await reach(browser, 'shown-short');
    const reports = () => r.page.frames.filter(f => f.includes('"rendered"')).map(f => JSON.parse(f));
    await until(() => reports().some(x => x.answerFocusVersion === 1 && x.answerStatus === 'shown'));
    await ask(r.page, r.svc, 'Why this company, really?');
    await until(() => reports().some(x => x.answerFocusVersion === 2 && x.answerStatus === 'preparing'));
    assert.deepEqual((await answerText(r.page)).bullets, []);
    await waitCalls(r.svc, 2); r.svc.f.release(SHORT);
    await until(() => reports().some(x => x.answerFocusVersion === 2 && x.answerStatus === 'shown'));
    await until(() => r.svc.audits.some(a => a.name === 'answer_timing' && a.focusVersion === 2 && a.outcome === 'shown'));
    await closeAll(r);
  });
  await check('PC-14', 'proposed message for another version or lower sequence is ignored', async () => {
    const r = await reach(browser, 'shown-short');
    const before = await answerText(r.page);
    const sessionId = await r.page.evaluate(() => remote.sessionId);
    const inject = (proposed, proposedSeq) => r.page.evaluate(({ sessionId: id, proposed: p, proposedSeq: s }) => {
      const message = { type: 'proposed', sessionId: id, serverAt: Date.now(), proposed: p, proposedSeq: s };
      current.socket.onmessage({ data: JSON.stringify(message) });
    }, { sessionId, proposed, proposedSeq });
    const other = { status: 'shown', focusVersion: 7, bullets: ['Other version.'], details: 'x', reason: null, lastKnown: false, lastStatus: null };
    await inject(other, 999);
    await inject({ ...other, focusVersion: 1 }, 0);
    assert.deepEqual(await answerText(r.page), before);
    await closeAll(r);
  });
  await check('PC-15', 'markup in bullets and details shows as literal text', async () => {
    const r = await reach(browser, 'shown-short', { result: { bullets: ['<b>bold</b> & <img src=x onerror=alert(1)>'], details: '<script>window.__x=1</script> <i>it</i>' } });
    const a = await answerText(r.page);
    assert.equal(a.bullets[0], '<b>bold</b> & <img src=x onerror=alert(1)>');
    assert.equal(await r.page.locator('#answer b, #answer img, #details script, #details i').count(), 0);
    assert.equal(await r.page.evaluate(() => window.__x), undefined);
    await closeAll(r);
  });
  await check('PC-16', 'only same-origin requests and no package text in page or frames', async () => {
    const r = await reach(browser, 'shown-short');
    r.svc.f.say('Another question here?');
    const html = await r.page.content();
    assert.equal(html.includes(SENTINEL) || r.page.frames.some(f => f.includes(SENTINEL)), false);
    assert.ok(r.svc.f.calls.length >= 1 && JSON.stringify(r.svc.f.calls[0].request).includes(SENTINEL), 'the fixture generator did receive the package');
    const host = new URL(r.svc.origin).host;
    assert.deepEqual(r.page.requests.filter(u => new URL(u).host !== host), []);
    await closeAll(r);
  });
  await check('PC-17', 'preview shows all states at both sizes with each cue', async () => {
    const svc = await service();
    const states = ['empty', 'preparing', 'shown-short', 'shown-long', 'general', 'failed', 'unavailable', 'last-known'];
    for (const [size, dims] of Object.entries(SIZES)) {
      const page = await openPage(browser, svc.origin, dims, '/preview');
      for (const state of states) {
        await page.evaluate(h => { location.hash = h; }, `state=${state}&cue=good`);
        const m = await measure(page);
        assert.deepEqual(m.rows, ROWS[size], `${state} ${size}`);
        assert.equal(await page.locator('#listen, #stop-listen, #confirm, #clear-live').count(), 4);
        assert.equal(await page.locator('#controls, .controls button').count() > 3, true);
        assert.ok((await textOf(page, '#answer-message')) !== '' || (await page.locator('#bullets li').count()) > 0, `${state} has content`);
      }
      for (const cue of Object.keys(CUE_COLORS)) {
        await page.evaluate(h => { location.hash = h; }, `state=shown-long&cue=${cue}`);
        assert.equal(await page.locator('#cue-band').evaluate(e => getComputedStyle(e).backgroundColor), CUE_COLORS[cue]);
        assert.equal(await page.locator('#bullets li').count(), 3);
      }
      await page.ctx.close();
    }
    svc.close();
  });
  await check('PC-18', 'preview and page make no network request to another origin', async () => {
    const svc = await service({ files: WITH_PACKAGE });
    for (const path of ['/preview', '/preview#state=shown-long&cue=stop', '/']) {
      const page = await openPage(browser, svc.origin, SIZES.desktop, path);
      await new Promise(resolve => setTimeout(resolve, 300));
      const host = new URL(svc.origin).host;
      assert.deepEqual(page.requests.filter(u => new URL(u).host !== host), [], path);
      await page.ctx.close();
    }
    svc.close();
  });
  await check('PC-19', 'cue, timer, Confirm and Clear live work in each of the seven states, one loop with one assertion per state', async () => {
    for (const state of ['empty', 'preparing', 'shown-short', 'general', 'failed', 'unavailable', 'last-known']) {
      const r = await reach(browser, state, { files: state === 'general' ? {} : WITH_PACKAGE, apiKey: state === 'unavailable' ? '' : undefined });
      await stopTimer(r.page);
      await r.page.click('#controls button[data-state="land"]');
      const manual = await textOf(r.page, '#panel');
      await r.page.evaluate(() => { mic.turnStart = performance.now() - 36000; tick({ getFloatTimeDomainData: b => b.fill(0.1) }, new Float32Array(2048)); });
      const timer = await textOf(r.page, '#panel');
      const connected = !['unavailable', 'last-known'].includes(state);
      let confirmAndClear = 'disabled-as-today';
      if (connected) {
        r.svc.f.say('A brand new question here?');
        await wait(r.page, () => document.getElementById('live-question').textContent === 'A brand new question here?');
        const enabled = !(await r.page.locator('#confirm-question').isDisabled());
        await r.page.click('#clear-live');
        await wait(r.page, () => document.getElementById('question-feedback').textContent.startsWith('Live cleared'));
        confirmAndClear = enabled ? 'works' : 'confirm-not-enabled';
      } else {
        assert.equal(await r.page.locator('#confirm-question').isDisabled() && await r.page.locator('#clear-live').isDisabled(), true);
      }
      assert.deepEqual([manual, timer, confirmAndClear], ['LAND IT', 'STOP', connected ? 'works' : 'disabled-as-today'], state);
      await closeAll(r);
    }
  });
  await check('PC-20', 'cue word, Focus and Live text are no smaller than the recorded baseline sizes', async () => {
    const r = await reach(browser, 'shown-short');
    const sizes = await r.page.evaluate(() => ['panel', 'focus-question', 'live-question'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).fontSize)));
    assert.ok(sizes[0] >= BASELINE.cueWord && sizes[1] >= BASELINE.text - 0.05 && sizes[2] >= BASELINE.text - 0.05, JSON.stringify(sizes));
    await closeAll(r);
  });
  await check('PC-21', 'longest details scroll inside their area while the four elements keep position and size', async () => {
    const s = await reach(browser, 'shown-short'), l = await reach(browser, 'shown-long');
    const [ms, ml] = [await measure(s.page), await measure(l.page)];
    assert.deepEqual(ml.boxes, ms.boxes);
    assert.equal(await l.page.locator('#details-text').evaluate(e => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY === 'auto'), true);
    assert.equal(ml.pageScroll, false);
    await closeAll(s); await closeAll(l);
  });
  await check('PC-22', 'the answer area holds no collapse, retry, button or link', async () => {
    for (const state of ['shown-long', 'failed', 'unavailable']) {
      const r = await reach(browser, state);
      assert.equal(await r.page.locator('#answer button, #answer a, #answer input, #answer summary, #answer details, #details button, #details a, #details summary, #details details').count(), 0, state);
      await closeAll(r);
    }
  });
  await check('PC-23', 'content changes with no animation, transition or sound', async () => {
    const r = await reach(browser, 'shown-short');
    await ask(r.page, r.svc, 'Next question, please?');
    const m = await r.page.evaluate(() => ({ anims: document.getAnimations().length, media: document.querySelectorAll('audio, video').length,
      durations: [...document.querySelectorAll('#page, #page *')].filter(e => getComputedStyle(e).transitionDuration !== '0s' || getComputedStyle(e).animationName !== 'none').length }));
    assert.deepEqual(m, { anims: 0, media: 0, durations: 0 });
    await closeAll(r);
  });
  await check('PC-24', 'no answer text appears inside the Focus or Live elements', async () => {
    const r = await reach(browser, 'shown-long');
    const t = await r.page.evaluate(() => document.getElementById('focus').textContent + document.getElementById('live').textContent);
    const a = await answerText(r.page);
    for (const piece of [...a.bullets, a.details.slice(0, 40)]) assert.equal(t.includes(piece), false);
    await closeAll(r);
  });
  await check('PC-25', 'on load with no key, Start is disabled with its reason while the timer and cue buttons work', async () => {
    const r = await reach(browser, 'unavailable', { apiKey: '' });
    assert.equal(await r.page.locator('#listen').isDisabled(), true);
    assert.equal(await textOf(r.page, '#listen-reason'), REASONS['no-key']);
    await stopTimer(r.page);
    await r.page.click('#controls button[data-state="stop"]');
    assert.equal(await textOf(r.page, '#panel'), 'STOP');
    await r.page.evaluate(() => { mic.turnStart = performance.now() - 26000; tick({ getFloatTimeDomainData: b => b.fill(0.1) }, new Float32Array(2048)); });
    assert.equal(await textOf(r.page, '#panel'), 'LAND IT');
    await closeAll(r);
  });
  await check('PC-26', 'the page makes exactly one health request on load', async () => {
    const svc = await service();
    const page = await openPage(browser, svc.origin);
    await listen(page); await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(page.requests.filter(u => new URL(u).pathname === '/health').length, 1);
    await page.ctx.close(); svc.close();
  });
  await check('PC-27', 'last known keeps a General answer\'s tag and reason and a Failed answer\'s note', async () => {
    const g = await reach(browser, 'general', { files: {} });
    await g.page.click('#stop-listen');
    await wait(g.page, () => document.getElementById('answer-tag').textContent.includes('Last known'));
    let a = await answerText(g.page);
    assert.deepEqual([a.tag, a.reason], [`${LBTEXT.general} · ${LBTEXT.lastKnown}`, REASONS.none]);
    await closeAll(g);
    const f = await reach(browser, 'failed');
    await f.page.click('#stop-listen');
    await wait(f.page, () => document.getElementById('answer-tag').textContent.includes('Last known'));
    a = await answerText(f.page);
    assert.deepEqual([a.message, a.tag], [LBTEXT.failed, LBTEXT.lastKnown]);
    await closeAll(f);
  });
  await check('PC-28', 'the four glance rows have the fixed heights at 1280 by 900 and 390 by 844 in every state', async () => {
    for (const [size, dims] of Object.entries(SIZES)) {
      for (const state of ['empty', 'preparing', 'shown-short', 'shown-long', 'general', 'failed', 'unavailable', 'last-known']) {
        const r = await reach(browser, state, { size: dims, files: state === 'general' ? {} : WITH_PACKAGE, apiKey: state === 'unavailable' ? '' : undefined });
        const m = await measure(r.page);
        assert.deepEqual(m.rows, ROWS[size], `${state} ${size}`);
        if (size === 'desktop') assert.equal(m.pageScroll, false, state);
        await r.page.screenshot({ path: join(shots, `page-${state}-${size}.png`) });
        await closeAll(r);
      }
    }
  });
  await check('PC-29', 'the controls and Confirm and Clear live sit where the approved preview puts them', async () => {
    const svc = await service();
    for (const [size, dims] of Object.entries(SIZES)) {
      const preview = await openPage(browser, svc.origin, dims, '/preview#state=empty&cue=good');
      const page = await openPage(browser, svc.origin, dims, '/');
      await ready(page);
      const pairs = [['#cue-band', '#cue-band'], ['#focus', '#focus'], ['#live', '#live'], ['#answer', '#answer'], ['#details', '#details'],
        ['#listen', '#listen'], ['#stop-listen', '#stop-listen'], ['#confirm', '#confirm-question'], ['#clear-live', '#clear-live']];
      for (const [pv, pg] of pairs) {
        const [a, b] = [await rectOf(preview, pv), await rectOf(page, pg)];
        assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= 2), `${size} ${pg}: preview ${a} page ${b}`);
      }
      const [c, k] = [await rectOf(page, '#confirm-question'), await rectOf(page, '#clear-live')];
      if (size === 'desktop') assert.ok(Math.abs(c[0] + c[2] - (k[0] + k[2])) <= 2 && c[1] < k[1], 'Confirm above Clear live at the right edge');
      await preview.ctx.close(); await page.ctx.close();
    }
    svc.close();
  });
  const failed = Object.entries(outcome).filter(([, v]) => v.result === 'FAIL');
  return { cases: outcome, passed: Object.keys(outcome).length - failed.length, failed: failed.length, sweep };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true,
  args: [] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(FAKE_MIC);
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
  // Measures the current state at desktop and phone widths: the four glance rows are unclipped and do not overlap.
  const shots = process.env.SCREENSHOT_DIR || tmpdir();
  const checkLayout = async name => {
    for (const [width, size] of [['desktop', { width: 1280, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
      await page.setViewportSize(size);
      // Let the resized page repaint (animation frames run on the fake clock) before measuring or capturing.
      await page.clock.runFor(50);
      await new Promise(resolve => setTimeout(resolve, 200));
      const layout = await page.evaluate(measureGlance);
      assert.deepEqual([layout.clipped, layout.overlaps, layout.sideways, width === 'desktop' ? layout.pageScroll : false], [[], [], false, false], `${name} ${width}`);
      await page.screenshot({ path: join(shots, `alice.good.meetings-uc04-${name}-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    results.layout[name] = 'PASS';
  };

  // Ready: both areas show their empty text; Confirm is disabled with a hint, Clear live is available.
  await page.getByRole('button', { name: 'Start listening' }).click();
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
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
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
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
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
  await page.getByRole('button', { name: 'Start listening' }).click();
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
  // The SPRINT-003 page check runs after the UC-04 protocol and is reported as its own result.
  const pageCheck = await sprint003Checks(browser, origin);
  console.log(JSON.stringify({ result: 'PASS', fixture: 'scripted /session protocol; no OpenAI', results, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ result: pageCheck.failed ? 'FAIL' : 'PASS', fixture: 'real page, real service, fixtures; no OpenAI, synthetic microphone',
    passed: pageCheck.passed, failed: pageCheck.failed, cases: pageCheck.cases }, null, 2));
  if (pageCheck.failed) process.exitCode = 1;
} finally { await browser.close(); assets.close(); }
