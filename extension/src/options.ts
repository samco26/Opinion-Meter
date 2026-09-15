/* The settings page: "take the bar with you" (the card on the sites you
   open from Google, which needs the browser's permission for those sites
   and so is asked for here, on a click), where the server is (for
   development against a local or a preview server), and the install
   token, so a reader can see the only identifier the extension carries. */

import { DEFAULT_SERVER, send, storage } from "./shared";

const field = document.getElementById("server") as HTMLInputElement;
const status = document.getElementById("status")!;
const tokenNode = document.getElementById("token")!;
const sitesButton = document.getElementById("sites") as HTMLButtonElement;
const sitesStatus = document.getElementById("sites-status")!;
const EVERYWHERE = { origins: ["*://*/*"] };
/* The promise-style permissions API: `browser` where it exists (Firefox), `chrome` otherwise. */
const api: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

const allowed = () => api.permissions.contains(EVERYWHERE).catch(() => false);

async function showSites() {
  const on = await allowed();
  sitesButton.textContent = on ? "Turn off" : "Turn on";
  sitesStatus.textContent = on ? "On. The card appears on the sites whose bar you have seen on Google, until you close the browser." : "Off. Nothing runs outside Google's search pages.";
}

async function toggleSites() {
  sitesButton.disabled = true;
  try {
    if (await allowed()) {
      await api.permissions.remove(EVERYWHERE).catch(() => false);
      await send({ type: "sites", enabled: false }).catch(() => undefined);
    } else {
      const ok = await api.permissions.request(EVERYWHERE).catch(() => false);
      if (!ok) { sitesStatus.textContent = "Not turned on."; return; }
      await send({ type: "sites", enabled: true }).catch(() => undefined);
    }
  } finally {
    sitesButton.disabled = false;
    await showSites();
  }
}

async function show() {
  field.value = (await storage.get<string>("server")) ?? "";
  tokenNode.textContent = (await storage.get<string>("token")) ?? "made on first use";
  await showSites();
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

sitesButton.addEventListener("click", () => void toggleSites());
document.getElementById("save")!.addEventListener("click", () => void save(field.value.trim()));
document.getElementById("reset")!.addEventListener("click", () => void save(""));
void show();
