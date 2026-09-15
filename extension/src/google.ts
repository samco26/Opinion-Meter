/* Reading Google's pages: which links are results, the site label Google
   prints for each, and the element a bar is pinned beside — the site's
   name when its line is free (the All tab), else the "About this result"
   dots (Videos, Forums), the source name on News, the merchant line under
   a Shopping tile, the source label in an AI Overview or AI Mode sources
   panel. Bars are drawn on a layer above the page and pinned to these
   targets, so Google's own layout is never touched. The query's card goes
   on the knowledge panel's title lines, above or below the sources panel,
   or above the results. */
import type { ExtensionConfig } from "./shared";

/* placement "fit": a bar with no text, shrunk to the room between the label's text and the dots (fitEnd) or the entry's right edge.
   placement "corner": a bar with no text in the top-right corner of a card whose site name sits at the bottom, kept clear of the title's first line (fitEnd). */
export interface Found { url: string; title: string; site?: string; anchor: HTMLElement; target: HTMLElement; placement: "after" | "below" | "fit" | "corner"; fitEnd?: HTMLElement; size: number }
/* "kp": right-aligned on the knowledge panel's title lines, between the text and whatever else shares those lines (others: a logo, a thumbnail). */
export type QueryPlace =
  | { mode: "kp"; title: HTMLElement; subtitle: HTMLElement | null; panel: HTMLElement; others: HTMLElement[] }
  | { mode: "panel"; panel: HTMLElement; below: boolean }
  | { mode: "flow"; parent: HTMLElement; before: Element | null };

const MENU = '[aria-label="About this result"], [aria-label^="About this result"], [aria-label*="More options"]';
const PRODUCT = "[data-product-id], [data-docid], [data-pv-entrypoint], .sh-dgr__grid-result, .sh-dlr__list-result, .pla-unit";
/* Pop-ups Google builds into the page but keeps unseen until a click: no result lives in one. */
const POPUP = '[role="menu"], [role="dialog"], [role="tooltip"], [aria-modal="true"]';
/* Google's own service pages that are never a result: the ad centre, ad settings, support, policies, accounts. */
const SERVICE_HOST = /(^|\.)(myadcenter|adssettings|support|policies|accounts|myaccount)\.google\.[a-z.]+$/;
/* Controls and housekeeping links dressed as results. */
const NOT_A_TITLE = /^(show (all|more)|learn more|more|visit|website|feedback|send feedback|next|previous|cached|my ad cent(re|er)|why this ad|about this ad|ad settings|privacy|terms|settings|sign in|help)$/i;
/* The query card's width when it stands beside a knowledge panel's title (ui.ts, data-square: the bar and "Mixed opinion" on one line). */
export const QUERY_SQUARE = 160;
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
/* Google's own search pages, whose links are redirects; every other Google-owned site (Google Play, Maps) is a real destination. */
const searchHost = (host: string) => /^(www\.)?google\.[a-z.]+$/.test(host);
const udm = () => new URL(location.href).searchParams.get("udm") ?? "";

export function destination(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    let u = new URL(raw, location.href);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (SERVICE_HOST.test(u.hostname)) return null;
    if (searchHost(u.hostname) || /(^|\.)googleadservices\.com$/.test(u.hostname)) {
      if (["/url", "/aclk", "/pagead/aclk"].includes(u.pathname)) {
        const target = u.searchParams.get("adurl") ?? u.searchParams.get("url") ?? u.searchParams.get("q");
        if (!target) return null;
        u = new URL(target);
        if (!/^https?:$/.test(u.protocol) || searchHost(u.hostname)) return null;
      } else if (!/^\/(maps\/place|shopping\/product)\//.test(u.pathname)) return null;
    }
    return u.href;
  } catch { return null; }
}

/* Visible on screen: Google marks some perfectly visible grids aria-hidden, so only [hidden] and our own nodes count as hidden. */
const visible = (node: HTMLElement) => !node.closest('[hidden], [data-opinion-meter]') && node.getClientRects().length > 0;
/* Actually seen: not made invisible by style, and not inside a box fixed to
   the window (a built-but-closed pop-up), which would carry a bar along as
   the page scrolls beneath it. Opacity is left alone: Google fades answers
   in, and a scan that lands mid-fade must not skip them. */
function seen(node: HTMLElement): boolean {
  const check = (node as unknown as { checkVisibility?: (options: Record<string, boolean>) => boolean }).checkVisibility;
  if (typeof check === "function" && !check.call(node, { checkVisibilityCSS: true })) return false;
  for (let el: HTMLElement | null = node; el && el !== document.body; el = el.parentElement) if (getComputedStyle(el).position === "fixed") return false;
  return true;
}
const fontSize = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 14;
const leaves = (root: Element) => [...root.querySelectorAll<HTMLElement>("span, div, cite")].filter((e) => e.childElementCount === 0 && clean(e.textContent));
/* A breadcrumb, an address or a time is never a site's name. */
const labelLike = (text: string) => text.length >= 2 && text.length <= 60 && !/[›/]|https?:|^\d+ (second|minute|hour|day|week|month|year)s? ago$|…$/i.test(text);
/* Nothing else written on the site name's line to its right: the All tab's
   two-line block. On the Videos and Forums tabs the channel or the community
   follows the name on the same line, and the bar goes after the dots instead. */
function lineFree(label: HTMLElement, container: HTMLElement): boolean {
  const r = label.getBoundingClientRect();
  return !leaves(container).some((e) => {
    if (e === label || label.contains(e) || e.contains(label)) return false;
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.top < r.bottom && b.bottom > r.top && b.left >= r.right - 1;
  });
}

/* The small site name Google prints above an organic title, or at the top of a news card. */
function siteLabel(anchor: HTMLElement, container: HTMLElement): HTMLElement | undefined {
  const cite = anchor.querySelector<HTMLElement>("cite") ?? container.querySelector<HTMLElement>("cite");
  if (cite) {
    const row = cite.parentElement, block = row?.parentElement, first = block?.firstElementChild;
    const span = row && first && first !== row ? first.querySelector<HTMLElement>("span") : null;
    if (span && labelLike(clean(span.textContent))) return span;
  }
  return leaves(anchor).find((e) => fontSize(e) <= 12.5 && labelLike(clean(e.textContent)));
}

/* The AI Mode page's "quick results" cards have no heading element: the title is the first large line. */
const cardTitle = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>("div, span")].find((e) => fontSize(e) >= 13.5 && clean(e.textContent).length >= 8 && e.getBoundingClientRect().height < 64);

/* Organic results, sponsored results and video results: anything with a title of its own. */
function organic(config: ExtensionConfig, known: WeakMap<Element, string>): Found[] {
  const found: Found[] = [];
  const roots = new Set([...document.querySelectorAll<HTMLElement>("#search, #rso, #tads, #tadsb, #bottomads"), ...document.querySelectorAll<HTMLElement>(config.google.results)]);
  const candidates = new Set<HTMLAnchorElement>();
  for (const root of roots) for (const node of root.querySelectorAll<HTMLAnchorElement>("a[href]")) candidates.add(node);
  const aiMode = udm() === "50";
  for (const node of candidates) {
    if (!visible(node) || node.closest('nav, [role="navigation"], form, #rhs, [data-attrid], [data-mcpr], [data-aim], [data-sgrd], ' + POPUP + ", " + PRODUCT)) continue;
    const heading = node.querySelector<HTMLElement>('h3, [role="heading"]') ?? (aiMode ? cardTitle(node) : undefined);
    if (!heading) continue;
    const url = destination(node.href);
    const title = clean(heading.textContent);
    if (!url || title.length < 3 || NOT_A_TITLE.test(title) || !seen(node)) continue;
    const signature = `${url}|${title}`;
    if (known.get(node) === signature) continue;
    known.set(node, signature);
    const container = node.closest<HTMLElement>("[data-hveid]") ?? node.parentElement ?? node;
    const menu = [...container.querySelectorAll<HTMLElement>(MENU)].find((m) => visible(m) && m.getBoundingClientRect().top < heading.getBoundingClientRect().bottom + 40);
    const label = siteLabel(node, container);
    const cite = node.querySelector<HTMLElement>("cite") ?? container.querySelector<HTMLElement>("cite") ?? undefined;
    /* On the AI Mode page a card carries its site name at the bottom: the bar goes to the card's top-right corner instead. */
    if (aiMode && label && label.getBoundingClientRect().top >= heading.getBoundingClientRect().bottom - 2) {
      found.push({ url, title, site: clean(label.textContent), anchor: node, target: container, placement: "corner", fitEnd: heading, size: 11 });
      continue;
    }
    /* Beside the site's name when its line is free; otherwise after the dots, which end the line. */
    const target = label && lineFree(label, container) ? label : menu ?? label ?? cite ?? heading;
    found.push({ url, title, site: label ? clean(label.textContent) : undefined, anchor: node, target, placement: "after", size: 12 });
  }
  return found;
}

/* Shopping tiles: every tile has a price, and the seller is the small line
   under it ("21Overlays", "evee", "QBD Books & more", "AbeBooks.com"),
   never a delivery or returns note, a rating or another price. The bar
   goes under that line. A seller without an address of its own gets a
   stand-in one, so the server can still name it. */
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PRICE = /^(?:[A-Z]{1,3}\s?)?\$\s?\d|^\d[\d,.]*\s?(?:AUD|USD|NZD|GBP|EUR)$/;
const TILE_NOTE = /^(?:free|fast|express|same[- ]day)?\s*(?:delivery|shipping|returns?|pick ?up|click ?&? ?collect)|^\d+[- ]day returns?|^(?:in|out of|low) stock|^nearby|^sponsored$|^ad$|^new$|^used$|^refurbished$|^\d+(?:\.\d+)?$|^\(\d[\d,]*\)$|^\d[\d,]* (?:reviews?|ratings?)$|^\d+% off|^was |^rrp|^save /i;
const DOMAIN = /^(?:[\w-]+\.)+[a-z]{2,}(?:\.[a-z]{2})?$/i;
function shopping(known: WeakMap<Element, string>): Found[] {
  if (udm() !== "28" && !location.pathname.startsWith("/shopping")) return [];
  const found: Found[] = [];
  for (const price of leaves(document.body)) {
    if (!PRICE.test(clean(price.textContent)) || !visible(price) || !seen(price)) continue;
    const tile = price.closest<HTMLElement>("[data-hveid], [data-docid], [data-product-id]") ?? price.parentElement?.parentElement?.parentElement ?? price.parentElement;
    if (!tile) continue;
    const p = price.getBoundingClientRect();
    const merchant = leaves(tile)
      .filter((e) => e !== price && fontSize(e) <= 14.5 && e.getBoundingClientRect().top >= p.bottom - 2)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .find((e) => { const text = clean(e.textContent); return labelLike(text) && !TILE_NOTE.test(text) && !PRICE.test(text); });
    if (!merchant || !visible(merchant)) continue;
    const row = merchant.parentElement?.closest<HTMLElement>("div") ?? merchant;
    const label = clean(merchant.textContent).replace(/\s*&\s*more$/i, "");
    if (!label) continue;
    const url = DOMAIN.test(label) ? `https://${label.toLowerCase()}/` : `https://merchant.invalid/${slug(label)}`;
    if (known.get(tile) === url) continue;
    known.set(tile, url);
    const heading = tile.querySelector<HTMLElement>('h3, [role="heading"]') ?? leaves(tile).find((e) => fontSize(e) >= 14 && clean(e.textContent).length > 8);
    found.push({ url, title: clean(heading?.textContent) || label, site: label, anchor: tile, target: row, placement: "below", size: 12 });
  }
  return found;
}

/* The sources panel of an AI Overview or AI Mode answer: the box on the
   right with a "Show all" control and a list of source entries. */
export function sourcesPanel(): HTMLElement | null {
  const showAll = [...document.querySelectorAll<HTMLElement>("div, span, button, a")].find((el) => el.childElementCount <= 2 && /^show all$/i.test(clean(el.textContent)) && visible(el) && seen(el));
  let panel: HTMLElement | null = showAll?.parentElement ?? null;
  for (let i = 0; panel && i < 8; i++) {
    if (panel.getBoundingClientRect().width > 250 && panel.querySelectorAll("a[href]").length >= 2) return panel;
    panel = panel.parentElement;
  }
  return null;
}

function panelEntries(known: WeakMap<Element, string>): Found[] {
  const panel = sourcesPanel();
  if (!panel) return [];
  const found: Found[] = [];
  const items = [...panel.querySelectorAll<HTMLElement>("li")];
  for (const item of items.length ? items : [...panel.children] as HTMLElement[]) {
    const a = item.querySelector<HTMLAnchorElement>("a[href]");
    if (!a || !visible(item) || !seen(item)) continue;
    const url = destination(a.href);
    if (!url) continue;
    const label = leaves(item).find((e) => fontSize(e) <= 13 && labelLike(clean(e.textContent)));
    if (!label) continue;
    if (known.get(item) === url) continue;
    known.set(item, url);
    const heading = leaves(item).find((e) => fontSize(e) >= 14 && clean(e.textContent).length > 8);
    const menu = [...item.querySelectorAll<HTMLElement>(MENU)].find(visible);
    const box = item.getBoundingClientRect();
    /* A card that names its site at the bottom gets the bar in its top-right corner; one that names it at the top gets it after the name. */
    const lower = label.getBoundingClientRect().top > box.top + box.height / 2;
    found.push(lower
      ? { url, title: clean(heading?.textContent) || clean(label.textContent), site: clean(label.textContent), anchor: item, target: item, placement: "corner", fitEnd: heading, size: 11 }
      : { url, title: clean(heading?.textContent) || clean(label.textContent), site: clean(label.textContent), anchor: item, target: label, placement: "fit", fitEnd: menu, size: 11 });
  }
  return found;
}

export function readResults(config: ExtensionConfig, known: WeakMap<Element, string>): Found[] {
  return [...organic(config, known), ...shopping(known), ...panelEntries(known)];
}

/* The box the text itself occupies, not its full-width block. */
export function textBox(el: HTMLElement): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(el);
  const box = range.getBoundingClientRect();
  return box.width ? box : el.getBoundingClientRect();
}

/* The knowledge panel's header lines in window coordinates: where the title
   and subtitle text (and the dots right after it) end, and where the next
   thing on those lines (a logo, a thumbnail) begins, if anything. */
export function kpHeader(title: HTMLElement, subtitle: HTMLElement | null, others: HTMLElement[]): { top: number; bottom: number; right: number; limit: number } {
  const t = textBox(title), s = subtitle && visible(subtitle) ? textBox(subtitle) : null;
  const top = Math.min(t.top, s?.top ?? t.top), bottom = Math.max(t.bottom, s?.bottom ?? t.bottom);
  let right = Math.max(t.right, s?.right ?? 0), limit = Infinity;
  const boxes = others.filter(visible).map((el) => el.getBoundingClientRect()).filter((b) => b.width >= 8 && b.top < bottom && b.bottom > top && b.right > right).sort((a, b) => a.left - b.left);
  for (const b of boxes) {
    if (b.left <= right + 40) right = Math.max(right, b.right);
    else limit = Math.min(limit, b.left);
  }
  return { top, bottom, right, limit };
}

export function queryPlacement(config: ExtensionConfig): QueryPlace | null {
  const title = document.querySelector<HTMLElement>('#rhs [data-attrid="title"]');
  const subtitle = document.querySelector<HTMLElement>('#rhs [data-attrid="subtitle"]');
  const rhs = document.querySelector<HTMLElement>("#rhs");
  if (title && rhs && visible(title)) {
    const sub = subtitle && visible(subtitle) ? subtitle : null;
    const near = title.getBoundingClientRect().top;
    const apart = (el: HTMLElement, text: HTMLElement | null) => !text || (el !== text && !el.contains(text) && !text.contains(el));
    const others = [...rhs.querySelectorAll<HTMLElement>('img, svg, video, button, [role="button"], [role="img"], g-img, a[href]')]
      .filter((el) => apart(el, title) && apart(el, sub) && visible(el) && Math.abs(el.getBoundingClientRect().top - near) < 160);
    const header = kpHeader(title, sub, others);
    /* Only when the card fits on those lines; a long title sends it into the flow instead, never over the panel's image. */
    if (Math.min(header.limit, rhs.getBoundingClientRect().right - 12) - (header.right + 16) >= QUERY_SQUARE) return { mode: "kp", title, subtitle: sub, panel: rhs, others };
  }
  const panel = sourcesPanel();
  if (panel && visible(panel)) return { mode: "panel", panel, below: udm() === "50" };
  const main = document.querySelector<HTMLElement>(config.google.results);
  if (!main) return null;
  return { mode: "flow", parent: main, before: main.firstElementChild };
}
