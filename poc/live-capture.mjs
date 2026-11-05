import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

// Records a live UC-04 session against the running POC service. Opens the page in a visible Chrome with the
// real microphone and logs every text frame on /session with its time. The log is saved every few seconds, on
// Ctrl+C and when Chrome closes. A checkpoint (screenshot plus question-panel text) is taken with Option+Shift+K
// (Alt+Shift+K) in the page, or Enter in this terminal. --dry-run uses headless Chrome's fake microphone to check
// the plumbing; it still talks to whatever service runs at POC_URL.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dryRun = process.argv.includes('--dry-run');
const origin = process.env.POC_URL || 'http://127.0.0.1:3000';
const out = process.argv.slice(2).find(arg => !arg.startsWith('--')) ||
  `/tmp/speakercoach-live-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(out, { recursive: true });
const log = { origin, dryRun, startedAt: Date.now(), audioPacketsSent: 0, frames: [], checkpoints: [], pageErrors: [] };
const save = () => writeFile(join(out, 'capture.json'), JSON.stringify(log, null, 2));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: dryRun,
  args: dryRun ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] : [] });
const context = await browser.newContext({ viewport: dryRun ? { width: 1280, height: 900 } : null });
await context.grantPermissions(['microphone'], { origin });
const page = await context.newPage();
page.on('pageerror', error => log.pageErrors.push({ at: Date.now(), message: error.message }));
// A sent question control is timed as the click; a sent `rendered` acknowledgement as the render.
page.on('websocket', socket => {
  const record = direction => frame => {
    if (typeof frame.payload !== 'string') { if (direction === 'sent') log.audioPacketsSent += 1; return; }
    try { log.frames.push({ at: Date.now(), direction, event: JSON.parse(frame.payload) }); } catch {}
  };
  socket.on('framesent', record('sent'));
  socket.on('framereceived', record('received'));
});

// Saves a screenshot and the panel text. Checkpoints run one at a time, from either trigger.
let checkpoints = Promise.resolve();
const checkpoint = label => (checkpoints = checkpoints.then(async () => {
  const n = log.checkpoints.length + 1;
  const screenshot = `checkpoint-${String(n).padStart(2, '0')}.png`;
  try {
    const view = await page.evaluate(() => {
      const text = id => document.getElementById(id)?.textContent ?? null;
      return { focus: text('focus-question'), focusStatus: text('focus-status'), live: text('live-question'),
        liveTag: text('live-tag'), liveNote: text('live-note'), feedback: text('question-feedback'),
        hint: text('confirm-hint'), signal: text('panel'), server: text('server') };
    });
    await page.screenshot({ path: join(out, screenshot) });
    log.checkpoints.push({ n, label: label || null, at: Date.now(), screenshot, view });
    await save();
    console.log(`checkpoint ${n} saved`);
    return n;
  } catch (error) { console.log(`checkpoint ${n} failed: ${error.message}`); return 0; }
}));

// Capture-only page helper: the hotkey calls back here and briefly shows a confirmation in the corner.
await page.exposeBinding('speakercoachCheckpoint', () => checkpoint('page hotkey'));
await page.addInitScript(() => {
  addEventListener('keydown', async event => {
    if (!(event.altKey && event.shiftKey && event.code === 'KeyK')) return;
    event.preventDefault();
    const n = await window.speakercoachCheckpoint();
    const note = document.createElement('div');
    note.textContent = n ? `capture checkpoint ${n} saved` : 'capture checkpoint failed';
    note.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:8px 14px;' +
      'background:#000c;color:#fff;font:16px sans-serif;border-radius:6px;z-index:9999';
    document.body.append(note);
    setTimeout(() => note.remove(), 1500);
  });
});
await page.goto(origin);
if (dryRun) {
  // The plumbing check exercises the page hotkey once, then closes the window like Pablo would.
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await page.waitForTimeout(3000);
  await page.keyboard.press('Alt+Shift+KeyK');
  setTimeout(() => { void page.close(); }, 2000);
}

let finished = false;
const finish = async () => {
  if (finished) return;
  finished = true;
  clearInterval(autosave);
  await checkpoints;
  log.finishedAt = Date.now();
  await save();
  await browser.close().catch(() => {});
  console.log(`Saved ${log.frames.length} frames and ${log.checkpoints.length} checkpoints to ${join(out, 'capture.json')}`);
  process.exit(0);
};
const autosave = setInterval(() => { void save(); }, 3000);
process.on('SIGINT', finish);
process.on('SIGTERM', finish);
// Closing the window ends only the page; Playwright's browser process keeps running, so finish on either.
browser.on('disconnected', finish);
page.on('close', finish);

console.log(`Capturing to ${out} (saved every 3 seconds).\nPress Start Listening in the page. At each checkpoint press ` +
  'Option+Shift+K in the page, or type a label and Enter here. Close Chrome, press Ctrl+C or type q to finish.');
const input = createInterface({ input: process.stdin });
for await (const line of input) {
  if (line.trim() === 'q') break;
  await checkpoint(line.trim());
}
await finish();
