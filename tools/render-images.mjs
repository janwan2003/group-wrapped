// Renders public/og.png (1200x630) and the PNG app icons. Needs the dev server (BASE) so slides.js can load.
// Usage: BASE=http://127.0.0.1:8961 node tools/render-images.mjs
import { launch } from './browser.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const BASE = process.env.BASE || 'http://127.0.0.1:8961';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`${BASE}/about`);
await page.evaluate(async () => {
  const { buildSlides, renderSlide } = await import('/slides.js');
  const demo = {
    title: 'Our 2026', kind: 'year', noun: 'year', storytellers: 7, members: 8, unanimous: [], contested: null,
    rating: { avg: 8.4, count: 7, min: 6, max: 10, hist: [0, 0, 0, 0, 0, 1, 1, 2, 2, 1] },
    awards: [{ key: 'main', label: 'Main character', short: 'Main character', emoji: '🎬', total: 7, winners: [{ id: 1, name: 'Maya', votes: 5 }], ranked: [] },
      { key: 'late', label: 'Always fashionably late', short: 'Always late', emoji: '⏰', total: 7, winners: [{ id: 2, name: 'Tom', votes: 6 }], ranked: [] }],
    words: [{ word: 'Chaotic', n: 3 }, { word: 'Iconic', n: 1 }], quotes: [], moments: [], people: [], me: null,
  };
  const slides = buildSlides(demo, { origin: location.origin });
  document.head.innerHTML = '<link rel="stylesheet" href="/app.css">';
  document.body.innerHTML = `<div style="width:1200px;height:630px;background:#fff8ef;display:flex;align-items:center;gap:36px;padding:0 48px;box-sizing:border-box;overflow:hidden">
    <div style="flex:0 0 550px"><div class="brand" style="font-size:2rem;margin-bottom:26px"><span data-logo style="width:54px;height:54px"></span>Crewcap</div>
    <div style="font:850 50px/1.08 system-ui;letter-spacing:-.03em;color:#16122b">Your group’s year,<br>voted by <span class="hl">your&nbsp;group.</span></div>
    <div style="font:600 26px system-ui;color:#3b3557;margin-top:22px">One link · everyone votes · the story drops for all of you</div></div>
    <div id="cards" style="display:flex;gap:12px;align-items:center;flex:0 0 auto"></div></div>`;
  const { LOGO } = await import('/common.js');
  document.querySelector('[data-logo]').innerHTML = LOGO;
  document.querySelector('[data-logo] svg').style.cssText = 'width:54px;height:54px';
  [2, 1, 3].forEach((i, n) => {
    const c = document.createElement('canvas');
    renderSlide(slides[i], c);
    c.style.cssText = `width:${n === 1 ? 190 : 160}px;height:auto;border-radius:16px;box-shadow:0 20px 40px -20px rgba(22,18,43,.6);transform:rotate(${[-4, 0, 4][n]}deg)`;
    document.getElementById('cards').append(c);
  });
  await document.fonts.ready;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${root}public/og.png` });
const svg = readFileSync(`${root}public/icon.svg`, 'utf8');
for (const size of [180, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: `${root}public/icon-${size}.png` });
}
await browser.close();
console.log('rendered og.png, icon-180.png, icon-512.png');
