/* The brain: the only part that talks to the server. It keeps the install
   token, remembers the config for as long as the server says, passes the
   hands' questions through, keeps recent answers for a while (so moving
   between the tabs of one search asks the server nothing), files the
   readings that travel with the reader to the sites they open, fetches a
   site's own reading when none was carried, and passes a page's text to
   the page door when the reader asks for the page's subject. */

import { hostOf, pageOf, serverUrl, siteOf, storage, type ConfigReply, type ExtensionConfig, type Gauge, type GaugeRequest, type GaugeResponse, type Message, type PageRequest, type PageResponse, type SiteReading, type SiteReply, type SubjectStates } from "./shared";

/* The promise-style parts of the API: `browser` where it exists (Firefox), `chrome` otherwise. */
const api: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

interface CachedConfig { server: string; config: ExtensionConfig; at: number }
/* How long an answer is kept here. The server's own memory outlives this;
   what is saved is the round trip, the shimmer and a second card request. */
const REMEMBER_MS = 10 * 60_000;
interface Kept<T> { at: number; value: T }
/* A result's address → its subject's key; the query text → its key; a key → its settled reading; a page → its reading. */
const resultKeys = new Map<string, Kept<string | null>>();
const queryKeys = new Map<string, Kept<string | null>>();
const readings = new Map<string, Kept<SubjectStates[string]>>();
const pages = new Map<string, Kept<PageResponse>>();
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
/* The browser puts this worker to sleep after half a minute without an
   event, whether or not an answer is still on its way; a page reading can
   take longer. Touching an extension API now and then keeps it awake
   while the long call runs. */
async function awake<T>(work: Promise<T>): Promise<T> {
  const timer = setInterval(() => { try { void chrome.runtime.getPlatformInfo(() => { /* Only the call matters. */ }); } catch { /* Not available: nothing to do. */ } }, 20_000);
  try { return await work; } finally { clearInterval(timer); }
}

/* ---- The card on every site ------------------------------------------
   On unless the menu turns it off (the "sitesOff" flag). When a result's
   bar is ready on Google, its reading is filed under the result's host,
   under the whole site when the result was the site itself
   (www.kia.com → kia.com), and under the page for a video. A page on
   another site asks by address and gets the closest match; a site nothing
   was carried for is read by its own address (the origin, never the
   page's path) and the name it declares for itself, and filed the same
   way, so the site's other tabs ask the server nothing. Kept in session
   storage: gone when the browser closes. */
const CARRY_MS = 24 * 3_600_000;
type Carried = Record<string, SiteReading>;
/* Subjects still being read, with the result they were asked for. */
const waiting = new Map<string, { url: string; context: GaugeRequest }>();

const session = {
  get: async <T>(key: string): Promise<T | undefined> => { try { return (await api.storage.session.get(key))[key] as T | undefined; } catch { return undefined; } },
  set: async (items: Record<string, unknown>) => { try { await api.storage.session.set(items); } catch { /* No session storage: carried readings simply do not persist. */ } },
};
const carried = async () => (await session.get<Carried>("carried")) ?? {};

/* Session storage replaces the whole record. Serialize read/modify/write so
   one result cannot overwrite another result arriving in the same batch. */
let carryQueue: Promise<void> = Promise.resolve();
function carry(key: string, gauge: Gauge, url: string, context: GaugeRequest): Promise<void> {
  carryQueue = carryQueue.then(() => saveCarry(key, gauge, url, context));
  return carryQueue;
}
async function saveCarry(key: string, gauge: Gauge, url: string, context: GaugeRequest) {
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
async function lookup(url: string, label?: string): Promise<SiteReply> {
  await carryQueue;
  const server = await serverUrl();
  if (await storage.get<boolean>("sitesOff")) return { reading: null, server, state: "off" };
  const all = await carried();
  const host = hostOf(url), site = siteOf(host);
  const reading = all[`page:${pageOf(url)}`] ?? all[`host:${host}`] ?? all[`site:${site}`] ?? null;
  if (reading && Date.now() - reading.at <= CARRY_MS) return { reading, server, state: "ready" };
  return siteReading(url, label, server);
}
/* The site's own reading, by the site's address alone: from what is
   remembered here, else from the server, whose answer is remembered and
   filed for the site's other tabs. Pending readings are asked about again
   by the site script; here that is one poll. */
async function siteReading(url: string, label: string | undefined, server: string): Promise<SiteReply> {
  const origin = `${new URL(url).origin}/`;
  const host = hostOf(url);
  const name = (label ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const result = { url: origin, title: name || host, ...(name ? { site: name } : {}) };
  const context: GaugeRequest = { query: "", results: [result] };
  const known = resultKeys.get(origin);
  let key: string | null;
  if (fresh(known)) key = known!.value;
  else {
    const response = await call<GaugeResponse>("/api/gauge", { method: "POST", body: JSON.stringify(context) });
    const answer = response.results.find((r) => r.url === origin) ?? response.results[0];
    settle(response.subjects);
    if (!answer || answer.later) return { reading: null, server, state: "pending" };
    keep(resultKeys, origin, answer.key);
    key = answer.key;
  }
  if (key === null) return { reading: null, server, state: "none", reason: "This site names nothing that people rate." };
  let kept = readings.get(key);
  if (!fresh(kept)) {
    const polled = await call<{ subjects: SubjectStates }>(`/api/gauge?keys=${encodeURIComponent(key)}`);
    settle(polled.subjects);
    kept = readings.get(key);
  }
  const state = kept?.value;
  if (!state || state.state === "pending") return { reading: null, server, state: "pending", name: state?.name };
  if (state.state === "none") return { reading: null, server, state: "none", reason: state.reason, thin: state.thin, name: state.name };
  await carry(key, state.gauge, origin, context);
  return { reading: { key, gauge: state.gauge, context, at: Date.now() }, server, state: "ready" };
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
  /* A name still being made on the server is not remembered: the hands ask again shortly and the answer then is the one to keep. */
  if (!response.query.later) keep(queryKeys, request.query, response.query.key);
  for (const r of response.results) if (!r.later) keep(resultKeys, r.url, r.key);
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
    await awake(call(`/api/card?key=${encodeURIComponent(key)}`));
    return { ok: true };
  } catch (err) {
    prepared.delete(key);
    throw err;
  }
}

/* The page's reading: remembered here for a while (back and forward cost
   nothing); the server holds it a quarter of an hour. The text itself is
   passed on and forgotten. */
async function page(request: PageRequest): Promise<PageResponse> {
  const at = pageOf(request.url);
  const kept = pages.get(at);
  if (fresh(kept)) return kept!.value;
  const response = await awake(call<PageResponse>("/api/page", { method: "POST", body: JSON.stringify(request) }));
  keep(pages, at, response);
  return response;
}

function handle(message: Message): Promise<unknown> {
  switch (message.type) {
    case "config": return config();
    case "gauge": return gauge(message.request);
    case "poll": return call<{ subjects: SubjectStates }>(`/api/gauge?keys=${encodeURIComponent(message.keys.join(","))}`).then((response) => { settle(response.subjects); return response; });
    case "prefetch": return prefetch(message.key);
    case "site": return lookup(message.url, message.label);
    case "page": return page(message.request);
  }
}

chrome.runtime.onInstalled.addListener(() => { void token(); });
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handle(message).then(sendResponse, (err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true;
});
