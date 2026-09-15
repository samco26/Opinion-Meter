/* X full-archive search, paid per post returned. Off unless a token
   exists; used only for the full card. Widens 3, 12, 36 months on empty
   responses and stops at the first match, so at most X_MAX_RESULTS posts
   are ever billed for one subject. The daily budget is per server
   instance; the enforceable ceiling is the spend limit in X's console. */

import { setTimeout as delay } from "node:timers/promises";
import type { SearchWindow, SourceItem } from "../types";
import { env, envInt } from "../env";
import { SEARCH_MONTHS, monthsBefore } from "../window";
import { getJson, getOnce, reasonFor, statusFor, type Collected, type CollectOptions, type Connector } from "../http";

const API = "https://api.x.com/2/tweets/search/all";
const END_TIME_SAFETY_MS = 15_000;
/* Archive requests are limited to one per second. */
const FALLBACK_DELAY_MS = 1050;

interface SearchResponse {
  data?: Array<{ id: string; text: string; created_at?: string; public_metrics?: { like_count?: number; retweet_count?: number } }>;
}

let budgetDay = "";
let spentToday = 0;

function spend(n: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) { budgetDay = today; spentToday = 0; }
  if (spentToday + n > envInt("X_DAILY_POST_BUDGET", 1000, 0, 1_000_000)) return false;
  spentToday += n;
  return true;
}

function refund(n: number): void {
  if (n > 0 && budgetDay === new Date().toISOString().slice(0, 10)) spentToday = Math.max(0, spentToday - n);
}

export function xTerms(opts: Pick<CollectOptions, "subject" | "link">): string {
  if (opts.link) {
    const u = new URL(opts.link);
    return `url:"${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}"`;
  }
  return `"${opts.subject.replace(/"/g, "")}"`;
}

async function collectArchive(opts: CollectOptions, to: Date): Promise<Collected> {
  const max = envInt("X_MAX_RESULTS", 20, 10, 20);
  const off = (note: string): Collected => ({ items: [], canExpand: false, status: { source: "x", availability: "unavailable", itemsAnalysed: 0, note } });
  if (envInt("X_DAILY_POST_BUDGET", 1000, 0, 1_000_000) === 0) return off("X is switched off: X_DAILY_POST_BUDGET is 0.");
  if (!spend(max)) return off("Today's reading budget for X is used up.");

  let completedWindow: SearchWindow | undefined;
  for (const months of SEARCH_MONTHS) {
    const period = months === 36 ? "3 years" : `${months} months`;
    try {
      if (completedWindow) await delay(FALLBACK_DELAY_MS, undefined, { signal: opts.signal });
      opts.signal.throwIfAborted();
      const from = monthsBefore(to, months);
      const url = new URL(API);
      url.searchParams.set("query", `${xTerms(opts)} -is:retweet lang:en`);
      url.searchParams.set("sort_order", "relevancy");
      url.searchParams.set("max_results", String(max));
      url.searchParams.set("tweet.fields", "created_at,public_metrics");
      url.searchParams.set("start_time", from.toISOString());
      if (to.getTime() <= Date.now() - END_TIME_SAFETY_MS) url.searchParams.set("end_time", to.toISOString());
      const res = await getJson<SearchResponse>(url.toString(), { signal: opts.signal, headers: { Authorization: `Bearer ${env("X_BEARER_TOKEN")}` } });
      completedWindow = { from: from.toISOString(), to: to.toISOString(), months };
      const items: SourceItem[] = (res.data ?? []).map((p) => ({
        id: `x:post:${p.id}`, source: "x", kind: "post", text: p.text, url: `https://x.com/i/status/${p.id}`, publishedAt: p.created_at,
        engagement: (p.public_metrics?.like_count ?? 0) + (p.public_metrics?.retweet_count ?? 0),
      }));
      if (items.length || months === 36) {
        refund(max - items.length);
        const note = items.length ? `Read ${items.length} of up to ${max} X posts from the last ${period}.` : `No matching X posts were found in the last ${period}.`;
        return { items, canExpand: false, status: { ...statusFor("x", items.length, max), note, window: completedWindow } };
      }
    } catch (error) {
      refund(max);
      return { items: [], canExpand: false, status: { source: "x", availability: "unavailable", itemsAnalysed: 0, note: `X search could not complete for the last ${period}. ${reasonFor(error, opts.signal.aborted)}`, window: completedWindow } };
    }
  }
  throw new Error("X search windows are not configured.");
}

export const x: Connector = {
  id: "x",
  configured: () => Boolean(env("X_BEARER_TOKEN")),
  collect: (opts) => {
    const to = opts.to ?? new Date();
    return getOnce(`x:archive:${xTerms(opts)}:${to.toISOString()}`, opts, () => collectArchive(opts, to));
  },
};
