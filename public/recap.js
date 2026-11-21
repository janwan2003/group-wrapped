import { $, esc, api, tokenFor, remember, recall, validToken, toast, shareLink, shareImage, counter, mountLogo } from './common.js';
import { buildSlides, renderSlide, slideBlob } from './slides.js';

mountLogo();
const id = location.pathname.split('/').filter(Boolean)[1] || '';
const app = $('#app');

// A personal link (#k=<token>) moves your identity to this browser; then the token leaves the address bar.
const hk = new URLSearchParams(location.hash.slice(1)).get('k');
if (validToken(hk)) {
  remember(`tok.${id}`, hk);
  history.replaceState(null, '', location.pathname);
}
const token = tokenFor(id);
const call = (action, body) => api(`r/${id}${action ? `/${action}` : ''}`, { method: body ? 'POST' : 'GET', body, token });
const recapUrl = () => `${location.origin}/r/${id}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

let data = null;
let shape = '';
let slides = [];

function dropLine(d) {
  if (!d.dropAt) return 'The story drops when everyone has answered.';
  const when = new Date(d.dropAt);
  return `The story drops ${when.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} at ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`;
}

function header(d) {
  const pct = d.total ? Math.round((d.answered / d.total) * 100) : 0;
  return `<div class="rhead">
    <span class="kicker">Group recap</span>
    <h1>${esc(d.title)}</h1>
    <div class="meter" aria-hidden="true"><i id="meter" style="width:${pct}%"></i></div>
    <p class="muted" id="counts"><b>${d.answered} of ${d.total}</b> have answered. ${esc(dropLine(d))}</p>
  </div>`;
}

function whoList(d) {
  return `<ul class="who" id="who">${d.members.map((m) => `<li class="${m.answered ? 'yes' : m.claimed ? '' : 'no'}">${esc(m.name)}</li>`).join('')}</ul>`;
}

function inviteBox(d, done) {
  const missing = d.total - d.answered;
  const head = done ? 'You’re in. Now get the others.' : 'Send this to the group chat';
  const sub = done
    ? `${missing > 0 ? `${plural(missing, 'person', 'people')} still to go.` : 'Everyone has answered.'} Nothing is revealed until the drop.`
    : 'Everyone answers on their own phone. The story needs the whole group, so the more answers, the better it gets.';
  return `<div class="sharebox" id="sharebox">
    <h2>${head}</h2>
    <p>${sub}</p>
    <button class="btn" id="share" type="button">Share the link</button>
    <div class="linkline"><input type="text" id="link" readonly value="${esc(recapUrl())}" aria-label="Recap link"><button class="btn ghost small" id="copy" type="button">Copy</button></div>
    ${whoList(d)}
  </div>`;
}

function bindInvite() {
  $('#share')?.addEventListener('click', () => shareLink({ title: data.title, text: `${data.title}: vote our recap awards (2 min, no app) 👀`, url: recapUrl() }));
  $('#copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(recapUrl()); toast('Link copied.'); } catch { $('#link').select(); }
  });
}

// ---------- Join ----------
function renderJoin(d) {
  const free = d.members.filter((m) => !m.claimed);
  app.innerHTML = `${header(d)}
    <div class="panel">
      <h2>Who are you?</h2>
      <p class="muted">Tap your name. Your phone remembers you for this recap, no account needed.</p>
      ${free.length ? `<div class="names" id="names">${free.map((m) => `<button class="chip" type="button" data-id="${m.id}">${esc(m.name)}</button>`).join('')}</div>` : ''}
      <form id="f-join" novalidate>
        <label for="j-name">${free.length ? 'Not on the list? Add yourself' : 'Your name'}</label>
        <div class="linkline" style="margin-top:0"><input type="text" id="j-name" maxlength="20" autocomplete="given-name" placeholder="Your first name"><button class="btn" type="submit">Join</button></div>
      </form>
      <p class="err" id="j-err" role="alert"></p>
    </div>
    <p class="muted small center" style="margin-top:16px">Already answered on another phone? Open your personal link there, or ask whoever started this recap.</p>`;
  const join = async (body, btn) => {
    $('#j-err').textContent = '';
    if (btn) btn.disabled = true;
    try { show(await call('join', body)); } catch (e) { $('#j-err').textContent = e.message; if (btn) btn.disabled = false; if (e.status === 409) refresh(); }
  };
  $('#names')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b && confirm(`Join as ${b.textContent}?`)) join({ memberId: Number(b.dataset.id) }, b);
  });
  $('#f-join').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#j-name').value.trim();
    if (!name) { $('#j-err').textContent = 'Type your name.'; return; }
    join({ name }, e.submitter);
  });
}

// ---------- Answer ----------
function renderAnswer(d) {
  const a = d.me.answer || { awards: {} };
  const others = d.members.filter((m) => m.id !== d.me.id);
  const noun = { year: 'year', trip: 'trip', season: 'season', event: 'night' }[d.kind] || 'year';
  const awardCards = d.awards.map((aw) => `
    <div class="q${a.awards?.[aw.key] != null ? ' done' : ''}" data-award="${aw.key}">
      <h3><span class="em" aria-hidden="true">${aw.emoji}</span>${esc(aw.label)}</h3>
      ${others.length ? `<div class="seg">${others.map((m) => `<button class="chip violet" type="button" data-vote="${m.id}" aria-pressed="${a.awards?.[aw.key] === m.id}">${esc(m.name)}</button>`).join('')}</div>`
        : '<p class="muted small" style="margin:0">Nobody else is in yet. Share the link, then come back to vote.</p>'}
    </div>`).join('');
  app.innerHTML = `${header(d)}
    ${!d.me.complete ? inviteBox(d, false) : ''}
    <p class="muted">Hi <b>${esc(d.me.name)}</b>. Your answers are secret and save as you go. Change them any time before the drop.</p>
    <div class="meter" aria-label="Your progress"><i id="mine" style="width:${Math.round(d.me.progress * 100)}%"></i></div>
    <h2 style="margin-top:22px">The awards</h2>
    ${awardCards}
    <h2 style="margin-top:26px">The ${noun}</h2>
    <div class="q${a.rating != null ? ' done' : ''}" id="q-rate">
      <h3><span class="em" aria-hidden="true">⭐</span>Rate the ${noun} out of 10</h3>
      <div class="rate">${Array.from({ length: 10 }, (_, i) => `<button class="chip violet" type="button" data-rate="${i + 1}" aria-pressed="${a.rating === i + 1}">${i + 1}</button>`).join('')}</div>
    </div>
    <div class="q${a.word ? ' done' : ''}" data-text="word">
      <h3><span class="em" aria-hidden="true">🔤</span><label for="a-word" style="margin:0">Word of the ${noun} <span class="hint">(one word)</span></label></h3>
      <input type="text" id="a-word" maxlength="24" autocomplete="off" placeholder="e.g. chaotic" value="${esc(a.word || '')}">
    </div>
    <div class="q${a.quote ? ' done' : ''}" data-text="quote">
      <h3><span class="em" aria-hidden="true">💭</span><label for="a-quote" style="margin:0">Quote of the ${noun} <span class="count" id="a-quote-c"></span></label></h3>
      <textarea id="a-quote" maxlength="140" rows="2" placeholder="The thing someone said that we still repeat">${esc(a.quote || '')}</textarea>
    </div>
    <div class="q${a.moment ? ' done' : ''}" data-text="moment">
      <h3><span class="em" aria-hidden="true">🎞️</span><label for="a-moment" style="margin:0">Best moment <span class="count" id="a-moment-c"></span></label></h3>
      <textarea id="a-moment" maxlength="120" rows="2" placeholder="That night, that trip, that one dinner…">${esc(a.moment || '')}</textarea>
    </div>
    <p class="muted small">Quotes, words and moments are shown without your name. Keep them kind: everyone in the group will see them.</p>
    <p class="err" id="a-err" role="alert"></p>
    <div id="donebox"></div>
    ${d.owner ? ownerPanel(d) : ''}
    <details style="margin-top:18px"><summary>Answer on another phone or laptop</summary><p>This is your personal link. Don’t post it in the group: anyone with it can answer as you.</p>
      <div class="linkline"><input type="text" readonly id="mylink" value="${esc(`${recapUrl()}#k=${token}`)}" aria-label="Your personal link"><button class="btn ghost small" type="button" id="copymine">Copy</button></div></details>`;
  bindInvite();
  drawDone(d);
  counter($('#a-quote'), $('#a-quote-c'));
  counter($('#a-moment'), $('#a-moment-c'));

  app.querySelectorAll('[data-award]').forEach((card) => card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vote]');
    if (!b) return;
    const was = b.getAttribute('aria-pressed') === 'true';
    card.querySelectorAll('[data-vote]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(!was));
    card.classList.toggle('done', !was);
    save({ awards: { [card.dataset.award]: was ? null : Number(b.dataset.vote) } });
  }));
  $('#q-rate').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rate]');
    if (!b) return;
    $('#q-rate').querySelectorAll('[data-rate]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#q-rate').classList.add('done');
    save({ rating: Number(b.dataset.rate) });
  });
  for (const k of ['word', 'quote', 'moment']) {
    const el = $(`#a-${k}`);
    let t;
    let last = el.value;
    const flush = () => {
      clearTimeout(t);
      if (el.value === last) return;
      last = el.value;
      el.closest('.q').classList.toggle('done', !!el.value.trim());
      save({ [k]: el.value });
    };
    el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(flush, 1200); });
    el.addEventListener('change', flush);
    el.addEventListener('blur', flush);
  }
  $('#copymine').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#mylink').value); toast('Personal link copied.'); } catch { $('#mylink').select(); } });
  bindOwner();
}

function drawDone(d) {
  const box = $('#donebox');
  if (!box) return;
  if (d.me?.complete) {
    // Once you're done, the invite box moves under your answers with a "now get the others" nudge.
    $('#sharebox')?.remove();
    box.innerHTML = `<p class="center" style="font-weight:750;color:var(--ok);margin:18px 0 0">✓ All your awards are in. Add the extras above if you like.</p>${inviteBox(d, true)}`;
  } else box.innerHTML = '';
  bindInvite();
}

let saving = Promise.resolve();
function save(patch) {
  saving = saving.then(async () => {
    try {
      const d = await call('answer', patch);
      $('#a-err').textContent = '';
      const wasComplete = data.me?.complete;
      data = d;
      if (d.status !== 'open') { show(d); return; }
      $('#mine').style.width = `${Math.round(d.me.progress * 100)}%`;
      updateCounts(d);
      if (d.me.complete && !wasComplete) { drawDone(d); toast('All your awards are in!'); }
    } catch (e) {
      $('#a-err').textContent = e.message;
      if (e.status === 409) refresh();
    }
  });
}

function ownerPanel(d) {
  const free = d.members.filter((m) => !m.claimed);
  return `<div class="panel owner" id="owner">
    <span class="lbl">You started this recap</span>
    <p class="muted small" id="drop-note">${d.canDrop ? 'Drop it now and everyone sees the story straight away.' : `You can drop it early once ${d.minToDrop} people have answered.`}</p>
    <button class="btn violet" type="button" id="drop-now" ${d.canDrop ? '' : 'disabled'}>Drop the story now</button>
    ${free.length ? `<span class="lbl">Remove a name nobody will use</span><div class="rmrow" id="rm">${free.map((m) => `<button class="chip" type="button" data-rm="${m.id}">${esc(m.name)}</button>`).join('')}</div>` : ''}
    <div class="spacer"></div>
    <button class="btn danger small" type="button" id="del">Delete this recap</button>
  </div>`;
}

function bindOwner() {
  $('#drop-now')?.addEventListener('click', async () => {
    const left = data.total - data.answered;
    if (!confirm(left > 0 ? `${plural(left, 'person hasn’t', 'people haven’t')} answered yet. Drop the story for everyone now?` : 'Drop the story for everyone now?')) return;
    await saving; // your own last answers go in before the story is compiled
    try { show(await call('drop', {})); } catch (e) { toast(e.message); }
  });
  $('#rm')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b || !confirm(`Remove ${b.textContent} from the list?`)) return;
    try { const d = await call('remove', { memberId: Number(b.dataset.rm) }); shape = ''; show(d); } catch (ex) { toast(ex.message); }
  });
  $('#del')?.addEventListener('click', async () => {
    if (!confirm('Delete this recap and every answer in it? This can’t be undone.')) return;
    try { await call('delete', {}); location.href = '/'; } catch (e) { toast(e.message); }
  });
}

function updateCounts(d) {
  const c = $('#counts');
  if (c) c.innerHTML = `<b>${d.answered} of ${d.total}</b> have answered. ${esc(dropLine(d))}`;
  const m = $('#meter');
  if (m) m.style.width = `${d.total ? Math.round((d.answered / d.total) * 100) : 0}%`;
  const w = $('#who');
  if (w) w.outerHTML = whoList(d);
  const dn = $('#drop-now');
  if (dn) {
    dn.disabled = !d.canDrop;
    $('#drop-note').textContent = d.canDrop ? 'Drop it now and everyone sees the story straight away.' : `You can drop it early once ${d.minToDrop} people have answered.`;
  }
}

// ---------- Story ----------
function renderStory(d) {
  const s = d.story;
  slides = buildSlides(s, { origin: location.origin });
  const member = !!s.me;
  app.innerHTML = `<div class="cover">
      <span class="kicker" style="color:#c6f432">The story is out</span>
      <h2>${esc(s.title)}</h2>
      <p>Told by ${plural(s.storytellers, 'person', 'people')} · ${plural(slides.length, 'slide', 'slides')}${member ? ' · one is about you' : ''}</p>
      <button class="btn" type="button" id="watch">▶ Watch the story</button>
    </div>
    <h2>All slides</h2>
    <p class="muted">Tap one to open it, then save it for your story or the group chat.</p>
    <div class="thumbs" id="thumbs"></div>
    <div class="cta">
      <h2>${member ? 'Got another group?' : 'Make one for your group'}</h2>
      <p class="muted" style="margin:0">Family, uni friends, the team, the trip crew. It takes a minute to start, and it’s free.</p>
      <div class="seg">
        <a class="btn violet" href="/?again=1">Start another recap</a>
        <a class="btn ghost" href="/?kind=trip&again=1">A trip recap</a>
        <a class="btn ghost" href="/?kind=season&again=1">A team season</a>
      </div>
    </div>
    ${d.owner ? '<button class="btn danger small" type="button" id="del">Delete this recap</button>' : ''}`;
  const big = document.createElement('canvas');
  const thumbs = $('#thumbs');
  slides.forEach((sl, i) => {
    renderSlide(sl, big);
    const t = document.createElement('canvas');
    t.width = 270; t.height = 480;
    t.getContext('2d').drawImage(big, 0, 0, 270, 480);
    t.setAttribute('role', 'img');
    t.setAttribute('aria-label', sl.alt);
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Open slide ${i + 1}`);
    b.append(t);
    b.addEventListener('click', () => openViewer(i));
    thumbs.append(b);
  });
  $('#watch').addEventListener('click', () => openViewer(0));
  $('#del')?.addEventListener('click', async () => {
    if (!confirm('Delete this recap and every answer in it? This can’t be undone.')) return;
    try { await call('delete', {}); location.href = '/'; } catch (e) { toast(e.message); }
  });
  if (!recall(`seen.${id}`) && !navigator.webdriver) { remember(`seen.${id}`, '1'); openViewer(0); }
}

const viewer = $('#viewer');
const DUR = 6500;
let cur = 0;
let timer = null;
let holdAt = 0;
let held = false;

function openViewer(i) {
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#bars').innerHTML = slides.map(() => '<i><b></b></i>').join('');
  go(i);
  $('#v-next').focus();
}
function closeViewer() {
  clearTimeout(timer);
  viewer.hidden = true;
  document.body.style.overflow = '';
}
function go(i) {
  if (i < 0) i = 0;
  if (i >= slides.length) { closeViewer(); return; }
  cur = i;
  const c = $('#slide');
  renderSlide(slides[i], c);
  c.setAttribute('aria-label', `Slide ${i + 1} of ${slides.length}: ${slides[i].alt}`);
  viewer.dataset.slide = String(i);
  [...$('#bars').children].forEach((b, j) => {
    b.className = j < i ? 'seen' : '';
    if (j === i) { void b.offsetWidth; b.className = 'now'; }
  });
  viewer.style.setProperty('--dur', `${DUR}ms`);
  schedule(DUR);
}
let left = DUR;
let startedAt = 0;
function schedule(ms) {
  clearTimeout(timer);
  left = ms;
  startedAt = Date.now();
  if (navigator.webdriver) return; // tests step through slides by hand
  timer = setTimeout(() => go(cur + 1), ms);
}
function pause() { clearTimeout(timer); left -= Date.now() - startedAt; viewer.classList.add('paused'); }
function resume() { viewer.classList.remove('paused'); schedule(Math.max(400, left)); }

$('#v-next').addEventListener('click', () => { if (!held) go(cur + 1); });
$('#v-prev').addEventListener('click', () => { if (!held) go(cur - 1); });
$('#v-close').addEventListener('click', closeViewer);
for (const el of [$('#v-next'), $('#v-prev')]) {
  el.addEventListener('pointerdown', () => { holdAt = Date.now(); held = false; pause(); });
  el.addEventListener('pointerup', () => { held = Date.now() - holdAt > 350; resume(); });
  el.addEventListener('pointerleave', () => { if (viewer.classList.contains('paused')) resume(); });
}
document.addEventListener('keydown', (e) => {
  if (viewer.hidden) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowRight') go(cur + 1);
  if (e.key === 'ArrowLeft') go(cur - 1);
});
$('#v-save').addEventListener('click', async () => {
  pause();
  const blob = await slideBlob(slides[cur]);
  await shareImage(blob, `crewcap-${cur + 1}.png`, `${data.title} · made with Crewcap ${location.origin}`);
  resume();
});
$('#v-share').addEventListener('click', async () => {
  pause();
  await shareLink({ title: data.title, text: `${data.title}: the recap is out 👀`, url: recapUrl() });
  resume();
});

// ---------- Load and refresh ----------
function show(d) {
  data = d;
  const next = d.status === 'dropped' ? 'story' : d.me ? `answer:${d.me.id}:${d.members.length}` : `join:${d.members.map((m) => `${m.id}${m.claimed ? 'c' : ''}`).join(',')}`;
  if (next === shape) { updateCounts(d); return; }
  // Keep the answer form in place while someone types; new joiners are added on the next full render.
  if (shape.startsWith('answer:') && next.startsWith('answer:') && document.activeElement?.matches('input, textarea')) { updateCounts(d); return; }
  shape = next;
  if (d.status === 'dropped') renderStory(d);
  else if (d.me) renderAnswer(d);
  else renderJoin(d);
}

async function refresh() {
  try { show(await call()); } catch (e) {
    if (e.status === 404) {
      document.title = 'Recap not found · Crewcap';
      app.innerHTML = '<div class="panel center"><h2>This recap isn’t here</h2><p class="muted">It was deleted, or the link is incomplete. Check the link in the chat, or start a new one.</p><a class="btn violet" href="/">Start a recap</a></div>';
      shape = 'gone';
    } else if (!data) {
      app.innerHTML = `<div class="panel center"><p class="err">${esc(e.message)}</p><button class="btn" type="button" id="retry">Try again</button></div>`;
      $('#retry').addEventListener('click', () => location.reload());
    }
  }
}

refresh();
setInterval(() => { if (document.visibilityState === 'visible' && data && data.status === 'open' && shape !== 'gone') refresh(); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data?.status === 'open') refresh(); });
