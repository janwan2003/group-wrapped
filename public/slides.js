// Story slides drawn on a 1080×1920 canvas. The same drawing is shown in the viewer and saved as the PNG,
// so what people screenshot and what they download look identical.

export const W = 1080;
export const H = 1920;
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", "Apple Color Emoji", sans-serif';

// Each palette: background gradient, accent, text colours. Slides cycle through them.
const PALETTES = [
  { a: '#2a1a6e', b: '#6d4aff', ink: '#ffffff', soft: 'rgba(255,255,255,.72)', accent: '#c6f432', blob: '#ff4fa3' },
  { a: '#ff5a3c', b: '#ff9a3c', ink: '#1b0f2e', soft: 'rgba(27,15,46,.72)', accent: '#1b0f2e', blob: '#ffd23c' },
  { a: '#0d3b2e', b: '#13805e', ink: '#ffffff', soft: 'rgba(255,255,255,.75)', accent: '#c6f432', blob: '#3fb8ff' },
  { a: '#ff3d8b', b: '#ff7ac0', ink: '#1b0f2e', soft: 'rgba(27,15,46,.7)', accent: '#ffffff', blob: '#6d4aff' },
  { a: '#0b1d4d', b: '#2468ff', ink: '#ffffff', soft: 'rgba(255,255,255,.75)', accent: '#ffd23c', blob: '#ff5a3c' },
  { a: '#c6f432', b: '#7fe08a', ink: '#14102a', soft: 'rgba(20,16,42,.7)', accent: '#14102a', blob: '#ffffff' },
  { a: '#16122b', b: '#3a2470', ink: '#ffffff', soft: 'rgba(255,255,255,.72)', accent: '#ff9a3c', blob: '#3fb8ff' },
];

function font(px, weight = 800) { return `${weight} ${px}px ${SANS}`; }

function background(ctx, p, seed = 0) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, p.a);
  g.addColorStop(1, p.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Two soft blobs and a ring give each slide some shape without images.
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = p.blob;
  const s = seed % 4;
  const spots = [[920, 260, 330], [140, 1660, 380], [980, 1500, 260], [120, 380, 280]];
  const [x1, y1, r1] = spots[s];
  const [x2, y2, r2] = spots[(s + 1) % 4];
  ctx.beginPath(); ctx.arc(x1, y1, r1, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.16;
  ctx.beginPath(); ctx.arc(x2, y2, r2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 6;
  // The ring sits in the bottom-right corner, half off the slide, so it never crosses names or numbers.
  ctx.beginPath(); ctx.arc(W - 40 - (seed % 3) * 30, H - 70, 120, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function brand(ctx, p, title) {
  ctx.save();
  ctx.fillStyle = p.ink;
  ctx.globalAlpha = 0.85;
  ctx.font = font(34, 800);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('CREWCAP', 90, 150);
  ctx.globalAlpha = 0.65;
  ctx.font = font(34, 600);
  ctx.textAlign = 'right';
  ctx.fillText(trimTo(ctx, title, 560), W - 90, 150);
  ctx.restore();
}

function trimTo(ctx, text, maxW) {
  let t = String(text);
  if (ctx.measureText(t).width <= maxW) return t;
  const chars = Array.from(t);
  while (chars.length && ctx.measureText(chars.join('') + '…').width > maxW) chars.pop();
  return chars.join('') + '…';
}

// Break text into lines that fit maxW; words longer than a line are split by character.
function lines(ctx, text, maxW) {
  const words = String(text).split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const tryLine = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(tryLine).width <= maxW) { cur = tryLine; continue; }
    if (cur) out.push(cur);
    if (ctx.measureText(w).width <= maxW) { cur = w; continue; }
    let piece = '';
    for (const ch of Array.from(w)) {
      if (ctx.measureText(piece + ch).width > maxW) { out.push(piece); piece = ch; } else piece += ch;
    }
    cur = piece;
  }
  if (cur) out.push(cur);
  return out;
}

// Largest font size (stepping down) at which text fits in maxLines lines.
function fit(ctx, text, maxW, maxPx, minPx, maxLines, weight = 800) {
  for (let px = maxPx; px >= minPx; px -= 4) {
    ctx.font = font(px, weight);
    const ls = lines(ctx, text, maxW);
    const wordsFit = String(text).split(' ').every((w) => ctx.measureText(w).width <= maxW);
    if (ls.length <= maxLines && wordsFit) return { px, ls };
  }
  ctx.font = font(minPx, weight);
  const ls = lines(ctx, text, maxW);
  if (ls.length > maxLines) { ls.length = maxLines; ls[maxLines - 1] = trimTo(ctx, ls[maxLines - 1] + '…', maxW); }
  return { px: minPx, ls };
}

// Draw a block of text; returns the y below it.
function block(ctx, text, { x = 90, y, maxW = W - 180, max = 120, min = 40, maxLines = 3, weight = 800, color, lh = 1.08, align = 'left' }) {
  const { px, ls } = fit(ctx, text, maxW, max, min, maxLines, weight);
  ctx.font = font(px, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const ax = align === 'center' ? W / 2 : x;
  let yy = y + px;
  for (const l of ls) { ctx.fillText(l, ax, yy); yy += px * lh; }
  ctx.textAlign = 'left';
  return yy - px * lh + px * 0.35;
}

function pill(ctx, text, x, y, p, { bg = p.accent, fg = null, px = 34 } = {}) {
  ctx.font = font(px, 800);
  const w = ctx.measureText(text).width + px * 1.3;
  const h = px * 1.9;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg || (isLight(bg) ? '#14102a' : '#ffffff');
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + px * 0.65, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic';
  return w;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function isLight(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 160;
}

function kicker(ctx, text, y, p) {
  ctx.font = font(40, 800);
  ctx.fillStyle = p.soft;
  ctx.fillText(text.toUpperCase(), 90, y);
}

function footer(ctx, p, text = 'crewcap · your year, voted by your crew') {
  ctx.font = font(30, 600);
  ctx.fillStyle = p.soft;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H - 90);
  ctx.textAlign = 'left';
}

const votes = (n) => `${n} ${n === 1 ? 'vote' : 'votes'}`;
const andList = (names) => names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;

// Build the slide list for one story. `viewer` adds the personal slide.
export function buildSlides(story, { origin = '' } = {}) {
  const s = story;
  const slides = [];
  let pi = 0;
  const next = () => PALETTES[pi++ % PALETTES.length];
  const add = (alt, draw) => { const p = next(); const seed = slides.length; slides.push({ alt, draw: (ctx) => { background(ctx, p, seed); brand(ctx, p, s.title); draw(ctx, p); } }); };

  add(`${s.title}: the recap, told by ${s.storytellers} of you.`, (ctx, p) => {
    kicker(ctx, 'The recap is out', 620, p);
    let y = block(ctx, s.title, { y: 660, max: 220, min: 90, maxLines: 3, color: p.ink });
    y = block(ctx, `told by ${s.storytellers} of you`, { y: y + 30, max: 64, min: 40, maxLines: 2, weight: 700, color: p.soft });
    pill(ctx, `${s.awards.length} awards · ${s.members} people`, 90, y + 60, p);
    footer(ctx, p, 'tap to start →');
  });

  if (s.rating) {
    add(`You rated the ${s.noun} ${s.rating.avg} out of 10.`, (ctx, p) => {
      kicker(ctx, `You rated the ${s.noun}`, 560, p);
      ctx.fillStyle = p.ink;
      ctx.font = font(380, 900);
      ctx.fillText(String(s.rating.avg).replace(/\.0$/, ''), 70, 960);
      ctx.font = font(90, 800);
      ctx.fillStyle = p.soft;
      ctx.fillText('/ 10', 90, 1080);
      // Histogram 1..10
      const max = Math.max(...s.rating.hist, 1);
      const bw = 72; const gap = 18; const base = 1520; const hMax = 300;
      s.rating.hist.forEach((n, i) => {
        const x = 90 + i * (bw + gap);
        const h = n ? 24 + (n / max) * hMax : 10;
        ctx.fillStyle = n ? p.ink : p.soft;
        ctx.globalAlpha = n ? 0.95 : 0.35;
        roundRect(ctx, x, base - h, bw, h, 14); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.soft;
        ctx.font = font(32, 700);
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), x + bw / 2, base + 50);
        ctx.textAlign = 'left';
      });
      const spread = s.rating.min === s.rating.max ? `Everyone said ${s.rating.min}.` : `Lowest ${s.rating.min}, highest ${s.rating.max}.`;
      block(ctx, spread, { y: 1640, max: 48, min: 36, maxLines: 1, weight: 700, color: p.ink });
    });
  }

  for (const a of s.awards) {
    const tie = a.winners.length > 1;
    const names = a.winners.map((w) => w.name);
    add(`${a.label}: ${andList(names)}${tie ? ' (a tie)' : ''}, ${votes(a.winners[0].votes)} of ${a.total}.`, (ctx, p) => {
      ctx.font = font(200, 400);
      ctx.fillText(a.emoji, 80, 600);
      let y = block(ctx, a.label, { y: 680, max: 76, min: 48, maxLines: 3, weight: 800, color: p.soft });
      if (tie) { kicker(ctx, 'It’s a tie', y + 110, p); y += 90; }
      y = block(ctx, andList(names), { y: y + 40, max: 260, min: 80, maxLines: 3, weight: 900, color: p.ink });
      const label = s.unanimous.includes(a.key) ? `Unanimous · ${a.total} of ${a.total}` : tie ? `${votes(a.winners[0].votes)} each, of ${a.total}` : `${votes(a.winners[0].votes)} of ${a.total}`;
      pill(ctx, label, 90, y + 50, p);
      const rest = a.ranked.filter((r) => !a.winners.some((w) => w.id === r.id)).slice(0, 3);
      if (rest.length) {
        block(ctx, `Also nominated: ${rest.map((r) => `${r.name} (${r.votes})`).join(', ')}`, { y: 1580, max: 40, min: 30, maxLines: 3, weight: 600, color: p.soft, lh: 1.3 });
      }
    });
  }

  const split = s.contested ? s.awards.find((a) => a.key === s.contested) : null;
  if (split) {
    add(`The vote that split the group: ${split.label}.`, (ctx, p) => {
      kicker(ctx, 'The vote that split the group', 520, p);
      let y = block(ctx, split.label, { y: 560, max: 110, min: 60, maxLines: 3, color: p.ink });
      y += 80;
      const max = split.ranked[0].votes;
      for (const r of split.ranked.slice(0, 4)) {
        const bwMax = W - 180;
        const bw = Math.max(140, (r.votes / max) * bwMax);
        ctx.fillStyle = p.ink;
        ctx.globalAlpha = 0.16;
        roundRect(ctx, 90, y, bwMax, 120, 28); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.accent;
        roundRect(ctx, 90, y, bw, 120, 28); ctx.fill();
        ctx.fillStyle = isLight(p.accent) ? '#14102a' : '#ffffff';
        ctx.font = font(54, 800);
        ctx.textBaseline = 'middle';
        ctx.fillText(trimTo(ctx, r.name, bwMax - 260), 130, y + 62);
        ctx.fillStyle = p.ink;
        ctx.textAlign = 'right';
        ctx.fillText(String(r.votes), W - 130, y + 62);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        y += 150;
      }
      block(ctx, 'Argue about it in the chat.', { y: y + 40, max: 48, min: 36, maxLines: 1, weight: 700, color: p.soft });
    });
  }

  if (s.words.length) {
    const top = s.words[0];
    add(`Word of the ${s.noun}: ${top.word}.`, (ctx, p) => {
      kicker(ctx, `Your word of the ${s.noun}`, 620, p);
      let y = block(ctx, top.word, { y: 660, max: 240, min: 90, maxLines: 2, weight: 900, color: p.ink });
      if (top.n > 1) y = block(ctx, `said by ${top.n} of you`, { y: y + 20, max: 56, min: 40, maxLines: 1, weight: 700, color: p.soft });
      const others = s.words.slice(1, 7).map((w) => w.word);
      if (others.length) {
        let x = 90; let yy = y + 90;
        for (const w of others) {
          ctx.font = font(40, 800);
          const wpx = ctx.measureText(w).width + 52;
          if (x + wpx > W - 90) { x = 90; yy += 100; }
          if (yy > 1650) break;
          pill(ctx, w, x, yy, p, { bg: 'rgba(255,255,255,.22)', fg: p.ink, px: 40 });
          x += wpx + 20;
        }
      }
    });
  }

  if (s.quotes.length) {
    add(`Quotes of the ${s.noun}: ${s.quotes.join(' / ')}`, (ctx, p) => {
      kicker(ctx, `Quotes of the ${s.noun}`, 330, p);
      const qs = s.quotes.slice(0, 4);
      const size = qs.length === 1 ? 110 : qs.length === 2 ? 76 : 58;
      const room = (1640 - 400) / qs.length;
      let y = 400;
      qs.forEach((q) => {
        ctx.fillStyle = p.accent;
        ctx.font = font(size * 1.6, 900);
        ctx.fillText('“', 76, y + size * 1.15);
        block(ctx, q, { x: 90 + size * 0.9, y, maxW: W - 180 - size * 0.9, max: size, min: 34, maxLines: Math.max(2, Math.floor((room - 30) / (size * 1.15))), weight: 750, color: p.ink, lh: 1.15 });
        y += room;
      });
    });
  }

  if (s.moments.length) {
    add(`Best moments: ${s.moments.join(' / ')}`, (ctx, p) => {
      kicker(ctx, `Best moments of the ${s.noun}`, 330, p);
      const ms = s.moments.slice(0, 5);
      const room = (1680 - 390) / ms.length;
      let y = 390;
      ms.forEach((m, i) => {
        ctx.fillStyle = p.accent;
        ctx.font = font(72, 900);
        ctx.fillText(String(i + 1).padStart(2, '0'), 90, y + 66);
        block(ctx, m, { x: 230, y, maxW: W - 320, max: ms.length <= 2 ? 72 : 54, min: 34, maxLines: Math.max(2, Math.floor((room - 20) / 62)), weight: 750, color: p.ink, lh: 1.15 });
        y += room;
      });
    });
  }

  if (s.me && s.me.titles.length) {
    const me = s.me;
    add(`${me.name}, the group says: ${me.titles.map((t) => t.short).join(', ')}.`, (ctx, p) => {
      kicker(ctx, 'Your slide', 430, p);
      let y = block(ctx, `${me.name}, the group says you’re…`, { y: 470, max: 110, min: 64, maxLines: 3, color: p.ink });
      y += 70;
      for (const t of me.titles.slice(0, 4)) {
        ctx.font = font(84, 400);
        ctx.fillText(t.emoji, 90, y + 84);
        const yy = block(ctx, t.short, { x: 220, y, maxW: W - 310, max: 72, min: 46, maxLines: 1, weight: 850, color: p.ink });
        ctx.font = font(36, 650);
        ctx.fillStyle = p.soft;
        ctx.fillText(`${t.won ? 'Winner · ' : ''}${votes(t.votes)} of ${t.total}`, 220, yy + 34);
        y += 210;
      }
    });
  } else if (s.me) {
    add(`${s.me.name}, no awards this time.`, (ctx, p) => {
      kicker(ctx, 'Your slide', 620, p);
      let y = block(ctx, `${s.me.name}, you flew under the radar this ${s.noun}.`, { y: 660, max: 120, min: 64, maxLines: 4, color: p.ink });
      block(ctx, 'Mysterious. We respect it.', { y: y + 40, max: 56, min: 40, maxLines: 1, weight: 700, color: p.soft });
    });
  }

  const cast = s.people.filter((x) => x.top);
  if (cast.length >= 2) {
    add(`The cast: ${cast.map((c) => `${c.name}, ${c.top.short}`).join('; ')}.`, (ctx, p) => {
      kicker(ctx, 'The cast', 320, p);
      const list = cast.slice(0, 10);
      const row = Math.min(140, (1700 - 380) / list.length);
      let y = 380;
      for (const c of list) {
        ctx.font = font(row * 0.5, 400);
        ctx.fillText(c.top.emoji, 90, y + row * 0.62);
        ctx.font = font(row * 0.4, 850);
        ctx.fillStyle = p.ink;
        const nameW = Math.min(ctx.measureText(c.name).width, 380);
        ctx.fillText(trimTo(ctx, c.name, 380), 90 + row * 0.8, y + row * 0.58);
        ctx.font = font(row * 0.3, 650);
        ctx.fillStyle = p.soft;
        ctx.fillText(trimTo(ctx, c.top.short, W - 180 - row * 0.8 - nameW - 30), 90 + row * 0.8 + nameW + 30, y + row * 0.58);
        y += row;
      }
      if (cast.length > 10) block(ctx, `+ ${cast.length - 10} more`, { y: y + 10, max: 40, min: 32, maxLines: 1, weight: 700, color: p.soft });
    });
  }

  add(`That’s a wrap on ${s.title}. Make one for your other group.`, (ctx, p) => {
    kicker(ctx, 'That’s a wrap', 620, p);
    let y = block(ctx, `Got another group? Make their recap.`, { y: 660, max: 150, min: 80, maxLines: 4, color: p.ink });
    y = block(ctx, 'Family, uni friends, the team, the trip crew. Free, no app, no sign-up.', { y: y + 40, max: 54, min: 40, maxLines: 3, weight: 650, color: p.soft, lh: 1.25 });
    pill(ctx, (origin || 'crewcap').replace(/^https?:\/\//, ''), 90, y + 70, p, { px: 44 });
  });

  return slides;
}

export function renderSlide(slide, canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  slide.draw(ctx);
  return canvas;
}

export function slideBlob(slide) {
  const c = renderSlide(slide, document.createElement('canvas'));
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
