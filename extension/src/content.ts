import { createBar, openOverlay, type Bar } from "./ui";
import { queryPlacement, readResults, type Found, type QueryPlace } from "./google";
import { send, type ConfigReply, type ExtensionConfig, type Gauge, type GaugeRequest, type GaugeResponse, type SubjectStates } from "./shared";

interface Placed { bar: Bar; target: HTMLElement; placement: "after" | "below" }

let config: ExtensionConfig;
let server = "", query = "", generation = 0, dark = false;
let queryBar: Bar | null = null;
let queryPlace: QueryPlace | null = null;
let seen = new WeakMap<Element, string>();
let queue: Found[] = [];
let busy = false, first = true;
const bars = new Map<string, Bar[]>();
const placements = new Map<HTMLElement, Placed>();
const pending = new Set<string>();
const prefetched = new Set<string>();
const currentQuery = () => (new URL(location.href).searchParams.get("q")?.trim() ?? "").slice(0, 200);

/* Google's dark theme is a page background, not a media query. */
function isDark(): boolean {
  const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (rgb.length < 3 || (rgb.length === 4 && rgb[3] === 0)) return matchMedia("(prefers-color-scheme: dark)").matches;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
}

/* Every bar lives on one layer above the page, pinned to its target by
   page coordinates, so Google's own layout is never touched and nothing
   of Google's can clip a bar or its glow. */
function layer(): HTMLElement {
  let node = document.querySelector<HTMLElement>('[data-opinion-meter="layer"]');
  if (!node) {
    node = document.createElement("div");
    node.setAttribute("data-opinion-meter", "layer");
    node.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none";
    document.body.append(node);
  }
  return node;
}
const onPage = (r: DOMRect) => ({ left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY, width: r.width, height: r.height });
const shown = (el: HTMLElement) => el.isConnected && el.getClientRects().length > 0;

function pinBar({ bar, target, placement }: Placed) {
  const host = bar.host;
  if (host.hidden) return;
  if (!shown(target)) { host.style.visibility = "hidden"; return; }
  host.style.visibility = "";
  const t = onPage(target.getBoundingClientRect());
  const h = host.offsetHeight || 20;
  if (placement === "after") {
    host.style.left = `${Math.round(t.right + 8)}px`;
    host.style.top = `${Math.round(t.top + (t.height - h) / 2)}px`;
  } else {
    host.style.left = `${Math.round(t.left)}px`;
    host.style.top = `${Math.round(t.bottom + 4)}px`;
  }
}
function pinQuery() {
  if (!queryBar || !queryPlace || queryPlace.mode === "flow") return;
  const host = queryBar.host;
  if (queryPlace.mode === "kp") {
    if (!shown(queryPlace.column)) { host.style.visibility = "hidden"; return; }
    host.style.visibility = "";
    const column = onPage(queryPlace.column.getBoundingClientRect()), row = onPage(queryPlace.row.getBoundingClientRect()), panel = onPage(queryPlace.panel.getBoundingClientRect());
    const w = host.offsetWidth || 124, h = host.offsetHeight || 60;
    /* On the same line as the logo, the title and the subtitle; under them only when the panel is too narrow. */
    if (column.right + 16 + w <= panel.right - 4) {
      host.style.left = `${Math.round(column.right + 16)}px`;
      host.style.top = `${Math.round(row.top + (row.height - h) / 2)}px`;
    } else {
      host.style.left = `${Math.round(column.left)}px`;
      host.style.top = `${Math.round(column.bottom + 8)}px`;
    }
    return;
  }
  if (!shown(queryPlace.panel)) { host.style.visibility = "hidden"; return; }
  host.style.visibility = "";
  const p = onPage(queryPlace.panel.getBoundingClientRect());
  host.style.width = `${Math.round(p.width)}px`;
  host.style.left = `${Math.round(p.left)}px`;
  const h = host.offsetHeight || 44;
  host.style.top = `${Math.round(queryPlace.below ? p.bottom + 12 : p.top - h - 12)}px`;
}
function reposition() {
  for (const placed of placements.values()) pinBar(placed);
  pinQuery();
}
const settle = () => requestAnimationFrame(() => requestAnimationFrame(reposition));

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
  settle();
}
/* The query's full card is prepared as soon as the results appear, so the
   drawer opens at once when it is clicked. Once per key per page. */
function prefetch(key: string | null) {
  if (!key || prefetched.has(key)) return;
  prefetched.add(key);
  send({ type: "prefetch", key }).catch(() => { /* The click will simply compute it then. */ });
}
/* Where the query's card goes: beside the knowledge panel's title, above
   or below an AI answer's sources panel, or in the flow above the results. */
function positionQuery() {
  if (!queryBar || !config.google.queryBar) return;
  queryPlace = queryPlacement(config);
  if (!queryPlace) return;
  const host = queryBar.host;
  host.toggleAttribute("data-square", queryPlace.mode === "kp");
  host.toggleAttribute("data-panel", queryPlace.mode === "panel");
  host.toggleAttribute("data-flow", queryPlace.mode === "flow");
  if (queryPlace.mode === "flow") {
    host.style.cssText = "";
    const inPlace = host.parentElement === queryPlace.parent && (queryPlace.before ? host.nextElementSibling === queryPlace.before : queryPlace.parent.lastElementChild === host);
    if (!inPlace) queryPlace.parent.insertBefore(host, queryPlace.before);
  } else {
    if (host.parentElement !== layer()) layer().append(host);
    if (queryPlace.mode === "kp") host.style.width = "";
  }
  settle();
}
function place(result: Found, bar: Bar) {
  layer().append(bar.host);
  placements.set(result.anchor, { bar, target: result.target, placement: result.placement });
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
        if (!result.anchor.isConnected) continue;
        placements.get(result.anchor)?.bar.remove();
        const context = { query: requestQuery, results: [{ url: result.url, title: result.title, ...(result.site ? { site: result.site } : {}) }] };
        const bar = createBar({ title: result.title, dark, size: result.size, onOpen: open(context, result.title) });
        place(result, bar);
        drawn.set(result, bar);
      }
      if (initial && config.google.queryBar) {
        queryBar = createBar({ big: true, title: requestQuery, dark, onOpen: open({ query: requestQuery, results: [] }, requestQuery) });
        positionQuery();
      }
      try {
        const unique = [...new Map(results.map(r => [r.url, { url: r.url, title: r.title, ...(r.site ? { site: r.site } : {}) }])).values()];
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
          /* The query names nothing that can be rated (a login page, a
             search for nothing in particular): no card, rather than a dead one. */
          else { queryBar.remove(); queryBar = null; }
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
    for (const placed of placements.values()) placed.bar.remove();
    placements.clear(); bars.clear(); pending.clear(); prefetched.clear(); queryBar?.remove(); queryBar = null; queryPlace = null;
  }
  if (!query) return;
  for (const [anchor, placed] of placements) if (!anchor.isConnected) { placed.bar.remove(); placements.delete(anchor); }
  queue.push(...readResults(config, seen)); positionQuery(); void drain(); settle();
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
  window.addEventListener("popstate", scan); window.addEventListener("resize", () => { positionQuery(); reposition(); });
  /* Google shifts its page as panels open and images load; follow it. */
  window.setInterval(reposition, 500);
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
