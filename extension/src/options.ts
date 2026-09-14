/* The settings page: where the server is (for development against a
   local or a preview server), and the install token, so a reader can see
   the only identifier the extension carries. */

import { DEFAULT_SERVER, storage } from "./shared";

const field = document.getElementById("server") as HTMLInputElement;
const status = document.getElementById("status")!;
const tokenNode = document.getElementById("token")!;

async function show() {
  field.value = (await storage.get<string>("server")) ?? "";
  tokenNode.textContent = (await storage.get<string>("token")) ?? "made on first use";
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

document.getElementById("save")!.addEventListener("click", () => void save(field.value.trim()));
document.getElementById("reset")!.addEventListener("click", () => void save(""));
void show();
