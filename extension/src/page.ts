/* What the page says, for "Analyse this page's subject": the page's own
   text, read inside the browser only when the reader presses the button.
   Reviews and comments are taken first (they are what the reading is
   for, and on a long shop page they come last), then the main content,
   then the rest, up to a cap; menus, headers, footers and scripts are
   skipped; the page's structured data (JSON-LD, where ratings and
   reviews often live) travels along. Nothing is read from forms. */

import type { PageRequest } from "./shared";

/* About twelve thousand words. */
export const TEXT_CAP = 60_000;
const DATA_CAP = 8_000;
const DESCRIPTION_CAP = 500;

/* Never read: chrome of the page, code, hidden copy, our own bars, and anything the reader types. */
const SKIP = "nav,header,footer,aside,script,style,noscript,template,iframe,svg,canvas,form,input,textarea,select,button,[aria-hidden='true'],[hidden],[role='navigation'],[role='banner'],[role='contentinfo'],[data-opinion-meter]";
/* Where reviews and comments live, on the sites that have them. */
const REVIEWS = "[data-hook*='review'],[id*='review' i],[class*='review' i],[itemprop='review'],[itemprop='reviewBody'],[class*='comment' i],[id*='comment' i],ytd-comments,[data-testid*='review' i]";
const MAIN = "main,article,[role='main'],#content,#main";

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[property='${name}'],meta[name='${name}']`)?.content?.trim() || undefined;

/* Text nodes under a root, in reading order, each node once across roots. */
function gather(root: Element, seen: Set<Node>, out: string[], budget: { left: number }) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (seen.has(node) || budget.left <= 0) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return (node.nodeValue ?? "").trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let node = walker.nextNode(); node && budget.left > 0; node = walker.nextNode()) {
    seen.add(node);
    const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    out.push(text.length > budget.left ? text.slice(0, budget.left) : text);
    budget.left -= text.length + 1;
  }
}

/* The outermost of a set of elements, so a box inside a box is read once. */
function outermost(nodes: Element[]): Element[] {
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)));
}

export function readPage(): PageRequest {
  const seen = new Set<Node>();
  const parts: string[] = [];
  const budget = { left: TEXT_CAP };
  const push = (label: string, root: Element | null) => { if (root && budget.left > 0) { parts.push(`\n## ${label}\n`); gather(root, seen, parts, budget); } };
  /* Reviews and comments first, up to two thirds of the room; the rest of the page after. */
  const reviewBudget = { left: Math.floor(TEXT_CAP * 2 / 3) };
  const reviewParts: string[] = [];
  for (const root of outermost([...document.querySelectorAll(REVIEWS)].slice(0, 300)).slice(0, 40)) {
    if (reviewBudget.left <= 0) break;
    gather(root, seen, reviewParts, reviewBudget);
  }
  if (reviewParts.length) { parts.push("\n## Reviews and comments on the page\n", ...reviewParts); budget.left -= reviewParts.reduce((n, part) => n + part.length + 1, 0); }
  push("Main content", document.querySelector(MAIN));
  push("Rest of the page", document.body);
  /* Structured data: ratings and reviews are often here even when the page shows few. */
  const data = [...document.querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']")].map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "").filter(Boolean).join("\n").slice(0, DATA_CAP);
  const description = (meta("og:description") ?? meta("description"))?.slice(0, DESCRIPTION_CAP);
  const site = siteLabel();
  return {
    url: location.href.slice(0, 2000),
    title: (meta("og:title") ?? document.title).replace(/\s+/g, " ").trim().slice(0, 300),
    ...(site ? { site } : {}),
    ...(description ? { description } : {}),
    text: parts.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, TEXT_CAP),
    ...(data ? { data } : {}),
  };
}

/* The name a site gives itself, when it does (og:site_name or application-name): a site-level label, not the page's content. */
export const siteLabel = (): string | undefined => (meta("og:site_name") ?? meta("application-name"))?.replace(/\s+/g, " ").trim().slice(0, 120) || undefined;

/* The page's own favicon, for the "this page" tile. */
export function faviconUrl(): string {
  const link = [...document.querySelectorAll<HTMLLinkElement>("link[rel~='icon'],link[rel='shortcut icon'],link[rel='apple-touch-icon']")].find((node) => node.href);
  return link?.href ?? `${location.origin}/favicon.ico`;
}
