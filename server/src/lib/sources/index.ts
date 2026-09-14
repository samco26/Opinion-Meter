/* Runs the requested readers in parallel, each under its own timeout. One
   failure never stops the others: a reader that is not configured, times
   out or is refused comes back as an unavailable status with a plain
   reason, and the analysis goes ahead on the rest. */

import type { SourceId, SourceItem, SourceStatus } from "../types";
import { reasonFor, type CollectOptions, type Collected, type Connector } from "../http";
import { youtube } from "./youtube";
import { x } from "./x";
import { reddit } from "./reddit";
import { hn } from "./hn";
import { bluesky } from "./bluesky";

const SOURCE_TIMEOUT_MS = 9000;
const CONNECTORS: Record<SourceId, Connector> = { youtube, x, reddit, hn, bluesky };

export const connectorConfigured = (id: SourceId) => CONNECTORS[id].configured();

export async function collectAll(sources: SourceId[], opts: Omit<CollectOptions, "signal">): Promise<{ items: SourceItem[]; statuses: SourceStatus[]; expandable: SourceId[] }> {
  const results = await Promise.all(sources.map(async (id): Promise<Collected> => {
    const c = CONNECTORS[id];
    if (!c.configured()) return { items: [], canExpand: false, status: { source: id, availability: "unavailable", itemsAnalysed: 0, note: "Not connected yet." } };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? SOURCE_TIMEOUT_MS);
    try {
      return await c.collect({ ...opts, signal: ctl.signal });
    } catch (err) {
      return { items: [], canExpand: false, status: { source: id, availability: "unavailable", itemsAnalysed: 0, note: reasonFor(err, ctl.signal.aborted) } };
    } finally {
      clearTimeout(timer);
    }
  }));
  return {
    items: results.flatMap((r) => r.items),
    statuses: results.map((r) => r.status),
    expandable: results.filter((r) => r.canExpand !== false && r.status.source !== "x").map((r) => r.status.source),
  };
}
