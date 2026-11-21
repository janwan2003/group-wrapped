// Crewcap core logic: validation and compiling the group's answers into a story. Pure functions, unit-tested.

export const MAX_MEMBERS = 30;
export const MIN_AWARDS = 3;
export const MAX_AWARDS = 10;
export const MIN_TO_DROP = 2;
export const KEEP_DAYS = 180;

// Preset awards only: nobody can write a free-text award about a person. Kind, a little teasing.
export const AWARDS = [
  { key: 'mvp', label: 'MVP of the year', short: 'MVP', emoji: '🏆' },
  { key: 'main', label: 'Main character', short: 'Main character', emoji: '🎬' },
  { key: 'funny', label: 'Made us laugh the most', short: 'Funniest', emoji: '😂' },
  { key: 'late', label: 'Always fashionably late', short: 'Always late', emoji: '⏰' },
  { key: 'chaos', label: 'Most chaotic energy', short: 'Chaos agent', emoji: '🌪️' },
  { key: 'glue', label: 'The one who holds us together', short: 'The glue', emoji: '🫶' },
  { key: 'chat', label: 'Group chat legend', short: 'Chat legend', emoji: '💬' },
  { key: 'hype', label: 'Best hype person', short: 'Hype person', emoji: '📣' },
  { key: 'glow', label: 'Biggest glow-up', short: 'Glow-up', emoji: '✨' },
  { key: 'yes', label: 'Said yes to every plan', short: 'Yes to everything', emoji: '🙌' },
  { key: 'cancel', label: 'Most likely to cancel (and get away with it)', short: 'Master canceller', emoji: '🫠' },
  { key: 'soft', label: 'Secret softie', short: 'Secret softie', emoji: '🧸' },
  { key: 'taste', label: 'Best taste in everything', short: 'Best taste', emoji: '🎧' },
  { key: 'photos', label: 'Took all the photos', short: 'Photographer', emoji: '📸' },
  { key: 'chef', label: 'Fed us all year', short: 'Head chef', emoji: '🍝' },
  { key: 'wildcard', label: 'Biggest surprise of the year', short: 'Wildcard', emoji: '🃏' },
];
export const DEFAULT_AWARDS = ['mvp', 'main', 'funny', 'late', 'chaos', 'glue'];
const AWARD_BY_KEY = Object.fromEntries(AWARDS.map((a) => [a.key, a]));

export const KINDS = {
  year: { noun: 'year', title: (y) => `Our ${y}` },
  trip: { noun: 'trip', title: () => 'The trip' },
  season: { noun: 'season', title: () => 'This season' },
  event: { noun: 'night', title: () => 'That night' },
};

// Award labels say "of the year"; swap the noun for trips and seasons.
export function awardLabel(key, kind = 'year') {
  const a = AWARD_BY_KEY[key];
  if (!a) return '';
  const noun = KINDS[kind]?.noun || 'year';
  return a.label.replace(/of the year/, `of the ${noun}`);
}

export function clean(s, max) {
  return Array.from(String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('');
}
const len = (s) => Array.from(String(s ?? '')).length;

export function cleanName(s) { return clean(s, 20); }

export function validateName(name, taken = []) {
  const n = cleanName(name);
  if (!n) return { ok: false, error: 'Type a name.' };
  if (len(String(name).trim()) > 20) return { ok: false, error: 'Names can be up to 20 characters.' };
  if (taken.some((t) => t.toLowerCase() === n.toLowerCase())) return { ok: false, error: `“${n}” is already in this group.` };
  return { ok: true, value: n };
}

export function validateRecap(body, now = Date.now()) {
  const b = body || {};
  const kind = Object.hasOwn(KINDS, b.kind) ? b.kind : 'year';
  const title = clean(b.title, 40);
  if (!title) return { ok: false, error: 'Give it a title, like “Our 2026”.' };
  const me = cleanName(b.me);
  if (!me) return { ok: false, error: 'Type your own name first.' };
  const raw = Array.isArray(b.names) ? b.names : String(b.names ?? '').split(/[\n,]/);
  const names = [me];
  for (const r of raw) {
    const n = cleanName(r);
    if (!n || names.some((x) => x.toLowerCase() === n.toLowerCase())) continue;
    names.push(n);
  }
  if (names.length > MAX_MEMBERS) return { ok: false, error: `A group can have up to ${MAX_MEMBERS} people.` };
  const awards = [...new Set((Array.isArray(b.awards) ? b.awards : []).filter((k) => AWARD_BY_KEY[k]))];
  if (awards.length < MIN_AWARDS) return { ok: false, error: `Pick at least ${MIN_AWARDS} awards.` };
  if (awards.length > MAX_AWARDS) return { ok: false, error: `Pick up to ${MAX_AWARDS} awards.` };
  let dropAt = null;
  if (b.dropAt != null && b.dropAt !== '') {
    dropAt = Number(b.dropAt);
    if (!Number.isFinite(dropAt) || dropAt < now + 10 * 60e3) return { ok: false, error: 'Pick a reveal time in the future.' };
    if (dropAt > now + 120 * 86400e3) return { ok: false, error: 'Pick a reveal date within the next 4 months.' };
  }
  return { ok: true, value: { kind, title, me, names, awards, dropAt } };
}

// Partial answers merge into what the member already saved, so the first tap counts and the rest can wait.
export function validateAnswer(body, { awards, memberIds, selfId }) {
  const b = body || {};
  const out = {};
  if (b.awards && typeof b.awards === 'object') {
    out.awards = {};
    for (const [k, v] of Object.entries(b.awards)) {
      if (!awards.includes(k)) continue;
      if (v === null) { out.awards[k] = null; continue; }
      const id = Number(v);
      if (!memberIds.includes(id)) return { ok: false, error: 'That person is not in this group any more.' };
      if (id === selfId) return { ok: false, error: 'You can’t vote for yourself.' };
      out.awards[k] = id;
    }
  }
  if ('rating' in b) {
    if (b.rating === null) out.rating = null;
    else {
      const r = Number(b.rating);
      if (!Number.isInteger(r) || r < 1 || r > 10) return { ok: false, error: 'Rate it from 1 to 10.' };
      out.rating = r;
    }
  }
  const texts = { word: 24, quote: 140, moment: 120 };
  for (const [k, max] of Object.entries(texts)) {
    if (!(k in b)) continue;
    if (len(String(b[k] ?? '').trim()) > max) return { ok: false, error: `Keep it under ${max} characters.` };
    out[k] = clean(b[k], max);
  }
  if (out.word && /\s/.test(out.word) && out.word.split(' ').length > 3) return { ok: false, error: 'The word of the year is one word (three at most).' };
  return { ok: true, value: out };
}

export function mergeAnswer(prev, patch) {
  const a = { awards: {}, rating: null, word: '', quote: '', moment: '', ...(prev || {}) };
  if (patch.awards) {
    a.awards = { ...a.awards };
    for (const [k, v] of Object.entries(patch.awards)) { if (v === null) delete a.awards[k]; else a.awards[k] = v; }
  }
  for (const k of ['rating', 'word', 'quote', 'moment']) if (k in patch) a[k] = patch[k];
  return a;
}

// A member "has answered" once every award is voted and the year is rated; texts are optional extras.
export function isComplete(answer, awards, otherCount) {
  if (!answer) return false;
  const need = otherCount > 0 ? awards.every((k) => answer.awards?.[k] != null) : true;
  return need && answer.rating != null;
}

export function progress(answer, awards) {
  if (!answer) return 0;
  const parts = [...awards.map((k) => answer.awards?.[k] != null), answer.rating != null, !!answer.word, !!answer.quote, !!answer.moment];
  return parts.filter(Boolean).length / parts.length;
}

export function status(r, now = Date.now()) {
  if (r.dropped_at) return 'dropped';
  if (r.drop_at && now >= r.drop_at) return 'dropped';
  return 'open';
}

// Small deterministic PRNG so every member sees the same order of quotes and moments.
function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
function shuffle(list, seed) {
  const rnd = seeded(seed);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const normWord = (w) => w.toLowerCase().replace(/[.!?,;:"'“”‘’]+/g, '').trim();

// Turn everyone's answers into the story. Who voted for whom is never included; texts are anonymous.
export function compile({ id, title, kind, awards }, members, answers, viewerId = null) {
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const given = answers.filter((a) => a && (Object.keys(a.awards || {}).length || a.rating != null || a.word || a.quote || a.moment));
  const received = Object.fromEntries(members.map((m) => [m.id, {}]));

  const awardResults = awards.map((key) => {
    const counts = {};
    let total = 0;
    for (const a of given) {
      const v = a.awards?.[key];
      if (v == null || !byId[v]) continue;
      counts[v] = (counts[v] || 0) + 1;
      total++;
    }
    const ranked = Object.entries(counts).map(([mid, n]) => ({ id: Number(mid), name: byId[mid].name, votes: n }))
      .sort((x, y) => y.votes - x.votes || x.name.localeCompare(y.name));
    for (const r of ranked) received[r.id][key] = r.votes;
    const top = ranked[0]?.votes || 0;
    const winners = ranked.filter((r) => r.votes === top && top > 0);
    return { key, label: awardLabel(key, kind), short: AWARD_BY_KEY[key].short, emoji: AWARD_BY_KEY[key].emoji, total, winners, ranked: ranked.slice(0, 4), share: total ? top / total : 0 };
  }).filter((a) => a.total > 0);

  // Biggest split: the award whose winner had the smallest share (needs a few votes to mean anything).
  const contested = awardResults.filter((a) => a.total >= 3 && a.ranked.length >= 2).sort((x, y) => x.share - y.share || y.total - x.total)[0] || null;
  const unanimous = awardResults.filter((a) => a.total >= 3 && a.share === 1).map((a) => a.key);

  const ratings = given.map((a) => a.rating).filter((r) => r != null);
  const rating = ratings.length ? {
    avg: Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10,
    count: ratings.length, min: Math.min(...ratings), max: Math.max(...ratings),
    hist: Array.from({ length: 10 }, (_, i) => ratings.filter((r) => r === i + 1).length),
  } : null;

  const wordCounts = new Map();
  for (const a of given) {
    if (!a.word) continue;
    const k = normWord(a.word);
    if (!k) continue;
    const cur = wordCounts.get(k) || { word: a.word.replace(/[.!?,;:]+$/, ''), n: 0 };
    cur.n++;
    wordCounts.set(k, cur);
  }
  const words = [...wordCounts.values()].sort((x, y) => y.n - x.n || x.word.localeCompare(y.word));

  const quotes = shuffle(given.map((a) => a.quote).filter(Boolean), `${id}q`).slice(0, 5);
  const moments = shuffle(given.map((a) => a.moment).filter(Boolean), `${id}m`).slice(0, 6);

  const people = members.map((m) => {
    const got = Object.entries(received[m.id]).map(([key, votes]) => {
      const res = awardResults.find((a) => a.key === key);
      return { key, short: res.short, label: res.label, emoji: res.emoji, votes, total: res.total, won: res.winners.some((w) => w.id === m.id) };
    }).sort((x, y) => Number(y.won) - Number(x.won) || y.votes / y.total - x.votes / x.total || y.votes - x.votes);
    return { id: m.id, name: m.name, answered: given.some((a) => a.member_id === m.id), titles: got, top: got[0] || null };
  });

  return {
    title, kind, noun: KINDS[kind]?.noun || 'year', storytellers: given.length, members: members.length,
    awards: awardResults, contested: contested ? contested.key : null, unanimous, rating, words: words.slice(0, 8),
    quotes, moments, people: people.filter((p) => p.top || p.answered), me: viewerId != null ? people.find((p) => p.id === viewerId) || null : null,
  };
}

export function timeLeft(ms) {
  if (ms <= 0) return 'now';
  const m = Math.round(ms / 60e3);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

export function dropText(dropAt, now = Date.now()) {
  if (!dropAt) return 'drops when everyone has answered';
  const d = new Date(dropAt);
  const days = (dropAt - now) / 86400e3;
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return days < 1 ? `drops in ${timeLeft(dropAt - now)}` : `drops ${date}`;
}
