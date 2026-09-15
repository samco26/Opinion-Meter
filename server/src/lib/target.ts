/* What a result stands for. A result's bar is about the thing its page
   represents — the product, service, film, app, company or article — as
   people regard it over time. With an AI key every result is named by
   one batched call so that "x.com", "X - App Store" and the query
   "twitter" all come back as the same X; only a YouTube video keeps its
   rule-made identity (the video ID is exact). Without an AI key the
   rules in subject.ts name what they can and an unnamed page falls back
   to a reading of the page itself, then of its website. A page that is
   about nothing in particular gets no bar either way. */
import { configured } from "./env";
import { nameSubjects } from "./analysis/name";
import { hashKey, normaliseUrl, resolveByRule, subject, type RawResult } from "./subject";
import type { Subject } from "./types";

export function linkSubject(result: RawResult): Subject | null {
  const link = normaliseUrl(result.url);
  if (!link || !result.title.trim()) return null;
  const u = new URL(link);
  // Internal shopping destinations are not independent sites to rate.
  if (/(^|\.)(google\.[a-z.]+|googleadservices\.com)$/.test(u.hostname)) return null;
  return { ...subject(result.title.trim().slice(0, 300), "article", `link:${hashKey(link)}`, link), scope: "link", domain: u.hostname };
}
export function domainSubject(target: Subject): Subject | null {
  if (target.scope !== "link" || !target.link || !target.domain) return null;
  return { ...subject(target.domain, "company", `domain:${hashKey(target.domain)}`), scope: "domain", domain: target.domain };
}

export interface ResultSubjects { query: Subject | null; results: Map<number, Subject | null> }

/* The query and every result, named. */
export async function resultSubjects(query: string, results: Array<RawResult & { i: number }>, timeoutMs: number): Promise<ResultSubjects> {
  const ai = configured.openai();
  const byIndex = new Map<number, Subject | null>();
  const unknown: Array<RawResult & { i: number }> = [];
  for (const result of results) {
    const outcome = resolveByRule(result);
    if (outcome === null) byIndex.set(result.i, null);
    else if (outcome !== "ask" && outcome.key.startsWith("yt:")) byIndex.set(result.i, outcome);
    else if (ai) unknown.push(result);
    else byIndex.set(result.i, outcome === "ask" ? linkSubject(result) : outcome);
  }
  const named = await nameSubjects(query, unknown, timeoutMs);
  for (const result of unknown) byIndex.set(result.i, named.results.get(result.i) ?? null);
  return { query: named.query, results: byIndex };
}

export function targetInstructions(target: Subject): string {
  if (target.scope === "link") return `Reading scope: the specific page ${target.link}, titled ${JSON.stringify(target.name)}. Classify views of that page's content, claims, usefulness, accuracy or trustworthiness. General opinions about the product/topic it mentions are irrelevant unless they directly evaluate this page. A shared link or promotional title alone is not an opinion. Never turn reactions to bad news into a negative rating for its publisher.`;
  if (target.scope === "domain") return `Reading scope: the website or service ${target.domain} as a whole, not an individual page or product it sells. Classify first-hand experiences, trust, usefulness, quality and service of that website over time. Mere links to it, syndicated headlines, and opinions about products/topics it mentions without evaluating the website are irrelevant.`;
  return "Reading scope: the named subject as a whole — the product, service, company, film, app, place or work itself — as people regard it over time, not any one page about it. Everything said about it counts, including its business decisions and its politics.";
}
