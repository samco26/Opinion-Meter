/* What the hands draw: the bar pinned beside a result (and the card for
   the query), the tooltip, and the drawer that opens over the page.
   Everything lives in its own shadow root so Google's styles and ours
   never touch. Bars sit on a layer above the page, so nothing of
   Google's clips them or their glow. Greyscale throughout; only the three
   sentiment colours carry colour. A result's bar stays invisible until a
   reading exists; a subject with too few opinions gets an empty outline. */

import type { Gauge } from "./shared";

const BAR_CSS = `
:host{all:initial;position:absolute;display:block;pointer-events:auto;--om-size:12px;--om-width:84px}
:host([data-bare]) .count,:host([data-bare]) .tag{display:none}
.bar.still{cursor:default}
:host([data-flow]){position:static;display:block;margin:0 0 16px}
:host([hidden]){display:none!important}
:host([data-site]){position:fixed;top:12px;right:12px;width:224px;z-index:2147483000;pointer-events:auto;transition:opacity 280ms ease}
:host([data-site][data-faint]){opacity:.22}
:host([data-site][data-faint]:hover),:host([data-site][data-faint]:focus-within){opacity:1}
:host([data-site]) .big{width:224px;max-width:224px;min-width:0;padding:8px 12px;gap:8px;overflow:hidden;background:#f3f5f6d9;border:1px solid #ffffff99;backdrop-filter:blur(22px) saturate(1.05);-webkit-backdrop-filter:blur(22px) saturate(1.05);box-shadow:0 12px 32px #0003}
:host([data-site][data-dark]) .big{background:#303134d9;border-color:#ffffff1f;box-shadow:0 12px 32px #0006}
:host([data-site]) .big:hover{background:#f3f5f6ee}:host([data-site][data-dark]) .big:hover{background:#303134ee}
:host([data-site]) .big .title b,:host([data-site]) .big .count b{font-weight:700}
:host([data-site][data-dragging]) .big{cursor:grabbing}
:host([data-site]) .big .title{flex:0 1 auto;max-width:64px}
:host([data-site]) .big .seg{flex:1 1 48px;min-width:40px}
:host([data-site]) .big .count{font-size:12px}
.dismiss{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:0;padding:0;background:#dfe1e5;color:#1f1f1f;font:14px/20px "Google Sans",Helvetica,Arial,sans-serif;text-align:center;cursor:pointer;opacity:0;transition:opacity 160ms ease,transform 160ms ease}
:host(:hover) .dismiss,.dismiss:focus-visible{opacity:1}.dismiss:hover{transform:scale(1.12)}
:host([data-dark]) .dismiss{background:#5f6368;color:#e8eaed}
.bar{display:inline-flex;align-items:center;gap:7px;margin:0;padding:0;border:0;background:transparent;font:12px/1.2 "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;color:#1f1f1f;cursor:pointer;position:relative;white-space:nowrap;vertical-align:middle;text-align:left;opacity:0;transition:opacity 280ms ease}
.bar.shown{opacity:1}
.bar:focus-visible{outline:3px solid #5f6368;outline-offset:4px;border-radius:99px}
.seg{display:flex;width:var(--om-width);height:var(--om-size);border-radius:99px;overflow:hidden;background:#20212422;flex-shrink:0;transition:box-shadow 180ms ease,transform 180ms cubic-bezier(.16,1,.3,1)}
.bar.still:hover .seg{transform:none;box-shadow:none}
.seg span{display:block;height:100%;transition:flex-basis 500ms cubic-bezier(.16,1,.3,1)}.pos{background:#3fae66}.neu{background:#525a5f}.neg{background:#d95d52}
.bar:hover .seg,.bar:focus-visible .seg{transform:scale(1.04);box-shadow:0 0 0 2px #ffffffcc,0 0 0 4px #9aa0a6cc,0 0 12px 3px #ffffff99}
:host([data-dark]) .bar:hover .seg,:host([data-dark]) .bar:focus-visible .seg{box-shadow:0 0 0 2px #202124,0 0 0 4px #bdc1c6cc,0 0 12px 3px #ffffff66}
.count{white-space:nowrap;color:#5f6368;font-size:12px}.count b{font-weight:500;color:#1f1f1f}
:host([data-dark]) .count{color:#bdc1c6}:host([data-dark]) .count b{color:#e8eaed}:host([data-dark]) .seg{background:#ffffff1f}
.muted{color:#5f6368}
.tag{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#5f6368;border:1px solid #20212433;border-radius:8px;padding:2px 5px;white-space:nowrap}
:host([data-dark]) .tag{color:#bdc1c6;border-color:#ffffff40}
.loading .seg{position:relative;background:#20212418}.loading .seg:before{content:"";position:absolute;inset:0;width:45%;border-radius:99px;background:linear-gradient(90deg,#3fae66 50%,#d95d52 50%);animation:flow 1600ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
.big{display:flex;flex-direction:row;align-items:center;gap:12px;width:100%;max-width:700px;min-height:46px;box-sizing:border-box;margin:0;padding:8px 15px;white-space:nowrap;border-radius:30px;background:#f3f5f6;border:0;box-shadow:none;font:14px/1.3 "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;color:#1f1f1f;transition:opacity 280ms ease,background 180ms ease}
.big:hover{background:#e9ebee}.big:hover .seg{box-shadow:none;transform:none}
.big .title{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:14px}.big .title b{font-weight:500}
.big .seg{flex:1 1 120px;width:auto;min-width:90px;height:14px}
.big .count{flex:0 0 auto;font-size:14px;color:#1f1f1f}.big .count b{font-weight:500;color:inherit}
:host([data-dark]) .big{background:#303134;color:#e8eaed}
:host([data-dark]) .big:hover{background:#3c4043}
:host([data-dark]) .big .tag,:host([data-dark]) .big .muted,:host([data-dark]) .big .count,:host([data-dark]) .big .count b{color:inherit}
:host([data-panel]) .big{max-width:none}
.empty .seg{background:transparent;outline:1px solid #8a949b88;outline-offset:-1px}
:host([data-dark]) .empty .seg{background:transparent;outline-color:#9aa0a688}
:host([data-narrow]) .big .title:has(.name) .lead,:host([data-narrow]) .big .title .of{display:none}
.estimated .seg{outline:1px dashed #9aa0a6;outline-offset:2px}
:host([data-square]){width:auto}
:host([data-square]) .big,:host([data-square][data-dark]) .big{display:grid;grid-template-columns:auto auto;grid-template-areas:"title title" "seg count";align-items:center;column-gap:7px;row-gap:4px;width:auto;min-width:0;max-width:none;min-height:0;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;font-size:12px}
:host([data-square]) .big:hover{background:transparent}
:host([data-square]) .big .title{grid-area:title;flex-basis:auto;font-size:11px;letter-spacing:0;color:#1f1f1f;white-space:nowrap}
:host([data-square][data-dark]) .big .title{color:#f1f3f4}
:host([data-square]) .big .title .name{display:none}
:host([data-square]) .big .seg{grid-area:seg;width:72px;flex:none;min-width:0;height:12px}
:host([data-square]) .big .count{grid-area:count;font-size:12px;white-space:nowrap}
@media(prefers-reduced-motion:reduce){.loading .seg:before{animation:none;width:100%;opacity:.6}.bar,.seg,.seg span{transition:none;animation:none}}
`;

const TIP_CSS = `
:host{all:initial}
.tip{position:fixed;left:0;top:0;z-index:2147483647;width:max-content;max-width:min(420px,80vw);padding:10px 15px;border-radius:16px;background:#f3f5f6;border:0;box-shadow:0 10px 28px #20212426;font:13px/1.45 "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;color:#1f1f1f;white-space:normal;text-align:left;pointer-events:none;opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity 160ms ease,transform 160ms ease,visibility 0s linear 160ms}
.tip.dark{background:#303134;color:#e8eaed;box-shadow:0 10px 28px #00000066}
.tip.on{opacity:1;visibility:visible;transform:none;transition:opacity 160ms ease,transform 160ms ease,visibility 0s}
@media(prefers-reduced-motion:reduce){.tip{transition:none}}
`;

const OVERLAY_CSS = `
:host{all:initial}
.back{position:fixed;inset:0;z-index:2147483646}.back.out{pointer-events:none}
.panel{position:absolute;z-index:2147483647;border-radius:24px;overflow:hidden;border:1px solid #ffffff99;box-shadow:0 24px 72px #0005;background:#f3f5f6d9;backdrop-filter:blur(22px) saturate(1.05);-webkit-backdrop-filter:blur(22px) saturate(1.05);animation:in 240ms cubic-bezier(.16,1,.3,1) both;transition:height 180ms ease}
.panel.dark{background:#303134d9;border-color:#ffffff1f;box-shadow:0 24px 72px #0008}
.panel.fixed{position:fixed}
.panel.out{animation:out 160ms ease both;pointer-events:none}
@keyframes in{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@keyframes out{to{opacity:0;transform:translateY(6px) scale(.98)}}
iframe{display:block;width:100%;height:100%;border:0;background:transparent;color-scheme:light}
.veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#f3f5f666;color:#1f1f1f;font:13px "Google Sans",Helvetica,"Helvetica Neue",Arial,sans-serif;transition:opacity 200ms ease}
.panel.dark .veil{background:#30313466;color:#e8eaed}.panel.dark .veil a{color:#e8eaed}
.veil[hidden]{display:none}.veil a{color:#202124}
.track{width:180px;height:12px;border-radius:99px;position:relative;overflow:hidden;background:#20212433}.track:before{content:"";position:absolute;inset:0;width:55%;border-radius:99px;background:linear-gradient(90deg,transparent,#bdc1c6 15%,#ffffff 55%,#dadce0 80%,transparent);animation:flow 1800ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
button{font:14px Helvetica,"Helvetica Neue",Arial,sans-serif;margin-top:12px;padding:8px 16px;border-radius:99px;border:1px solid #dadce0;background:#e8eaed;color:#202124;cursor:pointer;transition:opacity 180ms ease}button:hover{opacity:.85}
@media(prefers-reduced-motion:reduce){.panel{animation:none}.track:before{animation:none;width:100%}}
`;

export type BarState = { kind: "loading" } | { kind: "ready"; gauge: Gauge } | { kind: "empty"; reason: string; thin?: boolean };

export interface Bar {
  host: HTMLElement;
  set(state: BarState): void;
  remove(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* One tooltip for the whole page, hung off the document root. */
let tipNode: HTMLElement | undefined;
function tipElement(): HTMLElement {
  if (tipNode?.isConnected) return tipNode;
  const host = el("div");
  host.setAttribute("data-opinion-meter", "tip");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = TIP_CSS;
  tipNode = el("div", "tip");
  tipNode.setAttribute("role", "tooltip");
  root.append(style, tipNode);
  document.documentElement.append(host);
  return tipNode;
}
function showTip(text: string, anchor: DOMRect, dark?: boolean) {
  if (!text) return;
  const tip = tipElement();
  tip.classList.toggle("dark", Boolean(dark));
  tip.textContent = text;
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = tip.offsetWidth, height = tip.offsetHeight;
  const below = anchor.bottom + 8;
  tip.style.left = `${Math.max(8, Math.min(anchor.left, vw - width - 8))}px`;
  tip.style.top = `${below + height <= vh - 8 ? below : Math.max(8, anchor.top - height - 8)}px`;
  tip.classList.add("on");
}
function hideTip() { tipNode?.classList.remove("on"); }

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

/* "38% negative"; the number of opinions belongs to the drawer. */
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
   and drawers pass beneath the header as the page scrolls, never over it.
   Undefined where there is no such header (other sites). */
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

/* Google's dark theme is a page background, not a media query; other sites are read the same way. */
export function isDark(): boolean {
  const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (rgb.length < 3 || (rgb.length === 4 && rgb[3] === 0)) return matchMedia("(prefers-color-scheme: dark)").matches;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
}

/* site: the fixed card at the top right of another site (the name alone,
   224 px wide like Google's own pill buttons), with a × that calls
   onDismiss; it can be dragged anywhere, and onMove hears where it lands. */
export function createBar(opts: { big?: boolean; title?: string; dark?: boolean; size?: number; bare?: boolean; site?: boolean; onDismiss?: () => void; onMove?: (pos: { left: number; top: number }) => void; onOpen: (gauge: Gauge | undefined, anchor: DOMRect) => void }): Bar {
  const host = el("div");
  host.setAttribute("data-opinion-meter", opts.site ? "site" : opts.big ? "query" : "result");
  if (opts.dark) host.setAttribute("data-dark", "");
  if (opts.bare) host.setAttribute("data-bare", "");
  if (opts.site) { host.setAttribute("data-site", ""); host.setAttribute("data-narrow", ""); }
  if (opts.size) host.style.setProperty("--om-size", `${opts.size}px`);
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = BAR_CSS;
  const bar = el("button", `bar${opts.big ? " big" : ""} loading`);
  bar.type = "button";
  root.append(style, bar);
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
  /* A thin reading is hover-only: there is no card worth opening. */
  let still = false;
  /* The click that ends a drag is not a click. */
  let suppress = false;
  /* A bar must never act as the link it sits beside. */
  for (const type of SWALLOW) bar.addEventListener(type, (event) => event.stopPropagation());
  bar.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (suppress) { suppress = false; return; }
    if (still) return;
    hideTip();
    opts.onOpen(current, bar.getBoundingClientRect());
  });
  /* A site's card can be dragged anywhere on the window. */
  if (opts.site) {
    let start: { x: number; y: number; left: number; top: number } | null = null;
    let dragging = false;
    bar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const box = host.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      dragging = false;
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 4) return;
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
  const over = () => showTip(detail, bar.getBoundingClientRect(), opts.dark);
  bar.addEventListener("mouseenter", over);
  bar.addEventListener("mouseleave", hideTip);
  bar.addEventListener("focus", over);
  bar.addEventListener("blur", hideTip);
  const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("shown")));
  const render = (state: BarState) => {
    bar.replaceChildren();
    detail = "";
    hideTip();
    bar.classList.toggle("loading", state.kind === "loading");
    bar.classList.toggle("empty", state.kind === "empty");
    bar.classList.toggle("estimated", state.kind === "ready" && Boolean(state.gauge.simulated));
    still = !opts.big && state.kind === "empty" && Boolean(state.thin);
    bar.classList.toggle("still", still);
    if (!opts.big && state.kind !== "ready" && !(state.kind === "empty" && state.thin)) {
      current = undefined;
      host.hidden = true;
      bar.classList.remove("shown");
      return;
    }
    host.hidden = false;
    if (state.kind === "empty") {
      current = undefined;
      if (opts.big) bar.append(titleOf(opts.title ?? "this search"), segments(), el("span", "count muted", state.thin ? "Not enough opinions" : "No verdict yet"));
      else bar.append(segments());
      detail = state.reason;
      bar.setAttribute("aria-label", `${opts.title ?? "This link"}: no verdict. ${state.reason}`);
      reveal();
      return;
    }
    if (state.kind === "loading") {
      /* Just the lead and the moving bar; no words about the wait. */
      bar.append(titleOf(), segments());
      bar.setAttribute("aria-label", "Reading what people think");
      current = undefined;
      reveal();
      return;
    }
    const { gauge } = state;
    current = gauge;
    if (opts.big) bar.append(titleOf(gauge.name, true));
    bar.append(segments(gauge), countText(gauge));
    if (gauge.simulated) bar.append(el("span", "tag", "estimated"));
    detail = `${gauge.simulated ? "Unverified word-count estimate. " : ""}${gauge.sentence}`;
    bar.setAttribute("aria-label", `${gauge.name}: ${gauge.count} opinions. ${detail} Open what people think.`);
    reveal();
  };
  render({ kind: "loading" });
  return { host, set: render, remove: () => { hideTip(); host.remove(); } };
}

/* The drawer: a panel over the page, near the bar that opened it, framing
   the server's embed page. Closes on the embed's say-so, Escape, or a
   click anywhere outside. Returns the close function. */
let activeOverlay: (() => void) | undefined;
export function openOverlay(opts: { url: string; anchor: DOMRect; title: string; dark?: boolean; fixed?: boolean; level?: number; message?: string; onGauge?: (gauge: Gauge) => void }): () => void {
  activeOverlay?.();
  const previousFocus = document.activeElement as HTMLElement | null;
  const host = el("div");
  host.setAttribute("data-opinion-meter", "drawer");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = OVERLAY_CSS;
  const back = el("div", "back");
  /* fixed: opened from a card that is itself fixed to the window (a site's card), so the drawer stays with it. */
  const panel = el("div", `panel${opts.dark ? " dark" : ""}${opts.fixed ? " fixed" : ""}`);
  /* level: the stacking level to sit one step under (Google's search header), so the drawer passes beneath it when scrolled. */
  if (opts.level !== undefined) { panel.style.zIndex = String(opts.level); back.style.zIndex = String(Math.max(1, opts.level - 1)); }
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", `What people think of ${opts.title}`);
  const vw = window.innerWidth, vh = window.innerHeight;
  /* Short until the card arrives: the loading state is a strip, not a box.
     The panel is anchored to the page beside its bar, so it moves with the
     results as the reader scrolls rather than floating over them. */
  const width = Math.min(600, vw - 24), height = Math.min(96, vh - 24);
  const sx = opts.fixed ? 0 : window.scrollX, sy = opts.fixed ? 0 : window.scrollY;
  const below = opts.anchor.bottom + 8;
  const topFor = (h: number) => (below + h <= vh - 12 ? below : Math.max(12, vh - h - 12)) + sy;
  panel.style.width = `${width}px`;
  panel.style.height = `${height}px`;
  panel.style.left = `${Math.max(12, Math.min(opts.anchor.left, vw - width - 12)) + sx}px`;
  panel.style.top = `${topFor(height)}px`;
  const frame = el("iframe");
  if (!opts.message) frame.src = opts.url;
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute("title", `What people think of ${opts.title}`);
  /* Nothing is shown over the frame while it loads: the drawer's own loading strip is the loading state. The veil appears only if the drawer never says it is ready. */
  const veil = el("div", "veil");
  veil.hidden = true;
  let ready = false;
  if (opts.message) {
    const content = el("div");
    content.style.cssText = "padding:24px;font:14px/1.5 Arial,sans-serif;color:#202124";
    content.append(el("strong", undefined, opts.title), el("p", undefined, opts.message));
    const dismiss = el("button", undefined, "Close");
    dismiss.addEventListener("click", () => close());
    content.append(dismiss); panel.append(content); veil.hidden = true;
  } else panel.append(frame, veil);
  root.append(style, back, panel);
  document.documentElement.append(host);
  if (opts.message) panel.style.height = `${Math.min(panel.firstElementChild?.scrollHeight ?? height, vh - 24)}px`;

  let closing = false;
  /* Fades out, then goes. */
  const close = () => {
    if (closing) return;
    closing = true;
    window.removeEventListener("message", onMessage);
    window.removeEventListener("keydown", onKey);
    clearTimeout(fallback);
    panel.classList.add("out");
    back.classList.add("out");
    setTimeout(() => host.remove(), 170);
    previousFocus?.focus({ preventScroll: true });
    if (activeOverlay === close) activeOverlay = undefined;
  };
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { om?: boolean; type?: string; height?: number; gauge?: Gauge } | null;
    if (event.source !== frame.contentWindow || event.origin !== new URL(opts.url).origin || !data?.om) return;
    if (data.type === "ready") { ready = true; veil.hidden = true; }
    if (data.type === "close") close();
    if (data.type === "gauge" && data.gauge && typeof data.gauge.key === "string" && data.gauge.split) opts.onGauge?.(data.gauge);
    if (data.type === "resize" && typeof data.height === "number" && Number.isFinite(data.height)) {
      const height = Math.min(Math.max(72, data.height), vh - 24, 720);
      panel.style.height = `${height}px`;
      panel.style.top = `${topFor(height)}px`;
    }
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  const fallback = setTimeout(() => {
    if (ready) return;
    veil.replaceChildren(el("span", undefined, "The drawer is taking a while."), Object.assign(el("a"), { href: opts.url, target: "_blank", rel: "noopener", textContent: "Open it in a new tab" }));
    veil.hidden = false;
  }, 8000);
  back.addEventListener("click", close);
  window.addEventListener("message", onMessage);
  window.addEventListener("keydown", onKey);
  if (opts.message) panel.querySelector('button')?.focus(); else frame.focus();
  activeOverlay = close;
  return close;
}
