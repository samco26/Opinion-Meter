# Opinion Meter on Safari (and other browsers)

Safari cannot load an extension folder the way Chrome does. It needs the extension wrapped in a small Mac app, made by Apple's converter, which only runs on a Mac. Two ways to get there; both give you an unsigned copy for your own Mac. The App Store, or a signed download for other people, needs an Apple developer account (about US$99 a year); see the end.

## A. Use the app CI already built (no Xcode needed to run it)

1. GitHub → Actions → open a run that has the **safari-app** job. It runs when a push message contains `[safari]`, or when you press **Run workflow** on the `ci` workflow (any branch). Download the artifact **opinion-meter-safari-app**.
2. Unzip it. You get **Opinion Meter.app**. Drag it to Applications if you like.
3. First open: **right-click the app → Open → Open**. The app is unsigned, so macOS blocks a plain double-click. On macOS 15 and later, if "Open" is not offered: System Settings → Privacy & Security → scroll down to "Opinion Meter was blocked" → **Open Anyway**.
4. In Safari: **Settings → Advanced → tick "Show features for web developers"**. Then the new **Develop** menu → **Allow Unsigned Extensions** (this needs ticking again after every Safari restart; that is Apple's rule for unsigned copies).
5. **Safari → Settings → Extensions → tick Opinion Meter.** For website access choose **Always Allow on Every Website**: Google's search pages for the bars, and every other site for "take the bar with you". Safari asks per site otherwise.
6. Search Google. The bars, the card and the drawer should behave as in Chrome. Untested on Safari as of v0.13, so anything odd is worth a screenshot.

## B. Build it yourself on the Mac (needs Xcode, free)

1. Install **Xcode** from the App Store, open it once and accept the licence. In Terminal: `xcode-select --install`.
2. Get the extension folder in Safari's shape: download the **opinion-meter-safari** artifact from any green `ci` run and unzip it (or, with Node installed, `cd extension && npm install && npm run build` gives `extension/dist/safari`).
3. Convert it (one line; change the first path to where you unzipped):

```bash
xcrun safari-web-extension-converter "$HOME/Downloads/opinion-meter-safari" --project-location "$HOME/Desktop/OpinionMeterSafari" --app-name "Opinion Meter" --bundle-identifier app.opinionmeter.extension --macos-only --copy-resources
```

   Xcode opens with the project. Press **Run** (the ▶ button). The app launches; then follow steps 4 to 6 above.
4. For a newer version, run the same line with the new folder and `--force` at the end, or delete the project folder first.

## Edge and Firefox, for completeness

- **Edge** runs the Chrome package unchanged. Download **opinion-meter-edge** (the same files under Edge's name) → `edge://extensions` → Developer mode → Load unpacked → the unzipped folder.
- **Firefox**: download **opinion-meter-firefox** → `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json` in the unzipped folder. Firefox 127 or newer asks for the site permissions at install.
- **Brave, Opera, Vivaldi, Arc** take the Chrome package on their own extensions page, same as Chrome.

## Signing and the App Store (later)

1. Join the Apple Developer Program. In Xcode, select the project, then each of the two targets (the app and the extension), and set **Signing & Capabilities → Team** to yours.
2. **Product → Archive**, then **Distribute App**: *App Store Connect* for the Mac App Store, or *Developer ID* for a signed download you host yourself. Signed copies do not need the Develop menu step.
3. iPhone and iPad come from the same project: run the converter without `--macos-only`, and Safari on iOS installs the extension from the App Store app.

## What differs under the hood

- The Safari package is the Chrome package without the Chrome version key, plus `browser_specific_settings.safari` with a minimum of Safari 16.4 (the first version that runs a service-worker background like ours).
- The CI job (`.github/workflows/ci.yml`, `safari-app`) runs the converter with `--no-open --no-prompt --copy-resources --force --macos-only`, finds the generated project, picks the app scheme, and runs `xcodebuild` with signing turned off. A Mac minute costs ten Linux minutes of the free allowance, which is why it runs on request only.
