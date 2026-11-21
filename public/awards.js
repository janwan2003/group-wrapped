// Award list for the browser (mirrors src/logic.js AWARDS; tests/unit checks they match).
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
export const NOUNS = { year: 'year', trip: 'trip', season: 'season', event: 'night' };
export const awardLabel = (a, kind) => a.label.replace(/of the year/, `of the ${NOUNS[kind] || 'year'}`);
