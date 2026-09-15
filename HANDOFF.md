# Handoff — 15 September 2026

Where Opinion Meter is up to, for whoever (or whatever) picks it up next. README.md is the specification; AGENTS.md the rules; CHANGELOG.md the version history; this is the state.

## v0.7 — 15 September 2026 (afternoon, third pass)

CI run #23 green; server 0.7.0 live. See CHANGELOG.md for the list. The two findings that matter: (1) **the bar and the drawer disagreed because the bar rested on a 19-opinion quick pass** — now the bar reads the same three years, platforms and 250-entry sample as the card, the card writes its numbers back into the gauge (`rememberGaugeFromCard` in gauge.ts), and the embed posts a `gauge` message to the drawer host so the bar under it updates on the spot; live check: Reddit bar 51/0/49, card 51/0/49. (2) **X is refused because the developer console's monthly spend cap is reached** — the note now carries X's own words; the owner raises the cap in the X developer portal (Billing). The 7-day fallback is in place for tokens without archive access. Also: Shopping tiles sit in an aria-hidden block (visibility check relaxed); AI answer sources get a bare bar shrunk to fit before the dots; sites outside the table are named by the AI per host (`nameSites`); no prefetch on Videos tabs; thin bars hover-only; drawer relaid out (full-width bar, gold stars + icons left, count right, opinions list scrolls on its own, minimal loading state with rotating phrases).

Still open with the owner: the unfinished "also these clickable recurring op."; whether to keep the query card on the Videos tabs (kept, no prefetch); raising X_MAX_RESULTS above 20.

## v0.6 — what changed on 15 September 2026 (afternoon, second pass)

Built from the owner's live tests of v0.4/v0.5 across the All, Images, Videos, News, Shopping, AI Mode and AI Overview pages.

**Bars on a layer.** Bars are no longer inserted into Google's DOM. One layer (`[data-opinion-meter="layer"]`, absolute, at the document root) holds every bar, and each bar is pinned by page coordinates to a *target* element, re-pinned every 500 ms and on resize (`content.ts` `pinBar`/`reposition`). Targets by page (`google.ts`): the "About this result" dots on All, Forums and Videos (bar to their right, same line as the address); the source name on a News card; the merchant line under a Shopping tile (bar below it); the source label inside an AI Overview / AI Mode sources panel (found from its "Show all" control). Nothing of Google's can clip a bar or its glow any more.

**The query's card.** Beside the knowledge panel's logo, title and subtitle on the same line (`kp` mode; under them only if the panel is too narrow); above an AI Overview's sources box at the box's width; below an AI Mode sources panel (`udm=50`); otherwise in the flow above the results as one line (title · bar · percentage).

**Fixes.** Google Play results were being dropped because every `google.*` host was treated as a search redirect — now only the search host is. A YouTube video (Videos / Short videos tabs, or any video link) is read from its own comments alone: no search, no other platforms (`sourcesFor`, `youtube.ts`). Shopping sellers without an address get a stand-in host (`merchant.invalid/<slug>`) and their label ("& more", "AU" stripped) so `siteSubject` can name them.

**Look.** Greyscale everywhere except the three sentiment colours, brightened (`--sentPos #3fae66`, `--sentNeg #d95d52`). Icon-only platform buttons; recurring opinions glow on hover, no arrow; the drawer's title is 34 px and aligned with the text; the coverage line ("YouTube returned nothing…") and the opinion count in the tooltip are gone; steady glow on hover. Version 0.6.0 on both halves (CI run #21 green; server live).

## Not yet verified (in order of risk)

1. **v0.7 on any live page** — the run-23 package is the one to load; v0.6 was seen working on the All tab (bars right of the dots). Every placement above was written from DOM inspections made through the owner's Chrome (All, News, Forums, Videos, Shopping, AI Overview), not seen drawn.
2. **AI Mode** (`udm=50`) could not be inspected (the connector refuses scripts on its tokenised URL); the "Show all" panel logic is assumed to match the AI Overview's.
3. **The knowledge-panel same-line placement** relies on the title column's right edge; a very long title may push the card under the subtitle (the intended fallback).
4. **YouTube** quota status after the reset (5 pm Sydney).
5. **Open questions for the owner** (asked 15 September, afternoon): the unfinished sentence "also these clickable recurring op."; whether stars should stay coloured under the greyscale palette; whether Shopping bars rate the seller (as built) or the product.

## Immediate next actions

1. **Load the run-23 package**: GitHub → Actions → the top green run ("v0.7: one reading for bar and drawer…", #23) → Artifacts → `opinion-meter-chrome` → tell the assistant (it unpacks over `extension/dist/chrome`) → Reload at `chrome://extensions`.
2. **Walk the tabs** for "twitter" (All, News, Forums, Videos, Images, AI Mode), "youtube logo" (Videos, Images), "arnold workout" (Shopping), "peptides" (AI Overview) and report placement.
3. **X monthly spend cap** — raise it in the X developer portal (Billing); until then X reads nothing. **YouTube quota increase** — still urgent.
4. Reddit stays parked.

## How the pieces talk (one paragraph)

The hands read the page — titled results, news cards, shopping tiles, an AI answer's sources — with each result's address, title, and the site label Google prints beside it, plus the query; the brain POSTs them to `/api/gauge` with the install token. The server names each result's site (the sites table, the label, or the title; a YouTube video by its id) and the query's subject (one AI call, with aliases), merges duplicates, answers from memory or computes a lite gauge over three years within 20 seconds, and keeps unfinished work alive for the extension to poll (`GET /api/gauge?keys=`). The brain then asks `/api/card?key=` for the query's card so it is ready. Each bar is drawn on the layer and pinned beside its target once its reading exists (an empty outline when too thin); the query's card is pinned beside the knowledge panel's title, above or below a sources panel, or placed in the flow. Clicking a bar opens the drawer: an overlay framing `/embed?key=…`, which fetches `/api/card?key=` (held 15 minutes) and draws the card, the "Lately" line, opinions and evidence. `/api/config` is read on start; the memory key `config:override` changes it instantly (kill switch, selectors).

## Gotchas learned

- Bash heredocs over ~8 KB fail on this Windows machine (command-length limit); large files are written with the file tool. Perl is available for small in-place edits; use `\Q…\E` around literal text.
- The in-app browser gets a Google CAPTCHA; the owner's own Chrome (via the Chrome connector) renders Google with the extension's bars, runs JavaScript for DOM inspection (not on AI Mode's tokenised URLs) and reads the private repo's Actions pages and logs (open the job URL with `#step:N` and read the page text). It cannot open `chrome://` pages; clicking an artifact download link only works while the owner is not using Chrome — otherwise the owner downloads it (two clicks; from the *newest green* run) and the assistant unpacks it from Downloads. The owner may press Reload before the unpack — check the loaded build (`querySquare`/layer presence) before diagnosing.
- Google's result containers carry CSS transforms and the results column clips: nothing of ours goes inside them any more; the layer at the document root is the only place bars live.
- Google's "About this result" dots sit outside the result's anchor, on the address line, on All, Forums and Videos; News has no dots and no `cite`; Shopping tiles have no link element; AI answer sources are `li` entries whose overlay link has no text.
- `SEARCH_ENGINES` must be checked after the sites table (Google Play is on google.com); every `SubjectKind` needs a label in `CategoryCard.tsx`; `querySelectorAll<HTMLElement>("a[href]")` has no `.href` for the type checker — use `HTMLAnchorElement`.
- Git's housekeeping in the OneDrive-synced repo makes OneDrive ask about deleting hundreds of `.git/objects` files; it is safe.
- The office network answers requests to `public.api.bsky.app` with a proxy 403 page; probe Bluesky only through the server's doors.
- Line endings are forced to LF by `.gitattributes`; the CRLF warnings on commit are noise.
- The old site (`Desktop/t`, what-are-people-saying.vercel.app) is untouched and still has its own pending Reddit application, whose limits do not apply to this project.
