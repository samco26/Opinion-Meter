# Opinion Meter

The product and the repository (`samco26/Opinion-Meter`) are called Opinion Meter. The earlier search site, What People Think, is a separate project whose engine this one salvages.

A browser extension that shows, beside anything you are about to click, what people actually think of it: a small bar, how many voices, one sentence — and the full picture on click.

### Current behaviour — 15 September 2026, v0.3

The main card summarises opinion about the **search query**. A result's bar is about **the thing its page represents** — a product, a service, a film, an app, a company, a site's front page, a video, an article — as people regard it over time, named by rules where a site's address carries the identity and by one batched AI call otherwise. The query and a result about the same thing share one reading (the `youtube.com` result and the query "youtube" are both YouTube). A page about nothing in particular (a how-to, a login page) gets no bar. Only without an AI key does an unnamed page fall back to a reading of the page itself, then its website.

Summaries and the bar's sentence describe the subject's **general standing**, never the news of the moment; a separate **"Lately"** line appears only when the newest entries show a notable recent development, with roughly when it happened. Momentary "is it down?" reports do not count as opinions. The sample the model reads takes turns across platforms and caps any single thread, so one busy platform or one outage thread cannot drown the rest; search windows widen platform by platform.

Result bars sit inside the title, right after its last word, with "42% positive · 43 opinions", fade in, adapt to Google's dark theme, and are invisible until a reading exists — no placeholders, nothing drawn over images or untitled links. The tooltip is fixed to the viewport. The drawer shows the three percentages under the bar, a "Lately" line when there is one, a quiet scrollbar and fades; the "specific page / open page" line is gone. One Chrome package serves Chrome, Edge, Brave, Opera, Vivaldi and Arc; the Firefox package declares its host permissions.

Previously (v0.2, 14 September): result bars measured the exact linked page with a labelled website fallback and never borrowed the query's sentiment; result controls were bare bars with placeholders while loading.

The hands cover organic headings, sponsored results, product tiles and AI Overview references. Result controls are bare bars, with counts and scope on hover/focus; unavailable readings are neutral outlines. The main card has no summary subtext. It sits above the right-hand reference column when one can be recognised, otherwise above the main results. Dynamic results are processed in bounded batches, including repeated destinations and results after the first batch.

The drawer preserves the earlier site's summary, category sentiment score, platform buttons, recurring opinions and linked original excerpts. It is created and fetches the full analysis **only on click**, with no prefetch or background full-card analysis. Its frosted background blurs the underlying Google page; its height follows the content up to the viewport limit. Original query/result context recovers a lost subject on another server instance. Full cards containing excerpts are not cached; gauges and subject identities last at most 24 hours.

Expanded readings search all available indexed dates on Hacker News and Bluesky. Hacker News requests up to 1,000 matches and reads up to 1,000 comments per reading, including comment-text searches. Bluesky uses its maximum 100 posts per page and follows up to ten cursor pages. Both retain partial results on timeouts and disclose limits; this does not guarantee every historical post. See [Bluesky's API contract](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/searchPosts.json) and [Algolia's pagination limit](https://www.algolia.com/doc/api-reference/api-parameters/paginationLimitedTo). The AI still classifies a bounded sample (60 for a bar, 250 for a full card); collected counts and analysed counts are distinct.

Production server: **https://opinionmeter.vercel.app**. The owner's `CHATGPT` and `YOUTUBE` environment variables take precedence over `OPENAI_API_KEY` and `YOUTUBE_API_KEY`. `/api/health` reports configuration booleans, never key values. Adding keys requires a new deployment. Existing estimates are recomputed after AI is connected. Shared Upstash memory is still needed for reliable polling and global limits across Vercel instances.

This document is the specification. It is written for a reader with no computer-science background and doubles as the brief for anyone (or any AI assistant) working in this repository. Read it before changing anything.

---

## 1. The concept

You are about to click a Google result, buy a thing, watch a film, install an app. The crowd's verdict on it already exists, scattered across Reddit threads, X posts, YouTube comments, Hacker News and Bluesky. Nobody gathers it at the moment you need it.

The extension does. On a Google results page, any result that is about a **named thing** (a product, a film, an app, a place, a company) or an **article people are discussing** gets a small bar beside it:

- the split of opinion (positive / mixed / negative), counted from real classifications, never guessed;
- how many opinions were read;
- on hover, one sentence in plain words;
- on click, the **drawer**: the full card with the summary, the split, the recurring opinions and links to the actual posts.

When nobody is talking about something, nothing is drawn. Silence is part of the product.

Version 1 does Google results only. YouTube pages, news articles and eventually every page follow the same design and add one small "skill" each; see the roadmap.

## 2. Principles (not negotiable)

1. **Honest numbers.** Every percentage is counted from per-opinion classifications, weighted by reactions on a log scale. Fewer than eight on-topic opinions means no verdict. The count is always visible. A positive result is not the same as strong agreement, and the card says which it is.
2. **Silence when thin.** No bar is better than a misleading one. Utility pages, unknown subjects and thin samples get nothing.
3. **Anything named is a subject.** Products, media, apps, places, companies, articles, topics and people. A person is read on their work and public conduct, never their private life. (Decided 15 September 2026, reversing the 14 September rule that people were off-limits.)
4. **Nothing stored that isn't ours.** The server keeps only derived things — counts, the summary sentence, links — for at most 24 hours. Verbatim excerpts are fetched live when a reader opens the drawer, so a post deleted on its platform disappears from the product at once.
5. **Official doors only.** Every platform is read through its official API within its published limits. No scraping of platform websites. Facebook, Instagram and TikTok offer no such door and are therefore not sources.
6. **The extension stays dumb.** Keys, thinking and memory live on the server. The extension sees the page, asks, and draws. Improving the analysis never requires a store re-review.
7. **Least privilege.** The extension asks the browser only for the sites it needs (Google search pages in v1) and sends the server only what it needs (result titles and addresses from those pages, nothing else). What is sent is stated on the privacy page in the same words.
8. **Attribution.** Every opinion shown links back to the thread it came from, with the platform named.

## 3. Plain-words glossary

| Word | Meaning here |
|---|---|
| **Server** | An always-on computer that every copy of the extension can phone. It holds the keys, does the thinking and keeps the memory. Rented from Vercel; any equivalent host would do. Nobody "visits" it. |
| **Door** | An address on the server that a program can knock on with a question and get an answer (an API route). |
| **Memory** | A small database attached to the server holding recent answers so that one answer serves everyone (a cache). |
| **Extension** | The small app a reader installs from the store. It is the front half; the server is the back half — the way the Google Maps app is small because the map lives on Google's computers. |
| **Label** | The extension's manifest file: its name, version, which sites it may touch, what it is allowed to do. The store reads this most carefully. |
| **Hands** | The content script: the part of the extension that runs on a page, reads it and draws the bars. Each surface (Google, later YouTube, articles) is one skill of the hands. |
| **Brain** | The background service worker: the part that talks to the server and hands answers back. It runs inside the reader's browser, not on a server. |
| **Drawer** | The panel that opens over part of the results page when a bar is clicked. It frames the server's embed page, so the full card, the platform evidence and the opinions are drawn by the server and never need a store update. The same behaviour on every browser (Safari has no side panel). |
| **Subject** | The thing an opinion is about, named canonically ("Sony WH-1000XM6", not `amazon.com/dp/B0…`). |
| **Gauge** | The quick answer for the bar: split, count, one sentence. |
| **Card** | The full answer: summary, split, recurring opinions with counts, evidence links. |
| **Store** | The Chrome Web Store (and later Firefox Add-ons, Safari): the only way ordinary readers can install an extension. |

## 4. How it works

### 4.1 Where the pieces live

```
GitHub (this repository: server/ and extension/)
  |
  |-- push ---------> Vercel -- runs the server: doors, embed page, memory
  |                     |
  |                     '-- calls --> Reddit, YouTube, Hacker News, Bluesky, OpenAI
  |
  '-- zip, upload ---> Chrome Web Store -- reviews, then installs into readers' browsers
                                                |
                          A reader's browser     v
                          +------------------------------------+
                          | Hands   reads Google's results page |
                          | Brain   asks the server  <----------+----> Vercel
                          | Drawer  shows the card              |
                          +------------------------------------+
```

Two halves. The server half updates itself every time code is pushed to GitHub. The extension half only changes when a new zip goes through the store, which is why the extension is kept as small and dumb as possible.

### 4.2 A Google search, step by step

1. The reader searches. Google builds its results page as always; Google's computers are never involved in what follows and never know.
2. The label says "on Google search pages, run the hands", so the browser starts them.
3. The hands pick out the result links — title and address of each — and the query itself.
4. The hands bundle those and pass them to the brain, which sends one message to the server's gauge door: "ten results for *sony xm6 review*; what do people think of each?"
5. The server names the subject behind each result (section 4.3), merges duplicates (six of ten results about the same headphones are one subject), and checks its memory.
6. Known readings come straight from memory. New readings get a quick **lite gauge**. The full card is computed only when clicked.
7. The server replies with a short list: result 1 → 72% positive, 340 opinions, one sentence; result 2 → same subject; result 4 → nothing found.
8. The hands draw a bar beside each result that has one, inside a protected bubble (Shadow DOM) so Google's own styling cannot disturb it. Hover shows the sentence. Click opens the drawer with the card.
9. When Google swaps results without reloading, or the reader moves to page two, the hands notice and repeat from step 3.

Readers see bars about a second after the results for anything already in memory. The first person to hit a brand-new subject sees the lite gauge quickly and the full card on their next visit.

### 4.3 How a verdict is made

**Naming the subject.** AI names the subject of the main query. Each result names the thing its page represents: rules first (a shop's product page → the product; IMDb → the film; an app store → the app; GitHub → the tool; a YouTube address → that video; a site's front page → the site), then one batched AI call for the rest (a review names its product; a news story names the article, found by link; a person is named as publicly known; a how-to page or a page about nothing names nothing, though a how-to typed as the query is a topic and gets a reading). Tracking variants of an address share a reading. Without an AI key an unnamed page falls back to a reading of the page, then of its website.

**General versus recent.** The summary and the bar's sentence describe how people regard the subject over time and never hinge on an incident the reader has no context for. When the newest entries show a notable recent development — an outage, a redesign, a controversy, a price change — one "Lately" sentence names it with roughly when it happened; otherwise nothing. A bare report that something is down right now is not an opinion of it.

**A fair sample.** The model reads a bounded sample taken in turns from each platform's most-reacted-to opinions, with no single thread allowed more than two fifths of the places, so a platform with thousands of entries cannot crowd out one with dozens. Search windows widen platform by platform until each has about 25 opinions or runs out of history.

**Finding the discussion.** By name on Reddit, YouTube, Hacker News and Bluesky; by link where the subject is an article or a video (Reddit's `url:` search, Hacker News's URL search, Bluesky's URL filter). Search windows widen from 3 to 12 to 36 months until enough is found. A bounded sample: at most a fixed number of threads per platform and comments per thread.

**Two tiers.**

| Tier | When | What it reads | Model | Cost |
|---|---|---|---|---|
| Lite gauge | for the bar, on first sight | counts, reaction scores, the top comments | a small, cheap model | a fraction of a cent |
| Full card | only on click | the full bounded sample | a capable model | a few cents |

**Counting.** The model classifies each opinion (positive / neutral / negative, on-topic or not). The split is counted from those classifications, weighted by reactions on a log scale. Fewer than eight on-topic opinions → "not enough to say", drawn as a grey bar or nothing. A confidence level with a one-line reason travels with every answer.

**Articles (from v3).** For a news story, "negative" means nothing on a story about a flood. The classification becomes stance toward the article — agrees with it, disputes it, reacting to the event, off-topic — and the bar is labelled "how people are reacting".

**Memory.** Each answer is kept for 24 hours, keyed by subject; served stale while a refresh runs in the background. Only derived data is stored (section 2, principle 4).

## 5. Components

| Component | What it is | Why it is needed | Cost |
|---|---|---|---|
| **GitHub repository** | This one: `server/` and `extension/` | Where the code lives; pushing deploys the server | Free |
| **Server on Vercel** | A small Next.js project: the gauge door, the card door, the embed page, a config door, a scheduled job | Holds the keys, does the thinking, remembers answers | Free tier; Pro (~$20/mo) at scale |
| **Memory** | Upstash Redis (via Vercel Marketplace) or Vercel KV | Answer once, serve everyone; keeps cost and platform usage down | Free tier |
| **AI key** | OpenAI API key; a small model for lite gauges and subject naming, a capable one for cards | Names subjects, classifies opinions, writes the sentence | Pay per use; cents per new subject |
| **Source access** | YouTube Data API key (exists); Hacker News and Bluesky need none; a **new** Reddit application (section 10); X optional and paid | Where the opinions come from | Free for v1 |
| **The extension** | Label, hands (Google skill), brain, drawer, icons; plain TypeScript bundled by esbuild with a small build script that writes a Chrome and a Firefox package from one source | The thing readers install | Free |
| **Config door and kill switch** | A small settings file the extension fetches on start: enabled/disabled per surface, current Google page selectors, request limits | Turn things off or patch selectors without a store update when Google changes its page | Free |
| **Per-install token and limits** | A random token made on first run, stored in the extension, sent with every request; the server limits per token, per address and per day | Stops someone scripting the doors to burn the AI budget | Free |
| **Spend caps** | Hard monthly limits in the OpenAI dashboard (and X's, if used) | A surprise becomes an outage, not a bill | Free |
| **Golden set** | Fifty subjects with hand-checked verdict ranges in `server/golden/` | Every change to the analysis is run against them before it ships | Free |
| **Scheduled job** | A Vercel Cron that pre-answers trending subjects nightly | Makes most lookups instant | Free |
| **Privacy page** | One page on the server saying exactly what the extension sends | Required by the store; owed to readers | Free |
| **Chrome Web Store account** | Developer registration; a listing with icon, screenshots, description; *unlisted* first | The only way ordinary people can install it | $5 once |
| **Domain** (optional) | A real name instead of `…vercel.app` | Looks legitimate in the listing and on the privacy page | ~$10/yr |

Out-of-pocket for v1: $5 plus AI usage (a few dollars a month at friend scale).

## 6. Sources

| Platform | Search by name | Search by link | Access | Notes |
|---|---|---|---|---|
| Reddit | yes | yes (`url:` in search) | **off** — no application has succeeded yet | Would be the best source for products and news. The connector is written and dormant; it returns when an application is approved. |
| YouTube | yes (costly) | a video's own comments by ID | existing key | A search costs 100 quota units of a 10,000/day free quota; reading a known video's comments costs 1. Request a quota increase before launch and prefer by-ID reads. |
| Hacker News | yes | yes | free, no key | Excellent for tech and business. |
| Bluesky | yes | yes | free, no key | Growing news audience. |
| X | yes | yes (`url:` operator) | paid, about half a cent per post read; the owner's token is connected | Read only for the full card (on click or the prefetch of the query's card), at most 20 posts per subject, with a default budget of 1,000 posts a day (`X_DAILY_POST_BUDGET`). |
| Facebook | no | a total share count only | app token, tightly limited | Counts, never posts. Not a source. |
| Instagram, TikTok, Threads | no | no | — | No public search door. Not sources. |

Re-uploads of a video (the file re-posted rather than linked) cannot be found through any door; that needs audio/visual fingerprinting of downloaded candidates, which the platforms do not permit at scale. A title-text search catches the lazy ones.

## 7. Version 1 scope

**In**

- Google results pages on the Google country domains (google.com, google.com.au, google.co.uk, …; Chrome match patterns cannot wildcard the country ending, so the label lists them).
- A bar beside results resolved to a named thing or a discussed article; nothing beside anything else.
- One bar for the search query itself above the results when the query names a thing ("sony xm6 review" → Sony WH-1000XM6); nothing for how-to or generic queries.
- The old site's look everywhere: the turquoise, shell-pink, peach and salmon palette and the glass surfaces on the bars as well as in the drawer.
- Hover sentence; click → the drawer opens over part of the page with the full card: summary, platform buttons, the bar, the recurring opinions, and the evidence view with the original posts, as on the old site.
- Lite gauge and full card; memory; config door with kill switch; per-install tokens; spend caps; golden set.
- Sources: Hacker News, Bluesky, YouTube. Reddit switches on the day the new approval arrives. X off.
- Chrome, loaded unpacked for development, then an unlisted store listing for a small beta.
- Privacy page.

**Out (for now)**

- YouTube pages, article pages, any other site.
- Bars inside other sites' link lists.
- Firefox, Safari, phones.
- Accounts, payments, comparisons, opinion over time, per-community breakdowns.
- Per-user Reddit login.

## 8. Roadmap

| Version | Adds | The new skill |
|---|---|---|
| v1 | Google results | hands read Google's result list |
| v1.1 | unlisted beta, a dashboard of cost per day | — |
| v2 | YouTube watch pages | hands read the video ID; server gathers the video's own comments plus every Reddit/X/HN/Bluesky post that shared the link (where it spread, when it peaked) |
| v3 | news and article pages on any site | hands read the headline and canonical link from the page's own labels; server searches by link (this article) and by headline (this story); stance instead of sentiment |
| v4 | every page | hands read the page's structured labels (product, film, app) on any site; an optional "everywhere" permission the reader opts into |
| v5 | side-panel query mode | the drawer answers "what do people think of *your query*" on every search without touching Google's page — cannot break when Google changes |
| later | Firefox (same build), Safari and iPhone (Apple developer account), share-sheet fallback for phones, nightly precompute index, X vs Y comparisons, opinion over time, "who says what" by community, an embeddable badge, a daily "guess the crowd" game for growth |

## 9. Privacy and permissions

- **Permissions requested:** the Google search domains only, plus local storage for the install token and the config. No "all sites" permission in v1. Later versions offer "everywhere" as an optional permission the reader turns on inside the extension, never at install.
- **What is sent to the server:** the titles and addresses of results on Google search pages and the query. Nothing from any other page, ever. No page content, no cookies, no account details.
- **What the server keeps:** derived answers for 24 hours; request logs without raw queries beyond what abuse prevention needs, for a short fixed period. The privacy page states the period.
- **What the server sends to the AI:** comment text and titles for classification; never usernames.
- **The store's forms:** the "privacy practices" disclosure must match the above word for word; the description must match the function; no platform names or logos in the listing name or icon.

## 10. Reddit application (new)

The earlier search site has its own pending application with its own limits; it does not cover this project and its limits do not bind it. A new, separate application is submitted for the extension, describing it precisely. Mention the earlier ticket number and say this is a different product, so it is not treated as a duplicate.

Ask for exactly what the extension needs:

- **Doors:** search (`/search`, with the `url:` filter for "every post that shared this link" and plain queries for "posts about this subject") and comments (`/comments/{id}`, top-sorted, shallow, capped per thread).
- **Paging, with ceilings:** up to 100 posts per link, 20 threads read in depth.
- **Rate:** all calls from the server under one identity; results shared through the memory; usage kept under the free 100/minute by design; rate-limit headers respected with back-off.
- **What is kept:** derived counts, sentence and links for up to 24 hours; verbatim excerpts fetched live so deletions propagate immediately.
- **AI, stated plainly:** comment text is sent to a model to classify and summarise; usernames are not; nothing is used to train anything (the OpenAI API does not train on requests by default).
- **Hygiene:** attribution and links to source threads; `over_18` content dropped; read-only; no user-profile doors; a public privacy page.
- **Identity:** register the app at `reddit.com/prefs/apps` first; user-agent `web:opinion-extension:v<version> (by /u/<account>)`.
- **Structure:** shared server credentials for v1; per-reader Reddit login is the upgrade path if the shared budget ever binds.

The Zendesk form hides its "Details of inquiry" box behind a theme quirk; the text must be entered through the page's editor or the submission fails as blank.

## 11. Store listing

| Store | Cost | Review | Covers |
|---|---|---|---|
| Chrome Web Store | $5 once | usually 1–3 days; longer for broad permissions | Chrome, Edge, Brave, Opera, Arc, Vivaldi |
| Firefox Add-ons | free | minutes to days; source uploaded alongside the build | Firefox desktop and Android |
| Safari | $99/yr Apple Developer Program, a Mac | about a week | Safari on Mac and iPhone |

Chrome requires two-factor authentication on the account, a verified publisher email, an EU trader/non-trader declaration (non-trader while non-commercial), a privacy policy address and the privacy-practices form. Every update is re-reviewed, faster. Start **unlisted**: reviewed and installable by link, not searchable.

## 12. Costs

**Friend scale (tens of users):** $5 once; AI a few dollars a month; everything else on free tiers.

**Ten thousand daily users** (~80,000 result pages a day, heavy repetition of subjects; paid tiers; rough, check current prices):

| Component | Load | Rough cost/month |
|---|---|---|
| Vercel Pro | about one request a second; easy | $20–60 |
| Memory | easy | $5–15 |
| Reddit | ~5,000 fresh subjects/day × 3 requests fits the free tier because of the memory | $0 non-commercial; ~$100 on the commercial tier |
| YouTube | free once the quota increase is granted and by-ID reads are preferred | $0 |
| Hacker News, Bluesky | fine | $0 |
| OpenAI | the real cost: reading ~50 comments per fresh subject and writing cards on click; model choice and caching swing this 5× | $500–3,000 |
| **Total** | | **~$600–3,200** |

At that scale the question is not whether the design holds (it does, to roughly 100,000 daily users) but who pays. Charging money or showing ads moves Reddit to its commercial pricing and the store listing to a business identity, so the monetisation stance is decided before ~1,000 users, not after.

## 13. What breaks first

| Risk | Likelihood | Mitigation |
|---|---|---|
| Google changes its results page; every reader's bars vanish at once | high, recurring | selectors served from the config door; kill switch; fail closed (draw nothing rather than draw wrongly); fast store updates; v5 side-panel mode does not depend on Google's page |
| YouTube search quota exhausted | certain at scale | quota increase before launch; by-ID reads; memory |
| AI bill surprise | medium | hard spend caps; lite tier by default; precompute popular subjects; daily cost dashboard |
| Someone scripts the doors | medium | per-install tokens, per-address and per-day limits, spend caps |
| Reddit rate limit | low with memory | back-off on headers; cache; per-user login as the upgrade path |
| Brigaded or bot-heavy threads | medium on news | log-weighted reactions; minimum sample; showing per-platform disagreement rather than one blended number; account-age signals later |
| Store rejection | low | narrow permissions; disclosures matching the code; no platform names or logos in the listing |
| Privacy complaint | low | least-privilege permissions; nothing sent from non-Google pages; a plain privacy page |

## 14. Build order

1. **Server first, no extension.** The gauge door, the memory, subject naming with the rule table and the batched AI call, the lite gauge from Hacker News, Bluesky and YouTube. Tested from a plain web page that pastes in ten fake Google results.
2. **The extension.** Label, hands with the Google skill, brain, drawer showing the embed page. Loaded unpacked in Chrome.
3. **Safety rails.** Config door and kill switch, per-install tokens and limits, spend caps, the golden set.
4. **Public-facing.** Privacy page, icons, screenshots, the unlisted listing. Friends install by link.
5. **Reddit** on the day approval arrives — a new source behind the same doors, nothing else changes.
6. **v2 YouTube**, then v3 articles, per the roadmap.

Each step is a few working sessions.

## 15. Repository layout and technology

```
opinion-extension/
|-- README.md        this specification
|-- AGENTS.md        rules for anyone (or any AI) changing the code
|-- .env.example     the keys the server needs, with no values
|-- server/          Next.js on Vercel: doors, embed page, memory, cron, golden set
'-- extension/       WXT project: label, hands, brain, drawer, icons
```

- TypeScript throughout.
- Server: Next.js route handlers on Vercel; Upstash Redis for memory; Vercel Cron for the nightly job.
- Extension: plain TypeScript bundled by esbuild (Manifest V3; a Chrome package and a Firefox package from one source; Safari wraps the Chrome package in Xcode); Shadow DOM for anything drawn on a page; the drawer is an in-page overlay framing `/embed`.
- AI: OpenAI through the Responses API with Structured Outputs, a small model for lite gauges and naming, a capable model for cards.
- Salvaged from the earlier search site: the YouTube, Reddit and X readers, the analysis prompt, the counting, the card UI and its stylesheet. Starting from scratch on the product; not on the parts that already work.
- No Node on the owner's machines: GitHub Actions installs, builds and tests every push and attaches the extension packages to the run; Vercel builds and runs the server from the `server/` folder.

### Doors

| Door | Method | Purpose |
|---|---|---|
| `/api/gauge` | POST `{ query, results: [{ url, title, snippet? }] }` | Names the subject behind each result and the query, answers with a quick gauge per subject: from memory, computed within a 20-second budget, or `pending` with the work kept alive. |
| `/api/gauge?keys=a,b` | GET | The poll for pending subjects: memory only. |
| `/api/card?key=` or POST `{ key, context: { query, results } }` | GET / POST | Full card computed on click within a bounded budget. POST recovers missing subjects from the original query or single result. X is read here only. |
| `/api/config` | GET | The settings the extension reads on start, including the kill switch. Override instantly by writing JSON to the memory key `config:override`. |
| `/embed?key=` | page | The card the drawer frames. |
| `/api/health` | GET | AI/source configuration and memory reachability; no credentials. |
| `/dev` | page | Pretend to be the extension and knock on the gauge door. |

Every door answers any origin; the install token (`X-Install-Token`) and the rate limits are the protection. Without an AI key the gauge and the card still work, from a word-count estimate marked `simulated`, so the whole flow can be tried before a single key exists.

That word-count fallback applies only to main-query readings. Website/link reputation stays unavailable until AI is connected, since counting positive words cannot establish which site a post evaluates.

## 16. Decisions log

| Date | Decision |
|---|---|
| 2026-09-14 | Main-query opinion and individual URL reputation are separate; use an explicit domain fallback only when page-specific evidence is thin. |
| 2026-09-14 | Include sponsored results, product tiles and AI Overview references. Bare result bars; no main-card summary subtext. |
| 2026-09-14 | Full content loads only on expansion. Drawer is transparent frosted glass, sized to its content with a viewport ceiling. |
| 2026-09-14 | Deeper HN/Bluesky searches use full history and API-sized pages, retaining and disclosing bounded partial results. |
| 2026-09-14 | Accept CHATGPT/YOUTUBE deployment variable names; support exact YouTube-video comment lookup and cache-independent drawer recovery. |
| 2026-09-14 | Treat this as a fresh project: a browser extension, not a search page. New repository. |
| 2026-09-14 | Version 1 is Google results only; other surfaces are added as skills of the hands. |
| 2026-09-14 | The extension stays dumb; keys, thinking and memory on a server rented from Vercel. |
| 2026-09-14 | A new, separate Reddit application for this project; the earlier one's limits do not apply here. |
| 2026-09-14 | Sources at launch: Hacker News, Bluesky, YouTube. Reddit when approved. X off by default. Facebook/Instagram/TikTok are not sources. |
| 2026-09-14 | People are never subjects. |
| 2026-09-14 | Only derived answers are stored, for at most 24 hours; excerpts fetched live. |
| 2026-09-14 | Named Opinion Meter; repository `samco26/Opinion-Meter`. |
| 2026-09-14 | The old site's look everywhere, bars included. The query itself gets a bar in v1. |
| 2026-09-14 | The drawer is an in-page overlay framing the server's embed page, not a side panel: one behaviour on every browser, and the card UI updates without a store review. |
| 2026-09-14 | The extension is bundled by esbuild with a small build script rather than WXT: fewer moving parts while building without a local Node. |
| 2026-09-14 | No Node is installed on the owner's machines; GitHub Actions is the build and test machine, Vercel the server. The extension packages are downloaded from the Actions run and loaded unpacked. |
| 2026-09-15 | Reverses the 14 September separation: a result's bar is about the thing its page represents (rules, then AI naming), so a site's front page and the query about that site share one reading. The page-then-website reading remains only as the no-AI fallback. |
| 2026-09-15 | Summaries describe general standing, never the news of the moment; a separate "Lately" line carries a notable recent development when there is one. Momentary outage reports are not opinions. |
| 2026-09-15 | The sample is taken in turns across platforms with a per-thread cap; windows widen platform by platform. Every connected platform is read for every subject. |
| 2026-09-15 | Result bars sit inside the title after its last word, with the count text, and are invisible until a reading exists. No placeholders. Tooltip fixed to the viewport. |
| 2026-09-15 | Bluesky may be read signed in with an app password when the public door refuses; YouTube reads up to 20 videos × 100–200 comments and a linked video five pages deep; outgoing requests carry a User-Agent. |
| 2026-09-15 | One Chrome package for every Chromium browser; the Firefox package declares host permissions. Safari deferred (needs a Mac). |
| 2026-09-15 | Pipeline settled with the owner: the bar counts everything said about the subject (business decisions and politics included); "general" reaches back three years; "Lately" covers the last 60 days and only developments about the subject itself; reactions to one incident are classified as event and never enter the bar; genuinely neutral views stay neutral, but questions, facts, wishes and comparisons without a verdict no longer count as neutral; junk comments (timestamps, "first!", emoji, bare links, under two words) are dropped before sampling; thin evidence draws an empty bar. |
| 2026-09-15 | With an AI key every result is named by the batched AI call (a YouTube video keeps its rule-made identity), so x.com, the X app listing and the query "twitter" share one reading. |
| 2026-09-15 | Reddit is off until an application succeeds; X is on (the owner's token), read only for the full card, with a default budget of 1,000 posts a day. |
| 2026-09-15 | The query's card is prefetched when the results appear and a finished card is held for 15 minutes (AGENTS.md rule amended), so the first drawer opens at once. |
| 2026-09-15 | Result bars sit on the site-name line beside the site's name, sized to that text, with the percentage but no opinion count; the query's card sits beside the knowledge panel's title as a small square when there is room, else under its subtitle. Tooltip drawn from the page root so Google's transforms cannot move it; a ring animation on hover. |
| 2026-09-15 | Reverses "people are never subjects": anyone and anything named is rated — a person on their work and public conduct, a topic when typed as the query. Two-word praise ("Love it.") counts; a wish for a missing feature is a negative view. Reach: 120 entries for a bar, 250 for a card; YouTube reads two comment pages per video for the card. |
| 2026-09-15 | A result's bar is about the **site it sits beside** (X, Google Play, Wikipedia, the eSafety Commissioner), named from a table of well-known sites or from the label Google prints beside the favicon — not the page's topic. A YouTube video stays the exception. The query's card is about what was typed. |
| 2026-09-15 | Subjects carry aliases ("Twitter" for X) from the sites table or the naming call, and every reader searches each name; "X" alone found nothing usable. The bar reads the whole three years in one pass instead of widening from three months. |
| 2026-09-15 | YouTube's search results for a subject are remembered for a day (video ids and titles), so the bar, the prefetched card and a later drawer cost one 100-unit search rather than three. The day's quota ran out during testing; the increase request is now urgent. |
| 2026-09-15 | The query's card is pinned to the right edge of the knowledge panel's header, transparent (no card background), the row padded so the title wraps beside it. A steady glow on hover, no pulse. A reply-less post shows once in the evidence list. |
| 2026-09-15 | Bars are drawn on a layer above the page and pinned by page coordinates to a target element — the "About this result" dots on All, Forums and Videos; the source name on News; the merchant line under a Shopping tile (bar below it); the source label in an AI Overview or AI Mode sources panel — never inserted into Google's own containers, so nothing clips them. The query's card sits beside the knowledge panel's title on the same line, above an AI Overview's sources box at its width, below an AI Mode sources panel, else in the flow above the results as one line. |
| 2026-09-15 | Greyscale palette everywhere except the three sentiment colours, which are brighter. Icon-only platform buttons; recurring opinions glow on hover instead of carrying an arrow; the drawer's title is large and aligned with its text; the coverage line and the opinion count in the tooltip are gone. |
| 2026-09-15 | A YouTube video result is read from that video's own comments alone — no search, no other platforms. Google Play results are real destinations (only Google's own search host is treated as a redirect). A Shopping seller without an address gets a stand-in one so it can still be named. |

## 17. Trying it

Nothing here needs Node on your machine.

**The server.** The existing Vercel project is `opinion_meter`, rooted at `server/`, at **https://opinionmeter.vercel.app**. The extension now uses that address by default. Set keys from `.env.example` (or the `CHATGPT`/`YOUTUBE` aliases), then redeploy. `/api/health` shows which are configured. Connect Upstash for persistent memory. Open `/dev` to test the gauge door.

**The extension.** GitHub → Actions → the latest `ci` run → download `opinion-meter-chrome` → unzip → `chrome://extensions` → Developer mode → Load unpacked → the unzipped folder. Then search Google. Details in `extension/README.md`.

**When a run is red.** Open the failed step in Actions and paste the red lines into the conversation; that is the feedback loop that replaces a local Node.

**The kill switch.** In Upstash's data browser, set the key `config:override` to `{"enabled":false}` and every copy of the extension goes quiet within an hour (the config's `ttlMinutes`); delete the key to resume. The same key patches the Google selectors when Google changes its page.

## 18. Open questions

- Final name and whether to buy a domain.
- Monetisation stance (to be settled before ~1,000 users).
- Whether X is worth its cost for the full card, and at what daily budget.
- Which capable model writes the card, chosen by running the golden set against two or three candidates.
- Whether Chrome's built-in on-device model is good enough for a free "no-server" lite mode later.
