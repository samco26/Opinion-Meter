/* The brain: the only part that talks to the server. It keeps the install
   token, remembers the config for as long as the server says, passes the
   hands' questions through, keeps recent answers for a while (so moving
   between the tabs of one search asks the server nothing), and files the
   readings that travel with the reader to the sites they open ("take the
   bar with you"), which it hands to the site script by address alone. */

import { hostOf, pageOf, serverUrl, siteOf, storage, type ConfigReply, type ExtensionConfig, type Gauge, type GaugeRequest, type GaugeResponse, type Message, type SiteReading, type SiteReply, type SubjectStates } from "./shared";

/* The promise-style parts of the API: `browser` where it exists (Firefox), `chrome` otherwise. */
const api: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

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

/* ---- Take the bar with you --------------------------------------------
   Off until the reader turns it on in the settings, which grants the
   extension the other sites; the site script is then registered for every
   site but Google's search pages. When a result's bar is ready on Google,
   its reading is filed under the result's host, under the whole site when
   the result was the site itself (www.kia.com → kia.com), and under the
   page for a video. A page on another site asks by address and gets the
   closest match, unless the reader hid the card on that site since the
   reading was filed. Kept in session storage: gone when the browser
   closes, refreshed whenever the bar is loaded on Google again. */
const CARRY_MS = 24 * 3_600_000;
const EVERYWHERE = { origins: ["*://*/*"] };
const SITE_SCRIPT = "opinion-meter-site";
type Carried = Record<string, SiteReading>;
/* Subjects still being read, with the result they were asked for. */
const waiting = new Map<string, { url: string; context: GaugeRequest }>();

const session = {
  get: async <T>(key: string): Promise<T | undefined> => { try { return (await api.storage.session.get(key))[key] as T | undefined; } catch { return undefined; } },
  set: async (items: Record<string, unknown>) => { try { await api.storage.session.set(items); } catch { /* No session storage: carried readings simply do not persist. */ } },
};
const carried = async () => (await session.get<Carried>("carried")) ?? {};
const hiddenAt = async () => (await session.get<Record<string, number>>("hidden")) ?? {};

async function carry(key: string, gauge: Gauge, url: string, context: GaugeRequest) {
  const all = await carried();
  const now = Date.now();
  for (const [name, reading] of Object.entries(all)) if (now - reading.at > CARRY_MS) delete all[name];
  const reading: SiteReading = { key, gauge, context, at: now };
  if (key.startsWith("yt:")) all[`page:${pageOf(url)}`] = reading;
  else {
    const host = hostOf(url), site = siteOf(host);
    all[`host:${host}`] = reading;
    if (host === site) all[`site:${site}`] = reading;
  }
  await session.set({ carried: all });
}
/* File what is ready for the sites; remember what is still being made. */
function carryAll(request: GaugeRequest, results: Array<{ url: string; key: string | null }>, subjects: SubjectStates) {
  for (const r of results) {
    if (!r.key) continue;
    const asked = request.results.find((x) => x.url === r.url);
    const context: GaugeRequest = { query: request.query, results: asked ? [asked] : [] };
    const state = subjects[r.key];
    if (state?.state === "ready") void carry(r.key, state.gauge, r.url, context);
    else if (!state || state.state === "pending") waiting.set(r.key, { url: r.url, context });
  }
}
async function lookup(url: string): Promise<SiteReply> {
  const server = await serverUrl();
  const all = await carried(), hidden = await hiddenAt();
  const host = hostOf(url), site = siteOf(host);
  const reading = all[`page:${pageOf(url)}`] ?? all[`host:${host}`] ?? all[`site:${site}`] ?? null;
  if (!reading || Date.now() - reading.at > CARRY_MS) return { reading: null, server };
  const since = Math.max(hidden[`host:${host}`] ?? 0, hidden[`site:${site}`] ?? 0);
  return { reading: since > reading.at ? null : reading, server };
}
async function hide(url: string) {
  const hidden = await hiddenAt();
  hidden[`site:${siteOf(hostOf(url))}`] = Date.now();
  await session.set({ hidden });
}
async function granted(): Promise<boolean> {
  try { return await api.permissions.contains(EVERYWHERE); } catch { return false; }
}
async function registerSite(on: boolean) {
  try { await api.scripting.unregisterContentScripts({ ids: [SITE_SCRIPT] }); } catch { /* Not registered. */ }
  if (!on) return;
  const google = api.runtime.getManifest().content_scripts?.[0]?.matches ?? [];
  await api.scripting.registerContentScripts([{ id: SITE_SCRIPT, matches: ["*://*/*"], excludeMatches: google, js: ["site.js"], runAt: "document_idle", persistAcrossSessions: true }]);
}

async function config(): Promise<ConfigReply> {
  const server = await serverUrl();
  const on = await granted();
  const sites = { granted: on, offer: !on && !(await storage.get<boolean>("offered")) };
  const cached = await storage.get<CachedConfig>("config");
  const usable = cached && cached.server === server ? cached : undefined;
  if (usable && Date.now() - usable.at < usable.config.ttlMinutes * 60_000) return { server, config: usable.config, sites };
  try {
    const fresh = await call<ExtensionConfig>("/api/config");
    await storage.set({ config: { server, config: fresh, at: Date.now() } satisfies CachedConfig });
    return { server, config: fresh, sites };
  } catch (err) {
    /* A day on a stale config beats going dark on a hiccup; longer than that, the hands stay still. */
    if (usable && Date.now() - usable.at < 86_400_000) return { server, config: usable.config, sites };
    throw err;
  }
}

/* Settled readings (ready or empty) are kept; pending ones are not. A
   subject a site is waiting on is filed once it is ready. */
function settle(subjects: SubjectStates) {
  for (const [key, state] of Object.entries(subjects)) {
    if (state.state === "pending") continue;
    keep(readings, key, state);
    const wait = waiting.get(key);
    if (wait && state.state === "ready") { waiting.delete(key); void carry(key, state.gauge, wait.url, wait.context); }
  }
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
    carryAll(request, answer.results, answer.subjects);
    return answer;
  }
  const response = await call<GaugeResponse>("/api/gauge", { method: "POST", body: JSON.stringify(request) });
  keep(queryKeys, request.query, response.query.key);
  for (const r of response.results) keep(resultKeys, r.url, r.key);
  settle(response.subjects);
  carryAll(request, response.results, response.subjects);
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
    case "site": return lookup(message.url);
    case "site-hide": return hide(message.url).then(() => ({ ok: true }));
    case "offer": return storage.set({ offered: true }).then(() => (message.choice === "open" ? api.runtime.openOptionsPage() : undefined)).then(() => ({ ok: true }));
    case "sites": return registerSite(message.enabled).then(() => ({ ok: true }));
  }
}

chrome.runtime.onInstalled.addListener(() => { void token(); void granted().then(registerSite); });
api.runtime.onStartup.addListener(() => { void granted().then(registerSite); });
api.permissions.onRemoved.addListener(() => { void registerSite(false); });
/* The toolbar icon opens the settings, where "take the bar with you" is turned on. */
api.action.onClicked.addListener(() => { void api.runtime.openOptionsPage(); });
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handle(message).then(sendResponse, (err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true;
});
