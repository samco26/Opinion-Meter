/* What the hands draw, to the design handoff of 16 September 2026: hairline
   bars (2 to 3 px) in the host page's own greys, colour only inside a bar
   or a 5 px dot, labels in the page's muted grey, the page's own font.
   Each bar is one element that grows: rest with the pointer (300 ms) and
   its own background stretches into the source card (name, bar, verdict,
   the three dots, the summary, the platform tiles, the count); click and
   it stays; "See recurring opinions" swaps the summary for the list,
   which the server's page draws inside the card. Everything lives in its
   own shadow root so the page's styles and ours never touch. A bar with
   too few opinions is a plain grey track with no label. */

import type { Gauge } from "./shared";

/* Platform marks for the 24 px tiles, small enough to carry inline. */
const MARKS: Record<string, string> = {
  youtube: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033"/><path d="M10 9l5.5 3L10 15z" fill="#fff"/></svg>'),
  x: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 3h4.6l4.1 5.7L17.6 3H21l-6.7 7.7L21.5 21h-4.6l-4.4-6.1L7.2 21H3.8l7-8.1z" fill="currentColor"/></svg>'),
  hn: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="#ff6600"/><path d="M7 6h2.3l2.7 5.2L14.7 6H17l-4 7.2V18h-2v-4.8z" fill="#fff"/></svg>'),
  bluesky: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 10.8c-1-2-3.9-5.9-6.6-7.8C2.8 1.2 1.8 1.5 1.2 1.8.5 2.1.3 3.2.3 3.8c0 .7.4 5.6.6 6.4.9 2.8 4 3.7 6.9 3.4-4.2.6-7.9 2.1-3 7.5 5.3 5.6 7.3-1.2 8.2-4.6.9 3.4 2 10 8.2 4.6 4.7-4.6 1.2-6.9-3-7.5 2.9.3 6-.6 6.9-3.4.2-.8.6-5.7.6-6.4 0-.6-.2-1.7-.9-2C22.2 1.5 21.2 1.2 18.6 3c-2.7 1.9-5.6 5.8-6.6 7.8z" fill="#1185fe"/></svg>'),
  reddit: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff4500"/><ellipse cx="12" cy="13.5" rx="6" ry="4" fill="#fff"/><circle cx="9.7" cy="13" r="1" fill="#ff4500"/><circle cx="14.3" cy="13" r="1" fill="#ff4500"/></svg>'),
};
const PLATFORM_NAMES: Record<string, string> = { youtube: "YouTube", x: "X", hn: "Hacker News", bluesky: "Bluesky", reddit: "Reddit" };

const CSS = `
:host{all:initial;position:absolute;display:block;pointer-events:auto;font-family:var(--om-font,Helvetica,Arial,sans-serif);--om-h:2px;--om-r:1px;
  --pos:#7ec98f;--neu:#7a7f84;--neg:#e0705f;
  --card:#ffffff;--row:#f6f7f8;--tile:#f0f1f2;--border:#dcdfe2;--divider:#e6e8ea;--track:#e6e8ea;
  --t1:#202122;--t2:#54595d;--tb:#3b4045;--tm:#72777d;--tl:#72777d;
  --shadow:0 6px 24px rgba(0,0,0,.14);--badge-shadow:0 2px 8px rgba(0,0,0,.10)}
:host([data-dark]){--card:#26282b;--row:#2b2d30;--tile:#303235;--border:#35383b;--divider:#33363a;--track:#303235;
  --t1:#e8eaed;--t2:#dadce0;--tb:#c4c8cb;--tm:#969ba1;--tl:#8e9398;
  --shadow:0 12px 32px rgba(0,0,0,.45);--badge-shadow:0 2px 10px rgba(0,0,0,.4)}
:host([hidden]){display:none!important}
:host([data-flow]){position:relative;display:block;height:14px;margin:16px 0 22px}
:host([data-site]){position:fixed;top:12px;right:12px;z-index:2147483000;transition:opacity 280ms ease}
:host([data-site][data-faint]){opacity:.22}
:host([data-site][data-faint]:hover),:host([data-site][data-faint]:focus-within),:host([data-site][data-faint][data-state="open"]){opacity:1}
/* The card: one box that grows. At rest it is the header alone, without
   surface; grown, it is the source card, offset so the header stays put. */
.card{position:absolute;left:calc(-1 * var(--px));top:calc(-1 * var(--pt));box-sizing:border-box;display:flex;flex-direction:column;padding:var(--pt) var(--px) var(--pb);border-radius:12px;border:1px solid transparent;background:transparent;overflow:hidden;white-space:nowrap;--px:0px;--pt:0px;--pb:0px;transition:width 340ms cubic-bezier(.16,1,.3,1),height 340ms cubic-bezier(.16,1,.3,1),background 200ms ease,box-shadow 200ms ease,border-color 200ms ease,border-radius 200ms ease}
.card[data-state="hover"],.card[data-state="open"]{--px:18px;--pt:16px;--pb:14px;background:var(--card);border-color:var(--border);box-shadow:var(--shadow);z-index:1}
:host([data-site]) .card{--px:15px;--pt:8px;--pb:8px;left:0;top:0;position:relative;background:var(--card);border-color:var(--border);border-radius:19px;box-shadow:var(--badge-shadow)}
:host([data-site]) .card[data-state="hover"],:host([data-site]) .card[data-state="open"]{--px:17px;--pt:15px;--pb:13px;border-radius:12px}
:host([data-pill]) .card{white-space:nowrap}
.head{display:flex;align-items:center;gap:11px;min-width:0}
.head.block{display:grid;grid-template-columns:var(--om-indent,0px) auto 1fr auto;grid-template-rows:var(--om-line,20px) auto;grid-template-areas:"name label . x" "bar bar bar bar";row-gap:1px;column-gap:0;align-items:center}
:host([data-bare]) .head .label{display:none}
.head.block .name{grid-area:name;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--t2);opacity:0}
.card[data-state="hover"] .head.block .name,.card[data-state="open"] .head.block .name{opacity:1}
.head.block .label{grid-area:label;margin-left:9px}
.head.block .seg{grid-area:bar;width:var(--om-block,100%)}
.head.block .x{grid-area:x;justify-self:end}
.name{font-size:13px;font-weight:500;color:var(--t1);white-space:nowrap}
.head.line .name{font-size:11px;font-weight:400;color:var(--tl)}
:host([data-site]) .head .name{font-size:12px;font-weight:500;color:var(--t1)}
.label{font-size:11px;color:var(--tl);white-space:nowrap}
.head.line .label{color:var(--tb)}
:host([data-site]) .head .label{color:var(--t2)}
:host([data-site][data-dark]) .head .label{color:var(--tb)}
.seg{display:flex;height:var(--om-h);border-radius:var(--om-r);overflow:hidden;background:var(--track);flex:none;width:var(--om-width,34px);transition:width 340ms cubic-bezier(.16,1,.3,1)}
.head.line .seg{flex:1 1 auto;width:auto;--om-h:3px;--om-r:2px}
:host([data-site]) .head .seg{flex:none;width:48px;--om-h:3px;--om-r:2px}
:host([data-site]) .card[data-state="hover"] .head .seg,:host([data-site]) .card[data-state="open"] .head .seg{flex:1 1 auto;width:auto}
.seg span{display:block;height:100%}.seg .pos{background:var(--pos)}.seg .neu{background:var(--neu)}.seg .neg{background:var(--neg);flex:1}
.seg.wait{position:relative}.seg.wait:before{content:"";position:absolute;inset:0;width:45%;border-radius:inherit;background:linear-gradient(90deg,var(--pos) 50%,var(--neg) 50%);animation:flow 1600ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
.x{display:none;width:18px;height:18px;border-radius:9px;border:0;padding:0;background:var(--tile);color:var(--tm);font:11px/18px inherit;font-family:inherit;text-align:center;cursor:pointer;flex:none}
.card[data-state="open"] .x{display:block}
.head.story{gap:8px}.head.story .label{font-size:10px}
.who{display:none;font-size:13px;font-weight:500;color:var(--t1);white-space:nowrap;margin:0 0 8px}
:host([data-shape="story"]) .card[data-state="hover"] .who,:host([data-shape="story"]) .card[data-state="open"] .who{display:block}
.head.square{display:grid;grid-template-columns:auto auto auto;grid-template-areas:"lead lead lead" "bar label x";align-items:center;column-gap:8px;row-gap:5px}
.head.square .lead{grid-area:lead;font-size:11px;color:var(--tl)}.head.square .seg{grid-area:bar;width:72px;--om-h:3px;--om-r:2px}.head.square .label{grid-area:label;color:var(--tb)}.head.square .x{grid-area:x}
.body{display:none;flex-direction:column;white-space:normal}
.card[data-state="hover"] .body,.card[data-state="open"] .body{display:flex}
.dots{display:flex;gap:16px;margin-top:9px;font-size:10px;color:var(--tl);white-space:nowrap}
.dots span{display:inline-flex;align-items:center;gap:6px}.dots i{width:5px;height:5px;border-radius:3px;flex:none}
.summary{font-size:13px;line-height:1.6;color:var(--tb);margin:16px 0 18px;text-wrap:pretty;max-width:62ch}
:host([data-site]) .summary{font-size:12px;margin:14px 0 16px}
:host([data-site]) .dots{gap:14px;margin-top:8px}
.actions{display:flex;align-items:center;gap:10px}
.tiles{display:flex;gap:6px}
.tile{width:24px;height:24px;border-radius:7px;border:0;padding:0;background:var(--tile);display:grid;place-items:center;cursor:pointer;color:var(--t2);transition:background 160ms ease}.tile:hover{background:var(--border)}
.tile img{width:15px;height:15px;display:block}
.tile.mark-x{color:var(--t1)}
.chip{height:24px;padding:0 11px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--t2);font-size:11px;font-family:inherit;display:inline-flex;align-items:center;cursor:pointer;white-space:nowrap;transition:background 160ms ease}
.chip:hover{background:var(--tile)}.chip.on{background:var(--tile);border-color:var(--tile)}
.meta{flex:1;text-align:right;font-size:10px;color:var(--tl);white-space:nowrap}
:host([data-site]) .tiles{gap:5px}:host([data-site]) .tile{width:22px;height:22px;border-radius:6px}:host([data-site]) .tile img{width:14px;height:14px}
:host([data-site]) .chip{height:22px;padding:0 10px;border-radius:11px;color:var(--tb)}
:host([data-site]) .actions{gap:9px}:host([data-site]) .meta{flex:none;text-align:left;margin-top:11px;order:9;width:100%}
:host([data-site]) .actions{flex-wrap:wrap}
.heading{display:none;font-size:10px;font-weight:500;letter-spacing:.8px;text-transform:uppercase;color:var(--tl);margin:18px 0 9px}
.sheet{display:none;position:relative}
.card.list .dots,.card.list .summary{display:none}.card.list .heading,.card.list .sheet{display:block}
iframe{display:block;width:100%;height:100%;border:0;background:transparent;color-scheme:light}
.wait{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:10px;font-size:11px;color:var(--tl)}.wait.on{display:flex}.wait a{color:inherit}
.divider{height:1px;background:var(--divider);margin:14px calc(-1 * var(--px)) 10px}
:host([data-site]) .divider{margin:11px calc(-1 * var(--px)) 9px}
.foot{font-size:10px;color:var(--tl);background:none;border:0;padding:0;font-family:inherit;cursor:pointer;text-align:left}.foot:hover{color:var(--t2)}
.bar{display:contents}
.dismiss{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:0;padding:0;background:var(--tile);color:var(--t1);font:12px/20px inherit;font-family:inherit;text-align:center;cursor:pointer;opacity:0;transition:opacity 160ms ease;z-index:2}
:host(:hover) .dismiss,.dismiss:focus-visible{opacity:1}
:host([data-dragging]) .card{cursor:grabbing}
.head[tabindex]:focus-visible{outline:2px solid var(--tm);outline-offset:4px;border-radius:4px}
@media(prefers-reduced-motion:reduce){.card,.seg{transition:none}.seg.wait:before{animation:none;width:100%;opacity:.6}}
`;

export type BarState = { kind: "loading" } | { kind: "ready"; gauge: Gauge } | { kind: "empty"; reason: string; thin?: boolean };
export type CardState = "rest" | "hover" | "open";
/* line: label, bar, verdict on one line (the query's line, a panel's line).
   block: the per-result stack, the bar under the name (Google's) with the verdict beside it.
   story: a fixed 34 px bar with the verdict, after a panel entry's name.
   square: "What people think" over the bar and verdict, beside a knowledge panel's title.
   site: the badge on another site. */
export type Shape = "line" | "block" | "story" | "square" | "site";

export interface Bar {
  host: HTMLElement;
  set(state: BarState): void;
  /* The name Google prints beside the bar, the room it takes (indent), the
     column's width (block) and the name line's height (line), so the bar
     sits exactly under the name and the grown card can show the name in
     the very same place. */
  name(text: string, indent: number, block?: number, line?: number): void;
  remove(): void;
  state(): CardState;
  close(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* Percentages that add to exactly 100. */
export function percentages(gauge: Gauge): [number, number, number] {
  const values = [gauge.split.positive, gauge.split.neutral, gauge.split.negative];
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const exact = values.map((value) => (value / total) * 100);
  const rounded = exact.map(Math.floor);
  let missing = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - rounded[index] })).sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) if (missing-- > 0) rounded[index]++;
  return [rounded[0], rounded[1], rounded[2]];
}

/* "82% negative" or "71% positive": whichever side leads; never both. */
const verdict = (gauge: Gauge) => {
  const [pos, , neg] = percentages(gauge);
  return gauge.verdict === "negative" || (gauge.verdict !== "positive" && neg > pos) ? `${neg}% negative` : `${pos}% positive`;
};

/* The bar: positive, neutral (3-part bars only), negative takes the rest. */
function segments(gauge: Gauge | undefined, parts: 2 | 3): HTMLElement {
  const seg = el("div", "seg");
  if (!gauge) return seg;
  const [pos, neu] = percentages(gauge);
  const p = el("span", "pos"); p.style.width = `${pos}%`;
  seg.append(p);
  if (parts === 3) { const n = el("span", "neu"); n.style.width = `${neu}%`; seg.append(n); }
  seg.append(el("span", "neg"));
  return seg;
}

const SWALLOW = ["mousedown", "mouseup", "pointerdown", "pointerup", "auxclick", "touchstart", "touchend"] as const;

/* One step under Google's search header in the stacking order, so bars
   and their open cards pass beneath the header as the page scrolls, never
   over it. Undefined where there is no such header (other sites). */
export function headerLevel(): number | undefined {
  const form = document.querySelector<HTMLElement>("#searchform");
  if (!form) return undefined;
  let level = NaN;
  for (let el: HTMLElement | null = form; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.position !== "static" && style.zIndex !== "auto") level = parseInt(style.zIndex, 10);
  }
  return Number.isFinite(level) ? Math.max(2, level - 1) : 127;
}
export const resultLevel = () => headerLevel() ?? 127;

/* Google's dark theme is a page background, not a media query; other sites are read the same way. */
export function isDark(): boolean {
  const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (rgb.length < 3 || (rgb.length === 4 && rgb[3] === 0)) return matchMedia("(prefers-color-scheme: dark)").matches;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
}
/* The page's own type, so the annotation reads as part of it. */
const pageFont = () => getComputedStyle(document.body).fontFamily || "Helvetica, Arial, sans-serif";

const CARD_WIDTH = 460, SITE_CARD_WIDTH = 360, MIN_SHEET = 120, EDGE = 12, OPEN_DELAY = 300, CLOSE_DELAY = 200;

/* shape: which bar this is. title: the subject's name for a card that has
   no reading yet. drawer: the address of the server's page for a reading
   (the recurring opinions list draws inside the card; platforms and "How
   it works" open it in a new tab). onGauge: the list page's numbers coming
   back. relocate: lifts a bar living in the page's flow onto the layer
   before it grows, and returns the way back. site badges take onDismiss
   (the ×) and onMove (dragged). */
export function createBar(opts: {
  shape: Shape; title?: string; dark?: boolean;
  drawer: (gauge: Gauge | undefined) => string | null;
  onGauge?: (gauge: Gauge) => void;
  relocate?: () => (() => void) | undefined;
  onDismiss?: () => void; onMove?: (pos: { left: number; top: number }) => void;
}): Bar {
  const site = opts.shape === "site";
  const host = el("div");
  host.setAttribute("data-opinion-meter", site ? "site" : opts.shape === "line" || opts.shape === "square" ? "query" : "result");
  host.setAttribute("data-shape", opts.shape);
  if (opts.dark) host.setAttribute("data-dark", "");
  if (site) host.setAttribute("data-site", "");
  if (opts.shape === "line" || opts.shape === "square" || site) host.setAttribute("data-pill", "");
  host.style.setProperty("--om-font", pageFont());
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = CSS;
  const card = el("div", "card");
  card.dataset.state = "rest";
  /* A story's name, on its own line above the bar once the card has grown. */
  const who = el("div", "who");
  const head = el("div", `head ${opts.shape === "block" ? "block" : opts.shape === "square" ? "square" : opts.shape === "story" ? "story" : "line"}`);
  head.setAttribute("tabindex", "0");
  head.setAttribute("role", "img");
  const body = el("div", "body");
  const dots = el("div", "dots");
  const summary = el("div", "summary");
  const actions = el("div", "actions");
  const tiles = el("div", "tiles");
  const chip = el("button", "chip", "See recurring opinions");
  chip.type = "button";
  const meta = el("span", "meta");
  actions.append(tiles, chip, meta);
  const heading = el("div", "heading", "Recurring opinions");
  const sheet = el("div", "sheet");
  const wait = el("div", "wait");
  sheet.append(wait);
  const divider = el("div", "divider");
  const foot = el("button", "foot", "How it works · sources and confidence");
  foot.type = "button";
  body.append(dots, summary, actions, heading, sheet, divider, foot);
  card.append(who, head, body);
  root.append(style, card);
  /* The host's own box is the header's, so the pins measure the bar and never the grown card. */
  if (!site) new ResizeObserver(() => { if (state === "rest") { host.style.width = `${head.offsetWidth}px`; host.style.height = `${head.offsetHeight}px`; } }).observe(head);
  if (opts.onDismiss) {
    const dismiss = el("button", "dismiss", "×");
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Hide on this site");
    for (const type of SWALLOW) dismiss.addEventListener(type, (event) => event.stopPropagation());
    dismiss.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); opts.onDismiss?.(); });
    root.append(dismiss);
  }

  let current: Gauge | undefined;
  let still = false;
  let nameText = opts.title ?? "";
  let state: CardState = "rest";
  let listOpen = false;
  let frame: HTMLIFrameElement | null = null;
  let frameOrigin = "";
  let sheetHeight = 0;
  let ready = false;
  let restore: (() => void) | undefined;
  let fallback: number | undefined;
  let openTimer: number | undefined, closeTimer: number | undefined;
  let hoverArmed = true;
  let suppress = false;

  /* The server's page for this reading, opened in a new tab at a platform's posts or the explainer. */
  const tabTo = (view: string) => {
    const url = opts.drawer(current);
    if (!url) return;
    const u = new URL(url);
    u.searchParams.delete("morph");
    u.searchParams.set("view", view);
    window.open(u.toString(), "_blank", "noopener");
  };

  /* ---- content ---- */
  const fillCard = () => {
    dots.replaceChildren();
    tiles.replaceChildren();
    if (!current) return;
    const [pos, neu, neg] = percentages(current);
    for (const [cls, text] of [["pos", `${pos}% positive`], ["neu", `${neu}% neutral`], ["neg", `${neg}% negative`]] as const) {
      const item = el("span");
      const dot = el("i");
      dot.style.background = `var(--${cls})`;
      item.append(dot, text);
      dots.append(item);
    }
    summary.textContent = current.sentence;
    const sources = (current.sources ?? []).filter((s) => s.count > 0).map((s) => s.source);
    for (const source of sources) {
      const tile = el("button", `tile mark-${source}`);
      tile.type = "button";
      tile.title = PLATFORM_NAMES[source] ?? source;
      tile.setAttribute("aria-label", `${PLATFORM_NAMES[source] ?? source} posts, in a new tab`);
      const img = el("img");
      img.src = MARKS[source] ?? MARKS.hn;
      img.alt = "";
      tile.append(img);
      tile.addEventListener("click", (event) => { event.stopPropagation(); tabTo(source); });
    }
    meta.textContent = listOpen ? `${current.count} opinions` : `${current.count} opinions · ${current.confidence} confidence`;
  };
  foot.addEventListener("click", (event) => { event.stopPropagation(); tabTo("how"); });

  /* ---- sizing: the card grows from the header, which never moves ---- */
  const grow = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fromW = card.offsetWidth, fromH = card.offsetHeight;
    card.style.transition = "none";
    card.style.width = ""; card.style.height = "auto";
    const px = parseFloat(getComputedStyle(card).getPropertyValue("--px")) || 0;
    let width: number | null = null;
    if (state !== "rest") {
      const restW = host.offsetWidth || fromW;
      const wide = (opts.shape === "line") && restW >= 380;
      width = wide ? restW + 2 * px : Math.min(site ? SITE_CARD_WIDTH : CARD_WIDTH, vw - 2 * EDGE);
      card.style.width = `${width}px`;
    }
    /* Sideways: never past the window's right edge; the header is pushed right by the same amount, so it stays put.
       Upwards: a story's name line appears above the bar, and the card rises by exactly that, so the bar stays put. */
    const hostLeft = host.getBoundingClientRect().left;
    const shift = state === "rest" || width === null ? 0 : Math.max(0, Math.min(hostLeft - EDGE, hostLeft - px + width - (vw - EDGE)));
    const rise = state !== "rest" && opts.shape === "story" ? who.offsetHeight : 0;
    card.style.left = `calc(-1 * var(--px) - ${Math.round(shift)}px)`;
    card.style.top = site ? "" : `calc(-1 * var(--pt) - ${Math.round(rise)}px)`;
    head.style.marginLeft = `${Math.round(shift)}px`;
    if (state === "open" && listOpen) {
      const rowBox = head.getBoundingClientRect();
      const room = vh - rowBox.bottom - EDGE - (card.offsetHeight - sheet.offsetHeight - head.offsetHeight);
      const cap = Math.max(MIN_SHEET, Math.floor(room));
      if (sheetHeight > cap) { sheetHeight = cap; sheet.style.height = `${cap}px`; }
    }
    const toW = card.offsetWidth, toH = card.offsetHeight;
    card.style.width = `${fromW}px`; card.style.height = `${fromH}px`;
    void card.offsetHeight;
    card.style.transition = "";
    card.style.width = `${toW}px`; card.style.height = `${toH}px`;
  };
  const relax = () => {
    if (state !== "rest") return;
    card.style.width = ""; card.style.height = ""; card.style.left = ""; card.style.top = ""; head.style.marginLeft = "";
    if (restore) { const back = restore; restore = undefined; back(); }
  };
  card.addEventListener("transitionend", (event) => { if (event.target === card && event.propertyName === "height") relax(); });
  const setState = (next: CardState) => {
    if (state === next) return;
    if (state === "rest" && !restore) restore = opts.relocate?.();
    state = next;
    card.dataset.state = next;
    host.setAttribute("data-state", next);
    host.style.zIndex = next === "rest" ? "" : "1";
    if (next !== "rest") fillCard();
    grow();
    if (next === "rest") window.setTimeout(relax, 380);
  };

  /* ---- the recurring opinions, drawn by the server's page inside the card ---- */
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { om?: boolean; type?: string; height?: number; gauge?: Gauge } | null;
    if (!frame || event.source !== frame.contentWindow || event.origin !== frameOrigin || !data?.om) return;
    if (data.type === "ready") { ready = true; wait.classList.remove("on"); }
    if (data.type === "close") close();
    if (data.type === "gauge" && data.gauge && typeof data.gauge.key === "string" && data.gauge.split) opts.onGauge?.(data.gauge);
    if (data.type === "resize" && typeof data.height === "number" && Number.isFinite(data.height)) {
      sheetHeight = Math.min(Math.max(72, Math.ceil(data.height)), 640);
      sheet.style.height = `${sheetHeight}px`;
      if (state === "open" && listOpen) grow();
    }
  };
  const showList = (on: boolean) => {
    listOpen = on;
    card.classList.toggle("list", on);
    chip.textContent = on ? "Hide recurring opinions" : "See recurring opinions";
    chip.classList.toggle("on", on);
    if (current) meta.textContent = on ? `${current.count} opinions` : `${current.count} opinions · ${current.confidence} confidence`;
    if (on) {
      const url = opts.drawer(current);
      if (!url) return;
      if (!frame) {
        frame = el("iframe");
        frame.src = `${url.replace("#", "&part=opinions#")}`;
        frame.referrerPolicy = "no-referrer";
        frame.setAttribute("title", "Recurring opinions");
        frameOrigin = new URL(url).origin;
        ready = false;
        sheet.replaceChildren(frame, wait);
        sheetHeight = 96;
        sheet.style.height = "96px";
        window.addEventListener("message", onMessage);
        fallback = window.setTimeout(() => {
          if (ready) return;
          wait.replaceChildren(el("span", undefined, "The list is taking a while."), Object.assign(el("a"), { href: url, target: "_blank", rel: "noopener", textContent: "Open it in a new tab" }));
          wait.classList.add("on");
        }, 8000);
      }
    }
    grow();
  };
  const dropList = () => {
    window.removeEventListener("message", onMessage);
    clearTimeout(fallback);
    wait.classList.remove("on");
    wait.replaceChildren();
    frame = null;
    sheet.replaceChildren(wait);
    listOpen = false;
    card.classList.remove("list");
    chip.textContent = "See recurring opinions";
    chip.classList.remove("on");
  };
  chip.addEventListener("click", (event) => { event.stopPropagation(); if (state !== "open") pin(); showList(!listOpen); });

  /* ---- states ---- */
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  const onOutside = (event: Event) => { if (!event.composedPath().includes(host)) close(); };
  const pin = () => {
    if (state === "open" || still || !current) return;
    clearTimeout(openTimer); clearTimeout(closeTimer);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside, true);
    setState("open");
  };
  const close = () => {
    clearTimeout(openTimer); clearTimeout(closeTimer);
    if (state === "rest") return;
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onOutside, true);
    if (frame) dropList();
    hoverArmed = false;
    setState("rest");
  };
  const hoverIn = () => {
    if (!hoverArmed || state !== "rest" || !current || host.hasAttribute("data-dragging")) return;
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    openTimer = window.setTimeout(() => { if (state === "rest" && hoverArmed) setState("hover"); }, OPEN_DELAY);
  };
  const hoverOut = () => {
    clearTimeout(openTimer);
    hoverArmed = true;
    if (state !== "hover") return;
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => { if (state === "hover") setState("rest"); }, CLOSE_DELAY);
  };
  host.addEventListener("mouseenter", hoverIn);
  host.addEventListener("mouseleave", hoverOut);
  head.addEventListener("focus", () => { if (state === "rest" && current) setState("hover"); });
  head.addEventListener("blur", () => { if (state === "hover") hoverOut(); });
  head.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (state === "open") close(); else pin(); } });
  /* A bar must never act as the link it sits beside. */
  for (const type of SWALLOW) card.addEventListener(type, (event) => event.stopPropagation());
  card.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (suppress) { suppress = false; return; }
    if (still || !current) return;
    if ((event.target as HTMLElement).closest?.(".x")) { close(); return; }
    /* Hovering: a click pins. Pinned: a click anywhere that is not a control shrinks it back. */
    if (state !== "open") pin(); else close();
  });

  /* A site's badge can be dragged anywhere on the window. */
  if (site) {
    let start: { x: number; y: number; left: number; top: number } | null = null;
    let dragging = false;
    card.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || state === "open") return;
      const box = host.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      dragging = false;
      card.setPointerCapture(event.pointerId);
    });
    card.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 4) return;
      if (!dragging && state === "hover") { clearTimeout(closeTimer); setState("rest"); }
      clearTimeout(openTimer);
      dragging = true;
      host.setAttribute("data-dragging", "");
      const w = host.offsetWidth || 224, h = host.offsetHeight || 34;
      host.style.left = `${Math.round(Math.max(4, Math.min(window.innerWidth - w - 4, start.left + dx)))}px`;
      host.style.top = `${Math.round(Math.max(4, Math.min(window.innerHeight - h - 4, start.top + dy)))}px`;
      host.style.right = "auto";
    });
    const settle = (event: PointerEvent) => {
      if (!start) return;
      if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
      if (dragging) { suppress = true; opts.onMove?.({ left: parseFloat(host.style.left) || 0, top: parseFloat(host.style.top) || 0 }); }
      start = null;
      dragging = false;
      host.removeAttribute("data-dragging");
    };
    card.addEventListener("pointerup", settle);
    card.addEventListener("pointercancel", settle);
  }

  /* ---- the header for each shape ---- */
  const x = () => { const b = el("button", "x", "×"); b.type = "button"; b.setAttribute("aria-label", "Close"); return b; };
  const renderHead = (s: BarState) => {
    head.replaceChildren();
    const gauge = s.kind === "ready" ? s.gauge : undefined;
    const parts: 2 | 3 = opts.shape === "block" || opts.shape === "story" || (site && state === "rest") ? 2 : 3;
    const seg = segments(gauge, parts);
    if (s.kind === "loading") seg.classList.add("wait");
    const label = el("span", "label", gauge ? verdict(gauge) : "");
    if (opts.shape === "block") {
      head.append(el("span", "name", nameText), label, seg, x());
    } else if (opts.shape === "square") {
      head.append(el("span", "lead", "What people think"), seg, label, x());
    } else if (opts.shape === "story") {
      /* The name Google prints is not in the row; the grown card shows it on a line of its own above. */
      who.textContent = nameText;
      head.append(seg, label, x());
    } else {
      /* line and site: name, bar, verdict. */
      const name = el("span", "name", site ? nameText : `What people think of ${nameText}`);
      head.append(name, seg, label, x());
    }
    const said = gauge ? `${verdict(gauge)} sentiment for ${gauge.name}` : s.kind === "loading" ? `Reading what people think of ${nameText}` : `No verdict for ${nameText}`;
    head.setAttribute("aria-label", said);
  };
  const render = (s: BarState) => {
    still = s.kind !== "ready";
    if (s.kind === "ready") { current = s.gauge; if (opts.shape !== "block" && opts.shape !== "story") nameText = s.gauge.name; }
    else current = undefined;
    if (opts.shape === "block" || opts.shape === "story") {
      /* A result with no reading at all stays invisible; too few opinions is a plain grey track. */
      const show = s.kind === "ready" || (s.kind === "empty" && Boolean(s.thin));
      host.hidden = !show;
      if (!show && state !== "rest") close();
    } else host.hidden = false;
    renderHead(s);
    if (state !== "rest") { fillCard(); grow(); }
  };
  render({ kind: "loading" });
  return {
    host,
    set: render,
    name: (text, indent, block, line) => {
      nameText = text;
      host.style.setProperty("--om-indent", `${Math.max(0, Math.round(indent))}px`);
      if (block !== undefined) host.style.setProperty("--om-block", `${Math.max(34, Math.round(block))}px`);
      if (line !== undefined) host.style.setProperty("--om-line", `${Math.max(12, Math.round(line))}px`);
      const name = head.querySelector(".name");
      if (name && (opts.shape === "block" || opts.shape === "story")) name.textContent = text;
    },
    state: () => state,
    close,
    remove: () => { close(); host.remove(); },
  };
}
