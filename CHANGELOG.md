# Changelog

What changed in each version, in plain words, newest first. The version number lives in three places and moves together: `server/package.json`, `extension/package.json` and the health door (`server/src/app/api/health/route.ts`). **Rule:** every push that changes what a reader sees or what the server does adds an entry here in the same commit (see AGENTS.md).

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
