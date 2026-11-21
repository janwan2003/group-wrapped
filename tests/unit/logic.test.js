import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS as SERVER } from '../../src/logic.js';
import { AWARDS as BROWSER, DEFAULT_AWARDS as BD } from '../../public/awards.js';
import {
  validateRecap, validateAnswer, validateName, mergeAnswer, isComplete, progress, status, compile, awardLabel, dropText, DEFAULT_AWARDS,
} from '../../src/logic.js';

const NOW = Date.UTC(2026, 10, 21, 12);

test('browser and server award lists match', () => {
  assert.deepEqual(BROWSER, SERVER);
  assert.deepEqual(BD, DEFAULT_AWARDS);
});

test('validateRecap cleans names, puts the creator first, dedupes, checks awards and date', () => {
  const r = validateRecap({ title: '  Our   2026 ', me: 'Maya', names: 'Tom, ann\nmaya,  , Ann', awards: ['mvp', 'main', 'funny', 'nope'], kind: 'year' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.value.title, 'Our 2026');
  assert.deepEqual(r.value.names, ['Maya', 'Tom', 'ann']);
  assert.deepEqual(r.value.awards, ['mvp', 'main', 'funny']);
  assert.equal(r.value.dropAt, null);
  assert.equal(validateRecap({ title: 'x', me: 'M', awards: ['mvp', 'main'] }, NOW).ok, false);
  assert.match(validateRecap({ title: '', me: 'M', awards: DEFAULT_AWARDS }, NOW).error, /title/);
  assert.match(validateRecap({ title: 'x', me: '', awards: DEFAULT_AWARDS }, NOW).error, /your own name/);
  assert.match(validateRecap({ title: 'x', me: 'M', awards: DEFAULT_AWARDS, dropAt: NOW - 1 }, NOW).error, /future/);
  assert.equal(validateRecap({ title: 'x', me: 'M', awards: DEFAULT_AWARDS, dropAt: NOW + 86400e3 }, NOW).value.dropAt, NOW + 86400e3);
  const many = Array.from({ length: 31 }, (_, i) => `P${i}`);
  assert.equal(validateRecap({ title: 'x', me: 'M', names: many, awards: DEFAULT_AWARDS }, NOW).ok, false);
  assert.equal(validateRecap({ title: 'x', me: 'M', awards: DEFAULT_AWARDS, kind: 'weird' }, NOW).value.kind, 'year');
});

test('validateName rejects duplicates case-insensitively and long names', () => {
  assert.equal(validateName('tom', ['Tom']).ok, false);
  assert.equal(validateName('A'.repeat(21), []).ok, false);
  assert.equal(validateName(' Zoë ', []).value, 'Zoë');
});

test('validateAnswer: no self votes, unknown members, rating range, text limits', () => {
  const ctx = { awards: ['mvp', 'main'], memberIds: [1, 2, 3], selfId: 1 };
  assert.equal(validateAnswer({ awards: { mvp: 1 } }, ctx).ok, false);
  assert.equal(validateAnswer({ awards: { mvp: 9 } }, ctx).ok, false);
  assert.deepEqual(validateAnswer({ awards: { mvp: 2, other: 3 } }, ctx).value, { awards: { mvp: 2 } });
  assert.equal(validateAnswer({ rating: 11 }, ctx).ok, false);
  assert.equal(validateAnswer({ rating: 7 }, ctx).value.rating, 7);
  assert.equal(validateAnswer({ quote: 'x'.repeat(141) }, ctx).ok, false);
  assert.equal(validateAnswer({ word: 'far too many words here' }, ctx).ok, false);
  assert.equal(validateAnswer({ word: '  chaotic  ' }, ctx).value.word, 'chaotic');
});

test('mergeAnswer keeps earlier answers and clears with null', () => {
  let a = mergeAnswer(null, { awards: { mvp: 2 } });
  a = mergeAnswer(a, { rating: 8, awards: { main: 3 } });
  assert.deepEqual(a.awards, { mvp: 2, main: 3 });
  a = mergeAnswer(a, { awards: { mvp: null } });
  assert.deepEqual(a.awards, { main: 3 });
  assert.equal(a.rating, 8);
});

test('isComplete and progress', () => {
  const awards = ['mvp', 'main'];
  assert.equal(isComplete({ awards: { mvp: 2 }, rating: 5 }, awards, 2), false);
  assert.equal(isComplete({ awards: { mvp: 2, main: 3 }, rating: 5 }, awards, 2), true);
  assert.equal(isComplete({ awards: {}, rating: 5 }, awards, 0), true);
  assert.equal(progress({ awards: { mvp: 2, main: 3 }, rating: 5, word: 'x', quote: '', moment: '' }, awards), 4 / 6);
});

test('status: manual drop, date drop, open', () => {
  assert.equal(status({ dropped_at: 1 }, NOW), 'dropped');
  assert.equal(status({ drop_at: NOW - 1 }, NOW), 'dropped');
  assert.equal(status({ drop_at: NOW + 1 }, NOW), 'open');
  assert.equal(status({}, NOW), 'open');
});

test('compile: winners, ties, unanimous, split, rating, words, personal slide, no voter identities', () => {
  const members = [{ id: 1, name: 'Maya' }, { id: 2, name: 'Tom' }, { id: 3, name: 'Ann' }, { id: 4, name: 'Ben' }];
  const answers = [
    { member_id: 1, awards: { mvp: 2, main: 3, late: 2 }, rating: 8, word: 'Chaotic', quote: 'Q1', moment: 'M1' },
    { member_id: 2, awards: { mvp: 3, main: 1, late: 3 }, rating: 9, word: 'chaotic!', quote: '', moment: 'M2' },
    { member_id: 3, awards: { mvp: 2, main: 1, late: 2 }, rating: 7, word: 'loud', quote: 'Q2', moment: '' },
    { member_id: 4, awards: { mvp: 2, main: 3, late: 2 }, rating: 10 },
  ];
  const s = compile({ id: 'abc', title: 'Our 2026', kind: 'year', awards: ['mvp', 'main', 'late'] }, members, answers, 2);
  assert.equal(s.storytellers, 4);
  const mvp = s.awards.find((a) => a.key === 'mvp');
  assert.deepEqual(mvp.winners.map((w) => w.name), ['Tom']);
  assert.equal(mvp.winners[0].votes, 3);
  const main = s.awards.find((a) => a.key === 'main');
  assert.deepEqual(main.winners.map((w) => w.name).sort(), ['Ann', 'Maya']);
  assert.equal(s.contested, 'main');
  assert.equal(s.rating.avg, 8.5);
  assert.equal(s.rating.hist[9], 1);
  assert.equal(s.words[0].word, 'Chaotic');
  assert.equal(s.words[0].n, 2);
  assert.equal(s.quotes.length, 2);
  assert.equal(s.me.name, 'Tom');
  assert.equal(s.me.titles[0].won, true);
  assert.equal(JSON.stringify(s).includes('member_id'), false);
  // Every member sees quotes in the same order.
  assert.deepEqual(compile({ id: 'abc', title: 'x', kind: 'year', awards: ['mvp'] }, members, answers).quotes, s.quotes);
});

test('compile with all votes for one person marks unanimous', () => {
  const members = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }, { id: 4, name: 'D' }];
  const answers = [1, 3, 4].map((m) => ({ member_id: m, awards: { mvp: 2 }, rating: 5 }));
  const s = compile({ id: 'x', title: 't', kind: 'trip', awards: ['mvp', 'main'] }, members, answers);
  assert.deepEqual(s.unanimous, ['mvp']);
  assert.equal(s.awards.length, 1);
  assert.equal(s.awards[0].label, 'MVP of the trip');
  assert.equal(s.contested, null);
});

test('awardLabel and dropText', () => {
  assert.equal(awardLabel('mvp', 'season'), 'MVP of the season');
  assert.equal(awardLabel('main', 'trip'), 'Main character');
  assert.equal(dropText(null, NOW), 'drops when everyone has answered');
  assert.equal(dropText(NOW + 3 * 3600e3, NOW), 'drops in 3 h');
  assert.equal(dropText(Date.UTC(2026, 11, 31, 12), NOW), 'drops 31 Dec');
});
