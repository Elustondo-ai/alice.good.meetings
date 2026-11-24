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
// No /poc/avatar.js here: the avatar fails silently on this scripted server (AV-6) and the real-service checks cover it.
// Runs in the page: boxes of the areas, anything clipped or overlapping, and page scrolling.
function measureGlance() {
  const ids = ['cue-band', 'focus', 'live', 'answer', 'hear'];
  const box = id => document.getElementById(id).getBoundingClientRect();
  const clipIds = [...ids, 'focus-question', 'live-question'];
  const clipped = clipIds.filter(id => { const e = document.getElementById(id); return e && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1); });
  const overlaps = [];
  ids.forEach((a, i) => ids.slice(i + 1).forEach(b => { const p = box(a), q = box(b); if (p.left < q.right && q.left < p.right && p.top < q.bottom - 0.5 && q.top < p.bottom - 0.5) overlaps.push(`${a}/${b}`); }));
  return { clipped, overlaps, sideways: document.documentElement.scrollWidth > innerWidth };
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

// ---- SPRINT-004 page check (S4-19): the real page against the real service with fixtures, at three sizes ----
// Reported apart from `node --test`. The microphone is a synthetic tone stream stubbed into each page (`FAKE_MIC`);
// no real microphone, no OpenAI request and no private recording is used. Logs go to a temporary folder.
const FAKE_MIC = () => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext(), tone = ctx.createOscillator(), gain = ctx.createGain(), out = ctx.createMediaStreamDestination();
    gain.gain.value = 0.3; tone.connect(gain).connect(out); tone.start();
    return out.stream;
  };
};
const SIZES = { desktop: { width: 1280, height: 900 }, short: { width: 1280, height: 500 }, narrow: { width: 390, height: 844 }, tall: { width: 1280, height: 1200 } };
const words = n => 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango '.repeat(80).slice(0, n - 1).trimEnd().padEnd(n - 1, 'x') + '.';
const SHORT = { bullets: ['First.', 'Second.', 'Third.'] };
const LONG = { bullets: [words(118), words(116), words(112)] };
const SHORT_Q = 'Why this company?';
const MEDIUM_Q = 'Tell me about a project that went off track and what you did about it, step by step, from the first sign of trouble.';
const LONG_Q = 'Tell me about a project that went off track. (1) What did you notice first? (2) How did you bring the people involved back together? (3) What would you change if it happened again? (4) What did the team learn from it that they still use?';
const SENTINEL = 'PACKAGE-SENTINEL-TEXT';
const WITH_PACKAGE = { 'a.txt': `Synthetic reference. ${SENTINEL}` };

// The synthetic microphone is one continuous tone, so the service never sees a pause: the pause rule and automatic Focus are off
// unless a case turns them on (PC4-31), and Confirm, Space and Esc are the only way a candidate becomes the Question.
async function service({ files = {}, apiKey = 'sk-test-fixture', requirePause = false, autoFocus = false, ...options } = {}) {
  const f = createFixtures(), audits = [];
  const packageDir = await mkdtemp(join(tmpdir(), 'alice-pagecheck-'));
  const logDir = await mkdtemp(join(tmpdir(), 'alice-pagecheck-logs-'));
  for (const [name, content] of Object.entries(files)) await writeFile(join(packageDir, name), content);
  // The tone never pauses, so at Stop there is always speech the fixture will not transcribe: the wait for it is kept short (RT5-6).
  const server = createPocServer({ apiKey, connect: f.connect, generate: f.generate, packageDir, logDir, revision: 'pagecheck', log: () => {}, reasonDelayMs: 0, requirePause, autoFocus, drainMs: 150,
    audit: (name, data) => audits.push({ name, ...data }),
    reason: async snap => snap.observations.length
      ? { phase: 'QUESTION', question: snap.observations.at(-1).text, intent: 'new-question', evidenceIds: snap.observations.map(o => o.id) }
      : { phase: 'GREETINGS', question: null, intent: 'none', evidenceIds: [] }, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { f, audits, server, packageDir, logDir, origin: `http://127.0.0.1:${server.address().port}`, close: () => server.shutdown() };
}

async function openPage(browser, origin, size = SIZES.desktop, { path = '/', mic = true, clock = false, reducedMotion = 'no-preference', init } = {}) {
  const context = await browser.newContext({ viewport: size, reducedMotion, acceptDownloads: true });
  if (mic) await context.addInitScript(FAKE_MIC);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  Object.assign(page, { requests: [], frames: [], errors: [], ctx: context, sent: [], sockets: [] });
  page.on('request', r => page.requests.push(r.url()));
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('websocket', ws => { page.sockets.push(ws); page.requests.push(ws.url()); ws.on('framesent', e => { if (typeof e.payload === 'string') page.sent.push(e.payload); page.frames.push(String(e.payload).slice(0, 4000)); }); ws.on('framereceived', e => page.frames.push(String(e.payload).slice(0, 4000))); });
  if (clock) await page.clock.install();
  await page.goto(origin + path);
  return page;
}
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 });
const textOf = (page, selector) => page.locator(selector).textContent();
const ready = page => wait(page, () => !document.getElementById('listen').disabled || document.getElementById('error-row').textContent !== '');
async function listen(page) {
  await ready(page);
  await page.click('#listen');
  await wait(page, () => document.getElementById('monitor').textContent.includes('listening on server'));
}
async function until(predicate) {
  for (let i = 0; i < 500 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), 'condition timed out');
}
const waitCalls = (svc, n) => until(() => svc.f.calls.length >= n);
const candidate = async (page, svc, question) => { svc.f.say(question); await wait(page, q => document.getElementById('live-question').textContent === q, question); };
async function ask(page, svc, question) {
  await candidate(page, svc, question);
  await page.click('#confirm-question');
  await wait(page, q => document.getElementById('focus-question').textContent === q, question);
}
// Reaches a screen state on a fresh page and service.
async function reach(browser, state, { size = SIZES.desktop, question = SHORT_Q, result = SHORT, files = WITH_PACKAGE, apiKey, ...options } = {}) {
  const svc = await service({ files, apiKey, ...options });
  const page = await openPage(browser, svc.origin, size, options.page);
  if (state === 'unavailable') { await ready(page); return { svc, page }; }
  if (state === 'idle') { await ready(page); return { svc, page }; }
  await listen(page);
  if (state === 'listening') return { svc, page };
  if (state === 'candidate') { await candidate(page, svc, question); return { svc, page }; }
  await ask(page, svc, question);
  await waitCalls(svc, 1);
  if (state === 'preparing') return { svc, page };
  if (state === 'failed') { svc.f.fail(new Error('x')); await waitCalls(svc, 2); svc.f.fail(new Error('y')); await wait(page, () => document.getElementById('answer-message').textContent.startsWith('No proposed')); return { svc, page }; }
  svc.f.release(result);
  await wait(page, () => document.querySelectorAll('#bullets li').length > 0);
  // Stop is finished when the service has closed the session and Start is enabled again (RT5-6).
  if (state === 'last-known') { await page.click('#stop-listen'); await wait(page, () => document.getElementById('answer-tag').textContent.includes('Last known') && !document.getElementById('listen').disabled); }
  return { svc, page };
}
const closeAll = async ({ svc, page }) => { await page.ctx.close(); svc.close(); };
const measure = page => page.evaluate(measureGlance);
const key = (page, k) => page.keyboard.press(k);
const style = (page, selector, props) => page.locator(selector).first().evaluate((e, ps) => { const c = getComputedStyle(e); return Object.fromEntries(ps.map(p => [p, c[p]])); }, props);
const rect = (page, selector) => page.locator(selector).first().evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; });
const px = value => Number.parseFloat(value);
const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
const cueName = page => textOf(page, '#panel');
const cueColor = page => page.evaluate(() => getComputedStyle(document.getElementById('cue-band')).backgroundColor);

// Runs in the page: every visible text element with its computed weight, size, colour and effective contrast.
function textFacts() {
  const parse = value => { const m = value.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });
  const backdrop = e => { for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const opacityOf = e => { let o = 1; for (let n = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim(); const e = node.parentElement;
    if (!text || !e || e.closest('[hidden], script, style, pre')) continue;
    const c = getComputedStyle(e); const r = e.getBoundingClientRect();
    if (c.visibility === 'hidden' || r.width === 0 || r.height === 0 || e.closest('#avatar')) continue;
    const disabled = Boolean(e.closest('button:disabled'));
    const bg = backdrop(e); const fgc = parse(c.color); fgc.a *= opacityOf(e);
    const ratio = (() => { const l1 = lum(blend(fgc, bg)), l2 = lum(bg); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); })();
    out.push({ text: text.slice(0, 40), id: e.id || '', cls: e.className || '', tag: e.tagName, weight: Number(c.fontWeight), size: parseFloat(c.fontSize), italic: c.fontStyle, ratio, disabled,
      inTag: Boolean(e.closest('.tag')), inBullets: Boolean(e.closest('#bullets')), inNew: Boolean(e.closest('.hear-text .new')), inButton: Boolean(e.closest('button')) });
  }
  return out;
}

async function sprint004Checks(browser) {
  const outcome = {};
  const shots = process.env.SCREENSHOT_DIR || tmpdir();
  const check = async (id, name, body) => {
    try { await body(); outcome[id] = { name, result: 'PASS' }; } catch (error) { outcome[id] = { name, result: 'FAIL', why: String(error.message).split('\n').slice(0, 4).join(' | ') }; }
    if (process.env.PC_PROGRESS) process.stderr.write(`${id} ${outcome[id].result} ${outcome[id].why || ''}\n`);
  };
  const skip = (id, name, why) => { outcome[id] = { name, result: 'NOT RUN', why }; };
  const withState = async (state, opts, body) => {
    const r = await reach(browser, state, opts);
    try { await body(r); assert.deepEqual(r.page.errors, [], 'page errors'); }
    catch (error) {
      if (process.env.PC_PROGRESS) process.stderr.write(`  state=${state} page: ${JSON.stringify(await r.page.evaluate(() => ({ monitor: document.getElementById('monitor').textContent, focus: document.getElementById('focus-question').textContent, live: document.getElementById('live-question').textContent, hint: document.getElementById('confirm-hint').textContent, msg: document.getElementById('answer-message').textContent, err: document.getElementById('error-row').textContent })).catch(String))} sent=${JSON.stringify(r.page.sent.slice(-3)).slice(0, 300)}\n`);
      throw error;
    } finally { await closeAll(r); }
  };
  // The cue follows the speaking timer alone (the G, L and S keys were removed on 22 November 2026). A check reaches LAND IT
  // (over 25 s) or STOP (over 35 s) by moving the start of the speaking turn back; the synthetic tone keeps the turn open.
  const CUES = [[0, 'GOOD', 'rgb(27, 127, 42)'], [27, 'LAND IT', 'rgb(163, 92, 0)'], [40, 'STOP', 'rgb(179, 38, 30)']];
  const speakingFor = async (page, seconds, word) => {
    await page.evaluate(s => { mic.turnStart = performance.now() - s * 1000; }, seconds);
    await wait(page, w => document.getElementById('panel').textContent === w, word);
  };

  // ---- areas (03.8.2) ----
  await check('PC4-01', 'the five areas appear in order and none of the removed ones', async () => withState('shown', {}, async ({ page }) => {
    const tops = await Promise.all(['cue-band', 'focus', 'live', 'answer'].map(async id => (await rect(page, `#${id}`)).y));
    assert.deepEqual([...tops].sort((a, b) => a - b), tops, 'areas top to bottom');
    const hear = await rect(page, '#hear'); const answer = await rect(page, '#answer');
    assert.ok(Math.abs(hear.y - answer.y) < 1, 'two columns side by side');
    assert.equal(await page.locator('#details, #details-text, button[data-state]').count(), 0);
    assert.equal(await page.getByRole('button', { name: /^(Good|Land it|Stop)$/ }).count(), 0);
    assert.deepEqual(await page.evaluate(() => [document.getElementById('debug').hidden, document.getElementById('server').hidden]), [true, true]);
  }));
  await check('PC4-02', 'in a short window the page scrolls, no area clips and the last line is reachable', async () => withState('shown', { size: SIZES.short, result: LONG }, async ({ page }) => {
    const m = await measure(page);
    assert.deepEqual([m.clipped, m.sideways], [[], false]);
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), 'page scrolls');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const foot = await rect(page, '#package-line');
    assert.ok(foot.b <= 500 + 1, `last line reachable (${foot.b})`);
  }));
  await check('PC4-03', 'the bar is 80 px high (56 px in a window under 640 px high), full width, left block, empty centre and right block from 900 px wide, and stays at the top while scrolling', async () => {
    await withState('shown', {}, async ({ page }) => {
      const bar = await rect(page, '#cue-band');
      assert.ok(bar.h >= 76 && bar.h <= 84 && bar.w === 1280, `desktop bar ${bar.h} x ${bar.w}`);
      const [l, c, r] = await Promise.all(['.bar-left', '.bar-centre', '.bar-right'].map(s => rect(page, s)));
      assert.ok(l.r <= c.x + 1 && c.r <= r.x + 1 && c.w >= 1280 / 4, 'left, centre, right in a row');
    });
    await withState('shown', { size: SIZES.short, result: LONG }, async ({ page }) => {
      const bar = await rect(page, '#cue-band');
      assert.ok(bar.h >= 56 && bar.h < 80, `short window bar ${bar.h}`);
      assert.equal((await measure(page)).clipped.includes('cue-band'), false);
      await page.evaluate(() => scrollTo(0, 400));
      assert.equal(Math.round((await rect(page, '#cue-band')).y), 0, 'sticky');
    });
  });
  await check('PC4-04', 'the bar colour follows the cue and its text keeps the contrast', async () => withState('listening', {}, async ({ page }) => {
    for (const [seconds, word, color] of CUES) {
      await speakingFor(page, seconds, word);
      assert.deepEqual([await cueName(page), await cueColor(page)], [word, color]);
      const facts = (await page.evaluate(textFacts)).filter(f => f.id === 'panel');
      assert.ok(facts[0].ratio >= 4.5, `${word} contrast ${facts[0].ratio}`);
    }
  }));
  await check('PC4-05', 'the 20 px bold name shows when the avatar is absent, the cue word is 16 px bold and the bar has the cue as its accessible name', async () => withState('listening', { page: { reducedMotion: 'reduce' } }, async ({ page }) => {
    const name = await style(page, '#bar-name', ['fontSize', 'fontWeight']);
    assert.deepEqual([name.fontSize, name.fontWeight], ['20px', '700']);
    const word = await style(page, '#panel', ['fontSize', 'fontWeight']);
    assert.deepEqual([word.fontSize, word.fontWeight], ['16px', '700']);
    assert.equal(await page.locator('#cue-band').getAttribute('aria-label'), 'Cue: GOOD');
    await speakingFor(page, 27, 'LAND IT');
    assert.equal(await page.locator('#cue-band').getAttribute('aria-label'), 'Cue: LAND IT');
  }));
  await check('PC4-06', 'the monitor line is 15 px regular, sits under the buttons after the cue word and wraps', async () => withState('listening', {}, async ({ page }) => {
    const m = await style(page, '#monitor', ['fontSize', 'fontWeight', 'overflowWrap']);
    assert.deepEqual([m.fontSize, m.fontWeight, m.overflowWrap], ['15px', '400', 'anywhere']);
    const [buttons, word, mon] = await Promise.all(['#controls', '#panel', '#monitor'].map(s => rect(page, s)));
    assert.ok(word.y >= buttons.b - 1 && mon.x >= word.r - 1, 'cue word then monitor, under the buttons');
  }));
  await check('PC4-07', 'the bar buttons are in order, at least 14 px and 32 px high', async () => withState('idle', { page: { reducedMotion: 'reduce' } }, async ({ page }) => {
    const buttons = await page.locator('#controls button:visible').evaluateAll(list => list.map(b => ({ text: b.textContent.trim(), x: b.getBoundingClientRect().x, h: b.getBoundingClientRect().height, size: parseFloat(getComputedStyle(b).fontSize) })));
    assert.deepEqual(buttons.map(b => b.text), ['Start listening', 'Stop listening', 'Upload package', 'Download log']);
    assert.ok(buttons.every((b, i) => i === 0 || b.x > buttons[i - 1].x) && buttons.every(b => b.size >= 14 && b.h >= 32), JSON.stringify(buttons));
  }));
  await check('PC4-08', 'the Question box border, bold text and size by length with the SA-13 floor, never truncated', async () => {
    // SA-8's size by length, raised to SA-13's floor of 1.5 times the bullet size where the floor is larger.
    const floor = 1.5 * clamp(22, 900 * 0.034, 32);
    for (const [question, cls, lo, vh, hi] of [[SHORT_Q, '', 34, 6.2, 64], [MEDIUM_Q, 'medium', 28, 4.8, 48], [LONG_Q, 'long', 24, 3.8, 36]]) {
      await withState('listening', {}, async ({ svc, page }) => {
        await ask(page, svc, question);
        const box = await style(page, '#focus', ['borderTopWidth', 'borderTopColor']);
        assert.deepEqual([box.borderTopWidth, box.borderTopColor], ['3px', 'rgb(17, 17, 17)']);
        const t = await style(page, '#focus-question', ['fontSize', 'fontWeight']);
        assert.equal(t.fontWeight, '700');
        assert.equal(await page.locator('#focus-question').evaluate((e, c) => ['medium', 'long'].filter(n => e.classList.contains(n)).join(' ') === c, cls), true, `${question.length} chars: size class`);
        assert.ok(Math.abs(px(t.fontSize) - Math.max(clamp(lo, vh * 9, hi), floor)) < 0.6, `${question.length} chars: ${t.fontSize}`);
        assert.equal(await textOf(page, '#focus-question'), question);
        assert.equal((await measure(page)).clipped.includes('focus-question'), false);
      });
    }
  });
  await check('PC4-09', 'the Candidate line sizes and full wrapping', async () => withState('candidate', { question: LONG_Q, size: SIZES.narrow }, async ({ page }) => {
    const t = await style(page, '#live-question', ['fontSize', 'fontStyle']);
    assert.deepEqual([t.fontSize, t.fontStyle], ['22px', 'italic']);
    assert.equal((await style(page, '#live', ['borderLeftWidth'])).borderLeftWidth, '4px');
    assert.equal((await style(page, '#confirm-hint', ['fontSize'])).fontSize, '14px');
    assert.deepEqual([(await style(page, '#confirm-question', ['fontSize'])).fontSize, (await style(page, '#clear-live', ['fontSize'])).fontSize], ['16px', '16px']);
    assert.equal(await textOf(page, '#live-question'), LONG_Q);
    assert.deepEqual((await measure(page)).clipped, []);
  }));
  await check('PC4-10', 'the two columns are equal with an 8 px gap and stack under 800 px', async () => {
    await withState('shown', {}, async ({ page }) => {
      const [a, h] = await Promise.all([rect(page, '#answer'), rect(page, '#hear')]);
      assert.ok(Math.abs(a.w - h.w) < 1 && Math.abs(h.x - a.r - 8) < 1 && Math.abs(a.h - h.h) < 1 && a.h >= 300, JSON.stringify([a, h]));
    });
    await withState('shown', { size: SIZES.narrow }, async ({ page }) => {
      const [a, h] = await Promise.all([rect(page, '#answer'), rect(page, '#hear')]);
      assert.ok(h.y >= a.b, 'stacked, Alice suggests first');
    });
  });
  await check('PC4-11', 'the bullets are bold, sized to their range and at most three', async () => withState('shown', {}, async ({ page }) => {
    const b = await style(page, '#bullets', ['fontSize', 'fontWeight']);
    assert.equal(b.fontWeight, '700');
    assert.ok(Math.abs(px(b.fontSize) - clamp(22, 900 * 0.034, 32)) < 0.6, b.fontSize);
    assert.equal(await page.locator('#bullets li').count(), 3);
  }));
  await check('PC4-12', 'What I hear has the newest item bold, older ones faded and anchored to the bottom', async () => withState('listening', {}, async ({ svc, page }) => {
    svc.f.say('First heard words.'); await wait(page, () => document.querySelectorAll('#hear-text p').length === 1);
    svc.f.say('Second heard words.'); await wait(page, () => document.querySelectorAll('#hear-text p').length === 2);
    const items = await page.locator('#hear-text p').evaluateAll(list => list.map(p => ({ text: p.textContent, weight: getComputedStyle(p).fontWeight, opacity: getComputedStyle(p).opacity })));
    assert.deepEqual(items.map(i => i.text), ['First heard words.', 'Second heard words.']);
    assert.deepEqual([items[0].weight, items[1].weight], ['400', '700']);
    assert.ok(Number(items[0].opacity) >= 0.6 && Number(items[0].opacity) < 1);
    const [col, text] = await Promise.all([rect(page, '#hear'), rect(page, '#hear-text')]);
    assert.ok(col.b - text.b < col.h / 2, 'text sits in the lower half');
    assert.equal(px((await style(page, '#hear-text', ['fontSize'])).fontSize) >= 22, true);
    // A noise-only commit comes back with no words; the words already shown must stay and the newest stays bold.
    svc.f.say(''); await page.waitForTimeout(300);
    assert.deepEqual(await page.locator('#hear-text p').evaluateAll(list => list.map(p => [p.textContent, p.className])), [['First heard words.', 'old'], ['Second heard words.', 'new']]);
  }));
  await check('PC4-13', 'the size order holds at 500, 900 and 1200 px of window height', async () => {
    // Measured for a short, a medium and a long question: the Question is at least 1.5 times the bullets, then bullets, speech, candidate.
    const ratios = [];
    for (const size of [SIZES.short, SIZES.desktop, SIZES.tall]) {
      for (const question of [SHORT_Q, MEDIUM_Q, LONG_Q]) {
        await withState('shown', { size, question, result: SHORT }, async ({ page }) => {
          const [q, bl, hear, cand] = await Promise.all(['#focus-question', '#bullets', '#hear-text', '#live-question'].map(async s => px((await style(page, s, ['fontSize'])).fontSize)));
          ratios.push(`${size.height}/${question.length}: ${(q / bl).toFixed(3)}`);
          // 0.001 allows for the browser's rounding of a size that is exactly 1.5 times another.
          assert.ok(q / bl >= 1.5 - 0.001 && bl >= hear && hear >= cand && cand === 22, `h=${size.height}, ${question.length} chars: ${[q, bl, hear, cand]}`);
        });
      }
    }
    if (process.env.PC_PROGRESS) process.stderr.write(`  PC4-13 question-to-bullet ratios (height/characters): ${ratios.join(', ')}\n`);
  });
  await check('PC4-14', 'computed weight is 700 on the bold set, the name only without the avatar, and below 700 on every other text', async () => withState('shown', { page: { reducedMotion: 'reduce' } }, async ({ page }) => {
    const facts = await page.evaluate(textFacts);
    const boldAllowed = f => ['panel', 'focus-question', 'bar-name', 'error-row', 'package-notice', 'confirm-question'].includes(f.id) || f.inTag || f.inBullets || f.inNew || f.cls.includes('bold');
    const wrong = facts.filter(f => (f.weight >= 700) !== boldAllowed(f) && !(f.id === 'confirm-question' && f.disabled) && !(f.id === 'package-notice' && f.weight < 700));
    assert.deepEqual(wrong.map(f => `${f.id || f.cls || f.tag}:${f.weight}:${f.text}`), []);
  }));
  await check('PC4-15', 'every text meets its contrast threshold, older words included', async () => withState('listening', {}, async ({ svc, page }) => {
    svc.f.say('Older words here.'); await wait(page, () => document.querySelectorAll('#hear-text p').length === 1);
    svc.f.say('Newer words here.'); await wait(page, () => document.querySelectorAll('#hear-text p').length === 2);
    for (const k of ['g', 'l', 's']) {
      await key(page, k);
      const bad = (await page.evaluate(textFacts)).filter(f => !f.disabled && f.ratio < ((f.size >= 24 || (f.size >= 18.66 && f.weight >= 700)) ? 3 : 4.5));
      assert.deepEqual(bad.map(f => `${f.id || f.cls || f.tag}:${f.text}:${f.ratio.toFixed(2)}`), [], `cue ${k}`);
    }
  }));
  await check('PC4-16', 'content outside the avatar box changes without animation, transition or sound and markup shows as text', async () => withState('shown', { result: { bullets: ['<b>bold</b> & <img src=x onerror=alert(1)>'] } }, async ({ page }) => {
    assert.equal(await page.locator('#answer b, #answer img').count(), 0);
    assert.equal(await textOf(page, '#bullets li'), '<b>bold</b> & <img src=x onerror=alert(1)>');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => !a.effect?.target?.closest?.('#avatar')).length), 0);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('body *:not(#avatar):not(#avatar *)')].filter(e => { const c = getComputedStyle(e); return parseFloat(c.transitionDuration) > 0 || parseFloat(c.animationDuration) > 0; }).length), 0);
    assert.equal(await page.locator('audio, video').count(), 0);
  }));
  await check('PC4-49', 'no visible text, tooltip or accessible name on the page says interview', async () => withState('shown', {}, async ({ page }) => {
    const found = await page.evaluate(() => {
      const hits = [];
      const test = (where, value) => { if (/interview/i.test(value || '')) hits.push(`${where}: ${value}`); };
      test('title', document.title); test('text', document.body.innerText);
      document.querySelectorAll('[title],[aria-label],[alt],[placeholder]').forEach(e => ['title', 'aria-label', 'alt', 'placeholder'].forEach(a => test(`${e.id || e.tagName}[${a}]`, e.getAttribute(a))));
      return hits;
    });
    assert.deepEqual(found, []);
  }));
  await check('PC4-60', "the centre of the bar holds nothing and keeps a quarter of the bar's width from 900 px wide", async () => withState('shown', {}, async ({ page }) => {
    assert.deepEqual(await page.locator('.bar-centre').evaluate(e => [e.children.length, e.textContent.trim(), getComputedStyle(e).borderTopWidth]), [0, '', '0px']);
    assert.ok((await rect(page, '.bar-centre')).w >= 320);
  }));

  // ---- states (03.8.3) ----
  await check('PC4-17', 'not listening shows its wording and enabled buttons', async () => withState('idle', {}, async ({ page }) => {
    assert.equal(await textOf(page, '#monitor'), 'not listening');
    assert.deepEqual(await page.evaluate(() => ['listen', 'stop-listen', 'upload-package', 'download-log', 'confirm-question', 'clear-live'].map(id => document.getElementById(id).disabled)), [false, true, false, false, true, true]);
    assert.deepEqual([await textOf(page, '#focus-question'), await textOf(page, '#live-question'), await textOf(page, '#answer-message'), await textOf(page, '#hear-text')],
      ['No question yet', 'Not listening', 'An answer appears when Alice hears a question and you pause.', 'Not listening']);
  }));
  await check('PC4-18', 'listening shows the monitor, waits for a question and says no new question was heard after a pause', async () => withState('listening', { page: { clock: true } }, async ({ page }) => {
    assert.match(await textOf(page, '#monitor'), /^listening on server · heard \d\d:\d\d/);
    assert.equal(await textOf(page, '#live-question'), 'Waiting for a question');
    assert.deepEqual(await page.evaluate(() => [document.getElementById('listen').disabled, document.getElementById('upload-package').disabled, document.getElementById('stop-listen').disabled]), [true, true, false]);
    // The page's own silence timer: after 4 s with no voice, and only when the reader is not working, the regular notice shows.
    await page.evaluate(() => { mic.totalMs = 1000; mic.speaking = false; mic.lastVoice = performance.now() - 2000; tick({ getFloatTimeDomainData: b => b.fill(0) }, new Float32Array(2048)); });
    assert.equal(await textOf(page, '#live-question'), 'Waiting for a question', 'not yet after 2 s');
    await page.evaluate(() => { remote.agent = 'thinking'; mic.lastVoice = performance.now() - 5000; tick({ getFloatTimeDomainData: b => b.fill(0) }, new Float32Array(2048)); });
    assert.equal(await textOf(page, '#live-question'), 'Waiting for a question', 'not while the reader is working');
    await page.evaluate(() => { remote.agent = 'idle'; renderServer(); mic.totalMs = 1000; mic.speaking = false; mic.lastVoice = performance.now() - 5000; tick({ getFloatTimeDomainData: b => b.fill(0) }, new Float32Array(2048)); });
    assert.equal(await textOf(page, '#live-question'), 'No new question heard.');
    assert.equal((await style(page, '#live-question', ['fontWeight'])).fontWeight, '400');
    assert.equal(await page.locator('#error-row').isHidden(), true);
  }));
  await check('PC4-19', 'a candidate shows its tag, enables Confirm and shows the Space hint', async () => withState('candidate', {}, async ({ page }) => {
    assert.equal(await textOf(page, '#live-tag'), 'new question');
    assert.deepEqual(await page.evaluate(() => [document.getElementById('confirm-question').disabled, document.getElementById('clear-live').disabled]), [false, false]);
    assert.equal(await textOf(page, '#confirm-hint'), 'Space confirms');
    assert.equal(await textOf(page, '#focus-question'), 'No question yet');
  }));
  await check('PC4-20', 'a pending answer shows the confirmed question with its source and no earlier bullets', async () => withState('preparing', {}, async ({ page }) => {
    assert.match(await textOf(page, '#focus-status'), /^confirmed \d\d:\d\d:\d\d · by Confirm$/);
    assert.equal(await textOf(page, '#answer-message'), 'Preparing an answer for this question.');
    assert.equal(await page.locator('#bullets li').count(), 0);
    assert.match(await textOf(page, '#monitor'), /preparing an answer/);
    assert.deepEqual([await textOf(page, '#live-question'), await page.locator('#clear-live').isDisabled()], ['Waiting for a question', true], 'the candidate area is cleared');
    // The automatic flow Pablo uses: the service sets the Question itself and keeps its reading equal to it.
    await withState('listening', { autoFocus: true }, async ({ svc, page: auto }) => {
      svc.f.say(SHORT_Q);
      await wait(auto, q => document.getElementById('focus-question').textContent === q, SHORT_Q);
      assert.match(await textOf(auto, '#focus-status'), /by pause$/);
      assert.deepEqual([await textOf(auto, '#live-question'), await textOf(auto, '#live-tag'), await textOf(auto, '#confirm-hint')],
        ['Waiting for a question', '', 'Confirm becomes available when a new question is heard.']);
      assert.deepEqual(await auto.evaluate(() => [document.getElementById('confirm-question').disabled, document.getElementById('clear-live').disabled]), [true, true]);
      await key(auto, ' '); await key(auto, 'Escape'); await auto.waitForTimeout(200);
      assert.equal(auto.sent.filter(f => f.includes('question.')).length, 0, 'Space and Esc send nothing without a candidate');
    });
  }));
  await check('PC4-21', 'a shown answer shows bullets together with its tag and delay', async () => withState('shown', {}, async ({ page }) => {
    assert.deepEqual(await page.locator('#bullets li').allTextContents(), SHORT.bullets);
    assert.equal(await textOf(page, '#answer-tag'), 'from your package');
    assert.match(await textOf(page, '#monitor'), /answer ready \d+\.\d s/);
  }));
  await check('PC4-22', 'each error cause shows its notice row and clears with the cause', async () => {
    await withState('unavailable', { apiKey: '' }, async ({ page }) => {
      assert.equal(await textOf(page, '#error-row'), 'No OpenAI key is set up.');
      assert.equal(await page.locator('#listen').isDisabled(), true);
      assert.equal((await style(page, '#error-row', ['fontWeight'])).fontWeight, '700');
    });
    await withState('listening', {}, async ({ svc, page }) => {
      assert.equal(await page.locator('#error-row').isHidden(), true);
      svc.server.shutdown();
      await wait(page, () => document.getElementById('error-row').textContent === 'Connection to transcription was lost; stop and restart.');
    });
    await withState('listening', {}, async ({ page }) => {
      await page.evaluate(() => { remote.status = 'POC session limit reached (30 minutes); stop and restart'; renderServer(); });
      assert.equal(await textOf(page, '#error-row'), 'Session limit reached (30 minutes); stop and restart.');
      await page.evaluate(() => { remote.status = 'listening on server'; renderServer(); });
      assert.equal(await page.locator('#error-row').isHidden(), true, 'clears with the cause');
    });
    await withState('idle', {}, async ({ page }) => {
      await page.evaluate(() => { remote.status = 'OpenAI quota or rate limit reached'; renderServer(); });
      assert.equal(await textOf(page, '#error-row'), 'OpenAI quota or rate limit reached', 'any other failure shows the service text');
    });
    const refuse = () => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); }; };
    await withState('idle', { page: { mic: false, init: refuse } }, async ({ page }) => {
      await page.click('#listen');
      await wait(page, () => document.getElementById('error-row').textContent === 'Microphone access was refused.');
      assert.equal(await page.locator('#listen').isEnabled(), true);
    });
    await withState('failed', {}, async ({ page }) => assert.equal(await textOf(page, '#answer-message'), 'No proposed answer for this question.'));
  });
  await check('PC4-23', 'each missing-package case shows its line, general tag and enabled Upload', async () => {
    for (const [files, line] of [[{}, 'No package']]) {
      await withState('shown', { files, result: SHORT }, async ({ page }) => {
        assert.match(await textOf(page, '#package-line'), new RegExp(`^${line}`));
        assert.equal(await page.locator('#upload-package').isDisabled(), true, 'disabled while listening');
        assert.match(await textOf(page, '#answer-tag'), /General points|from your package/);
      });
    }
    await withState('idle', { files: {} }, async ({ page }) => {
      await wait(page, () => document.getElementById('package-text').textContent !== '');
      assert.equal(await textOf(page, '#package-text'), 'No package');
      assert.equal(await page.locator('#upload-package').isDisabled(), false);
    });
    await withState('idle', { files: { 'a.txt': 'x'.repeat(20001) } }, async ({ page }) => {
      await wait(page, () => document.getElementById('package-text').textContent !== '');
      assert.equal(await textOf(page, '#package-text'), 'Package over 20,000 characters, not used.');
    });
  });
  await check('PC4-24', 'stopped keeps content marked last known with no bold speech', async () => withState('last-known', {}, async ({ svc, page }) => {
    assert.equal(await textOf(page, '#focus-status'), 'Last known, not live');
    assert.match(await textOf(page, '#answer-tag'), /Last known, not live/);
    assert.deepEqual(await page.locator('#bullets li').allTextContents(), SHORT.bullets);
    assert.equal(await page.locator('#hear-text .new').count(), 0);
    assert.deepEqual(await page.locator('#hear-text p').evaluateAll(list => list.map(p => [p.textContent, p.className])), [[SHORT_Q, 'old']], 'the words stay, faded');
    assert.deepEqual(await page.evaluate(() => ['listen', 'upload-package', 'download-log'].map(id => document.getElementById(id).disabled)), [false, false, false]);
  }));
  await check('PC4-25', 'uploading shows its line and disables Upload', async () => withState('idle', {}, async ({ page }) => {
    await page.route('**/package', async route => { if (route.request().method() === 'PUT') { await new Promise(r => setTimeout(r, 600)); } await route.continue(); });
    const done = page.evaluate(() => uploadPackage([new File(['Beta notes.'], 'beta.md')]));
    await wait(page, () => document.getElementById('package-text').textContent === 'Loading package…');
    assert.equal(await page.locator('#upload-package').isDisabled(), true);
    await done;
    assert.match(await textOf(page, '#package-text'), /^Package: 1 file · \d+ chars · uploaded$/);
  }));
  await check('PC4-26', 'states combine and the bar and its buttons never hide', async () => withState('shown', {}, async ({ page }) => {
    await page.evaluate(() => { remote.status = 'Transcription disconnected; stop and restart'; renderServer(); });
    assert.equal(await page.locator('#error-row').isVisible(), true);
    assert.equal(await page.locator('#package-line').isVisible(), true);
    assert.deepEqual(await page.locator('#controls button:visible').count() >= 4, true);
    assert.deepEqual(await page.locator('#bullets li').allTextContents(), SHORT.bullets);
    assert.equal(await page.locator('#cue-band').isVisible(), true);
  }));

  // ---- controls and inputs ----
  await check('PC4-27', 'each control, Remove included, is enabled only in its states and a disabled one shows its cause as text', async () => {
    await withState('idle', {}, async ({ page }) => {
      await wait(page, () => document.getElementById('package-text').textContent !== '');
      assert.equal(await page.locator('#remove-package').isEnabled(), true, 'Remove with a loaded package, not listening');
      assert.equal(await page.locator('#clear-live').isDisabled(), true);
      assert.equal(await textOf(page, '#confirm-hint'), 'Start listening to continue.');
    });
    await withState('listening', {}, async ({ page }) => {
      assert.equal(await page.locator('#remove-package').isDisabled(), true);
      assert.equal(await textOf(page, '#package-notice'), 'Stop listening to load a package.');
      assert.equal(await page.locator('#download-log').isEnabled(), true, 'Download is always enabled');
      assert.equal(await textOf(page, '#confirm-hint'), 'Confirm becomes available when a question is heard.');
    });
  });
  await check('PC4-28', 'Space confirms outside buttons and fields, does not scroll and focus is released after a button', async () => withState('candidate', { size: SIZES.short }, async ({ svc, page }) => {
    assert.equal(await page.evaluate(() => document.activeElement === document.body || document.activeElement === document.documentElement), true, 'focus released after Start');
    const before = await page.evaluate(() => scrollY);
    await key(page, ' ');
    await wait(page, q => document.getElementById('focus-question').textContent === q, SHORT_Q);
    assert.equal(await page.evaluate(() => scrollY), before, 'no scroll');
  }));
  await check('PC4-29', 'Confirm and Space send the identical request apart from the field via', async () => {
    const sentConfirm = async how => {
      let message;
      await withState('candidate', {}, async ({ page }) => {
        if (how === 'button') await page.click('#confirm-question'); else await key(page, ' ');
        await until(() => page.sent.some(f => f.includes('question.confirm')));
        message = JSON.parse(page.sent.find(f => f.includes('question.confirm')));
      });
      return message;
    };
    const [a, b] = [await sentConfirm('button'), await sentConfirm('space')];
    assert.deepEqual([a.via, b.via], ['button', 'space']);
    const strip = ({ requestId, sessionId, liveId, via, ...rest }) => rest;
    assert.deepEqual(strip(a), strip(b));
    assert.equal(a.text, SHORT_Q);
  });
  await check('PC4-30', 'Clear resets by button and by Esc and never writes the Question', async () => {
    for (const how of ['button', 'escape']) {
      await withState('candidate', {}, async ({ page }) => {
        if (how === 'button') await page.click('#clear-live'); else await key(page, 'Escape');
        await until(() => page.sent.some(f => f.includes('question.reset')));
        assert.equal(JSON.parse(page.sent.find(f => f.includes('question.reset'))).via, how);
        await wait(page, () => document.getElementById('live-question').textContent === 'Waiting for a question');
        assert.equal(await textOf(page, '#focus-question'), 'No question yet');
      });
    }
  });
  const autoSvc = await service({ files: WITH_PACKAGE, autoFocus: true });
  await check('PC4-31', 'a question before a pause still sets the Question by speech', async () => {
    const page = await openPage(browser, autoSvc.origin, SIZES.desktop);
    try {
      await listen(page);
      autoSvc.f.say(SHORT_Q);
      await wait(page, q => document.getElementById('focus-question').textContent === q, SHORT_Q);
      assert.match(await textOf(page, '#focus-status'), /by pause$/);
    } finally { await page.ctx.close(); }
  });
  autoSvc.close();
  await check('PC4-32', 'the input inventory has Start, Stop, Confirm, Clear, Space, Esc, A, the avatar toggle, Upload, Remove and Download, and no cue key', async () => withState('candidate', {}, async ({ page }) => {
    const ids = await page.evaluate(() => ['listen', 'stop-listen', 'confirm-question', 'clear-live', 'upload-package', 'remove-package', 'download-log', 'avatar-toggle'].map(id => Boolean(document.getElementById(id))));
    assert.deepEqual(ids.slice(0, 7), [true, true, true, true, true, true, true]);
    for (const k of ['g', 'l', 's']) { await key(page, k); }
    await page.waitForTimeout(300);
    assert.equal(await cueName(page), 'GOOD', 'G, L and S are not inputs');
    await page.evaluate(() => { const o = []; document.addEventListener('keydown', e => o.push(e.key)); window.__keys = o; });
    await key(page, 'a');
  }));
  await check('PC4-33', 'Tab visits the controls in order, the avatar toggle after Download, with a visible 3 px outline', async () => withState('candidate', {}, async ({ page }) => {
    await wait(page, () => !document.getElementById('avatar-toggle') || !document.getElementById('avatar-toggle').hidden, null).catch(() => {});
    const order = [];
    for (let i = 0; i < 8; i++) {
      await key(page, 'Tab');
      order.push(await page.evaluate(() => { const e = document.activeElement; return { id: e.id, outline: getComputedStyle(e).outlineWidth, style: getComputedStyle(e).outlineStyle }; }));
    }
    const all = order.map(o => o.id);
    const ids = all.slice(0, all.includes('') ? all.indexOf('') : all.length); // one pass; an empty id is the page itself after the last control
    const inOrder = ['listen', 'stop-listen', 'upload-package', 'download-log', 'avatar-toggle', 'remove-package', 'confirm-question', 'clear-live'].filter(id => ids.includes(id));
    assert.deepEqual(ids.filter(id => inOrder.includes(id)), inOrder, `tab order ${ids.join(',')}`);
    for (const id of ['download-log', 'confirm-question', 'clear-live']) assert.ok(ids.includes(id), `${id} reachable by Tab`);
    if (ids.includes('avatar-toggle')) assert.ok(ids.indexOf('download-log') < ids.indexOf('avatar-toggle') && ids.indexOf('avatar-toggle') < ids.indexOf('confirm-question'));
    assert.ok(order.filter(o => o.id).every(o => o.outline === '3px' && o.style !== 'none'), JSON.stringify(order));
  }));
  await check('PC4-34', 'the page holds no control that was not listed', async () => withState('shown', {}, async ({ page }) => {
    const ids = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea, summary')].map(e => e.id));
    const allowed = ['listen', 'stop-listen', 'upload-package', 'download-log', 'package-file', 'avatar-toggle', 'confirm-question', 'clear-live', 'remove-package'];
    assert.deepEqual(ids.filter(id => !allowed.includes(id)), []);
  }));
  await check('PC4-35', 'Upload opens a picker for several md and txt files and no folder or zip', async () => withState('idle', {}, async ({ page }) => {
    const input = await page.locator('#package-file').evaluate(e => [e.multiple, e.accept, e.webkitdirectory, e.type]);
    assert.deepEqual(input, [true, '.md,.txt,text/markdown,text/plain', false, 'file']);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#upload-package')]);
    assert.equal(chooser.isMultiple(), true);
  }));
  await check('PC4-36', 'a file that is not UTF-8 is named, nothing is sent and the old package stays', async () => withState('idle', {}, async ({ page }) => {
    await wait(page, () => document.getElementById('package-text').textContent !== '');
    const before = await textOf(page, '#package-text');
    const puts = []; page.on('request', r => { if (r.method() === 'PUT') puts.push(r.url()); });
    const chooser = page.waitForEvent('filechooser'); await page.click('#upload-package');
    await (await chooser).setFiles([{ name: 'bad.md', mimeType: 'text/markdown', buffer: Buffer.from([0xff, 0xfe, 0x41]) }]);
    await wait(page, () => document.getElementById('package-notice').textContent.startsWith('Not loaded'));
    assert.equal(await textOf(page, '#package-notice'), 'Not loaded: bad.md could not be read as text. Your previous package is still in use.');
    assert.deepEqual([puts.length, await textOf(page, '#package-text')], [0, before]);
  }));
  await check('PC4-37', 'the upload request has the right route, type and body shape', async () => withState('idle', {}, async ({ page }) => {
    let seen;
    await page.route('**/package', route => { if (route.request().method() === 'PUT') seen = { type: route.request().headers()['content-type'], body: route.request().postDataJSON() }; return route.continue(); });
    const chooser = page.waitForEvent('filechooser'); await page.click('#upload-package');
    await (await chooser).setFiles([{ name: 'one.md', mimeType: 'text/markdown', buffer: Buffer.from('One.') }, { name: 'two.txt', mimeType: 'text/plain', buffer: Buffer.from('Two.') }]);
    await wait(page, () => document.getElementById('package-notice').textContent.startsWith('Package loaded'));
    assert.equal(seen.type, 'application/json');
    assert.deepEqual(seen.body, { files: [{ name: 'one.md', text: 'One.' }, { name: 'two.txt', text: 'Two.' }] });
  }));
  await check('PC4-38', 'each upload result and reason, and package removed, shows its message', async () => withState('idle', {}, async ({ page }) => {
    const upload = async files => { const c = page.waitForEvent('filechooser'); await page.click('#upload-package'); await (await c).setFiles(files); await wait(page, () => document.getElementById('package-notice').textContent !== '' && !document.getElementById('upload-package').disabled); return textOf(page, '#package-notice'); };
    const file = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
    assert.equal(await upload([file('a.md', 'Alpha notes.'), file('README.md', 'x')]), 'Package loaded: 1 file, 12 of 20,000 characters, 0 terms. Skipped: README.md (not used).');
    assert.equal(await upload([file('big.md', 'x'.repeat(20001))]), 'Not loaded: over 20,000 characters (20,001). Your previous package is still in use.');
    assert.equal(await upload([file('..x.md', 'x')]), 'Not loaded: the file name ..x.md was not accepted. Your previous package is still in use.');
    assert.match(await upload([file('e.md', '   ')]), /^Not loaded: no \.md or \.txt text was found\./);
    await page.click('#remove-package'); await wait(page, () => document.getElementById('package-notice').textContent === 'Package removed.');
    assert.equal(await textOf(page, '#package-text'), 'No package');
  }));
  await check('PC4-39', 'upload is disabled while listening with its message', async () => withState('listening', {}, async ({ page }) => {
    assert.deepEqual(await page.evaluate(() => [document.getElementById('upload-package').disabled, document.getElementById('remove-package').disabled]), [true, true]);
    assert.equal(await textOf(page, '#package-notice'), 'Stop listening to load a package.');
  }));
  await check('PC4-40', 'the package line follows GET package on load, after upload and after Stop, with Remove only for a loaded package and no names', async () => withState('idle', { files: { 'secret-name.md': 'Folder text.' } }, async ({ page }) => {
    await wait(page, () => document.getElementById('package-text').textContent !== '');
    assert.equal(await textOf(page, '#package-text'), 'Package: 1 file · 12 chars · folder');
    assert.equal(await page.locator('#remove-package').isVisible(), true);
    assert.equal((await page.evaluate(() => document.body.innerText)).includes('secret-name'), false);
    await page.click('#remove-package'); await wait(page, () => document.getElementById('package-text').textContent === 'No package');
    assert.equal(await page.locator('#remove-package').isVisible(), false, 'no Remove without a package');
    await listen(page); await page.click('#stop-listen');
    await wait(page, () => document.getElementById('monitor').textContent === 'not listening');
    assert.equal(await textOf(page, '#package-text'), 'No package');
  }));
  await check('PC4-41', 'Download log saves a file, is always enabled and shows the 404 message', async () => {
    await withState('idle', {}, async ({ page }) => {
      assert.equal(await page.locator('#download-log').isEnabled(), true);
      await page.click('#download-log');
      await wait(page, () => document.getElementById('monitor').textContent.includes('No meeting log yet.'));
    });
    await withState('listening', {}, async ({ page, svc }) => {
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download-log')]);
      assert.match(download.suggestedFilename(), /^alice-meeting-\d{8}T\d{6}Z\.jsonl$/);
      const text = await readFile(await download.path(), 'utf8');
      assert.equal(JSON.parse(text.split('\n')[0]).type, 'log_started');
    });
  });
  await check('PC4-42', 'the monitor says log not saved when the log cannot be written', async () => withState('listening', {}, async ({ page, svc }) => {
    await page.evaluate(() => { const e = new MessageEvent('message', { data: JSON.stringify({ type: 'log', status: 'not saved', sessionId: remote.sessionId }) }); current.socket.dispatchEvent(e); });
    await wait(page, () => document.getElementById('monitor').textContent.includes('log not saved'));
  }));
  await check('PC4-43', 'the keys G, L and S change nothing: the cue, the bar, the question areas and what is sent stay as they were', async () => {
    const facts = page => page.evaluate(() => { const t = id => document.getElementById(id).textContent, bar = document.getElementById('cue-band');
      return { word: t('panel'), color: getComputedStyle(bar).backgroundColor, label: bar.getAttribute('aria-label'), question: t('focus-question'), candidate: t('live-question'), bullets: t('bullets') }; });
    const pressAll = async page => { for (const k of ['g', 'l', 's', 'Shift+G', 'Shift+L', 'Shift+S']) await key(page, k); await page.waitForTimeout(400); };
    await withState('idle', {}, async ({ page }) => {
      const before = await facts(page); await pressAll(page);
      assert.deepEqual(await facts(page), before, 'not listening');
      assert.equal(before.word, 'GOOD');
    });
    await withState('candidate', {}, async ({ page }) => {
      await speakingFor(page, 27, 'LAND IT');
      const controls = () => page.sent.filter(f => !f.includes('"type":"rendered"')).length;
      const before = await facts(page), sent = controls(); await pressAll(page);
      assert.deepEqual(await facts(page), before, 'listening with a candidate and the cue at LAND IT');
      assert.equal(controls(), sent, 'nothing was sent to the service');
    });
  });
  await check('PC4-44', 'Space, Esc and A do nothing in a text field, and Space and Esc do nothing with a modifier key', async () => withState('candidate', {}, async ({ page }) => {
    const controls = () => page.sent.filter(f => f.includes('question.')).length;
    await page.evaluate(() => { const i = document.createElement('input'); i.id = 'probe'; document.body.append(i); });
    await page.focus('#probe'); for (const k of [' ', 'Escape', 'a']) await key(page, k);
    assert.equal(controls(), 0);
    await page.evaluate(() => document.activeElement.blur());
    for (const k of ['Control+Space', 'Alt+Space', 'Shift+Space', 'Control+Escape', 'Shift+Escape']) await key(page, k);
    await page.waitForTimeout(200);
    assert.equal(controls(), 0);
    assert.equal(await textOf(page, '#live-question'), SHORT_Q, 'the candidate is still there');
  }));
  await check('PC4-45', 'Remove clears an uploaded package, shows the folder package or none, and is disabled while listening', async () => withState('idle', { files: { 'f.md': 'Folder.' } }, async ({ page }) => {
    await wait(page, () => document.getElementById('package-text').textContent !== '');
    const c = page.waitForEvent('filechooser'); await page.click('#upload-package');
    await (await c).setFiles([{ name: 'up.md', mimeType: 'text/markdown', buffer: Buffer.from('Uploaded.') }]);
    await wait(page, () => document.getElementById('package-text').textContent.endsWith('uploaded'));
    await page.click('#remove-package'); await wait(page, () => document.getElementById('package-notice').textContent === 'Package removed.');
    assert.equal(await textOf(page, '#package-text'), 'No package', 'Remove clears the folder package too until restart');
  }));
  await check('PC4-46', 'with the page clock controlled, the cue follows the speaking timer alone, LAND IT above 25 s and STOP above 35 s, and no key holds or changes it', async () => withState('listening', { page: { clock: true } }, async ({ page }) => {
    await page.evaluate(() => { mic.turnStart = performance.now() - 20000; });
    await page.clock.runFor(300); assert.equal(await cueName(page), 'GOOD', '20 s of speaking');
    await key(page, 's'); await page.clock.runFor(300); assert.equal(await cueName(page), 'GOOD', 'S does not set STOP');
    await page.clock.runFor(6000); assert.equal(await cueName(page), 'LAND IT', 'over 25 s');
    await key(page, 'g'); await page.clock.runFor(300); assert.equal(await cueName(page), 'LAND IT', 'G does not set GOOD');
    await page.clock.runFor(10000); assert.equal(await cueName(page), 'STOP', 'over 35 s');
    await key(page, 'l'); await page.clock.runFor(300); assert.equal(await cueName(page), 'STOP', 'L does not set LAND IT');
  }));
  await check('PC4-47', 'a new question and a Focus change leave the timer cue as it is, and Stop returns it to GOOD', async () => withState('listening', {}, async ({ svc, page }) => {
    await speakingFor(page, 27, 'LAND IT');
    await candidate(page, svc, SHORT_Q); assert.equal(await cueName(page), 'LAND IT');
    await page.click('#confirm-question'); await wait(page, () => document.getElementById('focus-question').textContent !== 'No question yet');
    assert.equal(await cueName(page), 'LAND IT');
    await page.click('#stop-listen'); await wait(page, () => document.getElementById('panel').textContent === 'GOOD');
  }));
  await check('PC4-48', 'while a button has focus Esc and A do nothing and Space presses the button', async () => withState('candidate', {}, async ({ page }) => {
    await page.focus('#clear-live');
    for (const k of ['Escape', 'a']) await key(page, k);
    await page.waitForTimeout(200);
    assert.equal(page.sent.filter(f => f.includes('question.')).length, 0, 'Esc on a focused button sends nothing');
    await key(page, ' ');
    await until(() => page.sent.some(f => f.includes('question.reset')));
    assert.equal(JSON.parse(page.sent.find(f => f.includes('question.reset'))).via, 'button', 'Space pressed the focused Clear button');
  }));

  // ---- avatar (03.8.6) ----
  const avatarReady = page => wait(page, () => (typeof avatar !== 'undefined' && Boolean(avatar.api)) || !document.getElementById('avatar'), null);
  await check('PC4-50', 'the avatar is a round 56 px box at the left end of the bar from 900 px wide, 48 px under 900 px, 36 px under 500 px and 40 px in a short window, and no other area changes size', async () => {
    const sizes = {};
    for (const [name, size] of [['wide', SIZES.desktop], ['mid', { width: 800, height: 900 }], ['small', { width: 420, height: 900 }], ['short', SIZES.short]]) {
      await withState('idle', { size }, async ({ page }) => { await avatarReady(page); const b = await rect(page, '#avatar'); sizes[name] = [Math.round(b.w), Math.round(b.h)]; assert.equal((await style(page, '#avatar', ['borderTopLeftRadius'])).borderTopLeftRadius, '50%'); });
    }
    assert.deepEqual(sizes, { wide: [56, 56], mid: [48, 48], small: [36, 36], short: [40, 40] });
    await withState('idle', {}, async ({ page }) => { await avatarReady(page); assert.ok((await rect(page, '#avatar')).x < 40, 'left end'); });
    await withState('idle', {}, async ({ page }) => {
      const noAvatar = await rect(page, '#focus'); await avatarReady(page);
      assert.equal(Math.round((await rect(page, '#focus')).h), Math.round(noAvatar.h));
    });
  });
  await check('PC4-51', 'each screen state sets the matching avatar state', async () => withState('listening', {}, async ({ svc, page }) => {
    await avatarReady(page); const st = () => page.locator('#avatar').getAttribute('data-avatar-state');
    await wait(page, () => document.getElementById('avatar').dataset.avatarState === 'listening');
    await candidate(page, svc, SHORT_Q); assert.equal(await st(), 'question');
    await page.click('#confirm-question'); await waitCalls(svc, 1);
    await wait(page, () => document.getElementById('avatar').dataset.avatarState === 'researching');
    await page.evaluate(() => { remote.status = 'Transcription disconnected; stop and restart'; renderServer(); });
    await wait(page, () => document.getElementById('avatar').dataset.avatarState === 'error');
    await page.evaluate(() => { remote.status = 'listening on server'; renderServer(); });
    svc.f.release(SHORT); await wait(page, () => document.querySelectorAll('#bullets li').length > 0);
    await page.click('#stop-listen');
    await wait(page, () => ['idle', 'ready'].includes(document.getElementById('avatar').dataset.avatarState));
  }));
  await check('PC4-52', 'the question and ready states last 1.5 and 2.5 seconds, a failed answer shows error for 3 seconds, no restart within 3 seconds, and priority holds', async () => {
    // The timing and priority rules are exercised exactly on the state machine with a controlled clock in node --test
    // (avatar states follow ...; question lasts ...; error outranks ...). Here the page's use of them is seen on its own clock.
    await withState('listening', { page: { clock: true } }, async ({ svc, page }) => {
      await avatarReady(page); await page.clock.runFor(300);
      await page.evaluate(() => { remote.live = { id: 'x', version: 1, text: 'A question?', kind: 'new' }; remote.revision += 1; renderServer(); });
      assert.equal(await page.locator('#avatar').getAttribute('data-avatar-state'), 'question');
      await page.clock.runFor(1400); await page.evaluate(() => updateAvatar());
      assert.equal(await page.locator('#avatar').getAttribute('data-avatar-state'), 'question');
      await page.clock.runFor(200); await page.evaluate(() => updateAvatar());
      assert.equal(await page.locator('#avatar').getAttribute('data-avatar-state'), 'listening');
    });
  });
  await check('PC4-53', 'drawing stays near 15 frames a second and stops while the tab is hidden', async () => withState('idle', {}, async ({ page }) => {
    await avatarReady(page);
    const frames = () => page.evaluate(() => Number(document.getElementById('avatar').dataset.avatarFrames || 0));
    const a = await frames(); await page.waitForTimeout(3000); const b = await frames();
    const rate = (b - a) / 3;
    assert.ok(rate >= 8 && rate <= 20, `frames per second ${rate}`);
  }));
  await check('PC4-54', 'the toggle and the key A switch the avatar, the choice survives a reload and the default is on', async () => withState('idle', {}, async ({ page, svc }) => {
    await avatarReady(page);
    assert.equal(await page.locator('#avatar-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#avatar').isVisible(), true);
    await page.click('#avatar-toggle');
    assert.deepEqual([await page.locator('#avatar-toggle').getAttribute('aria-pressed'), await page.locator('#avatar').isVisible()], ['false', false]);
    await key(page, 'a');
    assert.deepEqual([await page.locator('#avatar-toggle').getAttribute('aria-pressed'), await page.locator('#avatar').isVisible()], ['true', true]);
    await key(page, 'a'); await page.reload(); await avatarReady(page);
    assert.equal(await page.locator('#avatar-toggle').getAttribute('aria-pressed'), 'false', 'remembered');
    assert.equal(await page.locator('#bar-name').evaluate(e => getComputedStyle(e).fontSize), '20px');
  }));
  await check('PC4-55', 'with reduced motion the avatar and toggle are absent and A does nothing', async () => withState('idle', { page: { reducedMotion: 'reduce' } }, async ({ page }) => {
    await page.waitForTimeout(500);
    assert.deepEqual([await page.locator('#avatar').count(), await page.locator('#avatar-toggle').count()], [0, 0]);
    await key(page, 'a'); assert.equal(await page.locator('#avatar').count(), 0);
    assert.equal(page.requests.some(u => u.includes('/poc/vendor/') || u.includes('/poc/avatar.js')), false, 'nothing loaded');
  }));
  await check('PC4-56', 'when the library, model or WebGL fails within 5 seconds the box and toggle vanish with no message and the name shows at 20 px bold and the rest of the page is as before', async () => {
    const svc = await service({ files: WITH_PACKAGE });
    const context = await browser.newContext({ viewport: SIZES.desktop });
    try {
      await context.route('**/poc/vendor/models/mpfb.glb', route => route.fulfill({ status: 404 }));
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(svc.origin); await ready(page);
      await wait(page, () => !document.getElementById('avatar'));
      assert.deepEqual([await page.locator('#avatar-toggle').count(), await page.locator('#error-row').isHidden()], [0, true]);
      assert.deepEqual(Object.values(await style(page, '#bar-name', ['fontSize', 'fontWeight'])), ['20px', '700']);
      assert.equal(await cueName(page), 'GOOD');
      assert.equal(await page.locator('#listen').isEnabled(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); svc.close(); }
  });
  await check('PC4-57', 'with the avatar on, nothing outside its box animates or flashes over two seconds', async () => withState('listening', {}, async ({ svc, page }) => {
    await avatarReady(page);
    const sample = () => page.evaluate(() => ({ anims: document.getAnimations().filter(a => !a.effect?.target?.closest?.('#avatar')).length,
      colour: getComputedStyle(document.getElementById('cue-band')).backgroundColor, focus: document.getElementById('focus').getBoundingClientRect().height }));
    const first = await sample(); await page.waitForTimeout(2000); const last = await sample();
    assert.deepEqual([first.anims, last.anims, last.colour, last.focus], [0, 0, first.colour, first.focus]);
  }));
  await check('PC4-58', 'the page asks only its own origin for the avatar files in poc/vendor and poc/avatar.js', async () => withState('idle', {}, async ({ page, svc }) => {
    await avatarReady(page);
    const urls = page.requests.filter(u => u.startsWith('http'));
    assert.equal(urls.every(u => u.startsWith(svc.origin)), true, urls.filter(u => !u.startsWith(svc.origin)).join(','));
    assert.ok(urls.some(u => u.endsWith('/poc/avatar.js')) && urls.some(u => u.includes('/poc/vendor/models/mpfb.glb')));
  }));
  await check('PC4-59', 'a throwing adapter leaves the cue, timer, keys and audio sends working and the frozen state cannot be written', async () => {
    const svc = await service({ files: WITH_PACKAGE });
    const context = await browser.newContext({ viewport: SIZES.desktop });
    try {
      await context.addInitScript(FAKE_MIC);
      await context.route('**/poc/avatar.js', route => route.fulfill({ status: 200, contentType: 'text/javascript',
        body: `export async function createAvatar() { return { setActive() {}, dispose() {}, update(s) { window.__wrote = []; try { s.listening = 'x'; } catch (e) { window.__wrote.push('blocked'); } try { s.extra = 1; } catch (e) { window.__wrote.push('blocked'); } throw new Error('adapter broke'); } }; }` }));
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(svc.origin); await listen(page);
      await wait(page, () => window.__wrote !== undefined || !document.getElementById('avatar'));
      assert.deepEqual(await page.evaluate(() => window.__wrote || []), ['blocked', 'blocked']);
      await speakingFor(page, 27, 'LAND IT');
      await wait(page, () => document.getElementById('monitor').textContent.includes('heard'));
      await page.click('#stop-listen');
      assert.deepEqual(errors, []);
    } finally { await context.close(); svc.close(); }
  });

  // ---- SPRINT-005 (RT5-6): Stop waits for the last words ----
  const stopFacts = page => page.evaluate(() => ({ stop: document.getElementById('stop-listen').textContent, stopOff: document.getElementById('stop-listen').disabled,
    startOff: document.getElementById('listen').disabled, uploadOff: document.getElementById('upload-package').disabled, monitor: document.getElementById('monitor').textContent,
    live: document.getElementById('live-question').textContent, focusStatus: document.getElementById('focus-status').textContent, tag: document.getElementById('answer-tag').textContent,
    hear: [...document.querySelectorAll('#hear-text p')].map(p => [p.textContent, p.className]), error: document.getElementById('error-row').textContent }));
  await check('PC5-1', 'pressing Stop sends stop and keeps the socket open; while the service waits the Stop button reads Stopping… and Start is disabled', async () => withState('shown', { drainMs: 3000 }, async ({ svc, page }) => {
    await wait(page, () => document.getElementById('monitor').textContent.includes('heard'));
    await page.click('#stop-listen');
    await until(() => page.sent.some(frame => frame.includes('"type":"stop"')));
    await page.waitForTimeout(300);
    const during = await stopFacts(page);
    assert.equal(page.sockets.at(-1).isClosed(), false, 'the socket stays open');
    assert.deepEqual([during.stop, during.stopOff, during.startOff, during.uploadOff], ['Stopping…', true, true, true]);
    assert.deepEqual([during.monitor, during.live, during.focusStatus, during.error], ['not listening', 'Not listening', 'Last known, not live', ''], 'the page is no longer listening');
    assert.match(during.tag, /Last known, not live/);
    assert.equal(await cueName(page), 'GOOD');
    // The last words arrive: they show in "What I hear" only, faded, and change nothing else.
    const sentBefore = page.sent.length;
    svc.f.say('And these were my very last words?');
    await wait(page, () => [...document.querySelectorAll('#hear-text p')].some(p => p.textContent === 'And these were my very last words?'));
    const after = await stopFacts(page);
    assert.deepEqual(after.hear.at(-1), ['And these were my very last words?', 'old']);
    assert.deepEqual([after.live, after.focusStatus, await textOf(page, '#focus-question'), await page.locator('#bullets li').allTextContents()], ['Not listening', 'Last known, not live', SHORT_Q, SHORT.bullets]);
    assert.equal(svc.f.calls.length, 1, 'no answer request from the last words');
    assert.equal(page.sent.slice(sentBefore).some(frame => frame.includes('"rendered"')), false);
  }));
  await check('PC5-2', 'the page closes when the service closes, or after about 4 seconds if it does not, and then shows the Stopped state with Start enabled', async () => {
    const stoppedState = async page => {
      const facts = await stopFacts(page);
      assert.deepEqual([facts.stop, facts.stopOff, facts.startOff, facts.uploadOff, facts.monitor, facts.focusStatus, facts.error], ['Stop listening', true, false, false, 'not listening', 'Last known, not live', '']);
      assert.equal(await page.locator('#hear-text .new').count(), 0);
      assert.equal(await page.locator('#download-log').isEnabled(), true);
    };
    // The service closes as soon as the last words are in: the page follows at once.
    await withState('shown', { drainMs: 3000 }, async ({ svc, page }) => {
      await wait(page, () => document.getElementById('monitor').textContent.includes('heard'));
      await page.click('#stop-listen');
      await wait(page, () => document.getElementById('stop-listen').textContent === 'Stopping…');
      const at = Date.now();
      svc.f.say('The last words.');
      await wait(page, () => !document.getElementById('listen').disabled);
      assert.ok(Date.now() - at < 1500, 'well before the 3 seconds of the service and the 4 of the page');
      await until(() => page.sockets.at(-1).isClosed());
      await stoppedState(page);
      assert.equal(svc.audits.filter(a => a.name === 'session_stopped').length, 1);
    });
    // The service does not close: the page closes the socket itself after about 4 seconds.
    await withState('shown', { drainMs: 60000 }, async ({ svc, page }) => {
      await wait(page, () => document.getElementById('monitor').textContent.includes('heard'));
      const at = Date.now();
      await page.click('#stop-listen');
      await page.waitForTimeout(3000);
      assert.deepEqual([(await stopFacts(page)).stop, page.sockets.at(-1).isClosed()], ['Stopping…', false], 'still waiting after 3 seconds');
      await wait(page, () => !document.getElementById('listen').disabled);
      const took = Date.now() - at;
      assert.ok(took >= 3800 && took < 5500, `the page waited ${took} ms`);
      await until(() => page.sockets.at(-1).isClosed());
      await stoppedState(page);
      assert.equal(svc.audits.filter(a => a.name === 'session_stopped').length, 0, 'the service was still waiting');
      // A new session can start at once.
      await page.click('#listen');
      await wait(page, () => document.getElementById('monitor').textContent.includes('listening on server'));
    });
  });

  return { outcome };
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
  const state = (revision, changes = {}) => ({ revision, phase: 'QUESTION', focus: null,
    focusVersion: 0, exchangeId: null, live: null, ...changes });
  const live = (id, version, value, kind = 'new') => ({ id, version, text: value, kind });
  const lastControl = socket => socket.controls.at(-1);
  const results = { layout: {} };
  // Measures the current state at desktop and phone widths: the four glance rows are unclipped and do not overlap.
  const shots = process.env.SCREENSHOT_DIR || tmpdir();
  const checkLayout = async name => {
    if (process.env.PC_PROGRESS) process.stderr.write(`layout ${name}\n`);
    for (const [width, size] of [['desktop', { width: 1280, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
      await page.setViewportSize(size);
      // Let the resized page repaint (animation frames run on the fake clock) before measuring or capturing.
      await page.clock.runFor(50);
      await new Promise(resolve => setTimeout(resolve, 200));
      const layout = await page.evaluate(measureGlance);
      assert.deepEqual([layout.clipped, layout.overlaps, layout.sideways], [[], [], false], `${name} ${width}`);
      if (process.env.PC_PROGRESS) process.stderr.write(`shot ${name} ${width}\n`);
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
  await until(async () => (await text('#live-question')) === 'Waiting for a question');
  assert.equal(await text('#focus-question'), 'No question yet');
  assert.equal(await text('#confirm-hint'), 'Confirm becomes available when a question is heard.');
  assert.ok(await disabled('#confirm-question') && await disabled('#clear-live'));
  results.ready = 'PASS';
  await checkLayout('1-ready');

  // A heard question fills Live with its tag; keyboard Confirm sends exactly the displayed Live.
  emit(one, 'answer', state(1, { live: live('L1', 1, multipart) }));
  await until(async () => (await text('#live-question')) === multipart);
  assert.deepEqual([await text('#live-tag'), await text('#confirm-hint')], ['new question', 'Space confirms']);
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
  assert.deepEqual([await text('#live-question'), await text('#live-tag')], ['Waiting for a question', '']);
  assert.match(await text('#question-feedback'), /^Confirmed/);
  assert.equal(await text('#confirm-hint'), 'Confirm becomes available when a new question is heard.');
  await checkLayout('3-confirmed');
  emit(one, 'question.result', { requestId: first.requestId, status: 'stale', state: state(2, { live: live('L1', 2, corrected) }) });
  await page.clock.runFor(100);
  assert.deepEqual([await text('#focus-question'), await text('#live-question')], [corrected, 'Waiting for a question']);
  results.confirmNoRollback = 'PASS';

  // 4 November case: a new question while answering fills Live, Focus stays, and old feedback clears.
  emit(one, 'answer', state(4, { phase: 'ANSWER', focus: corrected, focusVersion: 1, exchangeId: 1 }));
  await until(async () => (await text('#live-question')) === 'Waiting for a question' && (await text('#question-feedback')) !== '');
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
  await until(async () => (await text('#live-question')) === 'Waiting for a question');
  assert.deepEqual([await text('#live-tag'), await text('#confirm-hint')], ['', 'Confirm becomes available when a new question is heard.']);
  assert.ok(await disabled('#confirm-question') && await disabled('#clear-live'), 'a reading that repeats the Question is not a candidate');
  results.newQuestionKeepsFocus = 'PASS';
  emit(one, 'answer', state(7, { phase: 'ANSWER', focus: corrected, focusVersion: 1, exchangeId: 1, live: live('L3', 2, 'And what about the first job?', 'restatement') }));
  await until(async () => (await text('#live-tag')) === 'restatement');

  // Clear live sends its control and shows the cleared Live from the result.
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await until(() => lastControl(one).type === 'question.reset');
  emit(one, 'question.result', { requestId: lastControl(one).requestId, status: 'reset', state: state(8, { phase: 'ANSWER', focus: corrected, focusVersion: 1, exchangeId: 1 }) });
  await until(async () => (await text('#question-feedback')).startsWith('Candidate cleared'));
  assert.deepEqual([await text('#focus-question'), await text('#live-question')], [corrected, 'Waiting for a question']);
  results.resetLive = 'PASS';

  // A long three-part Live question stays complete at both widths.
  emit(one, 'answer', state(9, { focus: corrected, focusVersion: 1, exchangeId: 1, live: live('L4', 1, multipart) }));
  await until(async () => (await text('#live-question')) === multipart);
  await checkLayout('5-long-live');

  // Disconnect while pending: Focus becomes last known and the unanswered request stays unknown.
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await until(() => lastControl(one).type === 'question.confirm' && lastControl(one).liveId === 'L4');
  await one.ws.close();
  await until(async () => (await text('#question-feedback')).startsWith('Disconnected before the server replied'));
  assert.deepEqual([await text('#focus-status'), await text('#live-question'), await text('#live-tag'), await text('#confirm-hint')],
    ['Last known, not live', 'Not listening', '', 'Start listening to continue.']);
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
  await until(async () => (await text('#live-question')) === 'Waiting for a question');
  await page.clock.runFor(100);
  assert.deepEqual([await text('#focus-question'), await text('#live-question'), await text('#question-feedback'), two.controls.length],
    ['No question yet', 'Waiting for a question', '', 0]);
  assert.equal(await text('#panel'), 'GOOD');
  results.restart = 'PASS';

  assert.deepEqual(errors, []);
  // The SPRINT-003 page check runs after the UC-04 protocol and is reported as its own result.
  const { outcome } = await sprint004Checks(browser);
  const cases = Object.entries(outcome), failed = cases.filter(([, c]) => c.result === 'FAIL'), notRun = cases.filter(([, c]) => c.result === 'NOT RUN');
  console.log(JSON.stringify({ result: 'PASS', fixture: 'scripted /session protocol; no OpenAI', results, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ result: failed.length ? 'FAIL' : 'PASS', fixture: 'real page, real service, fixtures, temporary log and package folders; no OpenAI, synthetic microphone',
    passed: cases.length - failed.length - notRun.length, failed: failed.length, notRun: notRun.length, cases: outcome }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally { await browser.close(); assets.close(); }
