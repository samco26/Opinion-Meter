/* What the hands draw: the bar under a result (and the larger one for the
   query), and the drawer that opens over the page. Everything lives in
   its own shadow root so Google's styles and ours never touch, in the
   palette and glass of the card it opens. */

import type { Gauge } from "./shared";

const BAR_CSS = `
:host{all:initial;display:block}
.bar{display:inline-flex;align-items:center;gap:8px;margin:6px 0 2px;padding:5px 11px 5px 8px;border-radius:99px;background:#f2efe2d9;border:1px solid #ffffffb3;box-shadow:inset 0 1px 0 #ffffffd9,0 6px 16px #17424a1f;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font:12px/1.2 Helvetica,"Helvetica Neue",Arial,sans-serif;color:#153f43;cursor:pointer;position:relative;max-width:100%;text-align:left;transition:transform 200ms cubic-bezier(.16,1,.3,1),background 180ms}
.bar:hover{background:#f7f4e8f2;transform:translateY(-1px)}.bar:focus-visible{outline:3px solid #16565e;outline-offset:3px}
.seg{display:flex;width:72px;height:8px;border-radius:99px;overflow:hidden;background:#19464c18;flex-shrink:0}.seg span{display:block;height:100%;transition:flex-basis 500ms cubic-bezier(.16,1,.3,1)}.pos{background:#53866a}.neu{background:#525a5f}.neg{background:#bc716b}
.count{white-space:nowrap}.count b{font-weight:700}.muted{color:#426366}
.tag{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#426366;border:1px solid #16464c33;border-radius:8px;padding:2px 5px;white-space:nowrap}
.tip{position:absolute;left:0;top:calc(100% + 6px);z-index:10;width:max-content;max-width:min(440px,80vw);padding:10px 14px;border-radius:18px;background:#f7f4e8f7;border:1px solid #ffffffb3;box-shadow:0 10px 28px #163e4926;font-size:12.5px;line-height:1.45;color:#153f43;white-space:normal;display:none}
.bar:hover .tip,.bar:focus-visible .tip{display:block}
.loading .seg{position:relative;background:#17565f1c}.loading .seg:before{content:"";position:absolute;inset:0;width:55%;border-radius:99px;background:linear-gradient(90deg,transparent,#8bb9b5 15%,#ffd7c2 55%,#edaa99 80%,transparent);animation:flow 1600ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
.big{margin:0 0 16px;padding:11px 18px 11px 14px;gap:12px;font-size:13px;flex-wrap:wrap;border-radius:26px}
.big .seg{width:120px;height:10px}.big .title{flex-basis:100%;font-size:14px;letter-spacing:-.2px}.big .title b{font-weight:700}
.big .sentence{flex-basis:100%;font-size:13px;line-height:1.45;color:#2b5a5e;margin-top:2px}
.bar:not(.big){padding:8px 0;margin:2px 0;border:0;background:transparent;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;min-height:28px}
.bar:not(.big):hover{background:transparent}.bar:not(.big) .seg{width:96px;height:7px}
.bar:not(.big)>.count,.bar:not(.big)>.tag{display:none}
.empty .seg{background:transparent;outline:1px solid #8a949b88;outline-offset:-1px}
.estimated .seg{outline:1px dashed #c99b6f;outline-offset:2px}
.big{display:flex;width:100%;box-sizing:border-box;max-width:700px;padding:14px 16px;background:#f2efe2c2;border-radius:22px}
:host([data-side]) .big{max-width:none;border-radius:22px;border:1px solid #88888866;background:#ffffff08;color:#e8eaed;box-shadow:none;backdrop-filter:none}
:host([data-side]) .big .tag,:host([data-side]) .big .muted{color:inherit}
:host([data-side]) .big .seg{flex:1;width:100%;min-width:70px}
@media(prefers-color-scheme:light){:host([data-side]) .big{color:#202124;background:#ffffff88}}
@media(prefers-reduced-motion:reduce){.loading .seg:before{animation:none;width:100%;opacity:.6}.bar,.seg span{transition:none}}
`;

const OVERLAY_CSS = `
:host{all:initial}
.back{position:fixed;inset:0;z-index:2147483646}
.panel{position:fixed;z-index:2147483647;border-radius:24px;overflow:hidden;border:1px solid #ffffff66;box-shadow:0 24px 72px #0005;background:#e8f0ebaa;backdrop-filter:blur(22px) saturate(1.15);-webkit-backdrop-filter:blur(22px) saturate(1.15);animation:in 240ms cubic-bezier(.16,1,.3,1) both;transition:height 180ms ease}
@keyframes in{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
iframe{display:block;width:100%;height:100%;border:0;background:transparent}
.veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#edf2ec66;color:#153f43;font:13px Helvetica,"Helvetica Neue",Arial,sans-serif}
.veil[hidden]{display:none}.veil a{color:#ffd7c2}
.track{width:180px;height:12px;border-radius:99px;position:relative;overflow:hidden;background:#17565f55}.track:before{content:"";position:absolute;inset:0;width:55%;border-radius:99px;background:linear-gradient(90deg,transparent,#8bb9b5 15%,#ffd7c2 55%,#edaa99 80%,transparent);animation:flow 1800ms ease-in-out infinite}
@keyframes flow{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
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

export function createBar(opts: { big?: boolean; title?: string; onOpen: (gauge: Gauge | undefined, anchor: DOMRect) => void }): Bar {
  const host = el("div");
  host.setAttribute("data-opinion-meter", opts.big ? "query" : "result");
  const root = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = BAR_CSS;
  const bar = el("button", `bar${opts.big ? " big" : ""} loading`);
  bar.type = "button";
  root.append(style, bar);
  let current: Gauge | undefined;
  bar.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    opts.onOpen(current, bar.getBoundingClientRect());
  });
  const render = (state: BarState) => {
    bar.replaceChildren();
    bar.classList.toggle("loading", state.kind === "loading");
    bar.classList.toggle("empty", state.kind === "empty");
    bar.classList.toggle("estimated", state.kind === "ready" && Boolean(state.gauge.simulated));
    if (state.kind === "empty") {
      current = undefined;
      if (opts.big) bar.append(el("span", "title", `What people think of ${opts.title ?? "this search"}`));
      bar.append(segments());
      if (opts.big) bar.append(el("span", "count muted", "No verdict yet"));
      bar.append(el("span", "tip", state.reason));
      bar.setAttribute("aria-label", `${opts.title ?? "This link"}: no verdict. ${state.reason}`);
      return;
    }
    if (state.kind === "loading") {
      if (opts.big) bar.append(el("span", "title", "What people think of what you searched for"));
      bar.append(segments(), el("span", "count muted", "reading the crowd…"));
      bar.setAttribute("aria-label", "Reading what people think");
      current = undefined;
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
    const scope = gauge.scope === "domain" ? `Website fallback: ${gauge.domain}. Not a verdict on this specific page. ` : gauge.scope === "link" ? "This specific page. " : "";
    const detail = `${scope}${gauge.count} opinions. ${gauge.simulated ? "Unverified word-count estimate. " : ""}${gauge.sentence}`;
    bar.append(el("span", "tip", detail));
    bar.setAttribute("aria-label", `${gauge.name}: ${detail} Open what people think.`);
  };
  render({ kind: "loading" });
  return { host, set: render, remove: () => host.remove() };
}

/* The drawer: a panel over the page, near the bar that opened it, framing
   the server's embed page. Closes on the embed's say-so, Escape, or a
   click anywhere outside. Returns the close function. */
let activeOverlay: (() => void) | undefined;
export function openOverlay(opts: { url: string; anchor: DOMRect; title: string }): () => void {
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
  frame.src = opts.url;
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute("title", `What people think of ${opts.title}`);
  const veil = el("div", "veil");
  veil.append(el("div", "track"), el("span", undefined, "Opening the drawer…"));
  panel.append(frame, veil);
  root.append(style, back, panel);
  document.documentElement.append(host);

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
  frame.focus();
  activeOverlay = close;
  return close;
}
