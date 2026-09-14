# Handoff — 15 September 2026

Where Opinion Meter is up to, for whoever (or whatever) picks it up next. README.md is the specification; AGENTS.md the rules; this is the state.

## v0.3 — what changed on 15 September 2026

Built from the owner's first live test (Google search "youtube" in Chrome, 14 September).

**What a result's bar is about.** A result names the thing its page represents: rules first (shops, film sites, app stores, GitHub, a YouTube video by its ID, a site's front page — `youtube.com` is "YouTube"), then one batched AI call for the rest (a review page names its product; a how-to page names nothing). The query and a result about the same thing share one reading. Only without an AI key does an unnamed page fall back to the old page-then-website reading. (`server/src/lib/subject.ts`, `target.ts`, `gauge.ts`, `card-context.ts`.)

**General standing, not the news.** The summary and the bar's sentence describe how people regard the subject over time and may not hinge on an incident the reader has no context for. A new `recent` line ("Lately …") carries a notable recent development when the newest entries show one, with roughly when it happened; otherwise it is empty. Momentary "is it down?" reports are classified irrelevant. (`analysis/prompt.ts`, `lite.ts`, `analyse.ts`; `Card.recent` in `types.ts`.)

**Every platform gets its share.** The sample the model reads now takes turns across platforms and caps any one thread at two fifths, so 2,000 Hacker News entries can no longer crowd YouTube down to three comments. Search windows widen platform by platform (a platform stops at 25 opinions; the others keep going). (`prompt.ts` `sample()`, `sources/adaptive.ts`.)

**More from each platform.** YouTube: up to 20 videos, 100 most-relevant comments each (200 for the full card), the newest when a page came back short, a linked video's own comments five pages deep; videos with comments turned off are counted, not reported as refusals. Hacker News quick pass: 15 stories × 30 comments; website subjects search by address. Bluesky: most-liked and newest, `lang=en`, up to five pages for the card, and an optional signed-in session (`BLUESKY_IDENTIFIER` + `BLUESKY_APP_PASSWORD`) because the public search door refused the server's requests ("Access was refused" in the live card). Every outgoing request now carries a User-Agent. (`sources/youtube.ts`, `hn.ts`, `bluesky.ts`, `http.ts`, `.env.example`.)

**The bars.** A result's bar sits inside the title, right after its last word, with the bar plus "42% positive · 43 opinions"; 14 px tall; fades in; invisible until a reading exists (no placeholders, so nothing is drawn over knowledge-panel images or untitled links). Colours adapt to Google's dark theme. The tooltip is fixed to the viewport, beside the button rather than inside it, so no clipped or transformed ancestor can cut or flip it. (`extension/src/ui.ts`, `content.ts`, `google.ts`.)

**The drawer.** No "opinions about this specific page / open page" line; the "Lately" line under the summary; the three percentages under the bar and in every platform legend; a quiet rounded scrollbar; fades on everything pressable. (`components/Answer.tsx`, `SentimentBar.tsx`, `Embed.tsx`, `globals.css`.)

**Browsers.** One Chrome package for Chrome, Edge, Brave, Opera, Vivaldi and Arc; the Firefox package now declares its host permissions so Firefox can grant them (desktop and Android). Safari is documented as needing a Mac. Messages to a sleeping brain are retried. (`extension/build.mjs`, `shared.ts`, `extension/README.md`.)

Version 0.3.0 on both halves; `/api/health` reports it and whether Bluesky is signed in.

## Not yet verified (in order of risk)

1. **This commit's CI run** — typecheck, build and 20 tests. Nothing has run locally (no Node on the owner's machines).
2. **The bar inside Google's title element** on a live results page: written against `a[href]:has(h3)`; a clamped or single-line title could hide the bar on very long titles.
3. **Bluesky live**: still refused until the app password is set on Vercel; with it set, the signed-in path has only been reasoned through, not run.
4. **The `recent` line**: the model may over-use it; tune with the owner's answers to the pipeline questions.
5. **YouTube quota**: about 150–200 units per fresh subject now; the free 10,000/day covers roughly 50–65 fresh subjects. Request a quota increase before any public listing.

## Immediate next actions

1. **Connect the memory.** `/api/health` still says `"memory":{"persistent":false}`. Without Upstash every Vercel instance forgets: the same search gives different numbers each time (42% then 65% for YouTube in one afternoon) and polls for pending readings miss. Vercel → Storage → Upstash Redis (Marketplace) → connect to the project → redeploy.
2. **Sign Bluesky in.** Create an app password in Bluesky (Settings → Privacy and security → App passwords) and set `BLUESKY_IDENTIFIER` (the handle) and `BLUESKY_APP_PASSWORD` on Vercel; redeploy. Then `/api/health` shows `blueskyLogin: true`.
3. **Reload the extension** from this run's `opinion-meter-chrome` artifact: unzip over `extension/dist/chrome`, then the Reload arrow on the card at `chrome://extensions`.
4. **Settle the pipeline questions** (asked in the conversation of 15 September; to be recorded in README section 18 once answered): what the bar measures for a company versus a product, how far back "general" reaches, when "Lately" is allowed, tone and length, and how thin evidence is shown.
5. **Keys and caps** as before: a hard monthly spend cap in the OpenAI dashboard; the YouTube quota increase.
6. **The new Reddit application**: draft from README section 10; mention the earlier ticket; register the app at reddit.com/prefs/apps first for the client id.

## How the pieces talk (one paragraph)

The hands read Google's titled results and the query, the brain POSTs them to `/api/gauge` with the install token, the server names each result's subject (rules first, one batched AI call for the rest), merges duplicates, answers from memory or computes a lite gauge within 20 seconds, and keeps unfinished work alive for the extension to poll (`GET /api/gauge?keys=`). A bar appears beside each named result's title once its reading exists, and one card above the results (or the reference column) for the query. Clicking a bar opens the drawer: an overlay framing `/embed?key=…`, which fetches `/api/card?key=` (full analysis; X only here) and draws the card, the "Lately" line, opinions and evidence. `/api/config` is read on start; the memory key `config:override` changes it instantly (kill switch, selectors).

## Gotchas learned

- Bash heredocs over ~8 KB fail on this Windows machine (command-length limit); large files are written with the file tool. Perl is available for small in-place edits; escaping regex metacharacters in one-liners is error-prone — prefer the file tools.
- The in-app browser gets a Google CAPTCHA; the owner's own Chrome (via the Chrome connector) can read the private GitHub repo's Actions pages and shows the extension's bars on Google, but cannot open `chrome://` pages or click Reload — the owner does that.
- The office network answers requests to `public.api.bsky.app` with a proxy 403 page, so Bluesky cannot be probed from the owner's machine; probe through the server's doors instead.
- Line endings are forced to LF by `.gitattributes`; the CRLF warnings on commit are noise.
- The old site (`Desktop/t`, what-are-people-saying.vercel.app) is untouched and still has its own pending Reddit application, whose limits do not apply to this project.
