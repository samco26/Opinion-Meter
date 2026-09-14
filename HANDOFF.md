# Handoff — 14 September 2026

## v0.2 update

The production URL is **https://opinionmeter.vercel.app**, project `opinion_meter` under `samco7`; the extension default is corrected. Main-query sentiment and exact-link/domain reputation are now separate. Ads, product tiles and AI Overview references have minimalist controls; no subtext under the main card. Full analysis only happens on expansion. The drawer has a transparent frosted background and content-driven height, and can recover its subject after a server-instance memory loss.

HN/Bluesky full readings search all indexed dates with larger requests and bounded pagination, preserving partial results. AI classification remains sampled and all limits are disclosed. Exact YouTube URLs read that video's comments directly. The owner's new Vercel keys were entered as `CHATGPT` and `YOUTUBE`; aliases now activate the existing connectors. `/api/health` provides non-secret configuration diagnostics.

Verification: server production build; Chrome and Firefox bundles; 29 server regression tests; GitHub Actions run `34837108494` passed both jobs. Browser fixture verifies seven independent placements (including a duplicate URL and a product with no merchant URL), query placement above the sidebar, no pre-click iframe/full request, short drawer sizing, and opinion-to-reference navigation. It uses **labelled synthetic test data**, never production data. Run it with `node tests/preview.mjs` from `extension/` after dependencies are installed. The repository has no hand-reviewed `server/golden/` set, so live semantic accuracy is not yet certified.

Live production verification: `/api/health` confirms OpenAI and YouTube configured. A Cadbury gauge used 20 real YouTube comments and was not marked simulated. A full drawer opened from the installed Chrome extension returned 160 relevant opinions, a fresh AI summary and recurring opinions; source status disclosed limited YouTube/HN coverage and no Bluesky results. The main query currently normalises “Cadbury chocolate” to the Cadbury brand, so discussion can include ads and ownership as well as the chocolate. No claim of representative public sentiment or exhaustive coverage.

The unpacked folder `~/Downloads/opinion-meter-chrome` was updated and reloaded to 0.2.0; the previous bundle is backed up under ignored `artifacts/`. Live Google exposed newer `[data-pv-entrypoint]` tiles with no merchant href: these now get an expandable no-verdict explanation, never fabricated product or retailer sentiment. Main-card placement excludes individual reference/carousel tiles; layouts without a genuine right-hand reference rail use the main-column position. The live test saw 41 result controls, including product placeholders.

The older notes below describe the original v0.1 handoff and are retained as history. In particular, the server address is now known, Node is available through Codex's bundled runtime, and full-card caching/background precomputation has been removed. **Remaining setup:** live health reports persistent Upstash memory is not configured, and Reddit is not configured. Drawer recovery works without shared memory, but reliable cross-instance caching/polling and global budgets still require it.

Where Opinion Meter is up to, for whoever (or whatever) picks it up next. README.md is the specification; AGENTS.md the rules; this is the state.

## Done

| Step | State | Evidence |
|---|---|---|
| Specification, rules, key names | done | README.md, AGENTS.md, .env.example |
| Server: doors, naming rules, five readers, lite and full analysis, memory, limits, privacy and dev pages | written, builds, 17 tests pass | CI run #4 green (`next build` type-checks everything; `npm test` 17/17) |
| Embed card (the drawer's content) | written, builds | CI run #4 |
| Extension: hands, brain, drawer, settings page, icon, Chrome + Firefox packages | written, type-checks, builds | CI run #4 attaches `opinion-meter-chrome` and `opinion-meter-firefox` |
| Vercel project created from `server/` (Root Directory `server`, preset Next.js) | done by the owner | address not yet recorded here — see "Immediate next actions" |

Nothing has been run on the owner's machines: no Node is installed there. GitHub Actions is the build and test machine; Vercel runs the server.

## Not yet verified (in order of risk)

1. **The Google page reader** (`extension/src/content.ts`). Written from Google's known structure (`#search`/`#rso`, `a[href]:has(h3)`), never run against a live page — the in-app browser is served a CAPTCHA by Google. If no bars appear, the selectors in `server/src/lib/config.ts` are the first suspect; they can be patched live through the memory key `config:override` without a store update.
2. **The drawer over Google's page** (`extension/src/ui.ts`): an iframe of `/embed` inside a shadow-root overlay. An iframe injected into Google's CAPTCHA page rendered fine; the real results page has not been tried.
3. **The AI calls** (`server/src/lib/ai.ts`, `analysis/name.ts`, `analysis/lite.ts`, `analysis/analyse.ts`): the request shape is the one the old site used successfully, but no key has been set here yet.
4. **YouTube and Reddit readers**: salvaged from the old site's verified code, but Reddit needs the new application and YouTube its key.
5. **Upstash memory** (`server/src/lib/memory.ts`): written against the REST command format; untested. Without it the server uses an in-process map, which on Vercel forgets between requests — fine for a first look, wrong for real use.
6. **Hacker News and Bluesky readers**: tested against saved responses, not the live APIs.

## Immediate next actions

1. **Record the server's address.** Vercel named the project something other than `opinion-meter` (that address 404s). Put the real address in three places: `extension/src/shared.ts` (`DEFAULT_SERVER`), README.md section 17, and this file. Until then the extension can be pointed at it from its settings page.
2. **Test the doors live** (anyone with a browser can): `<address>/api/config` should return JSON with `"enabled": true`; `<address>/dev` lets you post sample results to the gauge door; a key from its answer opens `<address>/embed?key=…`. With no keys set, gauges come back from Hacker News and Bluesky marked `simulated`.
3. **Add the memory**: Vercel → Storage → Upstash Redis (Marketplace) → connect to the project; it sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; redeploy.
4. **Load the extension**: GitHub → Actions → latest run → download `opinion-meter-chrome` → unzip → `chrome://extensions` → Developer mode → Load unpacked. Search Google. Report what appears (or doesn't) and paste any red text from the extension's Errors button.
5. **Keys, when ready**: `OPENAI_API_KEY` (and optionally `LITE_MODEL`/`CARD_MODEL`), `YOUTUBE_API_KEY`. Set a hard monthly spend cap in the OpenAI dashboard first.
6. **The new Reddit application**: draft from README section 10; mention the earlier ticket so it is not treated as a duplicate; register the app at reddit.com/prefs/apps first for the client id.

## After that (the roadmap, README section 8)

Unlisted Chrome Web Store listing ($5, needs 2FA, a privacy policy address — `/privacy` exists — and the privacy-practices form); then v2 YouTube pages, v3 articles, v4 every page, v5 the query mode that never touches Google's page.

## How the pieces talk (one paragraph)

The hands read Google's results and the query, the brain POSTs them to `/api/gauge` with the install token, the server names each result's subject (rules first, one batched AI call for the rest), merges duplicates, answers from memory or computes a lite gauge within 20 seconds, and keeps unfinished work alive for the extension to poll (`GET /api/gauge?keys=`). A bar is drawn under each result with a gauge and one above the results for the query. Clicking a bar opens the drawer: an overlay framing `/embed?key=…`, which fetches `/api/card?key=` (full analysis, X only here) and draws the salvaged card, opinions and evidence. `/api/config` is read on start; the memory key `config:override` changes it instantly (kill switch, selectors).

## Gotchas learned

- Bash heredocs over ~8 KB fail on this Windows machine (command-length limit); large files are written with the file tool.
- The in-app browser gets a Google CAPTCHA; the owner's own Chrome (via the Chrome connector) can read the private GitHub repo's Actions pages but is not logged in to Vercel.
- Line endings are forced to LF by `.gitattributes`; the CRLF warnings on commit are noise.
- The old site (`Desktop/t`, what-are-people-saying.vercel.app) is untouched and still has its own pending Reddit application, whose limits do not apply to this project.
