import { $, api, tokenFor, remember, toast, counter, mountLogo } from './common.js';
import { AWARDS, DEFAULT_AWARDS, awardLabel } from './awards.js';
import { buildSlides, renderSlide } from './slides.js';

mountLogo();
const year = new Date().getFullYear() + (new Date().getMonth() === 0 ? -1 : 0);
const TITLES = { year: `Our ${year}`, trip: 'The trip', season: 'This season', event: 'That night' };
const params = new URLSearchParams(location.search);
let kind = ['year', 'trip', 'season', 'event'].includes(params.get('kind')) ? params.get('kind') : 'year';
let drop = 'all';
const picked = new Set(DEFAULT_AWARDS);
const title = $('#t-title');
let titleTouched = false;

if (params.get('again')) { $('#again').hidden = false; $('#new-h').textContent = 'Make one for your other group'; }

function drawKinds() {
  document.querySelectorAll('#kinds .chip').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.kind === kind)));
  title.placeholder = TITLES[kind];
  if (!titleTouched) title.value = TITLES[kind];
  title.dispatchEvent(new Event('input'));
  drawAwards();
}
function drawAwards() {
  $('#awards').innerHTML = '';
  for (const a of AWARDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip violet';
    b.setAttribute('aria-pressed', String(picked.has(a.key)));
    b.dataset.key = a.key;
    b.innerHTML = `<span aria-hidden="true">${a.emoji}</span><span></span>`;
    b.lastChild.textContent = awardLabel(a, kind);
    $('#awards').append(b);
  }
  $('#aw-count').textContent = `(${picked.size} picked, 3 to 10)`;
}
$('#kinds').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (b) { kind = b.dataset.kind; drawKinds(); } });
$('#awards').addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]');
  if (!b) return;
  const k = b.dataset.key;
  if (picked.has(k)) picked.delete(k);
  else if (picked.size >= 10) { toast('Up to 10 awards. Untick one first.'); return; } else picked.add(k);
  drawAwards();
});
$('#drop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-drop]');
  if (!b) return;
  drop = b.dataset.drop;
  document.querySelectorAll('#drop .chip').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.drop === drop)));
  $('#date-row').hidden = drop !== 'date';
  if (drop === 'date' && !$('#t-date').value) $('#t-date').value = defaultDate();
});
title.addEventListener('input', (e) => { if (e.isTrusted) titleTouched = true; });
counter(title, $('#t-title-c'));

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function defaultDate() {
  const now = new Date();
  const nye = new Date(now.getFullYear(), 11, 31);
  if (kind === 'year' && now.getMonth() >= 10 && now < nye) return iso(nye);
  return iso(new Date(Date.now() + 7 * 86400e3));
}
$('#t-date').min = iso(new Date());

$('#f-new').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#new-err');
  err.textContent = '';
  let dropAt = null;
  if (drop === 'date') {
    const v = $('#t-date').value;
    if (!v) { err.textContent = 'Pick a reveal day.'; return; }
    const [y, m, d] = v.split('-').map(Number);
    dropAt = new Date(y, m - 1, d, 12, 0, 0).getTime();
    if (dropAt < Date.now() + 10 * 60e3) { err.textContent = 'Pick a reveal day in the future (it drops at noon).'; return; }
  }
  if (!title.value.trim()) { err.textContent = `Give it a title, like “${TITLES[kind]}”.`; title.focus(); return; }
  if (!$('#t-me').value.trim()) { err.textContent = 'Type your own name first.'; $('#t-me').focus(); return; }
  const btn = e.submitter || $('#f-new button[type=submit]');
  btn.disabled = true;
  // The creator's token must exist before the recap id is known, so make one now and file it under the new id.
  const temp = tokenFor('new');
  try {
    const r = await api('r', { method: 'POST', token: temp, body: {
      kind, title: title.value, me: $('#t-me').value, names: $('#t-names').value, awards: [...picked], dropAt,
    } });
    remember(`tok.${r.id}`, temp);
    remember('tok.new', '');
    location.href = `/r/${r.id}`;
  } catch (ex) {
    err.textContent = ex.message;
    btn.disabled = false;
  }
});

drawKinds();

// Example slides on the landing page, drawn by the same code as real stories.
const demo = {
  title: TITLES.year, kind: 'year', noun: 'year', storytellers: 7, members: 8, unanimous: [], contested: 'late',
  rating: { avg: 8.4, count: 7, min: 6, max: 10, hist: [0, 0, 0, 0, 0, 1, 1, 2, 2, 1] },
  awards: [{ key: 'main', label: 'Main character', short: 'Main character', emoji: '🎬', total: 7, winners: [{ id: 1, name: 'Maya', votes: 5 }], ranked: [{ id: 1, name: 'Maya', votes: 5 }, { id: 2, name: 'Tom', votes: 2 }] }],
  words: [{ word: 'Chaotic', n: 3 }, { word: 'Iconic', n: 1 }, { word: 'Loud', n: 1 }], quotes: [], moments: [], people: [], me: null,
};
const peek = buildSlides(demo, { origin: location.origin });
for (const i of [2, 1, 3]) {
  const c = document.createElement('canvas');
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', peek[i].alt);
  renderSlide(peek[i], c);
  $('#peek').append(c);
}
