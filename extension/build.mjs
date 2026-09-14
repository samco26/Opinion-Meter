/* Builds the extension: one bundle each for the hands, the brain and the
   options page, then a Chrome package and a Firefox package with their
   own manifests. dist/<target>/ is what "Load unpacked" points at.

   The Chrome package is the one for every Chromium browser: Chrome, Edge,
   Brave, Opera, Vivaldi and Arc all install it unchanged. Firefox needs
   its own manifest (a background script instead of a service worker, an
   add-on id, and host permissions spelt out so Firefox can ask for them).
   Safari would need Apple's converter on a Mac; not built here. */

import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const { version, description } = JSON.parse(readFileSync("package.json", "utf8"));

/* Chrome match patterns cannot wildcard the country ending, so the Google
   domains are listed. */
const GOOGLE = ["com", "com.au", "co.uk", "ca", "co.nz", "ie", "co.in", "com.sg", "com.hk", "co.za", "de", "fr", "es", "it", "nl", "be", "ch", "at", "se", "no", "dk", "fi", "pl", "pt", "cz", "gr", "hu", "ro", "com.tr", "com.br", "com.mx", "com.ar", "cl", "co", "com.pe", "co.jp", "co.kr", "com.tw", "com.ph", "co.id", "com.my", "co.th", "com.vn", "ae", "com.sa", "co.il", "com.eg", "com.ng", "co.ke", "com.pk"];
const matches = GOOGLE.map((tld) => `*://www.google.${tld}/search*`);

const manifest = (target) => ({
  manifest_version: 3,
  name: "Opinion Meter",
  version,
  description,
  icons: { 16: "icons/icon16.png", 32: "icons/icon32.png", 48: "icons/icon48.png", 128: "icons/icon128.png" },
  permissions: ["storage"],
  ...(target === "firefox" ? { host_permissions: matches } : {}),
  background: target === "firefox" ? { scripts: ["background.js"] } : { service_worker: "background.js" },
  content_scripts: [{ matches, js: ["content.js"], run_at: "document_idle" }],
  options_ui: { page: "options.html", open_in_tab: false },
  action: { default_title: "Opinion Meter" },
  ...(target === "firefox" ? { browser_specific_settings: { gecko: { id: "opinion-meter@samco26.github.io", strict_min_version: "121.0" } } } : { minimum_chrome_version: "111" }),
});

for (const target of ["chrome", "firefox"]) {
  const out = `dist/${target}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: { content: "src/content.ts", background: "src/background.ts", options: "src/options.ts" },
    bundle: true, format: "iife", outdir: out, target: ["chrome111", "firefox121", "safari16"], logLevel: "info",
  });
  cpSync("src/options.html", `${out}/options.html`);
  cpSync("icons", `${out}/icons`, { recursive: true });
  writeFileSync(`${out}/manifest.json`, `${JSON.stringify(manifest(target), null, 2)}\n`);
}
