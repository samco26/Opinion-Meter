/* Widens the search window from 3 to 12 to 36 months while fewer than
   EXPAND_BELOW opinions have been found. Earlier findings are kept and
   deduplicated; the widest completed window is reported. */

import { collectAll } from "./index";
import type { SearchWindow, SourceId, SourceItem, SourceStatus } from "../types";
import { SEARCH_MONTHS, monthsBefore } from "../window";

export const EXPAND_BELOW = 50;

export async function collectAdaptive(
  subject: string,
  sources: SourceId[],
  options: { link?: string; to?: Date; collect?: typeof collectAll; depth?: "lite" | "full"; budgetMs?: number } = {},
): Promise<{ items: SourceItem[]; statuses: SourceStatus[]; window: SearchWindow }> {
  const { link, to = new Date(), collect = collectAll } = options;
  const started = Date.now();
  const budget = options.budgetMs ?? 24_000;
  if (options.depth === "full" && sources.some(id => id === "hn" || id === "bluesky")) {
    const deep: SourceId[] = sources.filter(id => id === "hn" || id === "bluesky");
    const rest = sources.filter(id => !deep.includes(id));
    const [all, other] = await Promise.all([
      collect(deep, { subject, link, to, depth: "full", timeoutMs: budget, memo: new Map() }),
      rest.length ? collectAdaptive(subject, rest, { ...options, depth: "lite", budgetMs: budget }) : null,
    ]);
    return { items: [...all.items, ...(other?.items ?? [])], statuses: [...all.statuses, ...(other?.statuses ?? [])], window: { from: "2006-01-01T00:00:00.000Z", to: to.toISOString(), months: (to.getUTCFullYear() - 2006) * 12 + to.getUTCMonth() } };
  }
  const items = new Map<string, SourceItem>();
  const statuses = new Map<SourceId, SourceStatus>();
  const memo = new Map<string, Promise<unknown>>();
  let active = sources;
  let months: number = SEARCH_MONTHS[0];
  for (const windowMonths of SEARCH_MONTHS) {
    if (!active.length || Date.now() - started >= budget) break;
    months = windowMonths;
    const batch = await collect(active, { subject, link, from: monthsBefore(to, months), to, memo, previousItems: [...items.values()], timeoutMs: Math.min(9000, Math.max(1, budget - (Date.now() - started))) });
    for (const item of batch.items) if (!items.has(item.id)) items.set(item.id, item);
    for (const status of batch.statuses) statuses.set(status.source, status);
    if ([...items.values()].filter((item) => item.kind !== "video").length >= EXPAND_BELOW) break;
    active = batch.expandable;
  }
  months = Math.max(months, ...[...statuses.values()].map((status) => status.window?.months ?? 0));
  return {
    items: [...items.values()],
    statuses: sources.map((source): SourceStatus => {
      const status = statuses.get(source) ?? { source, availability: "unavailable" as const, itemsAnalysed: 0, note: "Search time limit reached." };
      const count = [...items.values()].filter((item) => item.source === source && item.kind !== "video").length;
      return { ...status, itemsAnalysed: count, availability: count > 0 && status.availability === "unavailable" ? "partial" : status.availability };
    }),
    window: { from: monthsBefore(to, months).toISOString(), to: to.toISOString(), months },
  };
}
