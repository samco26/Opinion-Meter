import { createBar, openOverlay, type Bar } from "./ui";
import { queryPlacement, readResults, type Found } from "./google";
import { send, type ConfigReply, type ExtensionConfig, type Gauge, type GaugeRequest, type GaugeResponse, type SubjectStates } from "./shared";

let config: ExtensionConfig;
let server = "", query = "", generation = 0, dark = false;
let queryBar: Bar | null = null;
let seen = new WeakMap<Element, string>();
let queue: Found[] = [];
let busy = false, first = true;
const bars = new Map<string, Bar[]>();
const placements = new Map<HTMLElement, Bar>();
const pending = new Set<string>();
const prefetched = new Set<string>();
const currentQuery = () => (new URL(location.href).searchParams.get("q")?.trim() ?? "").slice(0, 200);

/* Google's dark theme is a page background, not a media query. */
function isDark(): boolean {
  const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (rgb.length < 3 || (rgb.length === 4 && rgb[3] === 0)) return matchMedia("(prefers-color-scheme: dark)").matches;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
}

const open = (context: GaugeRequest, title: string) => (gauge: Gauge | undefined, anchor: DOMRect) => {
  // No iframe or full reading until a click. Fragment avoids query/title URL logs.
  const fragment = encodeURIComponent(JSON.stringify(context));
  openOverlay({ url: `${server}/embed?key=${encodeURIComponent(gauge?.key ?? "")}#context=${fragment}`, anchor, title: gauge?.name || title });
};
function attach(key: string, bar: Bar) { bars.set(key, [...(bars.get(key) ?? []), bar]); }
function apply(states: SubjectStates) {
  for (const [key, state] of Object.entries(states)) {
    if (state.state === "pending") { pending.add(key); continue; }
    pending.delete(key);
    for (const bar of bars.get(key) ?? []) bar.set(state.state === "ready" ? { kind: "ready", gauge: state.gauge } : { kind: "empty", reason: state.reason, thin: state.thin });
  }
}
/* The query's full card is prepared as soon as the results appear, so the
   drawer opens at once when it is clicked. Once per key per page. */
function prefetch(key: string | null) {
  if (!key || prefetched.has(key)) return;
  prefetched.add(key);
  send({ type: "prefetch", key }).catch(() => { /* The click will simply compute it then. */ });
}
function positionQuery() {
  if (!queryBar || !config.google.queryBar) return;
  const place = queryPlacement(config);
  if (!place) return;
  const host = queryBar.host;
  host.toggleAttribute("data-side", place.side);
  host.toggleAttribute("data-square", place.square);
  const inPlace = host.parentElement === place.parent && (place.before ? host.nextElementSibling === place.before : place.parent.lastElementChild === host);
  if (!inPlace) place.parent.insertBefore(host, place.before);
}
/* A result's bar sits on the site-name line beside the site's name; a
   tile without one gets it inside its heading, else after the link. */
function place(result: Found, bar: Bar) {
  if (result.line?.isConnected) result.line.append(bar.host);
  else if (result.heading?.isConnected) result.heading.append(bar.host);
  else (result.anchor.closest('a, button') ?? result.anchor).insertAdjacentElement("afterend", bar.host);
}
async function drain() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length || first) {
      const epoch = generation, initial = first;
      first = false;
      const results = queue.splice(0, Math.min(20, Math.max(1, config.google.maxResults)));
      const requestQuery = query;
      const drawn = new Map<Found, Bar>();
      for (const result of results) {
        if (!result.anchor.isConnected || result.unavailable) continue;
        placements.get(result.anchor)?.remove();
        const context = { query: requestQuery, results: [{ url: result.url, title: result.title }] };
        const bar = createBar({ title: result.title, dark, size: result.size, onOpen: open(context, result.title) });
        place(result, bar);
        placements.set(result.anchor, bar); drawn.set(result, bar);
      }
      if (initial && config.google.queryBar) {
        queryBar = createBar({ big: true, title: requestQuery, dark, onOpen: open({ query: requestQuery, results: [] }, requestQuery) });
        positionQuery();
      }
      try {
        const unique = [...new Map(results.filter(r => !r.unavailable).map(r => [r.url, { url: r.url, title: r.title }])).values()];
        if (!initial && !unique.length) continue;
        const response = await send<GaugeResponse>({ type: "gauge", request: { query: requestQuery, results: unique } });
        if (epoch !== generation) continue;
        const keys = new Map(response.results.map(r => [r.url, r.key]));
        for (const [result, bar] of drawn) {
          const key = keys.get(result.url);
          if (key) attach(key, bar);
          else bar.set({ kind: "empty", reason: "No reading available for this link." });
        }
        if (initial && queryBar) {
          if (response.query.key) attach(response.query.key, queryBar);
          else queryBar.set({ kind: "empty", reason: "No verdict available for this search." });
        }
        apply(response.subjects);
        if (initial) { prefetch(response.query.key); prefetch(response.results[0]?.key ?? null); }
      } catch {
        if (epoch !== generation) continue;
        for (const bar of drawn.values()) bar.set({ kind: "empty", reason: "The reading could not finish." });
        if (initial) queryBar?.set({ kind: "empty", reason: "The reading could not finish. Click to retry." });
      }
    }
  } finally { busy = false; }
}
function scan() {
  const now = currentQuery();
  if (now !== query) {
    generation++; query = now; first = true; queue = []; seen = new WeakMap();
    for (const bar of placements.values()) bar.remove();
    placements.clear(); bars.clear(); pending.clear(); prefetched.clear(); queryBar?.remove(); queryBar = null;
  }
  if (!query) return;
  for (const [anchor, bar] of placements) if (!anchor.isConnected) { bar.remove(); placements.delete(anchor); }
  queue.push(...readResults(config, seen)); positionQuery(); void drain();
}
async function main() {
  if (window.top !== window || !currentQuery()) return;
  const reply = await send<ConfigReply>({ type: "config" }).catch(() => null);
  if (!reply?.config.enabled || !reply.config.google.enabled) return;
  ({ server, config } = reply); query = currentQuery(); dark = isDark(); scan();
  let timer: number | undefined;
  new MutationObserver(records => {
    if (records.every(record => (record.target as Element).closest?.('[data-opinion-meter]') || (record.type === "childList" && [...record.addedNodes, ...record.removedNodes].every(node => node instanceof Element && node.hasAttribute('data-opinion-meter'))))) return;
    clearTimeout(timer); timer = window.setTimeout(scan, 500);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "aria-label", "data-docid"] });
  window.addEventListener("popstate", scan); window.addEventListener("resize", positionQuery);
  const rounds = new Map<string, number>();
  let polling = false;
  window.setInterval(async () => {
    if (polling || !pending.size) return;
    polling = true;
    const epoch = generation;
    const keys = [...pending].slice(0, 20);
    try {
      const response = await send<{ subjects: SubjectStates }>({ type: "poll", keys });
      if (epoch !== generation) return;
      apply(response.subjects);
    } catch { /* Bounded retries below, including network failures. */ }
    finally {
      if (epoch === generation) for (const key of keys) {
        rounds.set(key, (rounds.get(key) ?? 0) + 1);
        if (pending.has(key) && rounds.get(key)! >= config.polls) {
          pending.delete(key);
          for (const bar of bars.get(key) ?? []) bar.set({ kind: "empty", reason: "Reading timed out." });
        }
      }
      polling = false;
    }
  }, config.pollMs);
}
void main();
