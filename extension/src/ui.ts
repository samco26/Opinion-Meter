/* What the hands draw: the bar beside a result's title (and the larger
   one for the query), and the drawer that opens over the page. Everything
   lives in its own shadow root so Google's styles and ours never touch,
   in the palette and glass of the card it opens. A result's bar stays
   invisible until a reading exists: no placeholders, no empty outlines. */

import type { Gauge } from "./shared";

const BAR_CSS = `
:host{all:initial;display:inline-block;vertical-align:middle;margin-left:10px}
:host([data-opinion-meter="query"]){display:block;margin:0}
:host([hidden]){display:none!important}
.bar{display:inline-flex;align-items:center;gap:8px;margin:0;padding:0;border:0;background:transparent;font:12px/1.2 Helvetica,"Helvetica Neue",Arial,sans-serif;color:#153f43;cursor:pointer;position:relative;white-space:nowrap;vertical-align:middle;text-align:left;opacity:0;transition:opacity 280ms ease}
.bar.shown{opacity:1}
.bar:hover .seg{box-shadow:0 0 0 2px #17565f26}
.bar:focus-visible{outline:3px solid #16565e;outline-offset:4px;border-radius:99px}
.seg{display:flex;width:88px;height:14px;border-radius:99px;overflow:hidden;background:#19464c22;flex-shrink:0;transition:box-shadow 180ms ease}
.seg span{display:block;height:100%;transition:flex-basis 500ms cubic-bezier(.16,1,.3,1)}.pos{background:#53866a}.neu{background:#525a5f}.neg{background:#bc716b}
.count{white-space:nowrap;color:#5f6368}.count b{font-weight:700;color:#153f43}
:host([data-dark]) .count{color:#bdc1c6}:host([data-dark]) .count b{color:#e8eaed}:host([data-dark]) .seg{background:#ffffff1f}
.muted{color:#426366}
.tag{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#426366;border:1px solid #16464c33;border-radius:8px;padding:2px 5px;white-space:nowrap}
:host([data-dark]) .tag{color:#bdc1c6;border-color:#ffffff40}
.tip{position:fixed;left:0;top:0;z-index:2147483647;width:max-content;max-width:min(440px,80vw);padding:10px 14px;border-radius:18px;background:#f7f4e8f7;border:1px solid #ffffffb3;box-shadow:0 10px 28px #163e4926;font:12.5px/1.45 Helvetica,"Helvetica Neue",Arial,sans-serif;color:#153f43;white-space:normal;text-align:left;pointer-events:none;opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity 160ms ease,transform 160ms ease,visibility 0s linear 160ms}
.tip.on{opacity:1;visibility:visible;transform:none;transition:opacity 160ms ease,transform 160ms ease,visibility 0s}
.loading .seg{position:relative;background:#17565f1c}.loading .seg:before{content:"";position:absolute;inset:0;width:55%;border-radius:99px;background:linear-gradient(90deg,transparent,#8bb9b5 15%,#ffd7c2 55%,#edaa99 80%,transparent);animation:flow 1600ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
.big{display:flex;width:100%;box-sizing:border-box;max-width:700px;margin:0 0 16px;padding:14px 16px;gap:12px;font-size:13px;flex-wrap:wrap;white-space:normal;border-radius:22px;background:#f2efe2c2;border:1px solid #ffffffb3;box-shadow:inset 0 1px 0 #ffffffd9,0 6px 16px #17424a1f;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:opacity 280ms ease,background 180ms ease}
.big:hover{background:#f7f4e8f2}.big:hover .seg{box-shadow:none}
.big .seg{width:120px;height:14px}.big .title{flex-basis:100%;font-size:14px;letter-spacing:-.2px}.big .title b{font-weight:700}
.big .count{color:#153f43}
.big .sentence{flex-basis:100%;font-size:13px;line-height:1.45;color:#2b5a5e;margin-top:2px}
.empty .seg{background:transparent;outline:1px solid #8a949b88;outline-offset:-1px}
.estimated .seg{outline:1px dashed #c99b6f;outline-offset:2px}
:host([data-side]) .big{max-width:none;border-radius:22px;border:1px solid #88888866;background:#ffffff08;color:#e8eaed;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
:host([data-side]) .big .tag,:host([data-side]) .big .muted,:host([data-side]) .big .count,:host([data-side]) .big .count b{color:inherit}
:host([data-side]) .big .seg{flex:1;width:100%;min-width:70px}
@media(prefers-color-scheme:light){:host([data-side]) .big{color:#202124;background:#ffffff88}}
@media(prefers-reduced-motion:reduce){.loading .seg:before{animation:none;width:100%;opacity:.6}.bar,.seg,.seg span,.tip{transition:none}}
`;

const OVERLAY_CSS = `
:host{all:initial}
.back{position:fixed;inset:0;z-index:2147483646}
.panel{position:fixed;z-index:2147483647;border-radius:24px;overflow:hidden;border:1px solid #ffffff66;box-shadow:0 24px 72px #0005;background:#e8f0ebaa;backdrop-filter:blur(22px) saturate(1.15);-webkit-backdrop-filter:blur(22px) saturate(1.15);animation:in 240ms cubic-bezier(.16,1,.3,1) both;transition:height 180ms ease}
@keyframes in{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
iframe{display:block;width:100%;height:100%;border:0;background:transparent;color-scheme:light}
.veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#edf2ec66;color:#153f43;font:13px Helvetica,"Helvetica Neue",Arial,sans-serif;transition:opacity 200ms ease}
.veil[hidden]{display:none}.veil a{color:#ffd7c2}
.track{width:180px;height:12px;border-radius:99px;position:relative;overflow:hidden;background:#17565f55}.track:before{content:"";position:absolute;inset:0;width:55%;border-radius:99px;background:linear-gradient(90deg,transparent,#8bb9b5 15%,#ffd7c2 55%,#edaa99 80%,transparent);animation:flow 1800ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
button{font:14px Helvetica,"Helvetica Neue",Arial,sans-serif;margin-top:12px;padding:8px 16px;border-radius:99px;border:1px solid #ffe6dc;background:#f4b49f;color:#153f43;cursor:pointer;transition:opacity 180ms ease}button:hover{opacity:.85}
@media(prefers-reduced-motion:reduce){.panel{animation:none}.track:before{animation:none;width:100%}}
`;

export type BarState = { kind: "loading" } | { kind: "ready"; gauge: Gauge } | { kind: "empty"; reason: string };

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

function countText(gauge: Gauge): HTMLElement {
  const [pos, , neg] = percentages(gauge);
  const count = el("span", "count");
  const lead = gauge.verdict === "positive" ? `${pos}% positive` : gauge.verdict === "negative" ? `${neg}% negative` : "Mixed";
  count.append(Object.assign(el("b"), { textContent: lead }), ` · ${gauge.count} opinions`);
  return count;
}

const SWALLOW = ["mousedown", "mouseup", "pointerdown", "pointerup", "auxclick", "touchstart", "touchend"] as const;

export function createBar(opts: { big?: boolean; title?: string; dark?: boolean; onOpen: (gauge: Gauge | undefined, anchor: DOMRect) => void }): Bar {
  const host = el("div");
  host.setAttribute("data-opinion-meter", opts.big ? "query" : "result");
  if (opts.dark) host.setAttribute("data-dark", "");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = BAR_CSS;
  const bar = el("button", `bar${opts.big ? " big" : ""} loading`);
  bar.type = "button";
  /* The tip sits beside the button, fixed to the viewport, so no clipped,
     flipped or transformed ancestor can distort it. */
  const tip = el("span", "tip");
  tip.setAttribute("role", "tooltip");
  root.append(style, bar, tip);
  let current: Gauge | undefined;
  /* A bar inside a result's link must never act as the link. */
  for (const type of SWALLOW) bar.addEventListener(type, (event) => event.stopPropagation());
  bar.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    opts.onOpen(current, bar.getBoundingClientRect());
  });
  const place = () => {
    const r = bar.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = tip.offsetWidth, height = tip.offsetHeight;
    const below = r.bottom + 8;
    tip.style.left = `${Math.max(8, Math.min(r.left, vw - width - 8))}px`;
    tip.style.top = `${below + height <= vh - 8 ? below : Math.max(8, r.top - height - 8)}px`;
  };
  const showTip = () => { if (!tip.textContent) return; place(); tip.classList.add("on"); };
  const hideTip = () => tip.classList.remove("on");
  bar.addEventListener("mouseenter", showTip);
  bar.addEventListener("mouseleave", hideTip);
  bar.addEventListener("focus", showTip);
  bar.addEventListener("blur", hideTip);
  const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("shown")));
  const render = (state: BarState) => {
    bar.replaceChildren();
    tip.textContent = "";
    hideTip();
    bar.classList.toggle("loading", state.kind === "loading");
    bar.classList.toggle("empty", state.kind === "empty");
    bar.classList.toggle("estimated", state.kind === "ready" && Boolean(state.gauge.simulated));
    if (!opts.big && state.kind !== "ready") {
      current = undefined;
      host.hidden = true;
      bar.classList.remove("shown");
      return;
    }
    host.hidden = false;
    if (state.kind === "empty") {
      current = undefined;
      bar.append(el("span", "title", `What people think of ${opts.title ?? "this search"}`), segments(), el("span", "count muted", "No verdict yet"));
      tip.textContent = state.reason;
      bar.setAttribute("aria-label", `${opts.title ?? "This search"}: no verdict. ${state.reason}`);
      reveal();
      return;
    }
    if (state.kind === "loading") {
      bar.append(el("span", "title", "What people think of what you searched for"), segments(), el("span", "count muted", "reading the crowd…"));
      bar.setAttribute("aria-label", "Reading what people think");
      current = undefined;
      reveal();
      return;
    }
    const { gauge } = state;
    current = gauge;
    if (opts.big) {
      const title = el("span", "title", "What people think of ");
      title.append(Object.assign(el("b"), { textContent: gauge.name }));
      bar.append(title);
    }
    bar.append(segments(gauge), countText(gauge));
    if (gauge.simulated) bar.append(el("span", "tag", "estimated"));
    const detail = `${gauge.count} opinions. ${gauge.simulated ? "Unverified word-count estimate. " : ""}${gauge.sentence}`;
    tip.textContent = detail;
    bar.setAttribute("aria-label", `${gauge.name}: ${detail} Open what people think.`);
    reveal();
  };
  render({ kind: "loading" });
  return { host, set: render, remove: () => host.remove() };
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
    content.style.cssText = "padding:24px;font:14px/1.5 Arial,sans-serif;color:#153f43";
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
