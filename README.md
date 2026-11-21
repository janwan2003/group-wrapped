# Crewcap

Your friend group's year in review, voted by the group. One person starts a recap and shares the link; everyone taps
their name, votes the awards (MVP, main character, always late…), rates the year and adds a quote, a word and a best
moment. When everyone has answered (or on the reveal day) the story drops for all of them: full-screen 1080×1920 slides,
including one about each person. No app, no account.

Live: https://pb-group-wrapped.jan-bef.workers.dev · Product page: https://janwan2003.github.io/group-wrapped/

- `src/` Cloudflare Worker + Durable Objects (one SQLite-backed object per recap, per-IP rate limits)
- `public/` the site; `public/slides.js` draws the story slides on a canvas
- `tests/unit` (`node --test tests/unit/*.test.js`), `tests/e2e/run.mjs` (Playwright, real Chromium)
- `docs/` GitHub Pages product, privacy and support page
