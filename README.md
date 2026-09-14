# Opinion Meter

The product and the repository (`samco26/Opinion-Meter`) are called Opinion Meter. The earlier search site, What People Think, is a separate project whose engine this one salvages.

A browser extension that shows, beside anything you are about to click, what people actually think of it: a small bar, how many voices, one sentence — and the full picture on click.

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
3. **People are off-limits.** Products, media, apps, places, companies and articles are subjects. Named individuals are never subjects. Decided now because it is far harder to retrofit.
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
6. Known subjects come straight from memory. New subjects get a quick **lite gauge** now and a full card computed in the background and saved for the next person.
7. The server replies with a short list: result 1 → 72% positive, 340 opinions, one sentence; result 2 → same subject; result 4 → nothing found.
8. The hands draw a bar beside each result that has one, inside a protected bubble (Shadow DOM) so Google's own styling cannot disturb it. Hover shows the sentence. Click opens the drawer with the card.
9. When Google swaps results without reloading, or the reader moves to page two, the hands notice and repeat from step 3.

Readers see bars about a second after the results for anything already in memory. The first person to hit a brand-new subject sees the lite gauge quickly and the full card on their next visit.

### 4.3 How a verdict is made

**Naming the subject.** A rule table handles the sites that matter most — Amazon `/dp/` → the product; IMDb `/title/` → the film; the App Store and Google Play → the app; Google Maps `/place/` → the place; Steam `/app/` → the game; GitHub `owner/repo` → the tool; Wikipedia → the entity; a news address → that article; wikiHow, documentation, forums → nothing. Everything else goes to one batched AI call per page (all remaining titles and snippets in, subject names out). Where a canonical identifier exists (Wikidata ID, ASIN, IMDb ID) it becomes the memory key, so "Sony XM6" and "WH-1000XM6" are one subject.

**Finding the discussion.** By name on Reddit, YouTube, Hacker News and Bluesky; by link where the subject is an article or a video (Reddit's `url:` search, Hacker News's URL search, Bluesky's URL filter). Search windows widen from 3 to 12 to 36 months until enough is found. A bounded sample: at most a fixed number of threads per platform and comments per thread.

**Two tiers.**

| Tier | When | What it reads | Model | Cost |
|---|---|---|---|---|
| Lite gauge | for the bar, on first sight | counts, reaction scores, the top comments | a small, cheap model | a fraction of a cent |
| Full card | on click, and in the background for popular subjects | the full bounded sample | a capable model | a few cents |

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
| Reddit | yes | yes (`url:` in search) | new application, free non-commercial | Best source for products and news. 100 requests/minute for the whole app, shared by all users — the memory is what makes this enough. Link posts are reliably findable; links buried in comments only partly. |
| YouTube | yes (costly) | a video's own comments by ID | existing key | A search costs 100 quota units of a 10,000/day free quota; reading a known video's comments costs 1. Request a quota increase before launch and prefer by-ID reads. |
| Hacker News | yes | yes | free, no key | Excellent for tech and business. |
| Bluesky | yes | yes | free, no key | Growing news audience. |
| X | yes | yes (`url:` operator) | paid, about half a cent per post read | Off by default; if used, only for the full card on click, with a daily post budget. |
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
| `/api/card?key=` | GET | The full card for one subject, from memory or computed within 55 seconds. X is read here only. |
| `/api/config` | GET | The settings the extension reads on start, including the kill switch. Override instantly by writing JSON to the memory key `config:override`. |
| `/embed?key=` | page | The card the drawer frames. |
| `/dev` | page | Pretend to be the extension and knock on the gauge door. |

Every door answers any origin; the install token (`X-Install-Token`) and the rate limits are the protection. Without an AI key the gauge and the card still work, from a word-count estimate marked `simulated`, so the whole flow can be tried before a single key exists.

## 16. Decisions log

| Date | Decision |
|---|---|
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

## 17. Trying it

Nothing here needs Node on your machine.

**The server.** In Vercel: Add New Project → import `samco26/Opinion-Meter` → set **Root Directory** to `server` → deploy. Add environment variables (names in `.env.example`) whenever you have them; none are needed for a first look. For the memory, add Upstash Redis from Vercel's Marketplace (Storage tab) and it fills in the two `UPSTASH_*` variables itself. The server's address becomes `https://<project-name>.vercel.app`; the extension expects `https://opinion-meter.vercel.app` unless told otherwise on its settings page. Open `/dev` on the deployed server to knock on the gauge door by hand.

**The extension.** GitHub → Actions → the latest `ci` run → download `opinion-meter-chrome` → unzip → `chrome://extensions` → Developer mode → Load unpacked → the unzipped folder. Then search Google. Details in `extension/README.md`.

**When a run is red.** Open the failed step in Actions and paste the red lines into the conversation; that is the feedback loop that replaces a local Node.

**The kill switch.** In Upstash's data browser, set the key `config:override` to `{"enabled":false}` and every copy of the extension goes quiet within an hour (the config's `ttlMinutes`); delete the key to resume. The same key patches the Google selectors when Google changes its page.

## 18. Open questions

- Final name and whether to buy a domain.
- Monetisation stance (to be settled before ~1,000 users).
- Whether X is worth its cost for the full card, and at what daily budget.
- Which capable model writes the card, chosen by running the golden set against two or three candidates.
- Whether Chrome's built-in on-device model is good enough for a free "no-server" lite mode later.
