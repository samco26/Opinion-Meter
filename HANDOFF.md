# Handoff — 15 September 2026

Where Opinion Meter is up to, for whoever (or whatever) picks it up next. README.md is the specification; AGENTS.md the rules; this is the state.

## v0.4 — what changed on 15 September 2026

Built from the owner's second live test (Google search "twitter") and the owner's answers to the pipeline questions (README decisions log, 15 September).

**The classifier.** Five lists instead of four: positive, negative, neutral (a genuine middling view only), event (a reaction to one incident — never in the bar) and irrelevant (questions, facts, wishes, comparisons without a verdict, chatter). Junk that could never carry a view — timestamps, "first!", emoji, bare links, one-word comments — is dropped before sampling (`prefilter` in `analysis/prompt.ts`); the YouTube status note says how many. The bar counts everything said about the subject, business decisions and politics included; whatever the subject is, positive means they like or recommend it.

**Windows.** General standing reaches back three years (the deep HN/Bluesky search no longer goes to 2006). "Lately" covers the last 60 days and only developments about the subject itself; the model lists the event entries it rests on and the server keeps the line only when at least two are dated within the window (`analyse.ts`). Readings in memory carry a version (`gauge:2:`, `card:2:`) so a classifier change recomputes rather than serves old numbers.

**Naming.** With an AI key every result is named by the batched call (a YouTube video keeps its rule-made identity), so `x.com`, the Play and App Store listings and the query "twitter" all come back as the same X. The naming prompt asks for the current official name ("X", not "X (Formerly Twitter)"). Live check: four results and the query → one key `name:x`.

**Sources.** Reddit off (no application has succeeded); X on for the full card with a default budget of 1,000 posts a day (`X_DAILY_POST_BUDGET`, the owner's token). Bluesky signed in; memory persistent (both confirmed by `/api/health`).

**Prefetch.** When results appear, the hands ask the brain to prepare the query's card (and the first result's, when different); a finished card is held for 15 minutes (AGENTS.md rule amended) so the drawer opens at once. Cost: one full analysis (X included) per fresh search subject, whether or not anyone clicks.

**The bars.** A result's bar sits on the site-name line, beside the site's name, sized to that text (`google.ts` `siteLine`, `content.ts` `place`), showing "38% negative" but no opinion count; the count stays in the drawer. Thin evidence draws an empty outline bar (`thin` on the none state). The query's card sits beside the knowledge panel's title as a small square when the row has room, else under the subtitle, else where it was (`queryPlacement`). The tooltip hangs off the page root — Google's result containers carry transforms, which had displaced the old fixed tooltip to mid-page — and a ring animates on hover. The drawer's subject is a plain heading. Version 0.4.0 on both halves.

## Not yet verified (in order of risk)

1. **The v0.4 extension on a live page** — placement beside the site name was previewed by injecting a mock into the owner's Chrome (looked right at 952 px and 1900 px); the real bars have not been seen since the reload.
2. **The knowledge-panel square** on pages other than "twitter": the room check (`spare >= 130`) is a guess from one layout.
3. **Ads**: the page tested had none; the code path (`#tads`, `/aclk` destinations) has not been exercised live.
4. **The event bucket may be too eager**: the first "twitter" card classed 0 of 77 Hacker News entries as views (most were reactions to news). The rule now says a lasting judgement prompted by an incident is a view; watch the next readings.
5. **Cost**: prefetch + X on every fresh search subject. Fine at friend scale; revisit before any listing.

## Immediate next actions

1. **Reload the extension** from run #11's `opinion-meter-chrome` artifact (already unzipped over `extension/dist/chrome` when this handoff was written — if not, GitHub → Actions → run 11 → download → unzip) → `chrome://extensions` → Reload.
2. **Look at "twitter" and a product search** ("sony xm6") and report: bar position, square placement, hover ring, tooltip position, drawer title.
3. **Answer the junk-filter questions** (in the conversation of 15 September): minimum length, whether "I wish it had X" is negative or nothing, whether "Great app!" counts.
4. **YouTube quota increase** before any listing; **OpenAI spend cap** now.
5. **Reddit**: parked. The connector stays in the code, off.

## How the pieces talk (one paragraph)

The hands read Google's titled results and the query, the brain POSTs them to `/api/gauge` with the install token, the server names each result's subject (rules for a YouTube video, one batched AI call for the rest), merges duplicates, answers from memory or computes a lite gauge within 20 seconds, and keeps unfinished work alive for the extension to poll (`GET /api/gauge?keys=`). The brain then asks `/api/card?key=` for the query's card so it is ready. A bar appears on each named result's site-name line once its reading exists, and a card beside the knowledge panel's title (or under it, or above the results) for the query. Clicking a bar opens the drawer: an overlay framing `/embed?key=…`, which fetches `/api/card?key=` (held 15 minutes) and draws the card, the "Lately" line, opinions and evidence. `/api/config` is read on start; the memory key `config:override` changes it instantly (kill switch, selectors).

## Gotchas learned

- Bash heredocs over ~8 KB fail on this Windows machine (command-length limit); large files are written with the file tool. Perl is available for small in-place edits; escaping regex metacharacters in one-liners is error-prone — prefer the file tools, or `\Q…\E`.
- The in-app browser gets a Google CAPTCHA; the owner's own Chrome (via the Chrome connector) renders Google with the extension's bars, runs JavaScript for DOM inspection and mock placements, and reads the private GitHub repo's Actions pages — but cannot open `chrome://` pages or click Reload, and its tab group sometimes drops (call tabs_context again).
- Google's result containers (`span.V9tjod`, `div.ESMNde`, the `h3`) carry CSS transforms: anything `position:fixed` inside them is positioned relative to them. Put fixed things on the document root.
- Google Actions artifacts download as `opinion-meter-chrome (N).zip` in Downloads; pick the newest.
- The office network answers requests to `public.api.bsky.app` with a proxy 403 page; probe Bluesky only through the server's doors.
- Line endings are forced to LF by `.gitattributes`; the CRLF warnings on commit are noise.
- The old site (`Desktop/t`, what-are-people-saying.vercel.app) is untouched and still has its own pending Reddit application, whose limits do not apply to this project.
