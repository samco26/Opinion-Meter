# Handoff — 15 September 2026

Where Opinion Meter is up to, for whoever (or whatever) picks it up next. README.md is the specification; AGENTS.md the rules; this is the state.

## v0.5 — what changed on 15 September 2026 (afternoon)

Built from the owner's live test of v0.4 ("twitter": every bar empty, the eSafety bar showing X, YouTube "returned nothing") and the owner's answers on people, junk and wishes.

**A result's bar is about the site it sits beside.** X, Google Play, App Store, Wikipedia, Britannica, the eSafety Commissioner — named from a table of well-known sites (`SITES` in `subject.ts`, with the other names discussion uses) or from the label Google prints beside the favicon (the hands now send it as `site`), else from the title. Not the page's topic: the eSafety page about X is rated as the eSafety Commissioner. A YouTube video stays the video. The query's card is about what was typed. (`subject.ts` `siteSubject`, `target.ts` `resultSubject`.)

**Aliases.** Subjects carry the other names discussion uses ("Twitter" for X, "Play Store" for Google Play) from the sites table or the naming call, and every reader searches each name; "X" alone found 0 usable Hacker News entries. (`Subject.aliases`, `searchTerms` in `http.ts`, all four readers.)

**The bar reads three years at once** instead of widening from three months, and samples 120 entries; readings in memory are versioned (`gauge:3:`, `card:3:`) so this recomputes everything. Live check after deploy: eSafety Commissioner 59 opinions / 75% negative, Britannica 31 / 81% positive, Google Play 26 / 70% negative.

**People and everything else are rated** (owner's decision, reversing the 14 September rule): a person on their work and public conduct; a topic when typed as the query. Two-word praise counts; a wish for a missing feature is a negative view. (`name.ts`, `prompt.ts`, AGENTS.md, privacy page.)

**YouTube quota.** The free 10,000 units/day ran out during testing (each card and bar spent a 100-unit search). The video list for a subject is now remembered for a day so a subject costs one search, and the status note says plainly when the quota is gone (resets midnight Pacific, 5 pm Sydney). The quota-increase form is now urgent.

**The bars and the card.** The query's card is pinned to the right edge of the knowledge panel's header with no background (the row is padded so the title wraps beside it); steady glow on hover instead of a pulse; a reply-less post shows once in the evidence list. Version 0.5.0 on both halves.

## Not yet verified (in order of risk)

1. **v0.5 on a live page** — the owner had v0.4 loaded when this was written; the run-18 package is the one to load.
2. **The knowledge-panel square on other layouts** (a long title, no subtitle, a panel without `data-attrid="title"`): falls back to the old right-rail placement.
3. **X's own bar** after the reading-version bump: the first probe after deploy is in the conversation of 15 September; the bar for "X" had been thin under the old three-month window.
4. **YouTube** cannot be judged until the quota resets.
5. **Cost**: prefetch + X on every fresh search subject, plus one YouTube search per subject per day.

## Immediate next actions

1. **Load the run-18 package**: GitHub → Actions → newest green run → Artifacts → `opinion-meter-chrome` → tell the assistant (it unpacks over `extension/dist/chrome`) → Reload at `chrome://extensions`.
2. **Look at "twitter"**: bars beside every site name (X, Google Play, X, Apple, Wikipedia, Reddit, Britannica, eSafety, Facebook), the transparent square to the right of "Twitter / Social media company", the eSafety drawer about the eSafety Commissioner.
3. **YouTube quota increase** (Google Cloud Console → YouTube Data API v3 → Quotas → apply) — now, not later.
4. **OpenAI spend cap** if not already set.
5. Reddit stays parked.

## How the pieces talk (one paragraph)

The hands read Google's titled results — title, address and the site label beside the favicon — and the query; the brain POSTs them to `/api/gauge` with the install token. The server names each result's site (the sites table, the label, or the title; a YouTube video by its id) and the query's subject (one AI call, with aliases), merges duplicates, answers from memory or computes a lite gauge over three years within 20 seconds, and keeps unfinished work alive for the extension to poll (`GET /api/gauge?keys=`). The brain then asks `/api/card?key=` for the query's card so it is ready. A bar appears on each result's site-name line once its reading exists (an empty outline when too thin), and a transparent square beside the knowledge panel's title for the query. Clicking a bar opens the drawer: an overlay framing `/embed?key=…`, which fetches `/api/card?key=` (held 15 minutes) and draws the card, the "Lately" line, opinions and evidence. `/api/config` is read on start; the memory key `config:override` changes it instantly (kill switch, selectors).

## Gotchas learned

- Bash heredocs over ~8 KB fail on this Windows machine (command-length limit); large files are written with the file tool. Perl is available for small in-place edits; use `\Q…\E` around literal text.
- The in-app browser gets a Google CAPTCHA; the owner's own Chrome (via the Chrome connector) renders Google with the extension's bars, runs JavaScript for DOM inspection and mock placements, and reads the private repo's Actions pages and logs (open the job URL with `#step:N` and read the page text; a script that reads the log is blocked). It cannot open `chrome://` pages, and clicking an artifact download link only works while the owner is not using Chrome — otherwise the owner downloads it (two clicks) and the assistant unpacks it from Downloads.
- Google's result containers carry CSS transforms: anything `position:fixed` inside them is positioned relative to them. Put fixed things on the document root.
- `SEARCH_ENGINES` must be checked after the sites table: Google Play lives on google.com.
- Every new kind in `SubjectKind` needs a label in `CategoryCard.tsx` (`Record<SubjectKind, string>`), or `next build` fails on Vercel and in CI.
- The office network answers requests to `public.api.bsky.app` with a proxy 403 page; probe Bluesky only through the server's doors.
- Line endings are forced to LF by `.gitattributes`; the CRLF warnings on commit are noise.
- The old site (`Desktop/t`, what-are-people-saying.vercel.app) is untouched and still has its own pending Reddit application, whose limits do not apply to this project.
