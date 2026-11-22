import { createHash } from 'node:crypto';
import { loadPackage, PACKAGE_MAX } from './package-loader.mjs';
import { extractTerms } from './vocabulary.mjs';

export const BODY_MAX = 200 * 1024;
export const FILES_MAX = 20;
const NONE = { status: 'none', found: false, skipped: [], chars: 0, files: [], documents: [] };
const unsafe = name => typeof name !== 'string' || !name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(name) || name.includes('..') || /^[A-Za-z]:/.test(name);
const sorted = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

// Validates an upload body. Returns {ok:true, package, skipped} or {ok:false, reason, name?, chars?}; changes nothing.
export function buildUpload(body) {
  const files = body?.files;
  if (!Array.isArray(files) || !files.every(f => f && typeof f === 'object' && typeof f.text === 'string')) return { ok: false, reason: 'refused' };
  if (files.length > FILES_MAX) return { ok: false, reason: 'too-many-files' };
  const bad = files.find(f => unsafe(f.name));
  if (bad) return { ok: false, reason: 'refused', name: typeof bad.name === 'string' ? bad.name.slice(0, 80) : undefined };
  if (new Set(files.map(f => f.name)).size !== files.length) return { ok: false, reason: 'refused' };
  const skipped = [], kept = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (file.name.startsWith('.')) skipped.push({ name: file.name, reason: 'hidden' });
    else if (lower === 'readme.md') skipped.push({ name: file.name, reason: 'not used' });
    else if (!/\.(txt|md)$/.test(lower)) skipped.push({ name: file.name, reason: 'type' });
    else kept.push(file);
  }
  const broken = kept.find(f => f.text.includes('�') || f.text.includes('\u0000'));
  if (broken) return { ok: false, reason: 'unreadable', name: broken.name };
  if (!kept.length || kept.every(f => !f.text.trim())) return { ok: false, reason: 'empty' };
  const chars = kept.reduce((sum, f) => sum + f.text.length, 0);
  if (chars > PACKAGE_MAX) return { ok: false, reason: 'too-large', chars };
  kept.sort(sorted);
  const pkg = { status: 'usable', found: true, skipped: skipped.map(s => s.name), chars,
    files: kept.map(({ name, text }) => ({ name, chars: text.length, sha256: createHash('sha256').update(text).digest('hex') })),
    documents: kept.map(({ name, text }) => ({ name, text })) };
  return { ok: true, package: pkg, skipped };
}

// The package of one service: an uploaded one, else the folder one until Remove. Text stays in this object.
export function createPackageStore(packageDir) {
  let uploaded = null, folderRemoved = false;
  const describe = (source, pkg) => ({ source, status: pkg.status, files: pkg.files.length, chars: pkg.chars,
    terms: pkg.status === 'usable' ? extractTerms(pkg.documents).length : 0 });
  return {
    // The package in use now; a session takes this snapshot once, at Start.
    async current() {
      if (uploaded) return { source: 'uploaded', pkg: uploaded };
      if (folderRemoved) return { source: 'none', pkg: NONE };
      const pkg = await loadPackage(packageDir);
      return { source: pkg.found ? 'folder' : 'none', pkg };
    },
    async status() { const { source, pkg } = await this.current(); return describe(source, pkg); },
    async replace(pkg) { uploaded = pkg; folderRemoved = false; return this.status(); },
    async remove() { uploaded = null; folderRemoved = true; return this.status(); },
  };
}
