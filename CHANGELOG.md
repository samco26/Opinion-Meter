# Changelog

## 0.17.0 — 21 September 2026

- **One reading.** The bar's rating no longer changes when "See recurring opinions" loads. The bar and the list were two separate readings (a quick model over one sample for the bar; a fuller model, with X, over a second sample for the list), and the list pushed its numbers back into the bar. Now the bar's quick reading is the reading: the server keeps the bar's sample — the entries and each one's verdict — for a quarter of an hour, and a card asked for in that time (the list, the prefetched card) is built from that very sample with the verdicts locked, so its numbers are the bar's to the digit. Nothing is sent back to the bar, on the page or in memory. A card asked for later, when the sample has aged out, is read afresh and becomes the subject's reading for the next search; a bar already on a page keeps what it shows. This keeps the first load exactly as quick as it was.
- **X in both.** X is read for the bar as well as the card, once per subject (the owner's choice). Up to twenty posts, up to US$0.10, per new subject; X's monthly spend cap must allow it.
- **The card on every site.** The badge at the top right now appears on every site, not only those reached from Google. When no reading was carried from Google, the brain fetches the site's reading by the site's address (the origin — scheme and domain — never the page's path) and the name the site declares for itself, and files it for the site's other tabs. The × hides the badge on that page until the page is next loaded. The menu switch, now "Show the card on every site", turns it off everywhere. The fade while scrolling stays.
- **"Analyse this page's subject."** The badge is now two halves cut by a line across its middle — the site's reading above, the button below — each starting at the same edge and ending at the same edge (the bars are the flexible part), both darkening under a pointer that turns to a hand. The top half grows into the site's card only once the pointer rests on it; a pointer passing through on its way to the button leaves the badge as it is. While the site's card is grown, the button shrinks into a small chip at the top right of the card, on the site's own line just left of the ×, so the figures and summary stay as they were; it opens the page card from there. Pressed (after a one-time note saying what is sent), the page's visible text — reviews and comments first, up to about twelve thousand words, never anything typed into forms — goes to the server's new page door once, and a ring of green-into-red light circles the whole badge while the page is read. The server names the page's subject, then at the same time sweeps the platforms for it and reads the page for the opinions written on it — each copied verbatim and checked against the page, so no quote is invented — then writes one reading. The same box grows into the page card: the subject's bar and figures, a summary, the sources (the page's own favicon among the platform tiles, each opening its quotes), and the pros and the cons in two columns of green and red bubbles — short phrases ("Excellent noise cancelling", "Some compatibility issues"), up to six each, most repeated first, each opening the words behind it. Only the pros and cons scroll; the figures, summary and sources above them and the footer below stay put, as in the other cards. A review found on the page counts as three platform posts. Fewer than eight opinions in all: "Subject does not possess sufficient sentiment footprint" under the subject's name; a page about nothing in particular: "This page seems to be about nothing in particular". The page card scrolls inside, stays open while the page is scrolled, and once made reopens at once (the server holds it a quarter of an hour; the page's text is never kept).
- **The page's own rating counts.** A page that rates its subject — IMDb's 8.4/10 from 502K, a shop's 4.2 out of 5, a tomatometer's 94 % — now joins the meter as a block of votes: its value on its own scale read as the share who liked it, weighed by how many rated, up to 1,000 votes so the words still count. Read from the page's structured data first, else as printed. The card's count line says so ("rated 8.4/10 by 502K on this page") and How it works explains it. Without this, sixty text opinions could call an 8.4 film "52 % positive".
- **A query is named with its results in view.** "the oddysey" beside results about a 2026 film is that film, not Homer's poem: the titles of the top results now go along with the query to the naming call, as context only.
- **The hands wait longer for a reading.** A fresh reading can take half a minute; the page polled for thirty seconds and then showed a blank bar. It now polls for seventy-five.
- **The badge, tuned:** the loading ring is the outline alone (no glow under it); the button reads in the same type and colour as the site's name; no arrow; the badge uses the extension's own type rather than the site's; while the site's card is grown the chip sits at the right end of the figures' line.
- **Privacy.** What leaves the browser has changed: every visited site's origin and declared name (unless the card is off), and a page's text on the button's press. README section 9, the privacy page, the menu's note, the store notes and the Firefox label (now "search terms", "browsing activity" and "website content") say so.

## 0.16.10 — 18 September 2026

- The Firefox package declares, in its label, the data the extension sends — the search words and the titles and addresses of results on Google pages, Mozilla's "search terms" and "website content" — so Firefox's install prompt can show it. Firefox Add-ons has required this of every new add-on since November 2025 and refused the 0.16.9 upload without it. The package now asks for Firefox 140 or later, the first version with that prompt (it asked for 127). Nothing else changes: what is sent, and the code in all four packages, is exactly 0.16.9's.

## 0.16.9 — 17 September 2026

- The figures row shows on hover, not only after a click. The card's height was measured while the row was still folded, and a folded row is the one thing in the card the layout was allowed to squeeze to nothing, so it never got its room until a click re-measured. The row is measured open and can no longer be squeezed.
- The icon is the owner's gauge on an umber square (28 px corners), in place of both earlier sets; the menu takes the icon's palette, drawn as a rounded panel.
- The manifest carries the store description; `STORE.md` holds the listing choices.

## 0.16.8 — 17 September 2026

- The figures row (positive, neutral, negative) lines up with the bar and the rest of the card's contents, past the favicon's room, on hover as on click.
- Every card's footer carries "Built by samco" on the right, mirroring "How it works · sources and confidence" on the left.

## 0.16.7 — 17 September 2026

- Merged with the Mac session's 0.16.5 and 0.16.6 below (the loading sweep unhidden, the main gauge always above the results, bars drawn at the scan).
- Fast readings are no longer held up by slow ones. The server answers a batch as soon as it can: readings it already has come at once, a fresh one gets 2.5 seconds, and anything slower is reported pending and filled in by polling (now every 3 seconds, up to 10 times). Names the model still has to make (a query or a site never seen before) are made in the background and marked "later"; the hands keep those bars sweeping and ask again after 1.5 seconds, so the known bars on the page fill without waiting for the unknown ones.
- The figures row (positive, neutral, negative) sits right under the bar on every card, as it does on the badge, sliding open with the card; on the query line the summary follows it.
- The per-install request ceiling is 60 a minute (was 20), to make room for the polls.

## 0.16.6 — 16 September 2026

- Fixed the loading bars being hidden by a style meant for the drawer's waiting message. Bars now visibly animate before sentiment arrives.
- The browser check now verifies visible bar dimensions and animation, including streamed results and reduced-motion settings, instead of merely counting elements.

## 0.16.5 — 16 September 2026

- All recognised result bars appear with a loading sweep immediately, including later batches and results arriving during a reading.
- The main search gauge stays above the results, including searches with a knowledge panel; an unavailable reading keeps an honest empty gauge.
- Expanded cards wrap platform controls and put the opinion count on its own line. Long names and summaries fit narrow windows.
- The first look respects the config door's stated memory lifetime.

What changed in each version, in plain words, newest first. The version number lives in three places and moves together: `server/package.json`, `extension/package.json` and the health door (`server/src/app/api/health/route.ts`). **Rule:** every push that changes what a reader sees or what the server does adds an entry here in the same commit (see AGENTS.md).

## 0.16.4 — 17 September 2026

- The query line's summary no longer runs over the first result: every fresh look at the page was wiping the line's mirrored height (and the page's font) along with its layer coordinates; now only the coordinates go.
- The first look at the page no longer waits for the brain to wake: the hands start from the config the brain cached last time, read straight from storage, and the brain's answer follows (taking the bars away if the meter was switched off meanwhile). Each bar carries the page time it was made at (`data-om-at`), for anyone checking how early the bars come.

## 0.16.3 — 17 September 2026

- The bars are there from the first moment: the hands now start as the page begins to load and read the results as they stream in, so every result gets its sweeping bar as it appears, well before any reading is back. The query line changes into its small square if the knowledge panel arrives later in the page.
- A sponsored result gets the same treatment as an organic one: the verdict beside its site name, the hairline under the row. (Google writes an ad's address in a plain span rather than a cite, which is where the site-name detection used to start.)
- The query line carries the reading's one-sentence summary under the bar, and keeps it in that place when the card grows (the figures follow it).

## 0.16.2 — 17 September 2026

- A result's bar starts where its name and address start (the column to the favicon's right), the place the owner marked, and no longer under the favicon. The grown card still shows the favicon: it reaches left across the favicon's room, and its figures, summary, tiles and list start level with the name, clear of the favicon.
- The hands start at DOMContentLoaded instead of after the page's load event, so the bars (sweeping) appear as the results do rather than a second or two later.
- Opening the recurring opinions keeps the figures and the summary above the list; the list's loading strip takes only the room it needs.
- A platform tile, or "How it works", opens that platform's posts or the explainer inside the card (the list opens first if it was closed; "← Back" returns to the list) instead of a new tab.
- The badge on a site fades on scroll even when the site scrolls a box of its own rather than the window, and closes its open card then, as on any other page.

## 0.16.1 — 17 September 2026

- Bars appear the moment a search loads, sweeping green then red while the reading is made, instead of arriving fully formed a few seconds later; a result with no reading then disappears.
- The ends of a result's bar are whole: the resting card is a square, transparent box (its rounded corners were clipping the bar's first and last pixels). The bar also runs at least to the end of its own verdict, and, on Google, from the favicon's left edge (the title's), not the name's.
- The grown card names the site in Google's own type (size, weight, colour copied from the page), so the name no longer shrinks as the card opens; the favicon copy sits exactly where Google draws it.
- Every platform gets its tile (YouTube, X, Hacker News, Bluesky; Reddit once it has posts), so X is there even when it returned nothing.
- With the recurring opinions open, the tiles row stands 14 px under the bar (the handoff's spacing) instead of touching it.
- The list's loading strip inside a card is the same 3 px hairline sweep as every other bar.
- The badge's card on a site stays above the site's own header (it had been dropping to stacking level 1 when it grew).

## 0.16.0 — 16 September 2026

- The look from the design handoff of 16 September, to the letter: hairline bars (2 px beside results and in panels, 3 px on the query line, in cards and on the badge) in the page's own greys and font, colour only inside a bar or a 5 px dot, labels in the page's muted grey. Beside a result the bar runs under the whole row, from the result's left edge (level with the title and the favicon) to the end of the name-and-address column, with the verdict 6 px after the site's name on the name's exact line; a 5 px gap opens under the name for it (the owner's tweak of 17 September to the handoff's column-wide bar). The query line reads "What people think of Kia" with the bar filling to the verdict. A knowledge panel keeps its small square; a sources panel's line sits above the panel. Stories in a panel get a fixed 34 px bar with the verdict.
- The source card, one design at two token sets (dark on a dark page, light on a light one): name, bar, verdict and × in the header, three dots with the figures, the summary, the platform tiles, "See recurring opinions", the count and confidence, a full-bleed divider and "How it works". 460 px on Google, 360 px on a site. "See recurring opinions" swaps the figures and summary for the list, drawn as quiet rows with a 2 px stance tick, and the chip fills. Platform tiles and "How it works" open the server's page in a new tab.
- The badge on a site is the handoff's pill (name, fixed 48 px bar, verdict), docked below the site's own header at the top right.
- The growing animation is unchanged, but nothing moves any more: the header keeps its place while the card grows around it, the card opens 300 ms after the pointer arrives and closes 200 ms after it leaves, and a click after a close does not reopen it under the pointer. The card grows from the bar's own box and shrinks back to it with its contents laid out at their final width from the first frame, so nothing re-wraps, slides or vanishes on the way; a card pushed left by the window's edge, a story's name line and a long address's wide bar all stay inside the card. The grown card shows a look-alike of Google's favicon in its place, so the header still reads favicon, name, verdict. The badge's padding and × animate, and a dragged badge slides back rather than jumping. Loading keeps the green-then-red sweep; too few opinions is a plain grey track with no label.
- A test page can be assembled from real bundles CI now builds (opinion-meter-preview).

## 0.15.1 — 16 September 2026

- A growing card no longer jumps upward: the pin that keeps a bar on its line was measuring the grown card and re-centring on it every half second. It measures the bar at rest now. Cards on Google always grow downward; only a site's card, fixed to the window, grows upward when the window's bottom is right there.
- The query pill is lifted onto the bar layer for a hover as well as a click, so its card sits above the bars beneath it.
- A click anywhere on an open card that is not a control shrinks it back, inside the card as well as on its header.
- The card on a site starts in the top right corner of every page; a drag moves it for that page only.

## 0.15.0 — 16 September 2026

- One card that grows. Hover a bar and its own background stretches down to show the sentence, with the three figures sitting under the bar; click and it keeps growing into the full card, which loads inside it. Nothing separate opens on top any more: the drawer and the hover card are gone. Same on Google, beside a result, and on a site. Escape, the × in the row or a click elsewhere shrink it back; on a site, scrolling closes it too. It grows leftwards or upwards when the window's edge is near, and never taller than the window (the card scrolls inside).
- The full card no longer repeats the bar: the pill's own bar and figures are the header, so the card starts at the summary.
- The card on a site fills its pill: the bar takes whatever room the name leaves, and a long name widens the pill.

## 0.14.1 — 16 September 2026

- Fixed a remaining Safari layout case on the real YouTube page: the floating bar uses content-sized grid columns and a viewport limit instead of a circular percentage width, keeping the full name beside “Mixed opinion”. Shared by all browser packages.

## 0.14.0 — 16 September 2026

- Fixed “YouTube” being squeezed after its floating card closes: the pill grows with the label and verdict and stays inside the window after an update.
- A dragged bar's hover paragraph moves with it. Hover gently lights the filled bar with no expanding outline, and fades in a background matching the hover card.
- Result bars stay below the expanded drawer when Google's header changes during scrolling.
- Recurring opinions start hidden. “See recurring opinions”, between platform icons and the count and the same height as the logos, expands the drawer to reveal the scrolling list; click again to hide it.
- Rounded icon corners, with cream in dark mode and grey in light mode on Safari/Firefox. Cream remains the compatibility fallback on Chromium and older browsers.
- Explain why automatic page controls require the browser's “read and change data” warning. No new permissions or data collection. All browser packages ship together by default, recorded in AGENTS.md.

## 0.13.2 — 15 September 2026

- The owner's smiling cream icon replaces the old icon in every browser package. Safari selects the grey icon in dark mode; Firefox uses grey on dark toolbars and cream on light ones. Browsers without native theme-icon support keep the cream icon.
- Fixed a shared site-card memory race: when several Google readings arrived together, their saves could overwrite each other. They now save in order, and a destination waits for those saves before looking up its card.
- Added package/icon checks and a simulated multi-site regression test to CI. No analysis or counting changes.

## 0.13.1 — 15 September 2026

- Safari uses the current v0.13 source from GitHub commit `8d8c41a`, including the pill, drawer, toolbar menu and draggable card on visited sites. This supersedes the outdated v0.3 Safari package from `e983a18`.
- Safari explicitly declares the website permissions needed for the existing “take the bar with you” feature. All browsers still bundle the same hands, brain, menu and site script.
- Added the verified temporary-extension installation route for recent Safari versions; Xcode is not needed for this local test.

## 0.13.0 — 16 September 2026

- The site's card can be dragged anywhere on the window; where it lands is where it appears next time, on every site, kept inside the window. The fade on scroll is unchanged. A drag does not open the drawer.
- The site's card wears the drawer's frosted background, in light and dark, and its name and verdict are bold.
- Four packages from one build: Chrome (also Brave, Opera, Vivaldi, Arc), Edge (the same package under its own name, for the Edge store), Firefox, and Safari (the extension folder in Safari's shape). A Mac job in CI turns the Safari folder into an unsigned Mac app on request (a manual run, or a push whose message says [safari]). SAFARI.md walks through it on a Mac.
- The menu no longer shows the server address; it was a developer setting, and it lives on as a hidden stored key for testing.

## 0.12.0 — 15 September 2026

- "Take the bar with you" is on by default. The label now names every site, so the browser says so at install; the one-time note and the permission step are gone. The menu behind the toolbar icon turns it off.
- The toolbar icon opens a menu styled like the drawer (light and dark): the take-the-bar switch, and under Advanced the server address and the install token. The same page is the settings page, opened in a tab; the embedded settings dialog, which kept resizing itself, is gone.
- The site's card is solid at the top of a page, faint (a fifth) once you scroll at all, solid under the cursor, and solid again when you return to the very top.
- Drawers pass under Google's search header when scrolled, like the bars, instead of over it.
- Dark theme: the drawer's title, summary and every other inherited text are light; they had inherited the page body's dark colour.

## 0.11.0 — 15 September 2026

- **Take the bar with you.** Off until turned on. The first time a reading lands on Google, a one-time note offers it; "Turn on" opens the settings, where the browser asks for permission to run on other sites. With it on, a site whose bar was loaded on Google shows the same pill fixed at the top right of every page of that site (the name, the bar and the verdict, 224 px wide like Google's own pill buttons), with a × that hides it there until the bar is next loaded on Google. Clicking opens the drawer as on Google; the drawer stays with the card. The reading comes from the brain's memory, filed when the bar was ready on Google (by host, by site for a site's own address, by page for a video), kept until the browser closes. Nothing about the visited page is sent anywhere; the privacy page and README say so. The toolbar icon opens the settings.
- The settings page wears the same grey look as the rest.

## 0.10.1 — 15 September 2026

- The drawer is dark on Google's dark theme, as intended: the frame had been given a different colour scheme from the page inside it, which makes the browser paint an opaque white canvas behind that page.
- The loading sweep is two solid blocks, green then red, with no fade or blur (the drawer's bar and the query card's).
- Expanded sources panel: no duplicate bars. Google keeps the collapsed copy of the list in place but unseen; bars now leave a target the moment it is hidden, and are trimmed by every box that clips around them, not only one that scrolls. Links inside the panel are read only as panel entries, never also as ordinary results.

## 0.10.0 — 15 September 2026

- One look everywhere, taken from the query card's pill: Google Sans (Arial where it is not served), ink-grey text, the pill's light grey for the hover card and the drawer, dark grey with light text on Google's dark theme (the drawer included, still slightly see-through).
- Drawer: "How it works · sources and confidence" is back at the bottom; "Recurring opinions" in sentence case at the card's size; opinion cards keep their green and red fills and lose the outline; the close button and platform icons lift on hover; the loading bar sweeps green into red (so does the query card's while it loads).
- Knowledge panel: "What people think" in full ink (bright on dark), the card shifted so the bar sits on the subtitle's line.
- AI Overview sources panel after "Show more": the panel stays found (its control reads "Show less" once pressed), so the card above it stays and the newly shown sources get bars; bars follow the panel's own scrolling at once and are trimmed at its edges.

## 0.9.0 — 15 September 2026

- Result bars sit right after the site's name text; a name's box could run the width of its block, which pushed the bar far to the right.
- The drawer is anchored to the page beside the bar that opened it, so it moves with the results as you scroll instead of floating over them; it fades out when closed; the brief "Opening the drawer…" cover is gone (the drawer's own loading strip is the loading state).
- Shopping: every tile's seller line gets a bar ("21Overlays", "evee"), not only sellers written as web addresses.
- The query card on the results pages mirrors Google's "Search … on Google" pill: 46 px tall, 30 px corners, 14 px Google Sans, no border.
- The brain remembers answers for ten minutes: switching between the tabs of one search draws the bars from memory and asks the server nothing; a card is prepared once per subject in that time.
- Knowledge panel: the card sits right after the dots, in line with the title and subtitle; "What people think" stays above the bar and the verdict moves to the bar's right. "Mixed" reads "Mixed opinion".
- AI answers: a source card that names its site at the bottom gets its bar in the card's top-right corner (AI Mode "quick results", sources panels), kept clear of the title's first line. A scan that lands while Google fades an answer in no longer skips it.
- Drawer: the "How it works · sources and confidence" link sits under the opinion count, so the recurring opinions end the card; the loading phrase is left-aligned and fades between phrases every three seconds.
- "Lately" appears only for a development in the past two weeks that clearly swung opinion, resting on at least three dated entries; it was sixty days and two entries.

## 0.8.0 — 15 September 2026

- Result bars on the All tab sit beside the site's name again (its line is free there); on the Videos and Forums tabs, where the channel or community follows the name, they stay after the dots.
- The bar layer sits one step under Google's search header in the stacking order, so bars pass beneath the header as the page scrolls instead of over it.
- The query card on a knowledge panel is right-aligned on the title and subtitle lines, between the text and any logo; with no room it goes above the results, never over the panel's image.
- A loading query card shows only "What people think" and the moving bar; no "reading the crowd…".
- AI answer sources: every bar sits after the label's visible text at one width. Google clips long labels; the text ran on unseen past the dots and the bar followed it out of the box.
- The narrow card above an AI Overview's sources keeps only the name, so "of p…" no longer happens.
- Phantom bar fixed: Google's built-but-unseen pop-ups (the "My Ad Centre" link) no longer get a bar; a link inside a box fixed to the window, or made invisible, is never a result.
- Thin "no verdict" bars are outlines in dark mode too (they were filled grey).
- Drawer: stars removed; the loading state is a short strip; the card never scrolls, the recurring opinions list gives way and scrolls on its own.
- X's refusal note no longer repeats X's words.

## 0.7.0 — 15 September 2026

- The bar and the drawer are one reading: the bar reads the same three years, platforms and 250-entry sample as the card; the card's numbers replace the bar's whenever a card is made; and a drawer that opens sends its numbers back to the bar under it.
- X falls back to the last seven days when the token has no archive access, and the reading's note carries X's own explanation.
- Sites the table does not know are named by the AI from the address and Google's label, so abc.net.au (ABC News Australia) and abcnews.go.com (ABC News US) are different subjects.
- Shopping bars appear (Google marks its product grid aria-hidden; the visibility check no longer treats that as hidden).
- AI Overview / AI Mode source entries get a bar with no text, shrunk to fit between the label and the dots.
- Videos and Short videos tabs no longer prepare the query's card ahead of time (YouTube quota).
- Thin readings are hover-only; the card title uses the subject's proper name and capitalisation; the query card's title shrinks before its percentage is cut off.
- Drawer: the bar spans the whole card; stars (gold) and platform icons sit beneath it on the left, "N relevant opinions · confidence" on the right; recurring opinions scroll on their own; the loading state is just the progress bar and a rotating phrase.

## 0.6.0 — 15 September 2026

- Bars are drawn on a layer above the page and pinned to a target: the "About this result" dots on All, Forums and Videos; the source name on News; the merchant line under a Shopping tile; the source label in an AI answer's sources panel.
- The query's card sits on the same line as the knowledge panel's logo, title and subtitle; above an AI Overview's sources box; below an AI Mode panel; else one line above the results.
- Google Play results are real destinations again; a YouTube video is read from its own comments alone.
- Greyscale palette with brighter sentiment colours; icon-only platform buttons; glow-on-hover recurring opinions; large drawer title.

## 0.5.0 — 15 September 2026

- A result's bar is about the site it sits beside, named from a table of well-known sites or Google's label; a YouTube video stays the video.
- Subjects carry aliases ("Twitter" for X) and every reader searches each name; the bar reads three years in one pass.
- YouTube's video list for a subject is remembered for a day; quota exhaustion is reported plainly.
- Anyone and anything named is rated; two-word praise counts; a wish for a missing feature is negative.

## 0.4.0 — 15 September 2026

- Five-bucket classifier (positive, negative, neutral, event, irrelevant) with a junk filter; general standing over three years and a separate "Lately" line for the last 60 days.
- Reddit parked; X on for the full card; the query's card prefetched and held 15 minutes.
- Bars on the site-name line with the percentage, no opinion count; tooltip from the page root; steady glow.

## 0.3.0 — 15 September 2026

- Result bars beside titles, fair per-platform sampling, Bluesky sign-in, larger YouTube reads, one Chrome package for every Chromium browser.

## 0.2.0 — 14 September 2026

- First working extension: bars beside Google results, a card for the query, the drawer framing the server's embed page.
