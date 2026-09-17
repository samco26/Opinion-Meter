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
