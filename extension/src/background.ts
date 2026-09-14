/* The brain: the only part that talks to the server. It keeps the install
   token, remembers the config for as long as the server says, and passes
   the hands' questions through. It holds no other state. */

import { serverUrl, storage, type ConfigReply, type ExtensionConfig, type Message } from "./shared";

interface CachedConfig { server: string; config: ExtensionConfig; at: number }

async function token(): Promise<string> {
  let value = await storage.get<string>("token");
  if (!value) {
    value = crypto.randomUUID();
    await storage.set({ token: value });
  }
  return value;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${await serverUrl()}${path}`, { ...init, headers: { "Content-Type": "application/json", "X-Install-Token": await token() } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `The server answered ${res.status}.`);
  return data;
}

async function config(): Promise<ConfigReply> {
  const server = await serverUrl();
  const cached = await storage.get<CachedConfig>("config");
  const usable = cached && cached.server === server ? cached : undefined;
  if (usable && Date.now() - usable.at < usable.config.ttlMinutes * 60_000) return { server, config: usable.config };
  try {
    const fresh = await call<ExtensionConfig>("/api/config");
    await storage.set({ config: { server, config: fresh, at: Date.now() } satisfies CachedConfig });
    return { server, config: fresh };
  } catch (err) {
    /* A day on a stale config beats going dark on a hiccup; longer than that, the hands stay still. */
    if (usable && Date.now() - usable.at < 86_400_000) return { server, config: usable.config };
    throw err;
  }
}

function handle(message: Message): Promise<unknown> {
  switch (message.type) {
    case "config": return config();
    case "gauge": return call("/api/gauge", { method: "POST", body: JSON.stringify(message.request) });
    case "poll": return call(`/api/gauge?keys=${encodeURIComponent(message.keys.join(","))}`);
  }
}

chrome.runtime.onInstalled.addListener(() => { void token(); });
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handle(message).then(sendResponse, (err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true;
});
