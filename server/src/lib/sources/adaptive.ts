/* Widens the search window from 3 to 12 to 36 months, platform by
   platform, while a platform has fewer than PER_SOURCE opinions — or,
   when a caller asks for a fixed window, reads that window once. A
   platform that has plenty stops widening; one that found little keeps
   going. Nothing older than three years is read: that is how far
   "general standing" reaches. Earlier findings are kept and
   deduplicated; the widest completed window is reported. */

import { collectAll } from "./index";
import type { SearchWindow, SourceId, SourceItem, SourceStatus } from "../types";
import { SEARCH_MONTHS, monthsBefore } from "../window";

/* Opinions a single platform is asked to reach before it stops widening. */
export const PER_SOURCE = 25;
/* Kept for callers that reason about the old whole-reading threshold. */
export const EXPAND_BELOW = 50;
const DEEPEST_MONTHS = SEARCH_MONTHS[SEARCH_MONTHS.length - 1];

export interface AdaptiveOptions {
  link?: string;
  domain?: string;
  aliases?: string[];
  to?: Date;
  collect?: typeof collectAll;
  depth?: "lite" | "full";
  budgetMs?: number;
  /* Read this many months in one pass instead of widening. */
  months?: number;
}

export async function collectAdaptive(
  subject: string,
  sources: SourceId[],
  options: AdaptiveOptions = {},
): Promise<{ items: SourceItem[]; statuses: SourceStatus[]; window: SearchWindow }> {
  const { link, domain, aliases, to = new Date(), collect = collectAll } = options;
  const started = Date.now();
  const budget = options.budgetMs ?? 24_000;
  if (options.depth === "full" && sources.some(id => id === "hn" || id === "bluesky")) {
    const deep: SourceId[] = sources.filter(id => id === "hn" || id === "bluesky");
    const rest = sources.filter(id => !deep.includes(id));
    const from = monthsBefore(to, DEEPEST_MONTHS);
    const [all, other] = await Promise.all([
      collect(deep, { subject, aliases, link, domain, from, to, depth: "full", timeoutMs: budget, memo: new Map() }),
      rest.length ? collectAdaptive(subject, rest, { ...options, budgetMs: budget }) : null,
    ]);
    return { items: [...all.items, ...(other?.items ?? [])], statuses: [...all.statuses, ...(other?.statuses ?? [])], window: { from: from.toISOString(), to: to.toISOString(), months: DEEPEST_MONTHS } };
  }
  const items = new Map<string, SourceItem>();
  const statuses = new Map<SourceId, SourceStatus>();
  const memo = new Map<string, Promise<unknown>>();
  const countFor = (source: SourceId) => [...items.values()].filter((item) => item.source === source && item.kind !== "video").length;
  const windows: readonly number[] = options.months ? [options.months] : SEARCH_MONTHS;
  let active = sources;
  let months: number = windows[0];
  for (const windowMonths of windows) {
    if (!active.length || Date.now() - started >= budget) break;
    months = windowMonths;
    const batch = await collect(active, { subject, aliases, link, domain, from: monthsBefore(to, months), to, depth: options.depth, memo, previousItems: [...items.values()], timeoutMs: Math.min(9000, Math.max(1, budget - (Date.now() - started))) });
    for (const item of batch.items) if (!items.has(item.id)) items.set(item.id, item);
    for (const status of batch.statuses) statuses.set(status.source, status);
    active = batch.expandable.filter((source) => countFor(source) < PER_SOURCE);
  }
  months = Math.max(months, ...[...statuses.values()].map((status) => status.window?.months ?? 0));
  return {
    items: [...items.values()],
    statuses: sources.map((source): SourceStatus => {
      const status = statuses.get(source) ?? { source, availability: "unavailable" as const, itemsAnalysed: 0, note: "Search time limit reached." };
      const count = countFor(source);
      return { ...status, itemsAnalysed: count, availability: count > 0 && status.availability === "unavailable" ? "partial" : status.availability };
    }),
    window: { from: monthsBefore(to, months).toISOString(), to: to.toISOString(), months },
  };
}
