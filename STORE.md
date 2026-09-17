# Chrome Web Store listing

The owner's choices of 17 September 2026. The store pack (icons, screenshots, promo tiles, `listing.md` with the long description) is in `Opinion Meter Extension Icons.zip` in the owner's Downloads; the icon is in `extension/icons/gauge.svg`.

## Short description (the manifest's, 107 of 132 characters)

Crowd opinion before you visit. Opinion Meter reads public posts and shows a sentiment bar for every page.

## Permission justification: access to all sites

Opinion Meter shows a small opinion badge on a site the user opens from Google, carrying over the reading they saw beside the result. Nothing on those pages is read or sent; the reading comes from the extension's own memory of the earlier search.

## Other fields

- Single purpose: show how people publicly rate a website, beside that site's Google result and on the site itself.
- storage: caches readings already fetched and the user's display settings.
- Host access to search pages: reads the result links on the search page to place a bar beside each; the search words and result labels/links go to Opinion Meter's own lookup service and nowhere else.
- Data use: not sold or transferred; not used for unrelated purposes; no creditworthiness use.
- Privacy policy: https://opinionmeter.vercel.app/privacy
- Category: Tools. Language: English.
- Upload: the CI artifact `opinion-meter-chrome`, zipped as it comes.

The listing assets (screenshots, tiles) are the owner's to upload.

# Firefox Add-ons listing (addons.mozilla.org)

Started 18 September 2026. Same description, justification, privacy policy and assets as above.

- Upload: the CI artifact `opinion-meter-firefox` from the `main` run, zipped as it comes (built on Linux, so the paths inside the zip are right; do not re-zip it on Windows). Version 0.16.10 or later — 0.16.9 was refused: "The data_collection_permissions property is missing".
- Add-on ID (fixed by the label, cannot change once listed): `opinion-meter@samco26.github.io`.
- Data collection (declared in the label, shown by Firefox 140+ at install; matches README section 9): required "search terms" and "website content"; nothing optional. The listing's data-use answers must say the same.
- Compatible with: Firefox. Not Firefox for Android (the hands read Google's desktop pages; untested on the phone layout).
- Source code: yes, required — the packages are TypeScript bundled by esbuild. Upload a zip of `extension/` (src, icons, build.mjs, package.json, tsconfig.json, pnpm-lock.yaml) with the build steps: Node 24, `npm install`, `npm run build`, output in `dist/firefox`.
- Review notes to give Mozilla: the all-sites content script draws the reading carried from Google and sends nothing from those pages (the justification above); the server is the developer's own at opinionmeter.vercel.app; the `/embed` card is framed inside the extension's card, no remote code runs in the extension.
