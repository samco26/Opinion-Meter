# extension

The installed half. Plain TypeScript, bundled by esbuild into a Chrome package and a Firefox package (`dist/chrome`, `dist/firefox`).

- `src/content.ts` — the hands: reads Google's results, draws the bars, opens the drawer.
- `src/google.ts` — how the hands read Google's page: which links are results and where their titles are.
- `src/ui.ts` — the bar and the drawer, each in its own shadow root.
- `src/background.ts` — the brain: the install token, the config, the calls to the server.
- `src/options.html`, `src/options.ts` — the settings page (server address, token).
- `src/shared.ts` — messages and storage; wire shapes are imported from `server/src/lib/types.ts`.
- `build.mjs` — the bundles and the two manifests, including the list of Google country domains.
- `icons/` — the icon at 16, 32, 48 and 128 pixels.

No keys, no prompts, no analysis here, ever.

## Getting a build without Node

Every push runs the `ci` workflow on GitHub, which attaches `opinion-meter-chrome` and `opinion-meter-firefox` to the run. Open the repository's Actions tab, pick the latest run, download the package, unzip it.

## Which package for which browser

| Browser | Package | How to load it for testing | Store, later |
|---|---|---|---|
| Chrome | `opinion-meter-chrome` | `chrome://extensions` → Developer mode → Load unpacked → the unzipped folder | Chrome Web Store |
| Edge | `opinion-meter-chrome` | `edge://extensions` → Developer mode → Load unpacked | Chrome Web Store works in Edge; Edge Add-ons optional |
| Brave | `opinion-meter-chrome` | `brave://extensions` → Developer mode → Load unpacked | Chrome Web Store |
| Opera | `opinion-meter-chrome` | `opera://extensions` → Developer mode → Load unpacked | Chrome Web Store (Opera installs it directly) or Opera add-ons |
| Vivaldi, Arc | `opinion-meter-chrome` | the browser's extensions page → Developer mode → Load unpacked | Chrome Web Store |
| Firefox (desktop and Android) | `opinion-meter-firefox` | `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json` in the unzipped folder | Firefox Add-ons (AMO) |
| Safari | `opinion-meter-safari` | Recent Safari: Settings → Developer → Add Temporary Extension → the unzipped folder. See `../SAFARI.md` for app packaging. | App Store |

Every Chromium browser installs the same Chrome package unchanged. The Firefox package differs only in its manifest.

**Firefox note.** Firefox treats the Google addresses as a permission the reader can switch off. If no bars appear, open the add-on's page in `about:addons` → Permissions and allow access to the Google sites. Temporary add-ons last until Firefox restarts; a signed build from the Firefox Add-ons site is the permanent route.

After loading, search Google. Bars appear beside the titles of results the server could name, and one card for the query above the reference column (or above the results).

To point it at a different server (a preview deployment, or `http://localhost:3000`), open the extension's settings (Details → Extension options) and enter the address.

## With Node

```bash
npm install
npm run typecheck
npm run build
```
