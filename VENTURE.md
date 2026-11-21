---
slug: group-wrapped
stage: idea
priority: 4
url:
repo:
updated: 2026-11-21
---

# group-wrapped

## Thesis

**Who:** Friend groups, uni friends, sports teams, office teams, cousins and families, from teens to
parents. Anyone who opens Spotify Wrapped in December and wishes their friend group had one.

**What:** A no-login "Wrapped" for a group, made by the group. One person starts "Our 2026 Wrapped"
and sends the link to the group chat. Each member opens it and answers 8–10 quick prompts about the
group's year, mostly taps: vote the member for awards ("MVP of 2026", "Main character",
"Most likely to be late, again"), pick the best night from a list the group builds, type the quote of
the year and the word that sums up the year, and guess one number ("how many times did we cancel
plans?"). Nothing is shown until the reveal. On the reveal date (the creator picks it, default the day
everyone has answered or 31 December), everyone gets the same Wrapped-style story: 10 full-screen
slides of awards, the top quote, the group's word, the "biggest disagreement" (the vote that split
the group most), and a personal slide per member ("You were voted Main Character by 5 of 8").
It also runs for any shorter event: "Trip Wrapped", "Wedding Wrapped", "Season Wrapped" for a team.

**Needs others:** yes. Every slide is made from other members' answers. A one-person Wrapped is
empty, unlike chat-export analysers, which one person can run alone.

**Viral moment:** the slides. Wrapped slides are among the most screenshotted formats on the
internet (500M Spotify shares in a day, below), and each member gets a personal slide about
themselves, which people post to their stories. The link preview shows "Our 2026 Wrapped · 6 of 9
have answered · drops 28 Dec".

**How often:** yearly peak in December (the next 6 weeks are the season: Spotify Wrapped lands in
early December, then New Year's Eve), then per event (every trip, wedding, team season, end of a
school year). A person is in several groups (family, school friends, work, team), so one person has
3–5 reasons to start one each December.

**Why now:** the format is at its peak (Spotify Wrapped 2025 hit 200M engaged users in about 24 hours
per Spotify) and the "X Wrapped" meme spread to dating, school and gym recaps on TikTok. What exists
for groups is either a chat-export analyser (upload your WhatsApp history: a privacy problem, and only
message stats) or a design template someone fills in by hand.

### The six questions

1. **Why the group IS the input:** awards are votes, quotes and best nights are what members typed;
   the story literally cannot render until others answer.
2. **Reveal moment:** the drop date; everyone opens the same story at the same time, and the personal
   slide ("what the group said about you") is the reason to come back.
3. **Ritual or deadline:** December, a fixed drop date with a countdown; plus every trip or season end.
4. **30-second join:** open link → nickname → 8 taps and 2 short texts (about 2 minutes, but answering
   the first prompt takes 10 seconds and the rest can be done later). No account.
5. **Screenshot-worthy result:** the story slides in 9:16, each one designed to stand alone, plus a
   summary card for the group chat.
6. **Why a joiner creates their own:** everyone is in more than one group; the last slide says "Make
   one for your other group" and pre-fills the template. In December the timing makes this obvious.

## Market evidence

Searches run 2026-11-21. Sources are search-result summaries, not opened pages, unless noted.

- **The format is huge:** Spotify says Wrapped 2025 reached 200M engaged users in about 24 hours (+19%
  year on year) and more than 500M shares in the first day, where a "share" includes screenshots
  ([TechCrunch](https://techcrunch.com/2025/12/04/spotify-says-wrapped-2025-is-its-biggest-yet-with-200m-users-in-its-first-day),
  [Music Business Worldwide](https://www.musicbusinessworldwide.com/spotify-wrapped-campaign-hit-200m-engaged-users-in-24-hours-a-19-yoy-increase)).
  These are Spotify's own figures.
- **People make their own "Wrapped" for non-Spotify life:** TikTok's "Dating Wrapped" trend (December
  2022) passed 116M views and spawned "High-School Wrapped", "Gym Wrapped" and others
  ([Glam](https://glam.com/1139154/the-dating-wrapped-trend-on-tiktok-explained),
  [NBC News](https://www.nbcnews.com/news/us-news/dating-spotify-wrapped-tiktok-rcna60972),
  [Know Your Meme](https://amp.knowyourmeme.com/memes/dating-wrapped)).
- **Group recaps exist, but they analyse a chat export (solo, privacy-heavy):** ZapZipped, "AI-powered
  WhatsApp Wrapped for your group chats", Product Hunt launch 2025-12-27, works from an uploaded .txt
  export or a WhatsApp bot ([Product Hunt](https://www.producthunt.com/p/zapzipped/zapzipped-3),
  [Software Advice](https://www.softwareadvice.com.au/software/643016/ZapZipped)); iOS apps
  [Wrapp: Chat Recap](https://apps.apple.com/us/app/-/id6745177108),
  [WRecap](https://apps.apple.com/us/app/-/id6740490199),
  [2025 Recap for WhatsApp](https://apps.apple.com/us/app/-/id6755372717). Weakness: one person uploads
  everyone's private messages, and the output is message counts, not what friends think of each other.
- **Other group recaps are tied to one app:** Snapchat's year-end recap covers group chats
  ([Tubefilter](https://www.tubefilter.com/2025/12/16/snapchat-year-end-recap-2025-bitmoji-6-7/amp/));
  the friend-planning app Howbout does a "Wrapped" of time spent with friends
  ([Howbout blog](https://howbout.app/blog/howbout-moments/howbout-wrapped-2025-is-here-/)). Both need
  everyone on that app.
- **How people do it now:** design templates filled in by hand: Miro "Your Year Wrapped" and
  "Team Wrapped" boards ([Miro](https://miro.com/templates/team-wrapped-year-template/)), CapCut
  recap templates ([CapCut](https://www.capcut.com/explore/2025-wrapped)), or a printed friendship
  yearbook ([Mixbook example](https://www.mixbook.com/inspiration/luan-nguyen-custom-friendship-yearbook)).
  One person does all the work, and nobody else contributes.
- **Gap:** I found no search-volume figure for "friend group wrapped" and no trend by that exact name;
  the demand evidence is the format's size and the hand-made versions.

## Our edge

- **Loop: needs others.**
- **K estimate ≈ 1.6** = 8 invited per group × 65% who answer (the personal slide about *you* is a strong
  pull) × 30% who start one for another group. Reason: in December each person has 3–5 groups, and the
  last slide is a ready "make one for your other group". Weakest factor: it is seasonal; outside
  December K falls well below 1 unless the trip/event mode carries it.
- **Boundary with most-likely-vote:** that is a daily one-question vote; this is a once-a-season
  compiled story with mixed inputs (awards, quotes, best moments, guesses) and a single drop. The award
  prompts can reuse its kind-but-teasing question rules.
- Beats chat-export analysers on privacy (nothing uploaded) and on the social payload (what friends
  said about you); beats templates because everyone contributes and no one designs anything.
- **Risks:** hard deadline. Worth building only if live by ~2026-12-05 for this season; otherwise
  launch as "Trip Wrapped" and save December for 2027. Awards must be preset and kind (no free-text
  awards about a person).

## Status

Idea only. Nothing built. Evidence above from web search on 2026-11-21.

## Next steps

1. Decide go/no-go for December 2026 with the operator: it needs to be live by ~2026-12-05.
2. Write the prompt set (10 award prompts, quote, word, best-night list, one number guess) and design the
   10 slides at 1080×1920; slides are the product.
3. Build on Cloudflare Pages + Functions + D1 (`pb-group-wrapped`); render slides client-side to PNG
   (no R2 needed); dynamic OG preview with answer count and drop date.
4. Playwright end-to-end test: create → 4 members answer → drop → slides render and download.
5. Add "Trip Wrapped" and "Season Wrapped" templates for the rest of the year.

## Monetization plan

None now (rule 4). Later: premium slide themes or a printed keepsake (the Mixbook-style yearbook) once
the operator can take money.

## Log

- 2026-11-21 scout: created from scouting session; evidence from web search (search-result summaries,
  pages not opened). Not built.
