// Local vocabulary hints: names and acronyms found in the package, chosen without any model call.
// The result goes to the transcription session as a prompt, so "CIBC" is not heard as "BBC".
export const MAX_TERMS = 40;
export const MAX_HINT_CHARS = 500;

const STOP = new Set(['THE', 'AND', 'FOR', 'NOT', 'OK', 'AM', 'PM', 'USA', 'ETC', 'FAQ', 'TBD', 'PDF', 'URL']);
const ACRONYM = /\b[A-Z][A-Z0-9&]{1,7}\b/g;
const CAMEL = /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g;
const NAMES = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
// A capitalised word in the middle of a sentence, so sentence starts are not mistaken for names.
const MID = /(?<=[a-z0-9,;:)] )[A-Z][a-z]{2,}\b/g;

function count(text, pattern, tally) {
  for (const match of text.matchAll(pattern)) {
    const term = match[0].replace(/\s+/g, ' ');
    if (STOP.has(term)) continue;
    const seen = tally.get(term);
    if (seen) seen.n += 1; else tally.set(term, { n: 1, at: tally.size });
  }
}

// Returns up to MAX_TERMS terms, most frequent first, within MAX_HINT_CHARS when joined.
export function extractTerms(documents = []) {
  const tally = new Map();
  for (const { text } of documents) {
    if (typeof text !== 'string') continue;
    for (const pattern of [ACRONYM, CAMEL, NAMES, MID]) count(text, pattern, tally);
  }
  const ranked = [...tally].sort((a, b) => b[1].n - a[1].n || a[1].at - b[1].at).map(([term]) => term);
  const terms = [];
  let chars = 0;
  for (const term of ranked) {
    if (terms.length >= MAX_TERMS || chars + term.length + 2 > MAX_HINT_CHARS) break;
    terms.push(term);
    chars += term.length + 2;
  }
  return terms;
}

// The transcription prompt, or undefined when there is nothing to hint.
export const hintPrompt = terms => (terms.length ? `Names and terms that may be spoken: ${terms.join(', ')}.` : undefined);
