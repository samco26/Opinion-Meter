/* The brain: the only part that talks to the server. It keeps the install
   token, remembers the config for as long as the server says, passes the
   hands' questions through, and keeps recent answers for a while, so that
   moving between the tabs of one search draws the bars at once and asks
   the server nothing. It holds no other state. */

import { serverUrl, storage, type ConfigReply, type ExtensionConfig, type GaugeRequest, type GaugeResponse, type Message, type SubjectStates } from "./shared";

interface CachedConfig { server: string; config: ExtensionConfig; at: number }
/* How long an answer is kept here. The server's own memory outlives this;
   what is saved is the round trip, the shimmer and a second card request. */
const REMEMBER_MS = 10 * 60_000;
interface Kept<T> { at: number; value: T }
/* A result's address → its subject's key; the query text → its key; a key → its settled reading. */
const resultKeys = new Map<string, Kept<string | null>>();
const queryKeys = new Map<string, Kept<string | null>>();
const readings = new Map<string, Kept<SubjectStates[string]>>();
/* Cards asked for ahead of a click, by key, and when. */
const prepared = new Map<string, number>();
const fresh = (kept: { at: number } | undefined): boolean => Boolean(kept && Date.now() - kept.at < REMEMBER_MS);
const keep = <T>(map: Map<string, Kept<T>>, key: string, value: T) => map.set(key, { at: Date.now(), value });

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

/* Settled readings (ready or empty) are kept; pending ones are not. */
function settle(subjects: SubjectStates) {
  for (const [key, state] of Object.entries(subjects)) if (state.state !== "pending") keep(readings, key, state);
}

/* From memory when every address and the query are known and settled;
   otherwise the server, whose answer is then remembered. */
async function gauge(request: GaugeRequest): Promise<GaugeResponse> {
  const query = queryKeys.get(request.query);
  const settled = (key: string | null) => key === null || fresh(readings.get(key));
  const known = fresh(query) && settled(query!.value) && request.results.every((r) => { const kept = resultKeys.get(r.url); return fresh(kept) && settled(kept!.value); });
  if (known) {
    const answer: GaugeResponse = { query: { key: query!.value }, results: [], subjects: {} };
    for (const r of request.results) {
      const key = resultKeys.get(r.url)!.value;
      answer.results.push({ url: r.url, key });
      if (key) answer.subjects[key] = readings.get(key)!.value;
    }
    if (answer.query.key) answer.subjects[answer.query.key] = readings.get(answer.query.key)!.value;
    return answer;
  }
  const response = await call<GaugeResponse>("/api/gauge", { method: "POST", body: JSON.stringify(request) });
  keep(queryKeys, request.query, response.query.key);
  for (const r of response.results) keep(resultKeys, r.url, r.key);
  settle(response.subjects);
  return response;
}

/* One card request per subject while it is remembered; the server keeps the finished card for the drawer. */
async function prefetch(key: string): Promise<{ ok: true }> {
  const at = prepared.get(key);
  if (at && Date.now() - at < REMEMBER_MS) return { ok: true };
  prepared.set(key, Date.now());
  try {
    await call(`/api/card?key=${encodeURIComponent(key)}`);
    return { ok: true };
  } catch (err) {
    prepared.delete(key);
    throw err;
  }
}

function handle(message: Message): Promise<unknown> {
  switch (message.type) {
    case "config": return config();
    case "gauge": return gauge(message.request);
    case "poll": return call<{ subjects: SubjectStates }>(`/api/gauge?keys=${encodeURIComponent(message.keys.join(","))}`).then((response) => { settle(response.subjects); return response; });
    case "prefetch": return prefetch(message.key);
  }
}

chrome.runtime.onInstalled.addListener(() => { void token(); });
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handle(message).then(sendResponse, (err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true;
});
