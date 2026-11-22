// End-to-end test in real Chromium: create → 4 friends join and answer → API keeps votes secret → drop →
// story slides, viewer, PNG save, personal slide, personal link on a second device → auto-drop → delete.
// Usage: BASE=http://127.0.0.1:8961 node tests/e2e/run.mjs   (defaults to the local dev server)
import { launch } from '../../tools/browser.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://127.0.0.1:8961';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const browser = await launch();
const errors = [];
const expected = [];
const LOCAL = /127\.0\.0\.1|localhost/.test(BASE);
// x-e2e: test traffic is left out of the production usage counts (/api/stats).
const E2E = { 'x-e2e': '1' };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1280, height: 860 } };

async function person(name, opts) {
  const ctx = await browser.newContext({ ...opts, acceptDownloads: true, extraHTTPHeaders: E2E });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Chromium logs every non-2xx fetch; the deliberate rejections below cause 404/409 responses.
    if (/Failed to load resource: .* (404|409) |ERR_INTERNET_DISCONNECTED/.test(m.text())) { expected.push(`${name}: ${m.text()}`); return; }
    errors.push(`${name}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
const step = (s) => console.log(`- ${s}`);
const shot = (page, n, full = true) => page.screenshot({ path: `${SHOTS}${n}.png`, fullPage: full });
async function og(path) {
  const res = await fetch(`${BASE}${path}`, { headers: E2E });
  const html = await res.text();
  return {
    status: res.status,
    title: html.match(/property="og:title" content="([^"]*)"/)?.[1] ?? '',
    desc: html.match(/property="og:description" content="([^"]*)"/)?.[1] ?? '',
  };
}
// No sideways scrolling on a small phone.
async function noOverflow(page, label) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  assert.ok(w[0] <= w[1], `${label}: page is ${w[0]}px wide in a ${w[1]}px viewport`);
}
async function token(page, id) { return page.evaluate((k) => localStorage.getItem(`cc.tok.${k}`), id); }
async function raw(path, tok, body) {
  const res = await fetch(`${BASE}/api/${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-token': tok, 'content-type': 'application/json', ...E2E }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}

const stats0 = await (await fetch(`${BASE}/api/stats`)).json();
assert.ok(stats0.totals && typeof stats0.totals.created === 'number', 'GET /api/stats returns totals');
const maya = await person('Maya', DESK);
const tom = await person('Tom', PHONE);
const ann = await person('Ann', PHONE);
const ben = await person('Ben', PHONE);
const cat = await person('Cat', PHONE);

// 1. Maya starts a recap
await maya.page.goto(BASE);
await maya.page.waitForSelector('#peek canvas');
await shot(maya.page, '01-landing-desktop', false);
assert.equal(await maya.page.inputValue('#t-title'), `Our ${new Date().getFullYear()}`);
assert.equal(await maya.page.$$eval('#awards .chip', (els) => els.length), 8);
assert.equal(await maya.page.textContent('#aw-more'), 'Show 8 more awards');
await maya.page.click('#aw-more');
assert.equal(await maya.page.$$eval('#awards .chip', (els) => els.length), 16);
assert.ok(await maya.page.isHidden('#aw-more'));
step('landing shows 8 awards, "Show 8 more awards" reveals all 16');
await maya.page.click('#f-new button[type=submit]');
await maya.page.waitForSelector('#new-err:has-text("Type your own name")');
step('empty name shows a validation message');
await maya.page.click('[data-kind="trip"]');
assert.equal(await maya.page.inputValue('#t-title'), 'The trip');
assert.ok(await maya.page.isVisible('#awards [data-key="mvp"]:has-text("MVP of the trip")'));
await maya.page.click('[data-kind="year"]');
await maya.page.fill('#t-title', 'Our <b>2026</b>');
await maya.page.fill('#t-me', 'Maya');
await maya.page.fill('#t-names', 'Tom, Ann\nBen');
for (const k of ['funny', 'chaos', 'glue']) await maya.page.click(`#awards [data-key="${k}"]`);
await maya.page.click('#awards [data-key="chat"]');
assert.match(await maya.page.textContent('#aw-count'), /4 picked/);
await maya.page.click('[data-drop="date"]');
assert.ok(await maya.page.inputValue('#t-date'));
await maya.page.click('[data-drop="all"]');
await maya.page.click('#f-new button[type=submit]');
await maya.page.waitForURL(/\/r\/[a-z2-9]{8}$/);
const id = maya.page.url().split('/').pop();
const url = `${BASE}/r/${id}`;
await maya.page.waitForSelector('#sharebox');
assert.equal(await maya.page.inputValue('#link'), url);
assert.equal(await maya.page.textContent('h1'), 'Our <b>2026</b>');
await shot(maya.page, '02-created-desktop');
step(`created recap ${id}; HTML in the title is shown as text; invite box shows the link`);

let p = await og(`/r/${id}`);
assert.equal(p.title, 'Our &lt;b&gt;2026&lt;/b&gt; · our recap, voted by us');
assert.match(p.desc, /^0 of 4 have answered · drops when everyone has answered/);
step(`link preview while open: "${p.desc}"`);

// 2. Tom joins from the list on his phone and answers everything
await tom.page.goto(url);
await tom.page.waitForSelector('#names');
await shot(tom.page, '03-join-phone');
await tom.page.click('#names [data-id]:has-text("Tom")');
await tom.page.waitForSelector('[data-award="mvp"]');
const tomChips = await tom.page.$$eval('[data-award="mvp"] [data-vote]', (els) => els.map((e) => e.textContent));
assert.deepEqual(tomChips.sort(), ['Ann', 'Ben', 'Maya']);
step('Tom joined by tapping his name; he cannot vote for himself');
await tom.page.click('[data-award="mvp"] [data-vote]:has-text("Maya")');
await tom.page.click('[data-award="main"] [data-vote]:has-text("Ann")');
await tom.page.click('[data-award="late"] [data-vote]:has-text("Ben")');
await tom.page.click('[data-award="chat"] [data-vote]:has-text("Maya")');
await tom.page.click('[data-award="chat"] [data-vote]:has-text("Maya")'); // tap again clears
await tom.page.click('[data-award="chat"] [data-vote]:has-text("Ann")');
await tom.page.click('[data-rate="9"]');
await tom.page.fill('#a-word', 'Chaotic');
await tom.page.fill('#a-quote', '“It’s only a 10 minute walk” — it was not');
await tom.page.fill('#a-moment', 'Missing the last train in Lisbon');
await tom.page.locator('#a-moment').blur();
await tom.page.waitForSelector('#donebox:has-text("Now get the others")');
await tom.page.waitForSelector('#mine-l:text-is("Your answers: all done")');
assert.equal(await tom.page.$eval('#mine', (e) => e.style.width), '100%');
await shot(tom.page, '04-answered-phone');
const tomTok = await token(tom.page, id);
let r = await raw(`r/${id}`, tomTok);
assert.equal(r.data.me.complete, true);
assert.equal(r.data.me.answer.awards.chat, r.data.members.find((m) => m.name === 'Ann').id);
assert.equal(r.data.answered, 1);
step('Tom answered; vote changes and the text answers saved (checked through the API)');

// 3. Ann joins, Cat adds herself (duplicate name rejected), Ben joins from the list
await ann.page.goto(url);
await ann.page.click('#names [data-id]:has-text("Ann")');
await ann.page.waitForSelector('[data-award="mvp"]');
await cat.page.goto(url);
await cat.page.waitForSelector('#names');
assert.equal(await cat.page.$('#names [data-id]:has-text("Tom")'), null);
await cat.page.fill('#j-name', 'tom');
await cat.page.click('#f-join button[type=submit]');
await cat.page.waitForSelector('#j-err:has-text("already in this group")');
await cat.page.fill('#j-name', 'Cat');
await cat.page.click('#f-join button[type=submit]');
await cat.page.waitForSelector('[data-award="mvp"]');
step('claimed names disappear from the list; a duplicate nickname is rejected; Cat added herself');
await ben.page.goto(url);
await ben.page.click('#names [data-id]:has-text("Ben")');
await ben.page.waitForSelector('[data-award="mvp"]');

async function answerAll(page, votes, rating, word, quote, moment) {
  await page.reload();
  await page.waitForSelector('[data-award="mvp"] [data-vote]');
  for (const [award, name] of Object.entries(votes)) await page.click(`[data-award="${award}"] [data-vote]:text-is("${name}")`);
  await page.click(`[data-rate="${rating}"]`);
  if (word) await page.fill('#a-word', word);
  if (quote) await page.fill('#a-quote', quote);
  if (moment) await page.fill('#a-moment', moment);
  await page.locator('#a-moment').blur();
  await page.waitForSelector('#donebox:has-text("Now get the others"), #donebox:has-text("All your awards")');
}
// Ann loses her connection mid-vote: the tap is kept and saved once she is back online.
await ann.ctx.setOffline(true);
await ann.page.click('[data-award="mvp"] [data-vote]:text-is("Tom")');
await ann.page.waitForSelector('#a-err:has-text("offline")');
await ann.ctx.setOffline(false);
await ann.page.waitForSelector('#a-err:text-is("")', { state: 'attached', timeout: 15000 });
await ann.page.waitForSelector('#mine-l:text-is("Your answers: 1 of 8")');
r = await raw(`r/${id}`, await token(ann.page, id));
assert.equal(r.data.me.answer.awards.mvp, r.data.members.find((m) => m.name === 'Tom').id);
step('offline tap: "You’re offline" shown, then saved automatically when the connection came back');
await answerAll(ann.page, { mvp: 'Maya', main: 'Maya', late: 'Ben', chat: 'Tom' }, 8, 'chaotic!', 'Who invited the goose?', 'Karaoke until 4am');
await answerAll(cat.page, { mvp: 'Tom', main: 'Maya', late: 'Ben', chat: 'Ann' }, 7, 'Loud', '', 'The lake day');
await shot(cat.page, '05-answer-form-phone');
step('Ann and Cat answered');

// Secrets: nobody sees anyone else's votes or texts before the drop; non-owners can't drop or remove
const catTok = await token(cat.page, id);
r = await raw(`r/${id}`, catTok);
const blob = JSON.stringify(r.data);
assert.ok(!blob.includes('goose') && !blob.includes('Lisbon'), 'other answers leak before the drop');
assert.equal(r.data.story, undefined);
assert.equal((await raw(`r/${id}/drop`, catTok, {})).status, 403);
assert.equal((await raw(`r/${id}/remove`, catTok, { memberId: 1 })).status, 403);
assert.equal((await raw(`r/${id}/answer`, catTok, { awards: { mvp: r.data.me.id } })).status, 400);
step('API: no other answers before the drop; self-vote 400; drop/remove by a non-owner 403');

p = await og(`/r/${id}`);
assert.match(p.desc, /^3 of 5 have answered/);
step(`link preview after 3 answers: "${p.desc}"`);

// 4. Maya answers and drops the story early (Ben hasn't answered)
await maya.page.reload();
await maya.page.waitForSelector('[data-award="mvp"] [data-vote]');
await maya.page.click('[data-award="mvp"] [data-vote]:text-is("Tom")');
await maya.page.click('[data-award="main"] [data-vote]:text-is("Ann")');
await maya.page.click('[data-award="late"] [data-vote]:text-is("Tom")');
await maya.page.click('[data-award="chat"] [data-vote]:text-is("Ann")');
await maya.page.click('[data-rate="10"]');
await maya.page.fill('#a-word', 'Iconic');
await maya.page.locator('#a-word').blur();
await maya.page.waitForSelector('#drop-now:not([disabled])');
await shot(maya.page, '06-owner-desktop');
await maya.page.click('#drop-now');
await maya.page.waitForSelector('#thumbs canvas');
const nSlides = await maya.page.$$eval('#thumbs canvas', (els) => els.length);
const alts = await maya.page.$$eval('#thumbs canvas', (els) => els.map((e) => e.getAttribute('aria-label')));
console.log(alts.map((a) => `    · ${a}`).join('\n'));
// cover, rating, 4 awards, split, word, quotes, moments, me, cast, outro
assert.equal(nSlides, 13);
assert.ok(alts.some((a) => /^Main character: Ann & Maya \(a tie\), 2 votes of 4\./.test(a)));
assert.ok(alts.some((a) => /^Always fashionably late: Ben, 3 votes of 4\./.test(a)));
assert.ok(alts.some((a) => /^Word of the year: Chaotic\./.test(a)));
assert.ok(alts.some((a) => /^Maya, the group says: /.test(a)));
assert.ok(alts.some((a) => /^You rated the year 8\.5 out of 10\./.test(a)));
await shot(maya.page, '07-story-desktop');
step(`Maya dropped the story: ${nSlides} slides with the right winners, tie, word and rating`);

// Viewer: open, step through every slide, save one as PNG
await maya.page.click('#watch');
await maya.page.waitForSelector('#viewer:not([hidden])');
const download = maya.page.waitForEvent('download');
await maya.page.click('#v-save');
const file = await (await download).path();
const png = readFileSync(file);
assert.equal(png.readUInt32BE(16), 1080);
assert.equal(png.readUInt32BE(20), 1920);
for (let i = 1; i < nSlides; i++) await maya.page.keyboard.press('ArrowRight');
assert.equal(await maya.page.getAttribute('#viewer', 'data-slide'), String(nSlides - 1));
await maya.page.keyboard.press('ArrowRight');
await maya.page.waitForSelector('#viewer[hidden]', { state: 'attached' });
step('viewer steps through every slide and closes at the end; "Save this slide" gives a 1080×1920 PNG');

// 5. Tom sees the story on his phone with his own slide; viewer works by tapping
await tom.page.reload();
await tom.page.waitForSelector('#thumbs canvas');
assert.match(await tom.page.textContent('.cover'), /one is about you/);
await shot(tom.page, '08-story-phone');
await tom.page.setViewportSize({ width: 320, height: 640 });
await noOverflow(tom.page, 'story page at 320px');
await tom.page.setViewportSize(PHONE.viewport);
await tom.page.click('#watch');
await tom.page.waitForSelector('#viewer:not([hidden])');
await shot(tom.page, '09-viewer-cover-phone', false);
for (let i = 0; i < 2; i++) await tom.page.click('#v-next');
await shot(tom.page, '10-viewer-award-phone', false);
const tomAlts = await tom.page.$$eval('#thumbs canvas', (els) => els.map((e) => e.getAttribute('aria-label')));
const mine = tomAlts.findIndex((a) => a.startsWith('Tom, the group says'));
assert.ok(mine > 0);
for (let i = 2; i < mine; i++) await tom.page.click('#v-next');
assert.match(await tom.page.getAttribute('#slide', 'aria-label'), /Tom, the group says/);
await shot(tom.page, '11-viewer-you-phone', false);
await tom.page.click('#v-prev');
assert.equal(await tom.page.getAttribute('#viewer', 'data-slide'), String(mine - 1));
await tom.page.click('#v-close');
step('Tom (phone) taps through the story and sees his personal slide');

// After the drop: answers closed, preview changes
r = await raw(`r/${id}/answer`, tomTok, { rating: 1 });
assert.equal(r.status, 409);
p = await og(`/r/${id}`);
assert.match(p.title, /the story is out$/);
assert.match(p.desc, /^Told by 4 of you\./);
step(`after the drop: answers closed (409); preview "${p.title} / ${p.desc}"`);

// 6. Tom's personal link on a second device keeps him as Tom
const tom2 = await person('Tom laptop', DESK);
await tom2.page.goto(`${url}#k=${tomTok}`);
await tom2.page.waitForSelector('.cover:has-text("one is about you")');
assert.equal(new URL(tom2.page.url()).hash, '');
step('personal link on a second device: recognised as Tom; the token is removed from the address bar');

// 7. A recap with no reveal date drops by itself once everyone on the list has answered
const t1 = 'e2eTokenAaaaaaaaaaaaaaaaaaaa1';
const t2 = 'e2eTokenBbbbbbbbbbbbbbbbbbbb2';
const t3 = 'e2eTokenCccccccccccccccccccc3';
const c = await raw('r', t1, { kind: 'trip', title: 'Lisbon', me: 'Zed', names: ['Yan', 'Xia'], awards: ['mvp', 'main', 'late'] });
const id2 = c.data.id;
let v = await raw(`r/${id2}`, t2);
await raw(`r/${id2}/join`, t2, { memberId: v.data.members.find((m) => m.name === 'Yan').id });
await raw(`r/${id2}/join`, t3, { memberId: v.data.members.find((m) => m.name === 'Xia').id });
const ids = Object.fromEntries(v.data.members.map((m) => [m.name, m.id]));
await raw(`r/${id2}/answer`, t1, { awards: { mvp: ids.Yan, main: ids.Xia, late: ids.Yan }, rating: 6 });
await raw(`r/${id2}/answer`, t2, { awards: { mvp: ids.Zed, main: ids.Xia, late: ids.Xia }, rating: 7 });
v = await raw(`r/${id2}`, t1);
assert.equal(v.data.status, 'open');
v = await raw(`r/${id2}/answer`, t3, { awards: { mvp: ids.Yan, main: ids.Zed, late: ids.Yan }, rating: 8 });
assert.equal(v.data.status, 'dropped');
assert.equal(v.data.story.awards[0].label, 'MVP of the trip');
step('auto-drop: the story dropped the moment the last of 3 answered; trip labels used');

// 7b. A browser that blocks storage (some in-app browsers): you can still join and vote in that visit.
const dee = await person('Dee', { ...PHONE, viewport: { width: 320, height: 640 } });
await dee.ctx.addInitScript(() => {
  Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
});
const c3 = await raw('r', t1, { kind: 'event', title: 'Ana’s wedding', me: 'Zed', names: ['Dee'], awards: ['mvp', 'main', 'late'] });
await dee.page.goto(`${BASE}/r/${c3.data.id}`);
await dee.page.waitForSelector('#names');
await noOverflow(dee.page, 'join page at 320px');
await dee.page.click('#names [data-id]:has-text("Dee")');
await dee.page.waitForSelector('[data-award="mvp"] [data-vote]');
await dee.page.click('[data-award="mvp"] [data-vote]:text-is("Zed")');
await dee.page.waitForSelector('#mine-l:text-is("Your answers: 1 of 7")');
assert.equal(await dee.page.textContent('#a-err'), '');
await noOverflow(dee.page, 'answer page at 320px');
v = await raw(`r/${c3.data.id}`, t1);
assert.equal(v.data.members.find((m) => m.name === 'Dee').claimed, true);
assert.equal((await raw(`r/${c3.data.id}/delete`, t1, {})).status, 200);
step('storage blocked: Dee joined and her vote saved; no sideways scroll at 320px');

// 8. Delete: page and API 404
assert.equal((await raw(`r/${id2}/delete`, t1, {})).status, 200);
await maya.page.click('#del');
await maya.page.waitForURL(`${BASE}/`);
assert.equal((await raw(`r/${id}`, tomTok)).status, 404);
await tom.page.goto(url);
await tom.page.waitForSelector('h2:has-text("This recap isn’t here")');
assert.equal((await og(`/r/${id}`)).status, 404);
step('owner deleted the recap: API 404, page shows "This recap isn’t here", preview 404');

// 9. Static pages and phone landing
for (const path of ['/', '/privacy', '/about', '/og.png', '/icon-512.png', '/sitemap.xml', '/robots.txt']) {
  assert.equal((await fetch(`${BASE}${path}`)).status, 200, path);
}
assert.equal((await fetch(`${BASE}/nope`)).status, 404);
await ann.page.goto(BASE);
await ann.page.waitForSelector('#peek canvas');
await shot(ann.page, '12-landing-phone');
await ann.page.setViewportSize({ width: 320, height: 640 });
await noOverflow(ann.page, 'landing at 320px');
await ann.page.setViewportSize(PHONE.viewport);
await ann.page.goto(`${BASE}/?again=1&kind=trip`);
assert.equal(await ann.page.textContent('#new-h'), 'Make one for your other group');
assert.equal(await ann.page.inputValue('#t-title'), 'The trip');
await ann.page.goto(`${BASE}/privacy`);
await shot(ann.page, '13-privacy-phone');
step('static pages 200, unknown page 404; "make one for your other group" link pre-fills the trip template');

// 10. Usage counts: test traffic is not counted; on a local server, real (unmarked) traffic is.
const stats1 = await (await fetch(`${BASE}/api/stats`)).json();
assert.deepEqual(stats1.totals, stats0.totals, 'e2e traffic must not change the usage counts');
if (LOCAL) {
  const real = await fetch(`${BASE}/api/r`, { method: 'POST', headers: { 'x-token': 'realTokenAaaaaaaaaaaaaaaa1', 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Count me', me: 'Kim', names: ['Lu'], awards: ['mvp', 'main', 'late'] }) });
  const rid = (await real.json()).id;
  const stats2 = await (await fetch(`${BASE}/api/stats`)).json();
  assert.equal(stats2.totals.created, stats1.totals.created + 1);
  assert.equal(stats2.totals.joined, stats1.totals.joined + 1);
  assert.equal((await raw(`r/${rid}/delete`, 'realTokenAaaaaaaaaaaaaaaa1', {})).status, 200);
  step('stats: an unmarked create counts 1 created + 1 joined; e2e traffic left the totals unchanged');
} else step('stats: e2e traffic left the production totals unchanged');

await browser.close();
if (expected.length) console.log(`(${expected.length} expected 404/409 network logs from deliberate rejections)`);
if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('PASS');
