/* The page door's work: one reading of the page the reader is on, made
   from its subject. Name the page; then, at the same time, sweep the
   platforms for that subject and read the page itself for the opinions
   written on it; then one pass over both. The finished reading is held a
   quarter of an hour (it carries quotes), so a second press opens at once;
   the page's text is never kept. */

import { analysePage, extractPageOpinions, namePage, pageEntries, TEXT_MAX } from "./analysis/page";
import { configured, settings } from "./env";
import { sourcesFor } from "./gauge";
import { claimFresh } from "./limits";
import { memory } from "./memory";
import { collectAdaptive } from "./sources/adaptive";
import { hashKey, normaliseUrl } from "./subject";
import type { PageRequest, PageResponse } from "./types";

/* Bumped whenever the page classifier changes, so old readings are not served. */
const READING = 1;
const PAGE_TTL = 15 * 60;
/* A page named as nothing in particular is remembered longer: a cheap answer. */
const NOTHING_TTL = 6 * 3600;
export const INSUFFICIENT = "Subject does not possess sufficient sentiment footprint";
export const NOTHING = "This page seems to be about nothing in particular";

/* The hands cap the text at TEXT_MAX; anything past a little slack is a malformed request. */
const TEXT_LIMIT = TEXT_MAX + 20_000;

export function readPageRequest(body: unknown): PageRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { url, title, site, description, text, data } = body as Record<string, unknown>;
  if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 2000) return null;
  if (typeof title !== "string" || title.length > 300) return null;
  if (typeof text !== "string" || text.length > TEXT_LIMIT) return null;
  const clean = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim().slice(0, max) : undefined);
  return {
    url, title: title.replace(/\s+/g, " ").trim(), text: text.slice(0, TEXT_MAX),
    ...(clean(site, 120) ? { site: clean(site, 120) } : {}),
    ...(clean(description, 500) ? { description: clean(description, 500) } : {}),
    ...(typeof data === "string" && data.trim() ? { data: data.slice(0, 10_000) } : {}),
  };
}

export const pageKey = (url: string) => `page:${hashKey(normaliseUrl(url) ?? url)}`;

export async function pageFor(req: PageRequest, budgetMs: number): Promise<PageResponse> {
  if (!configured.openai()) throw new Error("Reading a page needs the server's AI connection, which is not set up.");
  const m = memory();
  const started = Date.now();
  const remaining = () => Math.max(1000, budgetMs - (Date.now() - started));
  const key = pageKey(req.url);
  const held = await m.get<PageResponse>(`${key}:${READING}`);
  if (held) return held;

  const subject = await namePage(req, Math.min(8000, remaining() - 30_000));
  if (!subject) {
    const nothing: PageResponse = { kind: "nothing", message: NOTHING };
    await m.set(`${key}:${READING}`, nothing, NOTHING_TTL);
    return nothing;
  }
  if (!(await claimFresh())) throw new Error("Today's reading budget is used up. Please try again tomorrow.");

  /* The platforms and the page, read side by side. A platform sweep that fails still leaves the page's own reviews. */
  const [collected, quotes] = await Promise.all([
    collectAdaptive(subject.name, sourcesFor(subject), { link: subject.link, aliases: subject.aliases, depth: "full", budgetMs: Math.min(16_000, remaining() - 24_000) })
      .catch(() => ({ items: [], statuses: [], window: { from: new Date(Date.now() - 36 * 30 * 86_400_000).toISOString(), to: new Date().toISOString(), months: 36 } })),
    extractPageOpinions(subject, req, Math.min(24_000, remaining() - 22_000)).catch(() => [] as string[]),
  ]);
  const entries = pageEntries(quotes, req, collected.items);
  const minItems = settings.minItems();
  const opinions = entries.filter((entry) => entry.kind !== "video").length;
  let response: PageResponse;
  if (opinions < minItems) {
    response = { kind: "insufficient", subject: subject.name, message: INSUFFICIENT, pageCount: quotes.length, platformCount: opinions - quotes.length };
  } else {
    const analysed = await analysePage(subject, entries, collected.window, minItems, Math.min(22_000, remaining() - 1000));
    response = analysed.kind === "page"
      ? { kind: "page", page: { ...analysed.card, key } }
      : { kind: "insufficient", subject: subject.name, message: INSUFFICIENT, pageCount: analysed.pageCount, platformCount: analysed.platformCount };
  }
  await m.set(`${key}:${READING}`, response, PAGE_TTL);
  return response;
}
