// Reviewer-run package check (T34 procedure, written under T35). Run by hand, never by the service, the run
// script or the tests. It reads private benchmark text and reports counts and line numbers only, never text.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPackage, DEFAULT_PACKAGE_DIR } from '../package-loader.mjs';

const SHINGLE_WORDS = 8;
const DEFAULT_EVAL_DIR = fileURLToPath(new URL('../../eval-data/', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path));
    else if (entry.isFile()) found.push(path);
  }
  return found.sort();
}

// NFC, lower case, punctuation and symbols removed, spaces collapsed: one word list with its line numbers.
export function words(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const clean = line.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim();
    if (clean) for (const word of clean.split(' ')) out.push({ word, line: index + 1 });
  });
  return out;
}

export function shingles(list) {
  const out = [];
  for (let i = 0; i + SHINGLE_WORDS <= list.length; i += 1) {
    out.push({ key: list.slice(i, i + SHINGLE_WORDS).map(w => w.word).join(' '), line: list[i].line });
  }
  return out;
}

// JSON benchmark files contribute their string values; every other file contributes its text.
function benchmarkText(name, text) {
  if (!name.toLowerCase().endsWith('.json')) return text;
  const strings = [];
  const visit = value => {
    if (typeof value === 'string') strings.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(JSON.parse(text));
  return strings.join('\n');
}

async function benchmarkSet(paths) {
  const set = new Set(), sources = [];
  for (const path of paths) {
    try {
      const text = benchmarkText(path, new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path)));
      shingles(words(text)).forEach(s => set.add(s.key));
      sources.push({ name: basename(path), ok: true });
    } catch { sources.push({ name: basename(path), ok: false }); }
  }
  return { set, sources };
}

// Step 1: the audit's package_loaded digests must equal the bytes checked; returns problems, never text.
export function auditProblems(files, auditText) {
  if (auditText === null) return ['no audit file was given, so the bytes checked are not shown to be the bytes sent'];
  const events = auditText.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(e => e && (e.event === 'package_loaded' || e.name === 'package_loaded'));
  const event = events.at(-1);
  if (!event) return ['the audit holds no package_loaded event'];
  const sent = new Map((event.files || []).map(f => [f.name, f.sha256]));
  const problems = files.filter(f => sent.get(f.name) !== f.sha256).map(f => `digest of ${f.name} differs from or is missing in the audit`);
  if ((event.files || []).length !== files.length) problems.push('the audit lists a different number of files');
  return problems;
}

export async function checkPackage({ packageDir = DEFAULT_PACKAGE_DIR, evalDir = DEFAULT_EVAL_DIR, benchmark = [], auditText = null } = {}) {
  const pkg = await readPackage(packageDir);
  const digests = pkg.files.map(f => ({ name: f.name, sha256: f.sha256 }));
  const evalFiles = await walk(evalDir).catch(() => null);
  const unverified = [...auditProblems(pkg.files, auditText)];
  if (pkg.failed) unverified.push('a package file could not be read');
  if (evalFiles === null) unverified.push('the eval-data folder could not be read');
  const equal = [];
  for (const path of evalFiles || []) {
    const digest = sha256(await readFile(path));
    for (const f of digests) if (f.sha256 === digest) equal.push({ package: f.name, benchmark: relative(evalDir, path) });
  }
  const named = (evalFiles || []).filter(p => ['transcript.json', 'transcript.txt'].includes(basename(p)));
  const sources = await benchmarkSet([...new Set([...named, ...benchmark.map(p => resolve(evalDir, p))])]);
  if (!named.length) unverified.push('transcript.json and transcript.txt were not found under eval-data');
  unverified.push(...sources.sources.filter(s => !s.ok).map(s => `benchmark source ${s.name} is missing or unreadable`));
  const perFile = pkg.files.map(f => {
    const list = shingles(words(f.text)), hits = list.filter(s => sources.set.has(s.key));
    return { name: f.name, shingles: list.length, matches: hits.length, lines: [...new Set(hits.map(h => h.line))] };
  });
  const invalid = equal.length > 0 || perFile.some(f => f.matches > 0);
  return { digests, comparedFiles: (evalFiles || []).length, equal, sources: sources.sources, perFile, unverified,
    result: invalid ? 'INVALID' : unverified.length ? 'UNVERIFIED' : 'PASS' };
}

export function formatReport(r) {
  const out = ['Package check: counts and line numbers only; no package or benchmark text is printed.'];
  out.push(...r.digests.map(d => `digest ${d.name} sha256 ${d.sha256}`));
  out.push(`check A: ${r.comparedFiles} benchmark files compared by digest; equal: ${r.equal.length}`);
  out.push(...r.equal.map(e => `  EQUAL package file ${e.package} = benchmark file ${e.benchmark}`));
  out.push(`check B: sources ${r.sources.map(s => `${s.name} (${s.ok ? 'read' : 'NOT READ'})`).join(', ') || 'none'}`);
  out.push(...r.perFile.map(f => `  ${f.name}: shingles ${f.shingles}, matches ${f.matches}, lines ${f.lines.join(',') || '-'}`));
  out.push(...r.unverified.map(u => `unverified: ${u}`));
  out.push(`RESULT: ${r.result}${r.result === 'INVALID' ? ' (no billable run may start; remove the text and run again)' : ''}`);
  return out.join('\n');
}

async function main(argv) {
  const options = { benchmark: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    if (argv[i] === '--package-dir') options.packageDir = resolve(value);
    else if (argv[i] === '--eval-dir') options.evalDir = resolve(value);
    else if (argv[i] === '--benchmark') options.benchmark.push(value);
    else if (argv[i] === '--audit') options.auditText = await readFile(value, 'utf8');
    else { console.error('Usage: node poc/review/package-check.mjs [--audit FILE] [--benchmark FILE]... [--package-dir DIR] [--eval-dir DIR]'); return 64; }
  }
  const report = await checkPackage(options);
  console.log(formatReport(report));
  return { PASS: 0, INVALID: 1, UNVERIFIED: 2 }[report.result];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
