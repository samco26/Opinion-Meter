# Chrome Web Store listing

The owner's choices of 17 September 2026. The store pack (icons, screenshots, promo tiles, `listing.md` with the long description) is in `Opinion Meter Extension Icons.zip` in the owner's Downloads; the icon is in `extension/icons/gauge.svg`.

## Short description (the manifest's, 107 of 132 characters)

Crowd opinion before you visit. Opinion Meter reads public posts and shows a sentiment bar for every page.

## Permission justification: access to all sites

Opinion Meter shows a small opinion badge at the top right of every site: the site's public reputation, carried over from the user's Google search when they came from one, otherwise fetched by the site's domain and declared name. Under it sits a button, "Analyse this page's subject", which — only when pressed, and after a one-time note — sends that page's visible text to the extension's own service to name the page's subject and read the reviews on it. Nothing typed into forms is read; page text is never kept.

## Other fields

- Single purpose: show how people publicly rate a website or the subject of a page, beside that site's Google result and on the site itself.
- storage: caches readings already fetched, the user's display settings and whether the one-time note was seen.
- Host access to search pages: reads the result links on the search page to place a bar beside each; the search words and result labels/links go to Opinion Meter's own lookup service and nowhere else.
- Host access to all sites: the site's domain and declared name go to the same service for the site's reading (unless the card is switched off in the menu); a page's text goes only when the user presses "Analyse this page's subject". Web history: the service sees which sites are visited (domains only), for that reading; this must be declared in the data-use form (Chrome: "web history"; Firefox: "browsing activity").
- Data use: not sold or transferred; not used for unrelated purposes; no creditworthiness use.
- Privacy policy: https://opinionmeter.vercel.app/privacy
- Category: Tools. Language: English.
- Upload: the CI artifact `opinion-meter-chrome`, zipped as it comes.

The listing assets (screenshots, tiles) are the owner's to upload.

# Firefox Add-ons listing (addons.mozilla.org)

Started 18 September 2026. Same description, justification, privacy policy and assets as above.

- Upload: the CI artifact `opinion-meter-firefox` from the `main` run, zipped as it comes (built on Linux, so the paths inside the zip are right; do not re-zip it on Windows). Version 0.16.10 or later — 0.16.9 was refused: "The data_collection_permissions property is missing".
- Add-on ID (fixed by the label, cannot change once listed): `opinion-meter@samco26.github.io`.
- Data collection (declared in the label, shown by Firefox 140+ at install; matches README section 9): required "search terms", "browsing activity" and "website content"; nothing optional. The listing's data-use answers must say the same. Changed in 0.17.0: a listing submitted with 0.16.10's two categories must be updated.
- Compatible with: Firefox. Not Firefox for Android (the hands read Google's desktop pages; untested on the phone layout).
- Source code: yes, required — the packages are TypeScript bundled by esbuild. Upload a zip of `extension/` (src, icons, build.mjs, package.json, tsconfig.json, pnpm-lock.yaml) with the build steps: Node 24, `npm install`, `npm run build`, output in `dist/firefox`.
- Review notes to give Mozilla: the all-sites content script draws the site's badge, sending the site's domain and declared name for its reading and a page's text only on the user's press of "Analyse this page's subject" (the justification above); the server is the developer's own at opinionmeter.vercel.app; the `/embed` card is framed inside the extension's card, no remote code runs in the extension.
