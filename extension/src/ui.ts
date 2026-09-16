/* What the hands draw: the bar pinned beside a result, the card for the
   query, the card that follows the reader to a site. Each is one element
   that grows: hover and its own background stretches down to show the
   sentence and the three figures; click and it keeps growing into the
   full card, framing the server's embed page inside itself. Nothing
   separate opens on top. Everything lives in its own shadow root so
   Google's styles and ours never touch. Greyscale throughout; only the
   three sentiment colours carry colour. A result's bar stays invisible
   until a reading exists; a subject with too few opinions gets an empty
   outline and only ever shows its sentence. */

import type { Gauge } from "./shared";

const EASE = "cubic-bezier(.16,1,.3,1)";
const BAR_CSS = `
:host{all:initial;position:absolute;display:block;pointer-events:auto;--om-size:12px;--om-width:84px}
:host([data-bare]) .count,:host([data-bare]) .tag{display:none}
:host([data-flow]){position:relative;display:block;height:46px;margin:0 0 16px}
:host([data-flow]) .card{position:absolute;left:0;top:0;width:100%;z-index:1}
:host([hidden]){display:none!important}
:host([data-site]){position:fixed;top:12px;right:12px;width:max-content;max-width:calc(100vw - 24px);z-index:2147483000;pointer-events:auto;transition:opacity 280ms ease}
:host([data-site][data-faint]){opacity:.22}
:host([data-site][data-faint]:hover),:host([data-site][data-faint]:focus-within),:host([data-site][data-faint][data-state="open"]){opacity:1}
.card{position:relative;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;border-radius:30px;border:1px solid transparent;background:transparent;transition:width 340ms ${EASE},height 340ms ${EASE},transform 340ms ${EASE},border-radius 340ms ${EASE},background 200ms ease,box-shadow 200ms ease,border-color 200ms ease}
:host([data-pill]:not([data-square])) .card{background:#f3f5f6}
:host([data-dark][data-pill]:not([data-square])) .card{background:#303134}
:host([data-site]) .card{background:#f3f5f6d9;border-color:#ffffff99;backdrop-filter:blur(22px) saturate(1.05);-webkit-backdrop-filter:blur(22px) saturate(1.05);box-shadow:0 12px 32px #0003}
:host([data-site][data-dark]) .card{background:#303134d9;border-color:#ffffff1f;box-shadow:0 12px 32px #0006}
.card[data-state="hover"],.card[data-state="open"]{background:#f3f5f6f2;border-color:#ffffff99;box-shadow:0 18px 48px #20212433;backdrop-filter:blur(22px) saturate(1.05);-webkit-backdrop-filter:blur(22px) saturate(1.05)}
:host([data-dark]) .card[data-state="hover"],:host([data-dark]) .card[data-state="open"]{background:#303134f2;border-color:#ffffff1f;box-shadow:0 18px 48px #00000080}
.card[data-state="open"]{border-radius:24px}
.card.up .sheet{order:0}.card.up .peek{order:1}.card.up .bar{order:2}.card.up .figs{order:3}
.bar{display:inline-flex;align-items:center;gap:7px;margin:0;padding:0;border:0;background:transparent;font:12px/1.2 "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;color:#1f1f1f;cursor:pointer;position:relative;white-space:nowrap;vertical-align:middle;text-align:left;opacity:0;transition:opacity 280ms ease,padding 340ms ${EASE}}
.bar.shown{opacity:1}
.bar.still{cursor:default}
.bar:focus-visible{outline:3px solid #5f6368;outline-offset:-4px;border-radius:30px}
:host([data-dark]) .bar{color:#e8eaed}
.card[data-state="hover"] .bar:not(.big),.card[data-state="open"] .bar:not(.big){padding:12px 15px 4px;gap:10px}
.bar:not(.big) .name{display:none;font-size:14px;font-weight:500;margin-right:2px;max-width:220px;overflow:hidden;text-overflow:ellipsis}
.card[data-state="hover"] .bar:not(.big) .name,.card[data-state="open"] .bar:not(.big) .name{display:inline}
.seg{display:flex;width:var(--om-width);height:var(--om-size);border-radius:99px;overflow:hidden;background:#20212422;flex-shrink:0;transition:filter 180ms ease,box-shadow 180ms ease}
.seg span{display:block;height:100%;transition:flex-basis 500ms ${EASE}}.pos{background:#3fae66}.neu{background:#525a5f}.neg{background:#d95d52}
.bar:hover .seg,.bar:focus-visible .seg{filter:brightness(1.12);box-shadow:0 0 8px #ffffff33}
.bar.still:hover .seg{filter:none;box-shadow:none}
.count{white-space:nowrap;color:#5f6368;font-size:12px}.count b{font-weight:500;color:#1f1f1f}
:host([data-dark]) .count{color:#bdc1c6}:host([data-dark]) .count b{color:#e8eaed}:host([data-dark]) .seg{background:#ffffff1f}
.muted{color:#5f6368}
.tag{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#5f6368;border:1px solid #20212433;border-radius:8px;padding:2px 5px;white-space:nowrap}
:host([data-dark]) .tag{color:#bdc1c6;border-color:#ffffff40}
.loading .seg{position:relative;background:#20212418}.loading .seg:before{content:"";position:absolute;inset:0;width:45%;border-radius:99px;background:linear-gradient(90deg,#3fae66 50%,#d95d52 50%);animation:flow 1600ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
.big{display:flex;flex-direction:row;align-items:center;gap:12px;width:100%;max-width:700px;min-height:46px;box-sizing:border-box;margin:0;padding:8px 15px;white-space:nowrap;border-radius:30px;background:transparent;border:0;box-shadow:none;font:14px/1.3 "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;color:#1f1f1f}
.big .title{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:14px}.big .title b{font-weight:500}
.big .seg{flex:1 1 120px;width:auto;min-width:90px;height:14px}
.big .count{flex:0 0 auto;font-size:14px;color:#1f1f1f}.big .count b{font-weight:500;color:inherit}
:host([data-dark]) .big{color:#e8eaed}
:host([data-dark]) .big .tag,:host([data-dark]) .big .muted,:host([data-dark]) .big .count,:host([data-dark]) .big .count b{color:inherit}
:host([data-panel]) .big{max-width:none}
:host([data-site]) .big{display:grid;grid-template-columns:minmax(0,max-content) minmax(48px,1fr) max-content;width:100%;min-width:min(224px,calc(100vw - 24px));max-width:none;padding:8px 12px;gap:8px}
:host([data-site]) .big .title{max-width:240px}
:host([data-site]) .big .seg{min-width:40px;width:auto}
:host([data-site]) .big .count{font-size:12px}
:host([data-site]) .big .title b,:host([data-site]) .big .count b{font-weight:700}
:host([data-site][data-dragging]) .big{cursor:grabbing}
.empty .seg{background:transparent;outline:1px solid #8a949b88;outline-offset:-1px}
:host([data-dark]) .empty .seg{background:transparent;outline-color:#9aa0a688}
:host([data-narrow]) .big .title:has(.name) .lead,:host([data-narrow]) .big .title .of{display:none}
.estimated .seg{outline:1px dashed #9aa0a6;outline-offset:2px}
:host([data-square]){width:auto}
:host([data-square]) .big{display:grid;grid-template-columns:auto auto;grid-template-areas:"title title" "seg count";align-items:center;column-gap:7px;row-gap:4px;width:auto;min-width:0;max-width:none;min-height:0;margin:0;padding:0;font-size:12px}
:host([data-square]) .card[data-state="hover"] .big,:host([data-square]) .card[data-state="open"] .big{padding:10px 15px 4px}
:host([data-square]) .big .title{grid-area:title;flex-basis:auto;font-size:11px;letter-spacing:0;color:#1f1f1f;white-space:nowrap}
:host([data-square][data-dark]) .big .title{color:#f1f3f4}
:host([data-square]) .big .title .name{display:none}
:host([data-square]) .big .seg{grid-area:seg;width:72px;flex:none;min-width:0;height:12px}
:host([data-square]) .big .count{grid-area:count;font-size:12px;white-space:nowrap}
.figs{display:none;justify-content:space-between;gap:8px;box-sizing:border-box;padding:0 0 8px;font:11px/1.2 "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
.card[data-state="hover"] .figs,.card[data-state="open"] .figs{display:flex}
.fpos{color:#1e6b3e}.fneu{color:#4a5257}.fneg{color:#8a2f28}
:host([data-dark]) .fpos{color:#7ed49a}:host([data-dark]) .fneu{color:#bdc1c6}:host([data-dark]) .fneg{color:#f19c92}
.peek{display:none;padding:0 15px 14px;font:13.5px/1.45 "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;color:#1f1f1f;white-space:normal;max-width:62ch}
:host([data-dark]) .peek{color:#e8eaed}
.card[data-state="hover"] .peek{display:block}
.sheet{display:none;position:relative;padding:0 2px 2px}
.card[data-state="open"] .sheet{display:block}
iframe{display:block;width:100%;height:100%;border:0;background:transparent;color-scheme:light}
.wait{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:12px;font:13px "Google Sans",Helvetica,Arial,sans-serif;color:#1f1f1f}.wait.on{display:flex}.wait a{color:inherit}
:host([data-dark]) .wait{color:#e8eaed}
.closer{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;border:0;padding:0;background:#ffffff8c;color:#1f1f1f;font:18px/30px "Google Sans",Helvetica,Arial,sans-serif;cursor:pointer;display:none;transition:transform 160ms ease}
.card[data-state="open"] .closer{display:block}.closer:hover{transform:scale(1.1)}
:host([data-dark]) .closer{background:#ffffff1f;color:#e8eaed}
.dismiss{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:0;padding:0;background:#dfe1e5;color:#1f1f1f;font:14px/20px "Google Sans",Helvetica,Arial,sans-serif;text-align:center;cursor:pointer;opacity:0;transition:opacity 160ms ease,transform 160ms ease;z-index:2}
:host(:hover) .dismiss,.dismiss:focus-visible{opacity:1}.dismiss:hover{transform:scale(1.12)}
:host([data-dark]) .dismiss{background:#5f6368;color:#e8eaed}
@media(prefers-reduced-motion:reduce){.loading .seg:before{animation:none;width:100%;opacity:.6}.bar,.card,.seg,.seg span{transition:none;animation:none}}
`;

export type BarState = { kind: "loading" } | { kind: "ready"; gauge: Gauge } | { kind: "empty"; reason: string; thin?: boolean };
export type CardState = "rest" | "hover" | "open";

export interface Bar {
  host: HTMLElement;
  set(state: BarState): void;
  remove(): void;
  /* rest, hover (the sentence showing) or open (the full card inside). */
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
function percentages(gauge: Gauge): [number, number, number] {
  const values = [gauge.split.positive, gauge.split.neutral, gauge.split.negative];
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const exact = values.map((value) => (value / total) * 100);
  const rounded = exact.map(Math.floor);
  let missing = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - rounded[index] })).sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) if (missing-- > 0) rounded[index]++;
  return [rounded[0], rounded[1], rounded[2]];
}

function segments(gauge?: Gauge): HTMLElement {
  const seg = el("div", "seg");
  if (gauge) {
    const [pos, neu, neg] = percentages(gauge);
    for (const [cls, value] of [["pos", pos], ["neu", neu], ["neg", neg]] as const) {
      const span = el("span", cls);
      span.style.flex = `0 0 ${value}%`;
      seg.append(span);
    }
  }
  return seg;
}

/* "38% negative"; the number of opinions belongs to the card. */
function countText(gauge: Gauge): HTMLElement {
  const [pos, , neg] = percentages(gauge);
  const count = el("span", "count");
  const lead = gauge.verdict === "positive" ? `${pos}% positive` : gauge.verdict === "negative" ? `${neg}% negative` : "Mixed opinion";
  count.append(Object.assign(el("b"), { textContent: lead }));
  return count;
}

/* "What people think of Kia": the lead words, then the name. A narrow card
   (above an AI answer's sources) keeps only the name; beside a knowledge
   panel's title, only the lead. */
function titleOf(name?: string, bold = false): HTMLElement {
  const title = el("span", "title");
  title.append(el("span", "lead", "What people think"));
  if (name !== undefined) {
    const span = el("span", "name");
    span.append(el("span", "of", " of "), bold ? Object.assign(el("b"), { textContent: name }) : name);
    title.append(span);
  }
  return title;
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
/* The bar layer's level: just under the header. */
export const resultLevel = () => headerLevel() ?? 127;

/* Google's dark theme is a page background, not a media query; other sites are read the same way. */
export function isDark(): boolean {
  const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (rgb.length < 3 || (rgb.length === 4 && rgb[3] === 0)) return matchMedia("(prefers-color-scheme: dark)").matches;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
}

/* The open card's width: today's drawer width, or the pill's own when it is already that wide. */
const OPEN_WIDTH = 600, HOVER_WIDTH = 420, MIN_SHEET = 120, EDGE = 12;

/* big: the query's card (the lead words and the name). site: the card that
   follows the reader to a site, at least 224 px wide, draggable (onMove
   hears where it lands) with a × that calls onDismiss. drawer: the address
   of the full card for a reading, or null when nothing can open. onGauge:
   the card's numbers coming back, so every bar for the subject agrees.
   relocate: lifts a bar that lives in the page's flow onto the layer
   before it grows, and returns the way back. */
export function createBar(opts: {
  big?: boolean; title?: string; dark?: boolean; size?: number; bare?: boolean; site?: boolean;
  onDismiss?: () => void; onMove?: (pos: { left: number; top: number }) => void;
  drawer: (gauge: Gauge | undefined) => string | null;
  onGauge?: (gauge: Gauge) => void;
  relocate?: () => (() => void) | undefined;
}): Bar {
  const host = el("div");
  host.setAttribute("data-opinion-meter", opts.site ? "site" : opts.big ? "query" : "result");
  if (opts.dark) host.setAttribute("data-dark", "");
  if (opts.bare) host.setAttribute("data-bare", "");
  if (opts.big && !opts.site) host.setAttribute("data-pill", "");
  if (opts.site) { host.setAttribute("data-site", ""); host.setAttribute("data-narrow", ""); }
  if (opts.size) host.style.setProperty("--om-size", `${opts.size}px`);
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = BAR_CSS;
  const card = el("div", "card");
  card.dataset.state = "rest";
  const bar = el("button", `bar${opts.big ? " big" : ""} loading`);
  bar.type = "button";
  const figs = el("div", "figs");
  const peek = el("div", "peek");
  const sheet = el("div", "sheet");
  const wait = el("div", "wait");
  const closer = el("button", "closer", "×");
  closer.type = "button";
  closer.setAttribute("aria-label", "Close");
  sheet.append(wait);
  card.append(bar, figs, peek, sheet, closer);
  root.append(style, card);
  if (opts.onDismiss) {
    const dismiss = el("button", "dismiss", "×");
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Hide on this site");
    for (const type of SWALLOW) dismiss.addEventListener(type, (event) => event.stopPropagation());
    dismiss.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); opts.onDismiss?.(); });
    root.append(dismiss);
  }

  let current: Gauge | undefined;
  let detail = "";
  /* A thin reading only ever shows its sentence: there is no card worth opening. */
  let still = false;
  /* The click that ends a drag is not a click. */
  let suppress = false;
  let state: CardState = "rest";
  let frame: HTMLIFrameElement | null = null;
  let frameOrigin = "";
  let sheetHeight = 0;
  let ready = false;
  let restore: (() => void) | undefined;
  let fallback: number | undefined;
  /* Declared ahead of relax(), which the state change below relies on. */

  /* The three figures, sitting exactly under the row's bar. */
  const figures = () => {
    figs.replaceChildren();
    if (!current) return;
    const [pos, neu, neg] = percentages(current);
    figs.append(el("span", "fpos", `${pos}% positive`), el("span", "fneu", `${neu}% neutral`), el("span", "fneg", `${neg}% negative`));
  };
  const alignFigs = () => {
    const seg = bar.querySelector<HTMLElement>(".seg");
    if (!seg) return;
    const c = card.getBoundingClientRect(), s = seg.getBoundingClientRect();
    figs.style.marginLeft = `${Math.max(0, Math.round(s.left - c.left))}px`;
    figs.style.width = `${Math.round(s.width)}px`;
  };

  /* Grows or shrinks the card to its content, animated, keeping the row
     where it is: leftwards when the window's right edge is near, upwards
     when there is more room above than below. */
  const grow = (width: number | null) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fromW = card.offsetWidth, fromH = card.offsetHeight;
    const rowBox = bar.getBoundingClientRect();
    card.style.transition = "none";
    card.style.width = width ? `${Math.min(width, vw - 2 * EDGE)}px` : "";
    card.style.height = "auto";
    const toW = card.offsetWidth;
    /* Sideways: shift the card left as far as needed, and push the row right by the same, so the row stays put. */
    const hostLeft = host.getBoundingClientRect().left;
    const shift = state === "rest" ? 0 : Math.max(0, Math.min(hostLeft - EDGE, hostLeft + toW - (vw - EDGE)));
    bar.style.marginLeft = `${Math.round(shift)}px`;
    /* Down, always, on a page that scrolls; a card fixed to the window (a site's) grows up only when the window's bottom is right there. */
    const extra = card.offsetHeight - bar.offsetHeight;
    const below = vh - rowBox.bottom - EDGE, above = rowBox.top - EDGE;
    const up = Boolean(opts.site) && state !== "rest" && extra > below && above > below;
    card.classList.toggle("up", up);
    if (state === "open") {
      const room = (up ? above : below) - (card.offsetHeight - sheet.offsetHeight - bar.offsetHeight);
      const cap = Math.max(MIN_SHEET, Math.floor(room));
      if (sheetHeight > cap) { sheetHeight = cap; sheet.style.height = `${cap}px`; }
    }
    const toH = card.offsetHeight;
    card.style.width = `${fromW}px`;
    card.style.height = `${fromH}px`;
    void card.offsetHeight;
    card.style.transition = "";
    card.style.width = `${toW}px`;
    card.style.height = `${toH}px`;
    card.style.transform = `translate(${-Math.round(shift)}px, ${up ? -Math.round(toH - bar.offsetHeight - (state === "rest" ? 0 : figs.offsetHeight)) : 0}px)`;
    alignFigs();
  };
  /* Back at rest, the card follows its content again (after the shrink has
     played, or at once without motion), and a lifted bar returns to the flow. */
  const relax = () => {
    if (state !== "rest") return;
    card.style.width = ""; card.style.height = ""; card.style.transform = ""; bar.style.marginLeft = "";
    if (restore) { const back = restore; restore = undefined; back(); }
  };
  card.addEventListener("transitionend", (event) => { if (event.target === card && event.propertyName === "height") relax(); });

  const setState = (next: CardState) => {
    if (state === next) return;
    /* Leaving rest: a bar living in the page's flow is lifted onto the layer first; back at rest it returns. */
    if (state === "rest" && !restore) restore = opts.relocate?.();
    state = next;
    card.dataset.state = next;
    host.setAttribute("data-state", next);
    host.style.zIndex = next === "rest" ? "" : "1";
    if (next !== "rest") figures();
    const wide = opts.big && host.offsetWidth >= 480;
    grow(next === "rest" ? null : next === "hover" ? (wide ? host.offsetWidth : HOVER_WIDTH) : (wide ? host.offsetWidth : OPEN_WIDTH));
    if (next === "rest") window.setTimeout(relax, 380);
  };

  /* ---- the full card, inside ---- */
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { om?: boolean; type?: string; height?: number; gauge?: Gauge } | null;
    if (!frame || event.source !== frame.contentWindow || event.origin !== frameOrigin || !data?.om) return;
    if (data.type === "ready") { ready = true; wait.classList.remove("on"); }
    if (data.type === "close") close();
    if (data.type === "gauge" && data.gauge && typeof data.gauge.key === "string" && data.gauge.split) opts.onGauge?.(data.gauge);
    if (data.type === "resize" && typeof data.height === "number" && Number.isFinite(data.height)) {
      sheetHeight = Math.min(Math.max(72, Math.ceil(data.height)), 720);
      sheet.style.height = `${sheetHeight}px`;
      if (state === "open") grow(card.offsetWidth);
    }
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  const onOutside = (event: Event) => { if (!event.composedPath().includes(host)) close(); };
  const open = () => {
    const url = opts.drawer(current);
    if (!url || state === "open") return;
    frame = el("iframe");
    frame.src = url;
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("title", `What people think of ${current?.name ?? opts.title ?? "this"}`);
    frameOrigin = new URL(url).origin;
    ready = false;
    sheet.replaceChildren(frame, wait);
    sheetHeight = 96;
    sheet.style.height = "96px";
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside, true);
    fallback = window.setTimeout(() => {
      if (ready) return;
      wait.replaceChildren(el("span", undefined, "The card is taking a while."), Object.assign(el("a"), { href: url, target: "_blank", rel: "noopener", textContent: "Open it in a new tab" }));
      wait.classList.add("on");
    }, 8000);
    setState("open");
  };
  const close = () => {
    if (state !== "open") return;
    window.removeEventListener("message", onMessage);
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onOutside, true);
    clearTimeout(fallback);
    wait.classList.remove("on");
    wait.replaceChildren();
    frame = null;
    sheet.replaceChildren(wait);
    setState("rest");
  };

  /* A bar must never act as the link it sits beside. */
  for (const type of SWALLOW) bar.addEventListener(type, (event) => event.stopPropagation());
  bar.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (suppress) { suppress = false; return; }
    if (still) return;
    /* An open card shrinks back from a click anywhere on it that is not a control; the frame inside says so for its own area. */
    if (state === "open") close(); else open();
  });
  closer.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); close(); });
  for (const part of [figs, peek]) part.addEventListener("click", (event) => { event.stopPropagation(); if (state === "open") close(); });
  host.addEventListener("mouseenter", () => { if (state === "rest" && detail && !host.hasAttribute("data-dragging")) { peek.textContent = detail; setState("hover"); } });
  host.addEventListener("mouseleave", () => { if (state === "hover") setState("rest"); });
  bar.addEventListener("focus", () => { if (state === "rest" && detail) { peek.textContent = detail; setState("hover"); } });
  bar.addEventListener("blur", () => { if (state === "hover") setState("rest"); });

  /* A site's card can be dragged anywhere on the window. */
  if (opts.site) {
    let start: { x: number; y: number; left: number; top: number } | null = null;
    let dragging = false;
    bar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || state === "open") return;
      const box = host.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      dragging = false;
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 4) return;
      if (!dragging && state === "hover") setState("rest");
      dragging = true;
      host.setAttribute("data-dragging", "");
      const w = host.offsetWidth || 224, h = host.offsetHeight || 46;
      host.style.left = `${Math.round(Math.max(4, Math.min(window.innerWidth - w - 4, start.left + dx)))}px`;
      host.style.top = `${Math.round(Math.max(4, Math.min(window.innerHeight - h - 4, start.top + dy)))}px`;
      host.style.right = "auto";
    });
    const settle = (event: PointerEvent) => {
      if (!start) return;
      if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);
      if (dragging) { suppress = true; opts.onMove?.({ left: parseFloat(host.style.left) || 0, top: parseFloat(host.style.top) || 0 }); }
      start = null;
      dragging = false;
      host.removeAttribute("data-dragging");
    };
    bar.addEventListener("pointerup", settle);
    bar.addEventListener("pointercancel", settle);
  }

  const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("shown")));
  /* The row is redrawn for every new reading; an open or hovering card keeps its state and its figures follow. */
  const render = (s: BarState) => {
    bar.replaceChildren();
    detail = "";
    bar.classList.toggle("loading", s.kind === "loading");
    bar.classList.toggle("empty", s.kind === "empty");
    bar.classList.toggle("estimated", s.kind === "ready" && Boolean(s.gauge.simulated));
    still = !opts.big && s.kind === "empty" && Boolean(s.thin);
    bar.classList.toggle("still", still);
    if (!opts.big && s.kind !== "ready" && !(s.kind === "empty" && s.thin)) {
      current = undefined;
      if (state === "open") close();
      host.hidden = true;
      bar.classList.remove("shown");
      return;
    }
    host.hidden = false;
    if (s.kind === "empty") {
      current = undefined;
      if (opts.big) bar.append(titleOf(opts.title ?? "this search"), segments(), el("span", "count muted", s.thin ? "Not enough opinions" : "No verdict yet"));
      else bar.append(el("span", "name", opts.title ?? ""), segments());
      detail = s.reason;
      bar.setAttribute("aria-label", `${opts.title ?? "This link"}: no verdict. ${s.reason}`);
      reveal();
      return;
    }
    if (s.kind === "loading") {
      /* Just the lead and the moving bar; no words about the wait. */
      bar.append(titleOf(), segments());
      bar.setAttribute("aria-label", "Reading what people think");
      current = undefined;
      reveal();
      return;
    }
    const { gauge } = s;
    current = gauge;
    if (opts.big) bar.append(titleOf(gauge.name, true));
    else bar.append(el("span", "name", gauge.name));
    bar.append(segments(gauge), countText(gauge));
    if (gauge.simulated) bar.append(el("span", "tag", "estimated"));
    detail = `${gauge.simulated ? "Unverified word-count estimate. " : ""}${gauge.sentence}`;
    bar.setAttribute("aria-label", `${gauge.name}: ${gauge.count} opinions. ${detail} Open what people think.`);
    if (state !== "rest") { peek.textContent = detail; figures(); requestAnimationFrame(alignFigs); }
    reveal();
  };
  render({ kind: "loading" });
  return { host, set: render, state: () => state, close, remove: () => { close(); host.remove(); } };
}
