/* Reading Google's pages: which links are results, the site label Google
   prints for each, and the element a bar is pinned beside — the "About
   this result" dots on the All, Forums and Videos tabs, the source name
   on News, the merchant line under a Shopping tile, the source label in
   an AI Overview or AI Mode sources panel. Bars are drawn on a layer above
   the page and pinned to these targets, so Google's own layout is never
   touched. The query's card goes beside the knowledge panel's title, above
   or below the sources panel, or above the results. */
import type { ExtensionConfig } from "./shared";

export interface Found { url: string; title: string; site?: string; anchor: HTMLElement; target: HTMLElement; placement: "after" | "below"; size: number }
export type QueryPlace =
  | { mode: "kp"; row: HTMLElement; column: HTMLElement; panel: HTMLElement }
  | { mode: "panel"; panel: HTMLElement; below: boolean }
  | { mode: "flow"; parent: HTMLElement; before: Element | null };

const MENU = '[aria-label="About this result"], [aria-label^="About this result"], [aria-label*="More options"]';
const PRODUCT = "[data-product-id], [data-docid], [data-pv-entrypoint], .sh-dgr__grid-result, .sh-dlr__list-result, .pla-unit";
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
/* Google's own search pages, whose links are redirects; every other Google-owned site (Google Play, Maps) is a real destination. */
const searchHost = (host: string) => /^(www\.)?google\.[a-z.]+$/.test(host);
const udm = () => new URL(location.href).searchParams.get("udm") ?? "";

export function destination(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    let u = new URL(raw, location.href);
    if (!/^https?:$/.test(u.protocol)) return null;
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

const visible = (node: HTMLElement) => !node.closest('[hidden], [aria-hidden="true"], [data-opinion-meter]') && node.getClientRects().length > 0;
const fontSize = (el: Element) => parseFloat(getComputedStyle(el).fontSize) || 14;
const leaves = (root: Element) => [...root.querySelectorAll<HTMLElement>("span, div, cite")].filter((e) => e.childElementCount === 0 && clean(e.textContent));
/* A breadcrumb, an address or a time is never a site's name. */
const labelLike = (text: string) => text.length >= 2 && text.length <= 60 && !/[›/]|https?:|^\d+ (second|minute|hour|day|week|month|year)s? ago$|…$/i.test(text);

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

/* Organic results, sponsored results and video results: anything with a title of its own. */
function organic(config: ExtensionConfig, seen: WeakMap<Element, string>): Found[] {
  const found: Found[] = [];
  const roots = new Set([...document.querySelectorAll<HTMLElement>("#search, #rso, #tads, #tadsb, #bottomads"), ...document.querySelectorAll<HTMLElement>(config.google.results)]);
  const candidates = new Set<HTMLElement>();
  for (const root of roots) for (const node of root.querySelectorAll<HTMLElement>("a[href]")) candidates.add(node);
  for (const node of candidates) {
    if (!visible(node) || node.closest('nav, [role="navigation"], form, #rhs, [data-attrid], [data-mcpr], [data-aim], [data-sgrd], ' + PRODUCT)) continue;
    const heading = node.querySelector<HTMLElement>('h3, [role="heading"]');
    if (!heading) continue;
    const url = destination(node.href);
    const title = clean(heading.textContent);
    if (!url || title.length < 3 || /^(show (all|more)|learn more|more|visit|website|feedback|next|previous|cached)$/i.test(title)) continue;
    const signature = `${url}|${title}`;
    if (seen.get(node) === signature) continue;
    seen.set(node, signature);
    const container = node.closest<HTMLElement>("[data-hveid]") ?? node.parentElement ?? node;
    const menu = [...container.querySelectorAll<HTMLElement>(MENU)].find((m) => visible(m) && m.getBoundingClientRect().top < heading.getBoundingClientRect().bottom + 40);
    const label = siteLabel(node, container);
    const cite = node.querySelector<HTMLElement>("cite") ?? container.querySelector<HTMLElement>("cite") ?? undefined;
    const target = menu ?? label ?? cite ?? heading;
    found.push({ url, title, site: label ? clean(label.textContent) : undefined, anchor: node, target, placement: "after", size: 12 });
  }
  return found;
}

/* Shopping tiles: the merchant line ("AbeBooks.com", "QBD Books & more")
   names the seller; the bar goes under it. A seller without an address of
   its own gets a stand-in one, so the server can still name it. */
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function shopping(seen: WeakMap<Element, string>): Found[] {
  if (udm() !== "28" && !location.pathname.startsWith("/shopping")) return [];
  const found: Found[] = [];
  for (const leaf of leaves(document.body)) {
    const text = clean(leaf.textContent);
    let merchant: HTMLElement | undefined;
    if (/^& more$/i.test(text)) {
      const row = leaf.parentElement;
      merchant = row ? leaves(row).find((e) => e !== leaf && labelLike(clean(e.textContent))) : undefined;
    } else if (/^(?:[\w-]+\.)+[a-z]{2,}(?:\.[a-z]{2})?$/i.test(text)) merchant = leaf;
    if (!merchant || !visible(merchant)) continue;
    const row = merchant.parentElement?.closest<HTMLElement>("div") ?? merchant;
    const tile = row.closest<HTMLElement>("[data-hveid], [data-docid], [data-product-id]") ?? row.parentElement ?? row;
    const label = clean(merchant.textContent).replace(/\s*&\s*more$/i, "");
    if (!label) continue;
    const url = /^(?:[\w-]+\.)+[a-z]{2,}(?:\.[a-z]{2})?$/i.test(label) ? `https://${label.toLowerCase()}/` : `https://merchant.invalid/${slug(label)}`;
    if (seen.get(tile) === url) continue;
    seen.set(tile, url);
    const heading = tile.querySelector<HTMLElement>('h3, [role="heading"]') ?? leaves(tile).find((e) => fontSize(e) >= 14 && clean(e.textContent).length > 8);
    found.push({ url, title: clean(heading?.textContent) || label, site: label, anchor: tile, target: row, placement: "below", size: 12 });
  }
  return found;
}

/* The sources panel of an AI Overview or AI Mode answer: the box on the
   right with a "Show all" control and a list of source entries. */
export function sourcesPanel(): HTMLElement | null {
  const showAll = [...document.querySelectorAll<HTMLElement>("div, span, button, a")].find((el) => el.childElementCount <= 2 && /^show all$/i.test(clean(el.textContent)) && visible(el));
  let panel: HTMLElement | null = showAll?.parentElement ?? null;
  for (let i = 0; panel && i < 8; i++) {
    if (panel.getBoundingClientRect().width > 250 && panel.querySelectorAll("a[href]").length >= 2) return panel;
    panel = panel.parentElement;
  }
  return null;
}

function panelEntries(seen: WeakMap<Element, string>): Found[] {
  const panel = sourcesPanel();
  if (!panel) return [];
  const found: Found[] = [];
  const items = [...panel.querySelectorAll<HTMLElement>("li")];
  for (const item of items.length ? items : [...panel.children] as HTMLElement[]) {
    const a = item.querySelector<HTMLAnchorElement>("a[href]");
    if (!a || !visible(item)) continue;
    const url = destination(a.href);
    if (!url) continue;
    const label = leaves(item).find((e) => fontSize(e) <= 13 && labelLike(clean(e.textContent)));
    if (!label) continue;
    if (seen.get(item) === url) continue;
    seen.set(item, url);
    const heading = leaves(item).find((e) => fontSize(e) >= 14 && clean(e.textContent).length > 8);
    found.push({ url, title: clean(heading?.textContent) || clean(label.textContent), site: clean(label.textContent), anchor: item, target: label, placement: "after", size: 11 });
  }
  return found;
}

export function readResults(config: ExtensionConfig, seen: WeakMap<Element, string>): Found[] {
  return [...organic(config, seen), ...shopping(seen), ...panelEntries(seen)];
}

export function queryPlacement(config: ExtensionConfig): QueryPlace | null {
  const title = document.querySelector<HTMLElement>('#rhs [data-attrid="title"]');
  const subtitle = document.querySelector<HTMLElement>('#rhs [data-attrid="subtitle"]');
  const rhs = document.querySelector<HTMLElement>("#rhs");
  if (title && rhs && visible(title)) {
    let column: HTMLElement | null = title.parentElement;
    while (column && subtitle && !column.contains(subtitle)) column = column.parentElement;
    const row = column?.parentElement ?? null;
    if (column && row) return { mode: "kp", row, column, panel: rhs };
  }
  const panel = sourcesPanel();
  if (panel && visible(panel)) return { mode: "panel", panel, below: udm() === "50" };
  const main = document.querySelector<HTMLElement>(config.google.results);
  if (!main) return null;
  return { mode: "flow", parent: main, before: main.firstElementChild };
}
