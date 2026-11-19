import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const PACKAGE_MAX = 20000;
export const DEFAULT_PACKAGE_DIR = fileURLToPath(new URL('./context/interview/', import.meta.url));

const eligible = entry => entry.isFile() && !entry.name.startsWith('.') &&
  /\.(txt|md)$/i.test(entry.name) && entry.name.toLowerCase() !== 'readme.md';

// Reads one file as strict UTF-8; returns null when it cannot be read or decoded.
async function readEligible(dir, name) {
  try {
    const bytes = await readFile(join(dir, name));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { name, text, chars: text.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch { return null; }
}

function statusOf(files, failed) {
  if (!files.length && !failed) return 'none';
  if (failed) return 'unreadable';
  if (files.every(f => !f.text.trim())) return 'empty';
  return files.reduce((sum, f) => sum + f.chars, 0) > PACKAGE_MAX ? 'too-large' : 'usable';
}

async function listEntries(dir) {
  try { return await readdir(dir, { withFileTypes: true }); } catch { return []; }
}

// Lists and reads the eligible files once; the reviewer script reuses this so both apply one rule.
export async function readPackage(dir = DEFAULT_PACKAGE_DIR) {
  const entries = await listEntries(dir);
  const names = entries.filter(eligible).map(e => e.name).sort();
  const skipped = entries.filter(e => !eligible(e)).map(e => e.name).sort();
  const read = await Promise.all(names.map(name => readEligible(dir, name)));
  return { names, skipped, files: read.filter(Boolean), failed: read.filter(r => !r).length };
}

// Returns the package status and, only when usable, its documents in name order. Text never leaves this object.
export async function loadPackage(dir = DEFAULT_PACKAGE_DIR) {
  const { names, skipped, files, failed } = await readPackage(dir);
  const status = statusOf(files, failed);
  return {
    status, found: names.length > 0, skipped,
    chars: files.reduce((sum, f) => sum + f.chars, 0),
    files: files.map(({ name, chars, sha256 }) => ({ name, chars, sha256 })),
    documents: status === 'usable' ? files.map(({ name, text }) => ({ name, text })) : [],
  };
}

// The General reason line comes only from this status (LB-9); no package at all is the null reason.
export const reasonOf = status => (status === 'usable' ? undefined : status === 'none' ? null : status);
