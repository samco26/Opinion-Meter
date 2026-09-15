/* Reading Google's results page: every titled result — organic headings,
   sponsored results and product tiles — with the place its bar goes: the
   site-name line above the title (beside the site's name, or the row
   holding the address), sized to that text. Knowledge-panel images,
   source carousels and other untitled links get nothing. The query's
   card goes beside the knowledge panel's title when there is room. */
import type { ExtensionConfig } from "./shared";
export interface Found { url: string; title: string; anchor: HTMLElement; heading?: HTMLElement; line?: HTMLElement; size?: number; unavailable?: string }
export interface Placement { parent: HTMLElement; before: Element | null; side: boolean; square: boolean }
const PRODUCT = "[data-product-id], [data-docid], [data-pv-entrypoint], .sh-dgr__grid-result, .sh-dlr__list-result, .pla-unit";
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
const google = (host: string) => /(^|\.)google\.[a-z.]+$/.test(host);
export function destination(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    let u = new URL(raw, location.href);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (google(u.hostname) || /(^|\.)googleadservices\.com$/.test(u.hostname)) {
      if (["/url", "/aclk", "/pagead/aclk"].includes(u.pathname)) {
        const target = u.searchParams.get("adurl") ?? u.searchParams.get("url") ?? u.searchParams.get("q");
        if (!target) return null;
        u = new URL(target);
        if (!/^https?:$/.test(u.protocol) || google(u.hostname)) return null;
      } else if (!/^\/(maps\/place|shopping\/product)\//.test(u.pathname)) return null;
    }
    return u.href;
  } catch { return null; }
}
const visible = (node: HTMLElement) => !node.closest('[hidden], [aria-hidden="true"], [data-opinion-meter]') && node.getClientRects().length > 0;
/* The site-name line: Google draws the favicon, the site's name and its
   address above the title; the name span when there is one, else the
   row holding the address. The bar is sized to that text. */
function siteLine(anchor: HTMLElement): { line: HTMLElement; size: number } | undefined {
  const cite = anchor.querySelector<HTMLElement>("cite") ?? anchor.parentElement?.querySelector<HTMLElement>("cite") ?? null;
  if (!cite) return undefined;
  const row = cite.parentElement, block = row?.parentElement;
  const first = block?.firstElementChild;
  const nameSpan = row && first && first !== row ? first.querySelector<HTMLElement>("span") : null;
  const line = nameSpan ?? row;
  if (!line) return undefined;
  const px = parseFloat(getComputedStyle(nameSpan ?? cite).fontSize) || 14;
  return { line, size: Math.max(9, Math.round(px * 0.85)) };
}
export function readResults(config: ExtensionConfig, seen: WeakMap<Element, string>): Found[] {
  const found: Found[] = [];
  const roots = new Set([...document.querySelectorAll<HTMLElement>("#search, #rso, #tads, #tadsb, #bottomads"), ...document.querySelectorAll<HTMLElement>(config.google.results)]);
  const candidates = new Set<HTMLElement>();
  for (const root of roots) for (const node of root.querySelectorAll<HTMLElement>(`a[href], ${PRODUCT}`)) candidates.add(node);
  const selected = new Set<Element>();
  for (const node of candidates) {
    if (!visible(node) || node.closest('nav, [role="navigation"], form, #rhs, [data-attrid], [data-mcpr], [data-aim], [data-sgrd]')) continue;
    const product = node.closest<HTMLElement>(PRODUCT);
    const headline = node.querySelector<HTMLElement>('h3, [role="heading"]');
    /* Only a titled result gets a bar: a heading of its own, or a product tile. */
    if (!headline && !product) continue;
    const anchor = product ?? node;
    if (selected.has(anchor)) continue;
    const a = node instanceof HTMLAnchorElement ? node : node.querySelector<HTMLAnchorElement>('a[href]');
    const productLink = product?.querySelector<HTMLAnchorElement>('a[href]:has(h3), a[href]:has([role="heading"]), a[href]');
    let url = destination((productLink ?? a)?.href ?? "");
    const productTitle = product?.querySelector<HTMLElement>('h3, [role="heading"], .pymv4e, .tAxDx, [data-title], [title]');
    const title = clean(productTitle?.getAttribute('title') || productTitle?.textContent || headline?.textContent || node.getAttribute("aria-label") || a?.textContent || product?.querySelector('img[alt]')?.getAttribute("alt"));
    const unavailable = !url && product ? "Google has not exposed a merchant link for this product tile. A page or website verdict needs an identifiable destination; this is not a score for the product itself." : undefined;
    if ((!url && !unavailable) || title.length < 3 || /^(show (all|more)|learn more|more|visit|website|feedback|next|previous|cached)$/i.test(title)) continue;
    const signature = `${url}|${title}`;
    selected.add(anchor);
    if (seen.get(anchor) === signature) continue;
    seen.set(anchor, signature);
    const site = product ? undefined : siteLine(node);
    found.push({ url: url ?? "", title, anchor, heading: productTitle ?? headline ?? undefined, line: site?.line, size: site?.size, unavailable });
  }
  return found;
}
export function queryPlacement(config: ExtensionConfig): Placement | null {
  const main = document.querySelector<HTMLElement>(config.google.results);
  if (!main) return null;
  /* Beside the knowledge panel's title and subtitle when the row has room
     for a small square; under the subtitle when it has not. */
  const title = document.querySelector<HTMLElement>('#rhs [data-attrid="title"]');
  const subtitle = document.querySelector<HTMLElement>('#rhs [data-attrid="subtitle"]');
  if (title && visible(title)) {
    let column: HTMLElement | null = title.parentElement;
    while (column && subtitle && !column.contains(subtitle)) column = column.parentElement;
    const row = column?.parentElement ?? null;
    if (column && row && getComputedStyle(row).display.includes("flex")) {
      const used = [...row.children].filter((child) => child !== column && !child.hasAttribute("data-opinion-meter")).reduce((width, child) => width + child.getBoundingClientRect().width, 0);
      const text = Math.max(title.getBoundingClientRect().width, subtitle?.getBoundingClientRect().width ?? 0);
      const spare = row.getBoundingClientRect().width - used - text - 56;
      if (spare >= 130) return { parent: row, before: null, side: true, square: true };
      return { parent: column, before: null, side: true, square: false };
    }
  }
  const overview = [...document.querySelectorAll<HTMLElement>('[data-mcpr], [data-aim], [data-sgrd]')];
  const hasOverview = overview.length > 0 || [...main.querySelectorAll('h1, h2, [role="heading"], span')].some(node => node.textContent?.trim() === "AI Overview");
  if (hasOverview) overview.push(main);
  const candidates = [...document.querySelectorAll<HTMLElement>('#rhs'), ...overview.flatMap(root => [...root.querySelectorAll<HTMLElement>('[role="list"], [data-attrid], [class]')])];
  const left = main.getBoundingClientRect().left;
  const right = candidates.find(node => {
    const box = node.getBoundingClientRect();
    // A horizontal source carousel can have a tile at the same x-position as
    // a right rail. Never place the main card inside an individual source.
    return visible(node) && !node.closest('[role="listitem"], li, a, [data-pv-entrypoint]') && box.width >= 180 && box.width <= 450 && box.left > left + 450 && (node.id === 'rhs' ? Boolean(node.querySelector('a[href]')) : node.querySelectorAll('a[href]').length >= 2);
  });
  if (right) return { parent: right, before: right.firstElementChild, side: true, square: false };
  return { parent: main, before: main.firstElementChild, side: false, square: false };
}
