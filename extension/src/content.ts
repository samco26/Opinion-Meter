import { createBar, isDark, resultLevel, type Bar } from "./ui";
import { kpHeader, queryPlacement, readResults, textBox, type Found, type QueryPlace } from "./google";
import { send, type ConfigReply, type ExtensionConfig, type Gauge, type GaugeRequest, type GaugeResponse, type SubjectStates } from "./shared";

/* restHeight: the bar's height while nothing has grown; a grown card is pinned by that, never by its own. */
interface Placed { bar: Bar; anchor: HTMLElement; target: HTMLElement; placement: Found["placement"]; fitEnd?: HTMLElement; line?: HTMLElement; block?: HTMLElement; icon?: HTMLElement; heading?: HTMLElement; site?: string; restHeight?: number }
/* Tabs where a video's reading costs YouTube quota: no card is prepared ahead there. */
const VIDEO_TABS = new Set(["7", "39"]);
/* A story's bar is a fixed 34 px; its verdict needs about this much beside it. */
const STORY_BAR = 34, STORY_ROOM = 90;
/* The gap opened under a result's site name for the hairline. */
const GAP = 5;
const udm = () => new URL(location.href).searchParams.get("udm") ?? "";

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

/* Every bar lives on one layer above the page, pinned to its target by
   page coordinates, so Google's own layout is never touched and nothing
   of Google's can clip a bar or its glow. The layer sits one step under
   Google's search header, so bars pass beneath it as the page scrolls. */
function layer(): HTMLElement {
  let node = document.querySelector<HTMLElement>('[data-opinion-meter="layer"]');
  if (!node) {
    node = document.createElement("div");
    node.setAttribute("data-opinion-meter", "layer");
    node.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;pointer-events:none";
    document.body.append(node);
  }
  node.style.zIndex = String(resultLevel());
  return node;
}
const onPage = (r: DOMRect) => ({ left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY, width: r.width, height: r.height });
/* On the page and actually visible now: Google keeps a collapsed copy of an
   expanded list in place but unseen, and a bar must not stay on it. Checked
   at every tick, so a moment of fading in costs nothing. */
const shown = (el: HTMLElement) => {
  if (!el.isConnected || el.getClientRects().length === 0) return false;
  const check = (el as unknown as { checkVisibility?: (options: Record<string, boolean>) => boolean }).checkVisibility;
  return typeof check !== "function" || check.call(el, { checkOpacity: true, checkVisibilityCSS: true });
};
/* The first line of a title that may wrap. */
function firstLine(el: HTMLElement): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getClientRects().item(0) ?? el.getBoundingClientRect();
}

/* The box the boxes around a target let it show through: every ancestor
   that clips (a panel scrolling on its own, a collapsed list cut off at a
   height) narrows it. Null when nothing clips. */
function window_(el: HTMLElement): { top: number; bottom: number } | null {
  let box: { top: number; bottom: number } | null = null;
  for (let p = el.parentElement, depth = 0; p && p !== document.body && depth < 14; p = p.parentElement, depth++) {
    if (getComputedStyle(p).overflowY === "visible") continue;
    const r = onPage(p.getBoundingClientRect());
    box = box ? { top: Math.max(box.top, r.top), bottom: Math.min(box.bottom, r.bottom) } : { top: r.top, bottom: r.bottom };
  }
  return box;
}
/* Inside such boxes the bar is trimmed at their edges and hidden once its
   target is cut off entirely, so it never drifts outside them. */
function clipTo(host: HTMLElement, target: HTMLElement) {
  const box = window_(target);
  if (!box) { host.style.clipPath = ""; return; }
  const top = parseFloat(host.style.top) || 0, height = host.offsetHeight || 20;
  if (top + height <= box.top + 1 || top >= box.bottom - 1) { host.style.visibility = "hidden"; return; }
  host.style.clipPath = `inset(${Math.max(0, Math.ceil(box.top - top))}px 0 ${Math.max(0, Math.ceil(top + height - box.bottom))}px 0)`;
}

function pinBar(placed: Placed) {
  place(placed);
  /* A card that has grown reaches past its panel on purpose. */
  if (placed.bar.state() === "rest") clipTo(placed.bar.host, placed.target);
  else placed.bar.host.style.clipPath = "";
}
/* The visible end of a label's text: Google clips a long label inside a
   fixed-width box and the text runs on unseen past it, so the end is the
   nearest clipping box's edge, never the text's own. */
function visibleEnd(target: HTMLElement, anchor: HTMLElement) {
  const t = onPage(target.getBoundingClientRect());
  const range = document.createRange();
  range.selectNodeContents(target);
  const text = onPage(range.getBoundingClientRect());
  let clip = Infinity;
  for (let el: HTMLElement | null = target, depth = 0; el && el !== anchor.parentElement && depth < 12; el = el.parentElement, depth++) {
    if (getComputedStyle(el).overflowX !== "visible") clip = Math.min(clip, onPage(el.getBoundingClientRect()).right);
  }
  return { left: Math.min(text.left || t.left, t.left), right: Math.min(text.right || t.right, t.right, clip), top: text.height ? text.top : t.top, height: text.height || t.height };
}
function place(placed: Placed) {
  const { bar, anchor, target, placement, fitEnd } = placed;
  const host = bar.host;
  if (host.hidden) return;
  if (!shown(target)) { host.style.visibility = "hidden"; return; }
  host.style.visibility = "";
  const t = onPage(target.getBoundingClientRect());
  if (bar.state() === "rest") placed.restHeight = host.offsetHeight || placed.restHeight;
  const h = placed.restHeight || host.offsetHeight || 20;
  if (placement === "block" && placed.line && placed.block) {
    /* The stack: the verdict right after the site's name, the hairline under
       the whole row from the result's left edge (level with the title) to the
       end of the name-and-address column, inside a gap opened under the name's
       line so nothing of Google's moves but the address, by 5 px. The host
       sits at the row's exact fractional position, so the verdict shares the
       name's pixel row on every zoom level. */
    const line = placed.line, block = placed.block;
    if (!(line.nextElementSibling instanceof HTMLElement && line.nextElementSibling.getAttribute("data-opinion-meter") === "gap")) {
      const gap = document.createElement("div");
      gap.setAttribute("data-opinion-meter", "gap");
      gap.style.cssText = `height:${GAP}px;flex:none`;
      line.after(gap);
    }
    const name = visibleEnd(target, anchor);
    const lineBox = onPage(line.getBoundingClientRect()), blockBox = onPage(block.getBoundingClientRect());
    const address = line.nextElementSibling?.nextElementSibling instanceof HTMLElement ? visibleEnd(line.nextElementSibling.nextElementSibling, anchor) : null;
    /* The row starts where the title does (the favicon's left edge); on Google the name-and-address column stands to the favicon's right. */
    const heading = placed.heading && shown(placed.heading) ? onPage(placed.heading.getBoundingClientRect()) : null;
    const left = Math.min(blockBox.left, heading?.left ?? blockBox.left);
    const iconBox = placed.icon ? onPage(placed.icon.getBoundingClientRect()) : null;
    const width = Math.min(blockBox.left + blockBox.width - left, Math.max(name.right, address?.right ?? 0) - left + 2);
    bar.name(placed.site ?? "", name.right - name.left, { block: width, line: lineBox.height, lead: name.left - left, icon: placed.icon, iconX: iconBox ? iconBox.left - left : 0, iconY: iconBox ? iconBox.top - lineBox.top : 0, like: target });
    host.style.left = `${left}px`;
    host.style.top = `${lineBox.top}px`;
  } else if (placement === "after") {
    /* A small bar with its verdict right after the text itself. */
    const box = visibleEnd(target, anchor);
    bar.name(placed.site ?? "", box.right + 8 - box.left);
    host.style.left = `${Math.round(box.right + 8)}px`;
    host.style.top = `${Math.round(box.top + (box.height - h) / 2)}px`;
  } else if (placement === "below") {
    bar.name(placed.site ?? "", 0);
    host.style.left = `${Math.round(t.left)}px`;
    host.style.top = `${Math.round(t.bottom + 4)}px`;
  } else if (placement === "corner") {
    /* The card's top-right corner, on the title's first line, the verdict dropped when the line is close. */
    const first = fitEnd && shown(fitEnd) ? onPage(firstLine(fitEnd)) : null;
    const right = t.right - 12;
    const room = first ? Math.floor(right - first.right - 8) : STORY_ROOM;
    host.toggleAttribute("data-bare", room < STORY_ROOM);
    const width = room < STORY_ROOM ? STORY_BAR : host.offsetWidth || STORY_ROOM;
    bar.name(placed.site ?? "", 0);
    host.style.left = `${Math.round(right - width)}px`;
    host.style.top = `${Math.round(first ? first.top + (first.height - h) / 2 : t.top + 10)}px`;
  } else {
    /* After the label's visible text, the verdict dropped when the dots are close. */
    const box = visibleEnd(target, anchor);
    const limit = fitEnd && shown(fitEnd) ? onPage(fitEnd.getBoundingClientRect()).left - 10 : onPage(anchor.getBoundingClientRect()).right - 12;
    host.toggleAttribute("data-bare", limit - box.right - 8 < STORY_ROOM);
    bar.name(placed.site ?? "", box.right + 8 - box.left);
    host.style.left = `${Math.round(box.right + 8)}px`;
    host.style.top = `${Math.round(box.top + (box.height - h) / 2)}px`;
  }
}
function pinQuery() {
  if (!queryBar || !queryPlace || queryPlace.mode === "flow" || queryBar.state() !== "rest") return;
  const host = queryBar.host;
  if (queryPlace.mode === "kp") {
    if (!shown(queryPlace.title)) { host.style.visibility = "hidden"; return; }
    host.style.visibility = "";
    const header = kpHeader(queryPlace.title, queryPlace.subtitle, queryPlace.others);
    const panel = onPage(queryPlace.panel.getBoundingClientRect());
    const w = host.offsetWidth || 160, h = host.offsetHeight || 36;
    /* Right after the dots; pulled left only if a logo leaves no room. */
    const limit = Math.min(header.limit + scrollX, panel.right - 12);
    host.style.left = `${Math.round(Math.min(header.right + scrollX + 16, Math.max(header.right + scrollX + 8, limit - w)))}px`;
    /* The bar on the subtitle's line, "What people think" above it. */
    const seg = host.shadowRoot?.querySelector<HTMLElement>(".seg");
    const segMid = seg ? seg.getBoundingClientRect().top + seg.getBoundingClientRect().height / 2 - host.getBoundingClientRect().top : h - 4;
    host.style.top = `${Math.round(header.base.top + scrollY + (header.base.bottom - header.base.top) / 2 - segMid)}px`;
    return;
  }
  if (!shown(queryPlace.panel)) { host.style.visibility = "hidden"; return; }
  host.style.visibility = "";
  const p = onPage(queryPlace.panel.getBoundingClientRect());
  host.style.width = `${Math.round(p.width)}px`;
  host.style.left = `${Math.round(p.left)}px`;
  const h = host.offsetHeight || 14;
  host.style.top = `${Math.round(queryPlace.below ? p.bottom + 14 : p.top - h - 14)}px`;
}
function reposition() {
  if (placements.size || queryBar) layer();
  for (const placed of placements.values()) pinBar(placed);
  pinQuery();
}
const settle = () => requestAnimationFrame(() => requestAnimationFrame(reposition));

/* The address of the full card for a bar's reading: the embed in its morph
   shape (no title bar and no bar of its own; the pill is both). Nothing is
   fetched until a click. The fragment carries the query and the result so
   a lost subject can be recovered, and stays out of address logs. */
const drawerFor = (context: GaugeRequest) => (gauge: Gauge | undefined) =>
  `${server}/embed?key=${encodeURIComponent(gauge?.key ?? "")}&morph=1${dark ? "&theme=dark" : ""}#context=${encodeURIComponent(JSON.stringify(context))}`;
/* The card's numbers come back; every bar for that subject takes them. */
const take = (fresh: Gauge) => apply({ [fresh.key]: { state: "ready", gauge: fresh } });
/* The query's card in the results flow cannot grow there without pushing
   the results down, and there it would sit under the bar layer: before it
   grows (hover or click) it is lifted onto the layer at the very same
   spot, a blank of its size holding its place, and put back after. */
function liftQuery(): (() => void) | undefined {
  if (!queryBar || queryPlace?.mode !== "flow") return undefined;
  const host = queryBar.host;
  const box = onPage(host.getBoundingClientRect());
  const blank = document.createElement("div");
  blank.setAttribute("data-opinion-meter", "blank");
  blank.style.cssText = `height:${box.height}px;margin:14px 0 20px`;
  host.before(blank);
  host.removeAttribute("data-flow");
  host.style.cssText = `left:${box.left}px;top:${box.top}px;width:${box.width}px`;
  layer().append(host);
  return () => {
    host.style.cssText = "";
    host.setAttribute("data-flow", "");
    if (blank.isConnected) blank.replaceWith(host);
    else queryPlace?.mode === "flow" && queryPlace.parent.insertBefore(host, queryPlace.before);
  };
}
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
  if (!queryBar || !config.google.queryBar || queryBar.state() !== "rest") return;
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
function hold(result: Found, bar: Bar) {
  /* Unseen until its first placement, so a bar never flashes at the layer's origin. */
  bar.host.style.visibility = "hidden";
  layer().append(bar.host);
  placements.set(result.anchor, { bar, anchor: result.anchor, target: result.target, placement: result.placement, fitEnd: result.fitEnd, line: result.line, block: result.block, icon: result.icon, heading: result.heading, site: result.site });
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
        const bar = createBar({ shape: result.placement === "block" ? "block" : "story", title: result.site ?? result.title, dark, drawer: drawerFor(context), onGauge: take });
        hold(result, bar);
        drawn.set(result, bar);
      }
      if (initial && config.google.queryBar) {
        /* Beside a knowledge panel's title the card is the small square; everywhere else the line. */
        queryPlace = queryPlacement(config);
        queryBar = createBar({ shape: queryPlace?.mode === "kp" ? "square" : "line", title: requestQuery, dark, drawer: drawerFor({ query: requestQuery, results: [] }), onGauge: take, relocate: liftQuery });
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
        if (initial && !VIDEO_TABS.has(udm())) { prefetch(response.query.key); prefetch(response.results[0]?.key ?? null); }
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
  /* A box that scrolls on its own (an expanded sources panel) moves its targets at once; follow without waiting for the next tick. */
  let following = false;
  document.addEventListener("scroll", (event) => {
    if (event.target === document || following) return;
    following = true;
    requestAnimationFrame(() => { following = false; reposition(); });
  }, { capture: true, passive: true });
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
