// Static layout preview. Invented sample text only; no network, microphone, key or package use.
const CUES = {
  good: { text: 'GOOD', bg: 'green', fg: 'white' },
  'land-it': { text: 'LAND IT', bg: 'gold', fg: 'black' },
  stop: { text: 'STOP', bg: 'red', fg: 'white' },
};
const STATES = ['empty', 'preparing', 'shown-short', 'shown-long', 'general', 'failed', 'unavailable', 'last-known'];
const EXTRA = ['last-known-empty'];

const LB = {
  empty: 'An answer appears after you confirm a question.',
  preparing: 'Preparing an answer for this question.',
  failed: 'No proposed answer for this question.',
  unavailable: 'Question recognition and proposed answers are unavailable.',
  liveUnavailable: 'Question recognition is unavailable.',
  generalTag: 'General points, not from your documents',
  generalReason: 'No preparation package was found.',
  lastKnownTag: 'Last known, not live',
  lastKnownNone: 'No answer arrived before listening stopped.',
  noKey: 'No OpenAI key is set up.',
};

const SHORT_FOCUS = 'Tell me about a time you led a team through change.';
const LONG_FOCUS = 'Tell me about a project that went off track. (1) What did you notice first? (2) How did you bring the people involved back together? (3) What would you change if it happened again?';
const SHORT_LIVE = 'So how did the team react?';
const LONG_LIVE = 'And when the schedule slipped a second time, who did you tell first, and what did you ask them to decide?';

const SHORT_BULLETS = ['Name the change and why it mattered.', 'Say how I kept the team informed.', 'End on one concrete result.'];
const LONG_BULLETS = [
  'Lead with the rollout I owned: two teams, one shared plan, and a launch date that moved only once, with notice to all.',
  'Name the hardest trade-off, speed against quality, and the rule we agreed so that nobody had to argue it every week.',
  'Close on the result: fewer late fixes, calmer reviews, and a team that asked to run the next rollout themselves.',
];
const SHORT_DETAILS = 'Sample detail: one sentence of background and one number to quote if asked.';
const LONG_DETAILS = [
  'Sample details, invented for the preview. Background: the rollout covered two teams that had never shared a plan. Week one was spent agreeing on one list of tasks, one owner for each task, and one weekly meeting that never ran longer than thirty minutes.',
  'Trade-off: the faster option shipped sooner but left the quality checks to the end. The slower option added a short review at each step. We chose the second and wrote down the rule: any task that fails review goes back to its owner the same day.',
  'People: two engineers disagreed about the order of work. I put both views on one page, asked each to say what they would give up, and let the team vote. The vote went one way and both engineers accepted it because the reasons were visible.',
  'Numbers to quote if asked (all invented): twelve tasks, three reviews per week, two late fixes instead of nine in the earlier rollout.',
  'If asked what I would change: start the shared plan a week earlier, and ask the quieter team members for their view before the meeting, not during it.',
  'Longer notes for scrolling. The meeting notes were short and sent the same day. Every decision carried a name and a date. When a date moved, the owner said so in the shared plan before anyone asked. Reviews took ten minutes each and were held at the same hour, which made them easy to keep. The launch went ahead on the second date, and the notice period let the support team prepare their own steps.',
].join('\n\n');

const NOTE_COMMON = 'Static preview, nothing approved. Limits are provisional: bullet 120 characters, details 1500 characters, fixed by T22. Control placement is proposed for Pablo to approve or move.';

function defs(state, cue) {
  const longShown = state === 'shown-long';
  const base = {
    cue,
    focus: SHORT_FOCUS, focusMark: '', live: SHORT_LIVE, liveTag: 'new question', confirm: true, clear: true,
    listen: true, stopListen: false, listenReason: '', cls: '', tag: '', message: '', bullets: [], reason: '', details: '',
  };
  switch (state) {
    case 'empty':
      return { ...base, live: 'Not listening', liveTag: '', confirm: false, clear: false, message: LB.empty };
    case 'preparing':
      return { ...base, stopListen: true, listen: false, message: LB.preparing };
    case 'shown-short':
      return { ...base, stopListen: true, listen: false, bullets: SHORT_BULLETS, details: SHORT_DETAILS };
    case 'shown-long':
      return { ...base, stopListen: true, listen: false, focus: LONG_FOCUS, live: LONG_LIVE, bullets: LONG_BULLETS, details: LONG_DETAILS };
    case 'general':
      return { ...base, stopListen: true, listen: false, tag: LB.generalTag, bullets: SHORT_BULLETS, reason: LB.generalReason,
        details: 'General details: a short structure for any answer about change. Say what happened, what you did, and what came of it.' };
    case 'failed':
      return { ...base, stopListen: true, listen: false, cls: 'failed', message: LB.failed };
    case 'unavailable':
      return { ...base, cls: 'unavailable', focus: 'No focus question yet', live: LB.liveUnavailable, liveTag: '', confirm: false, clear: false,
        listen: 'disabled', listenReason: LB.noKey, message: LB.unavailable, reason: LB.noKey };
    case 'last-known':
      return { ...base, cls: 'last-known', focusMark: 'Last known, not live', live: 'Not listening', liveTag: '', confirm: false, clear: false,
        tag: LB.lastKnownTag, bullets: SHORT_BULLETS, details: SHORT_DETAILS };
    case 'last-known-empty':
      return { ...base, cls: 'last-known', focusMark: 'Last known, not live', live: 'Not listening', liveTag: '', confirm: false, clear: false,
        message: LB.lastKnownNone, tag: LB.lastKnownTag };
    default:
      return null;
  }
}

function parse() {
  const out = {};
  new URLSearchParams(location.hash.slice(1)).forEach((v, k) => { out[k] = v; });
  return out;
}

const $ = (id) => document.getElementById(id);

function link(list, label, hash) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `#${hash}`;
  a.textContent = `${label}  (#${hash})`;
  li.append(a);
  list.append(li);
}

function showList() {
  $('page').hidden = true;
  $('list').hidden = false;
  $('state-links').replaceChildren();
  $('cue-links').replaceChildren();
  $('extra-links').replaceChildren();
  STATES.forEach((s) => link($('state-links'), s, `state=${s}&cue=good`));
  Object.keys(CUES).forEach((c) => link($('cue-links'), `shown-long with ${CUES[c].text}`, `state=shown-long&cue=${c}`));
  EXTRA.forEach((s) => link($('extra-links'), s, `state=${s}&cue=good`));
}

function render() {
  const { state, cue = 'good' } = parse();
  const d = state && CUES[cue] ? defs(state, cue) : null;
  if (!d) { showList(); return; }
  $('list').hidden = true;
  $('page').hidden = false;
  const c = CUES[d.cue];
  const band = $('cue-band');
  band.style.setProperty('--cue-bg', c.bg);
  band.style.setProperty('--cue-fg', c.fg);
  $('cue-word').textContent = c.text;
  $('listen').disabled = d.listen !== true;
  $('stop-listen').disabled = !d.stopListen;
  $('listen-reason').textContent = d.listenReason;
  $('focus-text').textContent = d.focus;
  $('focus-mark').textContent = d.focusMark;
  $('live-text').textContent = d.live;
  $('live-tag').textContent = d.liveTag;
  $('confirm').disabled = !d.confirm;
  $('clear-live').disabled = !d.clear;
  const ans = $('answer');
  ans.className = `card answer ${d.cls}`;
  $('answer-tag').textContent = d.tag;
  $('answer-message').textContent = d.message;
  $('answer-message').hidden = !d.message;
  $('bullets').replaceChildren(...d.bullets.map((b) => { const li = document.createElement('li'); li.textContent = b; return li; }));
  $('answer-reason').textContent = d.reason;
  $('answer-reason').hidden = !d.reason;
  $('details-text').textContent = d.details;
  $('note').textContent = `${state} / ${c.text}. ${NOTE_COMMON}`;
  document.title = `Alice layout preview: ${state}, ${c.text}`;
}

window.addEventListener('hashchange', render);
render();
