/* Distinct placements share readings, including ads and product tiles. */
import type { ExtensionConfig } from "./shared";
export interface Found { url: string; title: string; anchor: HTMLElement }
const PRODUCT = "[data-product-id], [data-docid], .sh-dgr__grid-result, .sh-dlr__list-result, .pla-unit";
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
const google = (host: string) => /(^|\.)google\.[a-z.]+$/.test(host);
export function destination(raw: string): string | null {
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
export function readResults(config: ExtensionConfig, seen: WeakMap<Element, string>): Found[] {
  const found: Found[] = [];
  const roots = new Set([...document.querySelectorAll<HTMLElement>("#search, #rso, #tads, #tadsb, #bottomads, #rhs, [data-mcpr]"), ...document.querySelectorAll<HTMLElement>(config.google.results)]);
  const candidates = new Set<HTMLElement>();
  for (const root of roots) for (const node of root.querySelectorAll<HTMLElement>(`a[href], ${PRODUCT}`)) candidates.add(node);
  const selected = new Set<Element>();
  for (const node of candidates) {
    if (!visible(node) || node.closest('nav, [role="navigation"], form')) continue;
    const product = node.closest<HTMLElement>(PRODUCT);
    const headline = node.querySelector<HTMLElement>('h3, [role="heading"]');
    const ad = node.closest(config.google.ads);
    const reference = node.closest('#rhs, [data-attrid], [data-mcpr], [data-aim], [data-sgrd]');
    if (!headline && !product && !ad && !reference && !node.matches(config.google.anchor)) continue;
    const anchor = product ?? node;
    if (selected.has(anchor)) continue;
    const a = node instanceof HTMLAnchorElement ? node : node.querySelector<HTMLAnchorElement>('a[href]');
    const productLink = product?.querySelector<HTMLAnchorElement>('a[href]:has(h3), a[href]:has([role="heading"]), a[href]');
    let url = destination((productLink ?? a)?.href ?? "");
    const productTitle = product?.querySelector<HTMLElement>('h3, [role="heading"], .pymv4e, .tAxDx, [data-title]');
    const title = clean(productTitle?.textContent || headline?.textContent || node.getAttribute("aria-label") || a?.textContent || product?.querySelector('img[alt]')?.getAttribute("alt"));
    const productId = product?.getAttribute("data-product-id") ?? product?.getAttribute("data-docid");
    if (!url && productId && /^[\w-]+$/.test(productId)) url = `https://www.google.com/shopping/product/${encodeURIComponent(productId)}`;
    if (!url || title.length < 3 || /^(show (all|more)|learn more|more|visit|website|feedback|next|previous|cached)$/i.test(title)) continue;
    const signature = `${url}|${title}`;
    selected.add(anchor);
    if (seen.get(anchor) === signature) continue;
    seen.set(anchor, signature);
    found.push({ url, title, anchor });
  }
  return found;
}
export function queryPlacement(config: ExtensionConfig): { parent: HTMLElement; before: Element | null; side: boolean } | null {
  const main = document.querySelector<HTMLElement>(config.google.results);
  if (!main) return null;
  const overview = [...document.querySelectorAll<HTMLElement>('[data-mcpr], [data-aim], [data-sgrd]')];
  const hasOverview = overview.length > 0 || [...main.querySelectorAll('h1, h2, [role="heading"], span')].some(node => node.textContent?.trim() === "AI Overview");
  if (hasOverview) overview.push(main);
  const candidates = [...document.querySelectorAll<HTMLElement>('#rhs'), ...overview.flatMap(root => [...root.querySelectorAll<HTMLElement>('[role="list"], [data-attrid], [class]')])];
  const left = main.getBoundingClientRect().left;
  const right = candidates.find(node => {
    const box = node.getBoundingClientRect();
    return visible(node) && box.width >= 180 && box.width <= 450 && box.left > left + 450 && Boolean(node.querySelector('a[href]'));
  });
  if (right) return { parent: right, before: right.firstElementChild, side: true };
  return { parent: main, before: main.firstElementChild, side: false };
}
