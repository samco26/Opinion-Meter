/* The hands, on a Google results page: read the results and the query,
   ask the brain, draw a bar under each result that has one and a larger
   one for the query, keep asking while any is still being read, and open
   the drawer on a click. Fails closed: no config, or a page it cannot
   read with confidence, and it draws nothing. */

import { createBar, openOverlay, type Bar } from "./ui";
import { send, type ConfigReply, type ExtensionConfig, type Gauge, type GaugeResponse, type SubjectStates } from "./shared";

interface Found { url: string; title: string; anchor: HTMLAnchorElement }

let config: ExtensionConfig;
let server = "";
let query = "";
let queryBar: Bar | null = null;
let polling = false;
const seen = new WeakSet<Element>();
const bars = new Map<string, Bar[]>();
const pending = new Set<string>();

const currentQuery = () => new URL(location.href).searchParams.get("q")?.trim() ?? "";
const resultsRoot = () => document.querySelector<HTMLElement>(config.google.results) ?? document.body;

/* Google links straight to the destination, or through /url; its own
   pages are not results, except a Maps place. */
function destination(a: HTMLAnchorElement): string | null {
  try {
    const u = new URL(a.href);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname)) {
      if (u.pathname === "/url") {
        const target = u.searchParams.get("q") ?? u.searchParams.get("url") ?? "";
        return /^https?:\/\//.test(target) ? target : null;
      }
      return u.pathname.startsWith("/maps/") ? u.href : null;
    }
    return u.href;
  } catch {
    return null;
  }
}

function readResults(): Found[] {
  const found: Found[] = [];
  const urls = new Set<string>();
  for (const anchor of resultsRoot().querySelectorAll<HTMLAnchorElement>(config.google.anchor)) {
    if (seen.has(anchor)) continue;
    if (found.length >= config.google.maxResults) break;
    seen.add(anchor);
    if (anchor.closest(config.google.ads)) continue;
    const url = destination(anchor);
    const title = anchor.querySelector("h3")?.textContent?.replace(/\s+/g, " ").trim();
    if (!url || !title || urls.has(url)) continue;
    urls.add(url);
    found.push({ url, title, anchor });
  }
  return found;
}

const open = (fallbackName: string) => (gauge: Gauge, anchor: DOMRect) =>
  openOverlay({ url: `${server}/embed?key=${encodeURIComponent(gauge.key)}`, anchor, title: gauge.name || fallbackName });

function attach(key: string, bar: Bar) {
  bars.set(key, [...(bars.get(key) ?? []), bar]);
}

function apply(states: SubjectStates) {
  for (const [key, state] of Object.entries(states)) {
    const targets = bars.get(key) ?? [];
    if (state.state === "ready") {
      pending.delete(key);
      for (const bar of targets) bar.set({ kind: "ready", gauge: state.gauge });
    } else if (state.state === "none") {
      pending.delete(key);
      for (const bar of targets) bar.remove();
      bars.delete(key);
    } else {
      pending.add(key);
    }
  }
}

async function poll() {
  polling = true;
  try {
    for (let round = 0; round < config.polls && pending.size; round++) {
      await new Promise((resolve) => setTimeout(resolve, config.pollMs));
      apply((await send<{ subjects: SubjectStates }>({ type: "poll", keys: [...pending] })).subjects);
    }
  } catch {
    /* The bars still waiting are cleared below. */
  } finally {
    for (const key of pending) {
      for (const bar of bars.get(key) ?? []) bar.remove();
      bars.delete(key);
    }
    pending.clear();
    polling = false;
  }
}

async function scan(first: boolean) {
  const results = readResults();
  if (!results.length && !first) return;
  const drawn = new Map<Found, Bar>();
  for (const result of results) {
    const bar = createBar({ onOpen: open(result.title) });
    result.anchor.insertAdjacentElement("afterend", bar.host);
    drawn.set(result, bar);
  }
  if (first && config.google.queryBar) {
    queryBar = createBar({ big: true, onOpen: open(query) });
    resultsRoot().insertAdjacentElement("afterbegin", queryBar.host);
  }
  let response: GaugeResponse;
  try {
    response = await send<GaugeResponse>({ type: "gauge", request: { query, results: results.map(({ url, title }) => ({ url, title })) } });
  } catch {
    for (const bar of drawn.values()) bar.remove();
    queryBar?.remove();
    queryBar = null;
    return;
  }
  const keyOf = new Map(response.results.map((r) => [r.url, r.key]));
  for (const [result, bar] of drawn) {
    const key = keyOf.get(result.url);
    if (key) attach(key, bar);
    else bar.remove();
  }
  if (first && queryBar) {
    if (response.query.key) attach(response.query.key, queryBar);
    else { queryBar.remove(); queryBar = null; }
  }
  apply(response.subjects);
  if (pending.size && !polling) void poll();
}

function reset() {
  for (const list of bars.values()) for (const bar of list) bar.remove();
  bars.clear();
  pending.clear();
  queryBar?.remove();
  queryBar = null;
}

async function main() {
  if (window.top !== window) return;
  query = currentQuery();
  if (!query) return;
  const reply = await send<ConfigReply>({ type: "config" }).catch(() => null);
  if (!reply?.config.enabled || !reply.config.google.enabled) return;
  ({ server, config } = reply);
  await scan(true);
  let timer: number | undefined;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const now = currentQuery();
      if (now && now !== query) { query = now; reset(); void scan(true); }
      else void scan(false);
    }, 800);
  }).observe(document.body, { childList: true, subtree: true });
}

void main();
