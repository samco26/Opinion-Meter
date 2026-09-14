# extension

The installed half. Plain TypeScript, bundled by esbuild into a Chrome package and a Firefox package (`dist/chrome`, `dist/firefox`).

- `src/content.ts` — the hands: reads Google's results, draws the bars, opens the drawer.
- `src/ui.ts` — the bar and the drawer, each in its own shadow root.
- `src/background.ts` — the brain: the install token, the config, the calls to the server.
- `src/options.html`, `src/options.ts` — the settings page (server address, token).
- `src/shared.ts` — messages and storage; wire shapes are imported from `server/src/lib/types.ts`.
- `build.mjs` — the bundles and the two manifests, including the list of Google country domains.
- `icons/` — the icon at 16, 32, 48 and 128 pixels.

No keys, no prompts, no analysis here, ever.

## Getting a build without Node

Every push runs the `ci` workflow on GitHub, which attaches `opinion-meter-chrome` and `opinion-meter-firefox` to the run. Open the repository's Actions tab, pick the latest run, download the package, unzip it.

## Loading it in Chrome (or Edge, Brave, Opera, Vivaldi)

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. **Load unpacked** → choose the unzipped `chrome` folder.
3. Search Google. Bars appear under results the server could name, and one above the results for the query.

To point it at a different server (a preview deployment, or `http://localhost:3000`), open the extension's settings (Details → Extension options) and enter the address.

## Loading it in Firefox

`about:debugging` → This Firefox → **Load Temporary Add-on** → pick `manifest.json` inside the unzipped `firefox` folder. Temporary add-ons last until Firefox restarts; a signed build from the Firefox Add-ons site is the permanent route.

## With Node

```bash
npm install
npm run typecheck
npm run build
```
