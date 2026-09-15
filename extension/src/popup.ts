/* The menu behind the toolbar icon (and the settings page, opened in a
   tab): "take the bar with you" on or off, the version, the install
   token (the only identifier the extension carries) and the privacy page.

   The server address is not shown: it is a developer setting, kept only
   as the "server" key in local storage for testing against a preview or
   a local server (set it from the extension's service-worker console:
   chrome.storage.local.set({ server: "https://…" }), then remove the
   "config" key; remove "server" to return to the default). */

import { serverUrl, storage } from "./shared";

const sitesSwitch = document.getElementById("sites") as HTMLButtonElement;
const tokenNode = document.getElementById("token")!;
const versionNode = document.getElementById("version")!;
const privacy = document.getElementById("privacy") as HTMLAnchorElement;

async function show() {
  sitesSwitch.setAttribute("aria-checked", String(!(await storage.get<boolean>("sitesOff"))));
  tokenNode.textContent = (await storage.get<string>("token")) ?? "made on first use";
  versionNode.textContent = `v${chrome.runtime.getManifest().version}`;
  privacy.href = `${await serverUrl()}/privacy`;
}

/* Off is stored; on is the absence of the flag, so a fresh install is on. */
async function toggleSites() {
  if (await storage.get<boolean>("sitesOff")) await storage.remove("sitesOff");
  else await storage.set({ sitesOff: true });
  await show();
}

sitesSwitch.addEventListener("click", () => void toggleSites());
void show();
