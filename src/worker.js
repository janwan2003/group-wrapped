// Crewcap Worker: static site from ./public; every recap is its own SQLite-backed Durable Object (Recap);
// per-IP write limits live in a tiny Limiter Durable Object.
import { DurableObject } from 'cloudflare:workers';
import {
  validateRecap, validateAnswer, validateName, mergeAnswer, isComplete, progress, status, compile, dropText,
  awardLabel, AWARDS, MAX_MEMBERS, MIN_TO_DROP, KEEP_DAYS,
} from './logic.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS recap (k INTEGER PRIMARY KEY CHECK (k = 1), id TEXT, title TEXT, kind TEXT, awards TEXT,
  owner TEXT, drop_at INTEGER, dropped_at INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, tok TEXT, joined INTEGER);
CREATE TABLE IF NOT EXISTS answers (member_id INTEGER PRIMARY KEY, data TEXT, updated INTEGER)`;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const fail = (error, status = 400) => json({ error }, status);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomId(n, alphabet = 'abcdefghijkmnpqrstuvwxyz23456789') {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
const validToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t);

export class Recap extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.reads = new Map();
  }

  exists() {
    return this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'recap'").toArray().length > 0;
  }
  row() {
    if (!this.exists()) return null;
    const r = this.sql.exec('SELECT * FROM recap WHERE k = 1').toArray()[0];
    return r ? { ...r, awards: JSON.parse(r.awards) } : null;
  }
  members() { return this.sql.exec('SELECT id, name, tok, joined FROM members ORDER BY id').toArray(); }
  answers() {
    return this.sql.exec('SELECT member_id, data FROM answers').toArray().map((a) => ({ member_id: a.member_id, ...JSON.parse(a.data) }));
  }
  async wipe() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
  async alarm() { await this.wipe(); }

  counts(r, members, answers) {
    const done = new Set(answers.filter((a) => isComplete(a, r.awards, members.length - 1)).map((a) => a.member_id));
    return { done, answered: done.size, total: members.length };
  }

  view(r, tokHash, now) {
    const members = this.members();
    const answers = this.answers();
    const st = status(r, now);
    const me = tokHash ? members.find((m) => m.tok === tokHash) : null;
    const { done, answered, total } = this.counts(r, members, answers);
    const mine = me ? answers.find((a) => a.member_id === me.id) || null : null;
    const owner = !!tokHash && tokHash === r.owner;
    const out = {
      id: r.id, title: r.title, kind: r.kind, status: st, now, created: r.created, dropAt: r.drop_at, droppedAt: r.dropped_at,
      awards: r.awards.map((k) => ({ key: k, label: awardLabel(k, r.kind), emoji: AWARDS.find((a) => a.key === k).emoji })),
      members: members.map((m) => ({ id: m.id, name: m.name, claimed: !!m.tok, answered: done.has(m.id) })),
      answered, total, owner, minToDrop: MIN_TO_DROP,
      canDrop: owner && st === 'open' && answered >= MIN_TO_DROP,
      me: me ? { id: me.id, name: me.name, answer: mine, progress: progress(mine, r.awards), complete: done.has(me.id) } : null,
    };
    if (st === 'dropped') {
      out.story = compile(r, members, answers, me ? me.id : null);
    }
    return out;
  }

  og(r, now) {
    if (!r) return { status: 404, title: 'Recap not found · Crewcap', desc: 'This recap was deleted. Start your own: your group’s year, voted by your group.' };
    const members = this.members();
    const { answered, total } = this.counts(r, members, this.answers());
    if (status(r, now) === 'dropped') {
      const s = compile(r, members, this.answers());
      const mvp = s.awards[0];
      const lead = mvp && mvp.winners.length === 1 ? ` ${mvp.emoji} ${mvp.short}: ${mvp.winners[0].name}.` : '';
      return { status: 200, title: `${r.title} · the story is out`, desc: `Told by ${s.storytellers} of you.${lead} Tap to watch the whole recap.` };
    }
    return {
      status: 200, title: `${r.title} · our recap, voted by us`,
      desc: `${answered} of ${total} have answered · ${dropText(r.drop_at, now)}. Vote the awards in 2 minutes. No app, no sign-up.`,
    };
  }

  rateRead(ip) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${ip}:${minute}`;
    const n = (this.reads.get(key) || 0) + 1;
    if (this.reads.size > 500) this.reads.clear();
    this.reads.set(key, n);
    return n <= 120;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.pathname.split('/').filter(Boolean)[0] || '';
    const now = Date.now();
    const ip = request.headers.get('x-ip') || '';
    const tok = request.headers.get('x-token');
    const tokHash = validToken(tok) ? await sha(tok) : null;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (action === 'create') {
      if (this.exists()) return fail('Try again.', 409);
      if (!tokHash) return fail('Your browser blocked storage; enable it and try again.');
      const v = validateRecap(body, now);
      if (!v.ok) return fail(v.error);
      const r = v.value;
      for (const q of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) this.sql.exec(q);
      this.sql.exec('INSERT INTO recap (k, id, title, kind, awards, owner, drop_at, created) VALUES (1, ?, ?, ?, ?, ?, ?, ?)',
        body.id, r.title, r.kind, JSON.stringify(r.awards), tokHash, r.dropAt, now);
      r.names.forEach((n, i) => this.sql.exec('INSERT INTO members (name, tok, joined) VALUES (?, ?, ?)', n, i === 0 ? tokHash : null, i === 0 ? now : null));
      await this.ctx.storage.setAlarm(now + KEEP_DAYS * 86400e3);
      return json({ id: body.id });
    }

    const r = this.row();
    if (action === 'og') return json(this.og(r, now));
    if (!r) return fail('This recap was deleted.', 404);
    const st = status(r, now);

    if (request.method === 'GET' && !action) {
      if (!this.rateRead(ip)) return fail('Too many requests, slow down a little.', 429);
      return json(this.view(r, tokHash, now));
    }
    if (!tokHash) return fail('Your browser blocked storage; enable it and try again.');
    const members = this.members();
    const me = members.find((m) => m.tok === tokHash);

    switch (action) {
      case 'join': {
        if (st !== 'open') return fail('The story is already out, so answers are closed.', 409);
        if (me) return fail(`You already joined as ${me.name}.`, 409);
        if (body.memberId != null) {
          const m = members.find((x) => x.id === Number(body.memberId));
          if (!m) return fail('That name is gone. Add yourself instead.', 404);
          if (m.tok) return fail(`Someone already joined as ${m.name}. If that wasn’t you, add yourself with another name.`, 409);
          this.sql.exec('UPDATE members SET tok = ?, joined = ? WHERE id = ?', tokHash, now, m.id);
        } else {
          if (members.length >= MAX_MEMBERS) return fail(`This group is full (${MAX_MEMBERS} people).`, 409);
          const v = validateName(body.name, members.map((m) => m.name));
          if (!v.ok) return fail(v.error, 409);
          this.sql.exec('INSERT INTO members (name, tok, joined) VALUES (?, ?, ?)', v.value, tokHash, now);
        }
        break;
      }
      case 'answer': {
        if (st !== 'open') return fail('The story is already out, so answers are closed.', 409);
        if (!me) return fail('Pick your name first.', 403);
        const v = validateAnswer(body, { awards: r.awards, memberIds: members.map((m) => m.id), selfId: me.id });
        if (!v.ok) return fail(v.error);
        const prev = this.sql.exec('SELECT data FROM answers WHERE member_id = ?', me.id).toArray()[0];
        const merged = mergeAnswer(prev ? JSON.parse(prev.data) : null, v.value);
        this.sql.exec('INSERT INTO answers (member_id, data, updated) VALUES (?, ?, ?) ON CONFLICT (member_id) DO UPDATE SET data = excluded.data, updated = excluded.updated',
          me.id, JSON.stringify(merged), now);
        // With no reveal date, the story drops the moment the last person on the list has answered.
        if (!r.drop_at && members.length >= 3 && members.every((m) => m.tok)) {
          const { answered, total } = this.counts(r, members, this.answers());
          if (answered === total) this.sql.exec('UPDATE recap SET dropped_at = ? WHERE k = 1', now);
        }
        break;
      }
      case 'remove': {
        if (tokHash !== r.owner) return fail('Only the person who started this recap can remove names.', 403);
        if (st !== 'open') return fail('The story is already out.', 409);
        const m = members.find((x) => x.id === Number(body.memberId));
        if (!m) return fail('That name is already gone.', 404);
        if (m.tok === r.owner) return fail('You can’t remove yourself.', 409);
        if (m.tok) return fail(`${m.name} has already joined, so their name stays.`, 409);
        this.sql.exec('DELETE FROM members WHERE id = ?', m.id);
        break;
      }
      case 'drop': {
        if (tokHash !== r.owner) return fail('Only the person who started this recap can drop it.', 403);
        if (st !== 'open') return fail('The story is already out.', 409);
        const { answered } = this.counts(r, members, this.answers());
        if (answered < MIN_TO_DROP) return fail(`Wait until at least ${MIN_TO_DROP} people have answered.`, 409);
        this.sql.exec('UPDATE recap SET dropped_at = ? WHERE k = 1', now);
        break;
      }
      case 'delete': {
        if (tokHash !== r.owner) return fail('Only the person who started this recap can delete it.', 403);
        await this.wipe();
        return json({ deleted: true });
      }
      default:
        return fail('Not found.', 404);
    }
    return json(this.view(this.row(), tokHash, Date.now()));
  }
}

// Fixed-window per-IP counters: one Limiter object per IP address.
export class Limiter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS hits (k TEXT, hour INTEGER, n INTEGER, PRIMARY KEY (k, hour))');
  }
  async fetch(request) {
    const url = new URL(request.url);
    const k = url.searchParams.get('k');
    const max = Number(url.searchParams.get('max'));
    const hour = Math.floor(Date.now() / 3600e3);
    this.sql.exec('DELETE FROM hits WHERE hour < ?', hour);
    this.sql.exec('INSERT INTO hits (k, hour, n) VALUES (?, ?, 1) ON CONFLICT (k, hour) DO UPDATE SET n = n + 1', k, hour);
    const n = this.sql.exec('SELECT n FROM hits WHERE k = ? AND hour = ?', k, hour).one().n;
    if (n === 1) await this.ctx.storage.setAlarm(Date.now() + 2 * 3600e3);
    return json({ ok: n <= max });
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

const LIMITS = { create: 20, join: 40, write: 600 };

async function allowed(env, ip, kind) {
  try {
    const stub = env.LIMITER.get(env.LIMITER.idFromName(ip || 'unknown'));
    const r = await (await stub.fetch(`https://limiter/?k=${kind}&max=${LIMITS[kind]}`)).json();
    return r.ok;
  } catch (e) {
    console.error(e);
    return true;
  }
}

const recapStub = (env, id) => env.RECAP.get(env.RECAP.idFromName(id));
const ID = /^[a-z2-9]{8}$/;

async function api(request, env, url) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const parts = url.pathname.split('/').filter(Boolean); // api, r, id?, action?
  if (parts[1] !== 'r') return fail('Not found.', 404);
  const headers = new Headers({ 'x-ip': ip });
  if (request.headers.get('x-token')) headers.set('x-token', request.headers.get('x-token'));

  if (parts.length === 2 && request.method === 'POST') {
    if (!(await allowed(env, ip, 'create'))) return fail('You’ve started a lot of recaps this hour. Try again later.', 429);
    const body = await request.json().catch(() => ({}));
    const id = randomId(8);
    headers.set('content-type', 'application/json');
    return recapStub(env, id).fetch(new Request('https://recap/create', { method: 'POST', headers, body: JSON.stringify({ ...body, id }) }));
  }
  const id = parts[2];
  if (!ID.test(id || '')) return fail('This recap was deleted.', 404);
  const action = parts[3] || '';
  if (request.method === 'GET' && !action) return recapStub(env, id).fetch(new Request('https://recap/', { headers }));
  if (request.method !== 'POST' || !action) return fail('Not found.', 404);
  const kind = action === 'join' ? 'join' : 'write';
  if (!(await allowed(env, ip, kind))) return fail('Too many requests this hour. Try again later.', 429);
  headers.set('content-type', 'application/json');
  return recapStub(env, id).fetch(new Request(`https://recap/${action}`, { method: 'POST', headers, body: await request.text() }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(request, env, url); } catch (e) { console.error(e); return fail('Something went wrong. Try again.', 500); }
    }
    const m = url.pathname.match(/^\/r\/([^/]*)\/?$/);
    if (m && (request.method === 'GET' || request.method === 'HEAD')) {
      let meta = { status: 404, title: 'Recap not found · Crewcap', desc: 'This recap was deleted.' };
      if (ID.test(m[1])) {
        try { meta = await (await recapStub(env, m[1]).fetch(new Request('https://recap/og'))).json(); } catch (e) { console.error(e); }
      }
      const page = await env.ASSETS.fetch(new Request(`${url.origin}/recap`));
      const head = `<title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.desc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Crewcap">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.desc)}">
  <meta property="og:image" content="${url.origin}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(url.origin + url.pathname)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="noindex">`;
      const html = (await page.text()).replace('<!--META-->', head);
      const headers = new Headers(page.headers);
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('cache-control', 'no-store');
      return new Response(html, { status: meta.status, headers });
    }
    return env.ASSETS.fetch(request);
  },
};
