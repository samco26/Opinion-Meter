/* Widens the search window from 3 to 12 to 36 months while fewer than
   EXPAND_BELOW opinions have been found. Earlier findings are kept and
   deduplicated; the widest completed window is reported. */

import { collectAll } from "./index";
import type { SourceId, SourceItem, SourceStatus } from "../types";
import { SEARCH_MONTHS, monthsBefore } from "../window";

export const EXPAND_BELOW = 50;

export async function collectAdaptive(
  subject: string,
  sources: SourceId[],
  options: { link?: string; to?: Date; collect?: typeof collectAll } = {},
) {
  const { link, to = new Date(), collect = collectAll } = options;
  const items = new Map<string, SourceItem>();
  const statuses = new Map<SourceId, SourceStatus>();
  const memo = new Map<string, Promise<unknown>>();
  let active = sources;
  let months: number = SEARCH_MONTHS[0];
  for (const windowMonths of SEARCH_MONTHS) {
    if (!active.length) break;
    months = windowMonths;
    const batch = await collect(active, { subject, link, from: monthsBefore(to, months), to, memo, previousItems: [...items.values()] });
    for (const item of batch.items) if (!items.has(item.id)) items.set(item.id, item);
    for (const status of batch.statuses) statuses.set(status.source, status);
    if ([...items.values()].filter((item) => item.kind !== "video").length >= EXPAND_BELOW) break;
    active = batch.expandable;
  }
  months = Math.max(months, ...[...statuses.values()].map((status) => status.window?.months ?? 0));
  return {
    items: [...items.values()],
    statuses: sources.map((source): SourceStatus => {
      const status = statuses.get(source)!;
      const count = [...items.values()].filter((item) => item.source === source && item.kind !== "video").length;
      return { ...status, itemsAnalysed: count, availability: count > 0 && status.availability === "unavailable" ? "partial" : status.availability };
    }),
    window: { from: monthsBefore(to, months).toISOString(), to: to.toISOString(), months },
  };
}
