import { chmod, mkdir, open, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

export const DEFAULT_LOG_DIR = fileURLToPath(new URL('./logs/', import.meta.url));
export const LOG_MAX_BYTES = 5 * 1024 * 1024;
export const LOG_VERSION = 1;
const FULL_RESERVE = 200;
const NAME = /^meeting-(\d{8}T\d{6}Z)-[0-9a-f]{8}\.jsonl$/;
const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

// One listening session's log: lines are queued synchronously and appended in the background, so a slow or failing
// disk never blocks the caller (the audio path). A failure is reported once and later writes are dropped.
export class MeetingLog {
  constructor({ dir, sessionId, wallNow = Date.now, mono = () => performance.now(), maxBytes = LOG_MAX_BYTES, onFail = () => {} }) {
    Object.assign(this, { dir, sessionId, wallNow, mono, maxBytes, onFail });
    this.startedAt = wallNow();
    this.start = mono();
    this.name = `meeting-${stamp(new Date(this.startedAt))}-${sessionId.slice(0, 8)}.jsonl`;
    this.path = join(dir, this.name);
    this.bytes = 0; this.full = false; this.failed = false; this.closed = false;
    this.chain = this.openFile();
  }

  async openFile() {
    try {
      const made = await mkdir(this.dir, { recursive: true, mode: 0o700 });
      if (made) await chmod(this.dir, 0o700);
      this.handle = await open(this.path, 'a', 0o600);
    } catch { this.fail(); }
  }

  fail() {
    if (this.failed) return;
    this.failed = true;
    try { this.onFail(); } catch { /* reporting must never throw */ }
  }

  // Queues one event line. Never awaits and never throws.
  write(type, data = {}) {
    if (this.closed || this.full || this.failed) return;
    const event = { t: new Date(this.wallNow()).toISOString(), ms: Math.max(0, Math.round(this.mono() - this.start)), type, ...data };
    let line = `${JSON.stringify(event)}\n`;
    let size = Buffer.byteLength(line);
    if (this.bytes + size + FULL_RESERVE > this.maxBytes) {
      this.full = true;
      line = `${JSON.stringify({ ...event, type: 'log_full', maxBytes: this.maxBytes })}\n`;
      size = Buffer.byteLength(line);
    }
    this.bytes += size;
    this.chain = this.chain.then(async () => {
      if (!this.handle || this.failed) return;
      try { await this.handle.appendFile(line); } catch { this.fail(); }
    });
  }

  flush() { return this.chain; }

  // Queues the close behind the writes already waiting.
  close() {
    if (this.closed) return this.chain;
    this.closed = true;
    this.chain = this.chain.then(async () => { try { await this.handle?.close(); } catch { /* nothing left to save */ } });
    return this.chain;
  }
}

// The log folder of one service: starts logs and reads back only the current or most recent one (SD-1, MS-5).
export function createLogStore({ dir = process.env.ALICE_LOG_DIR || DEFAULT_LOG_DIR, wallNow = Date.now, mono, maxBytes } = {}) {
  let latest = null;
  return {
    dir,
    start(sessionId, onFail) {
      latest = new MeetingLog({ dir, sessionId, wallNow, mono, maxBytes, onFail });
      return latest;
    },
    // `{filename, text}` holding complete lines only, or null when there is no log.
    async read() {
      let log = latest, path, name;
      if (log) { await log.flush(); path = log.path; name = log.name; } else {
        try { name = (await readdir(dir)).filter(n => NAME.test(n)).sort().at(-1); } catch { return null; }
        if (!name) return null;
        path = join(dir, name);
      }
      let text;
      try { text = await readFile(path, 'utf8'); } catch { return null; }
      const end = text.lastIndexOf('\n');
      return { filename: `alice-${name.replace(NAME, 'meeting-$1.jsonl')}`, text: end < 0 ? '' : text.slice(0, end + 1) };
    },
  };
}
