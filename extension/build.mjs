/* Builds the extension: one bundle each for the hands, the brain, the
   menu and the site script, then one package per browser with its own
   manifest. dist/<target>/ is what "Load unpacked" points at.

   Chrome and Edge share one manifest (Brave, Opera, Vivaldi and Arc
   install the Chrome package unchanged; the Edge package is the same
   under its own name, for the Edge store). Firefox needs its own (a
   background script instead of a service worker, an add-on id, host
   permissions spelt out). Safari takes the Chrome shape without the
   Chrome version key; Apple's converter on a Mac (the ci.yml "safari-app"
   job) turns that folder into a Mac app. */

import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const { version, description } = JSON.parse(readFileSync("package.json", "utf8"));

/* Chrome match patterns cannot wildcard the country ending, so the Google
   domains are listed. */
const GOOGLE = ["com", "com.au", "co.uk", "ca", "co.nz", "ie", "co.in", "com.sg", "com.hk", "co.za", "de", "fr", "es", "it", "nl", "be", "ch", "at", "se", "no", "dk", "fi", "pl", "pt", "cz", "gr", "hu", "ro", "com.tr", "com.br", "com.mx", "com.ar", "cl", "co", "com.pe", "co.jp", "co.kr", "com.tw", "com.ph", "co.id", "com.my", "co.th", "com.vn", "ae", "com.sa", "co.il", "com.eg", "com.ng", "co.ke", "com.pk"];
const matches = GOOGLE.map((tld) => `*://www.google.${tld}/search*`);

/* "Take the bar with you" (on unless the reader turns it off in the menu)
   runs the site script on every site but Google's search pages, so the
   label names every site: the browser says so at install. Firefox lists
   the hosts as permissions too and, from 127, asks for them at install. */
const EVERYWHERE = ["*://*/*"];
const iconSizes = [16, 32, 48, 128];
const icons = (dark = false) => Object.fromEntries(iconSizes.map((size) => [size, `icons/${dark ? "grey" : "icon"}${size}.png`]));
const iconVariants = [{ ...icons(true), color_schemes: ["light"] }, { ...icons(), color_schemes: ["dark"] }];
const manifest = (target) => ({
  manifest_version: 3,
  name: "Opinion Meter",
  version,
  description,
  icons: icons(),
  ...(target === "safari" ? { icon_variants: iconVariants } : {}),
  permissions: ["storage"],
  ...(["firefox", "safari"].includes(target) ? { host_permissions: EVERYWHERE } : {}),
  background: target === "firefox" ? { scripts: ["background.js"] } : { service_worker: "background.js" },
  content_scripts: [
    { matches, js: ["content.js"], run_at: "document_start" },
    { matches: EVERYWHERE, exclude_matches: matches, js: ["site.js"], run_at: "document_idle" },
  ],
  /* The icon opens the menu; the same page serves as the settings page, in a tab. */
  options_ui: { page: "popup.html", open_in_tab: true },
  action: {
    default_title: "Opinion Meter", default_popup: "popup.html", default_icon: icons(),
    ...(target === "safari" ? { icon_variants: iconVariants } : {}),
    /* Firefox names these for the toolbar TEXT colour, not its background. */
    ...(target === "firefox" ? { theme_icons: iconSizes.map((size) => ({ size, light: `icons/icon${size}.png`, dark: `icons/grey${size}.png` })) } : {}),
  },
  ...(target === "firefox" ? { browser_specific_settings: { gecko: { id: "opinion-meter@samco26.github.io", strict_min_version: "127.0" } } }
    : target === "safari" ? { browser_specific_settings: { safari: { strict_min_version: "16.4" } } }
    : { minimum_chrome_version: "111" }),
});

for (const target of ["chrome", "edge", "firefox", "safari"]) {
  const out = `dist/${target}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: { content: "src/content.ts", background: "src/background.ts", popup: "src/popup.ts", site: "src/site.ts" },
    bundle: true, format: "iife", outdir: out, target: ["chrome111", "firefox127", "safari16"], logLevel: "info",
  });
  cpSync("src/popup.html", `${out}/popup.html`);
  cpSync("icons", `${out}/icons`, { recursive: true });
  writeFileSync(`${out}/manifest.json`, `${JSON.stringify(manifest(target), null, 2)}\n`);
}
