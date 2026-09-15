/* What the hands draw: the bar pinned beside a result (and the card for
   the query), the tooltip, and the drawer that opens over the page.
   Everything lives in its own shadow root so Google's styles and ours
   never touch. Bars sit on a layer above the page, so nothing of
   Google's clips them or their glow. Greyscale throughout; only the three
   sentiment colours carry colour. A result's bar stays invisible until a
   reading exists; a subject with too few opinions gets an empty outline. */

import type { Gauge } from "./shared";

const BAR_CSS = `
:host{all:initial;position:absolute;display:block;pointer-events:auto;--om-size:12px}
:host([data-flow]){position:static;display:block;margin:0 0 16px}
:host([hidden]){display:none!important}
.bar{display:inline-flex;align-items:center;gap:7px;margin:0;padding:0;border:0;background:transparent;font:12px/1.2 Helvetica,"Helvetica Neue",Arial,sans-serif;color:#202124;cursor:pointer;position:relative;white-space:nowrap;vertical-align:middle;text-align:left;opacity:0;transition:opacity 280ms ease}
.bar.shown{opacity:1}
.bar:focus-visible{outline:3px solid #5f6368;outline-offset:4px;border-radius:99px}
.seg{display:flex;width:84px;height:var(--om-size);border-radius:99px;overflow:hidden;background:#20212422;flex-shrink:0;transition:box-shadow 180ms ease,transform 180ms cubic-bezier(.16,1,.3,1)}
.seg span{display:block;height:100%;transition:flex-basis 500ms cubic-bezier(.16,1,.3,1)}.pos{background:#3fae66}.neu{background:#525a5f}.neg{background:#d95d52}
.bar:hover .seg,.bar:focus-visible .seg{transform:scale(1.04);box-shadow:0 0 0 2px #ffffffcc,0 0 0 4px #9aa0a6cc,0 0 12px 3px #ffffff99}
:host([data-dark]) .bar:hover .seg,:host([data-dark]) .bar:focus-visible .seg{box-shadow:0 0 0 2px #202124,0 0 0 4px #bdc1c6cc,0 0 12px 3px #ffffff66}
.count{white-space:nowrap;color:#5f6368;font-size:12px}.count b{font-weight:700;color:#202124}
:host([data-dark]) .count{color:#bdc1c6}:host([data-dark]) .count b{color:#e8eaed}:host([data-dark]) .seg{background:#ffffff1f}
.muted{color:#5f6368}
.tag{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#5f6368;border:1px solid #20212433;border-radius:8px;padding:2px 5px;white-space:nowrap}
:host([data-dark]) .tag{color:#bdc1c6;border-color:#ffffff40}
.loading .seg{position:relative;background:#20212418}.loading .seg:before{content:"";position:absolute;inset:0;width:55%;border-radius:99px;background:linear-gradient(90deg,transparent,#bdc1c6 15%,#ffffff 55%,#dadce0 80%,transparent);animation:flow 1600ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
.big{display:flex;flex-direction:row;align-items:center;gap:12px;width:100%;max-width:700px;box-sizing:border-box;margin:0;padding:10px 14px;white-space:nowrap;border-radius:16px;background:#f1f3f4cc;border:1px solid #dadce0;box-shadow:0 4px 14px #20212414;transition:opacity 280ms ease,background 180ms ease}
.big:hover{background:#f8f9fa}.big:hover .seg{box-shadow:none;transform:none}
.big .title{flex:0 0 auto;font-size:13px;letter-spacing:-.2px}.big .title b{font-weight:700}
.big .seg{flex:1 1 120px;width:auto;min-width:90px;height:14px}
.big .count{flex:0 0 auto;color:#202124}
:host([data-dark]) .big{border:1px solid #ffffff2e;background:#ffffff0f;color:#e8eaed;box-shadow:none}
:host([data-dark]) .big:hover{background:#ffffff1a}
:host([data-dark]) .big .tag,:host([data-dark]) .big .muted,:host([data-dark]) .big .count,:host([data-dark]) .big .count b{color:inherit}
:host([data-panel]) .big{max-width:none}
.empty .seg{background:transparent;outline:1px solid #8a949b88;outline-offset:-1px}
:host([data-dark]) .empty .seg{outline-color:#9aa0a688}
.estimated .seg{outline:1px dashed #9aa0a6;outline-offset:2px}
:host([data-square]){width:124px}
:host([data-square]) .big,:host([data-square][data-dark]) .big{flex-direction:column;align-items:stretch;gap:5px;width:100%;min-width:0;max-width:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;font-size:12px}
:host([data-square]) .big:hover{background:transparent}
:host([data-square]) .big .title{flex-basis:auto;font-size:11px;letter-spacing:0;opacity:.8;white-space:nowrap}
:host([data-square]) .big .title .name{display:none}
:host([data-square]) .big .seg{width:auto;flex:none;min-width:0}
:host([data-square]) .big .count{font-size:12px}
@media(prefers-reduced-motion:reduce){.loading .seg:before{animation:none;width:100%;opacity:.6}.bar,.seg,.seg span{transition:none;animation:none}}
`;

const TIP_CSS = `
:host{all:initial}
.tip{position:fixed;left:0;top:0;z-index:2147483647;width:max-content;max-width:min(420px,80vw);padding:10px 14px;border-radius:14px;background:#f8f9faf7;border:1px solid #dadce0;box-shadow:0 10px 28px #20212426;font:12.5px/1.45 Helvetica,"Helvetica Neue",Arial,sans-serif;color:#202124;white-space:normal;text-align:left;pointer-events:none;opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity 160ms ease,transform 160ms ease,visibility 0s linear 160ms}
.tip.on{opacity:1;visibility:visible;transform:none;transition:opacity 160ms ease,transform 160ms ease,visibility 0s}
@media(prefers-reduced-motion:reduce){.tip{transition:none}}
`;

const OVERLAY_CSS = `
:host{all:initial}
.back{position:fixed;inset:0;z-index:2147483646}
.panel{position:fixed;z-index:2147483647;border-radius:24px;overflow:hidden;border:1px solid #ffffff66;box-shadow:0 24px 72px #0005;background:#f1f3f4b3;backdrop-filter:blur(22px) saturate(1.05);-webkit-backdrop-filter:blur(22px) saturate(1.05);animation:in 240ms cubic-bezier(.16,1,.3,1) both;transition:height 180ms ease}
@keyframes in{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
iframe{display:block;width:100%;height:100%;border:0;background:transparent;color-scheme:light}
.veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#f1f3f466;color:#202124;font:13px Helvetica,"Helvetica Neue",Arial,sans-serif;transition:opacity 200ms ease}
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
function showTip(text: string, anchor: DOMRect) {
  if (!text) return;
  const tip = tipElement();
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
  const lead = gauge.verdict === "positive" ? `${pos}% positive` : gauge.verdict === "negative" ? `${neg}% negative` : "Mixed";
  count.append(Object.assign(el("b"), { textContent: lead }));
  return count;
}

const SWALLOW = ["mousedown", "mouseup", "pointerdown", "pointerup", "auxclick", "touchstart", "touchend"] as const;

export function createBar(opts: { big?: boolean; title?: string; dark?: boolean; size?: number; onOpen: (gauge: Gauge | undefined, anchor: DOMRect) => void }): Bar {
  const host = el("div");
  host.setAttribute("data-opinion-meter", opts.big ? "query" : "result");
  if (opts.dark) host.setAttribute("data-dark", "");
  if (opts.size) host.style.setProperty("--om-size", `${opts.size}px`);
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = BAR_CSS;
  const bar = el("button", `bar${opts.big ? " big" : ""} loading`);
  bar.type = "button";
  root.append(style, bar);
  let current: Gauge | undefined;
  let detail = "";
  /* A bar must never act as the link it sits beside. */
  for (const type of SWALLOW) bar.addEventListener(type, (event) => event.stopPropagation());
  bar.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideTip();
    opts.onOpen(current, bar.getBoundingClientRect());
  });
  const over = () => showTip(detail, bar.getBoundingClientRect());
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
    if (!opts.big && state.kind !== "ready" && !(state.kind === "empty" && state.thin)) {
      current = undefined;
      host.hidden = true;
      bar.classList.remove("shown");
      return;
    }
    host.hidden = false;
    if (state.kind === "empty") {
      current = undefined;
      if (opts.big) {
        const title = el("span", "title", "What people think");
        title.append(Object.assign(el("span", "name"), { textContent: ` of ${opts.title ?? "this search"}` }));
        bar.append(title, segments(), el("span", "count muted", state.thin ? "Not enough opinions" : "No verdict yet"));
      } else bar.append(segments());
      detail = state.reason;
      bar.setAttribute("aria-label", `${opts.title ?? "This link"}: no verdict. ${state.reason}`);
      reveal();
      return;
    }
    if (state.kind === "loading") {
      const title = el("span", "title", "What people think");
      title.append(Object.assign(el("span", "name"), { textContent: " of what you searched for" }));
      bar.append(title, segments(), el("span", "count muted", "reading the crowd…"));
      bar.setAttribute("aria-label", "Reading what people think");
      current = undefined;
      reveal();
      return;
    }
    const { gauge } = state;
    current = gauge;
    if (opts.big) {
      const title = el("span", "title", "What people think");
      const name = el("span", "name", " of ");
      name.append(Object.assign(el("b"), { textContent: gauge.name }));
      title.append(name);
      bar.append(title);
    }
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
export function openOverlay(opts: { url: string; anchor: DOMRect; title: string; message?: string }): () => void {
  activeOverlay?.();
  const previousFocus = document.activeElement as HTMLElement | null;
  const host = el("div");
  host.setAttribute("data-opinion-meter", "drawer");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = OVERLAY_CSS;
  const back = el("div", "back");
  const panel = el("div", "panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", `What people think of ${opts.title}`);
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.min(600, vw - 24), height = Math.min(210, vh - 24);
  const below = opts.anchor.bottom + 8;
  panel.style.width = `${width}px`;
  panel.style.height = `${height}px`;
  panel.style.left = `${Math.max(12, Math.min(opts.anchor.left, vw - width - 12))}px`;
  panel.style.top = `${below + height <= vh - 12 ? below : Math.max(12, vh - height - 12)}px`;
  const frame = el("iframe");
  if (!opts.message) frame.src = opts.url;
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute("title", `What people think of ${opts.title}`);
  const veil = el("div", "veil");
  veil.append(el("div", "track"), el("span", undefined, "Opening the drawer…"));
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

  const close = () => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener("keydown", onKey);
    clearTimeout(fallback);
    host.remove();
    previousFocus?.focus({ preventScroll: true });
    activeOverlay = undefined;
  };
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { om?: boolean; type?: string; height?: number } | null;
    if (event.source !== frame.contentWindow || event.origin !== new URL(opts.url).origin || !data?.om) return;
    if (data.type === "ready") veil.hidden = true;
    if (data.type === "close") close();
    if (data.type === "resize" && typeof data.height === "number" && Number.isFinite(data.height)) {
      const height = Math.min(Math.max(140, data.height), window.innerHeight - 24, 720);
      panel.style.height = `${height}px`;
      panel.style.top = `${Math.max(12, Math.min(below, window.innerHeight - height - 12))}px`;
    }
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  const fallback = setTimeout(() => {
    if (veil.hidden) return;
    veil.replaceChildren(el("span", undefined, "The drawer is taking a while."), Object.assign(el("a"), { href: opts.url, target: "_blank", rel: "noopener", textContent: "Open it in a new tab" }));
  }, 8000);
  back.addEventListener("click", close);
  window.addEventListener("message", onMessage);
  window.addEventListener("keydown", onKey);
  if (opts.message) panel.querySelector('button')?.focus(); else frame.focus();
  activeOverlay = close;
  return close;
}
