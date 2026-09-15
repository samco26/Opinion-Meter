/* The menu behind the toolbar icon (and the settings page, opened in a
   tab): "take the bar with you" on or off, and under Advanced the server
   address (for development against a local or a preview server) and the
   install token, the only identifier the extension carries. */

import { DEFAULT_SERVER, serverUrl, storage } from "./shared";

const sitesSwitch = document.getElementById("sites") as HTMLButtonElement;
const field = document.getElementById("server") as HTMLInputElement;
const status = document.getElementById("status")!;
const tokenNode = document.getElementById("token")!;
const versionNode = document.getElementById("version")!;
const privacy = document.getElementById("privacy") as HTMLAnchorElement;

async function show() {
  sitesSwitch.setAttribute("aria-checked", String(!(await storage.get<boolean>("sitesOff"))));
  field.value = (await storage.get<string>("server")) ?? "";
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

async function save(value: string) {
  if (value) {
    try { new URL(value); } catch { status.textContent = "That is not an address."; return; }
    await storage.set({ server: value.replace(/\/+$/, "") });
  } else {
    await storage.remove("server");
  }
  await storage.remove("config");
  status.textContent = value ? `Saved. Using ${value}.` : `Saved. Using ${DEFAULT_SERVER}.`;
  await show();
}

sitesSwitch.addEventListener("click", () => void toggleSites());
document.getElementById("save")!.addEventListener("click", () => void save(field.value.trim()));
document.getElementById("reset")!.addEventListener("click", () => void save(""));
void show();
