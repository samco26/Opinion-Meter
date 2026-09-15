/* What a result stands for. A result's bar is about the site it sits
   beside — X, Google Play, Wikipedia, the eSafety Commissioner — as
   people regard that site or service over time; the one exception is a
   YouTube video, which is the video itself (its own comments and the
   posts that link to it). The query names the thing the reader typed,
   by the batched AI call, with the other names discussion uses for it.
   A page about nothing in particular gets no bar. */
import { nameSubjects } from "./analysis/name";
import { hashKey, normaliseUrl, resolveByRule, siteSubject, subject, type RawResult } from "./subject";
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

/* The site behind each result, or the video; the query by name. */
export function resultSubject(result: RawResult): Subject | null {
  const rule = resolveByRule(result);
  if (rule !== null && rule !== "ask" && rule.key.startsWith("yt:")) return rule;
  return siteSubject(result);
}

export async function resultSubjects(query: string, results: Array<RawResult & { i: number }>, timeoutMs: number): Promise<ResultSubjects> {
  const byIndex = new Map<number, Subject | null>();
  for (const result of results) byIndex.set(result.i, resultSubject(result));
  const named = await nameSubjects(query, [], timeoutMs);
  return { query: named.query, results: byIndex };
}

export function targetInstructions(target: Subject): string {
  if (target.scope === "link") return `Reading scope: the specific page ${target.link}, titled ${JSON.stringify(target.name)}. Classify views of that page's content, claims, usefulness, accuracy or trustworthiness. General opinions about the product/topic it mentions are irrelevant unless they directly evaluate this page. A shared link or promotional title alone is not an opinion. Never turn reactions to bad news into a negative rating for its publisher.`;
  if (target.scope === "domain") return `Reading scope: the website or service ${target.domain} as a whole, not an individual page or product it sells. Classify first-hand experiences, trust, usefulness, quality and service of that website over time. Mere links to it, syndicated headlines, and opinions about products/topics it mentions without evaluating the website are irrelevant.`;
  if (target.kind === "person") return `Reading scope: ${target.name} as a public figure — their work, performance and public conduct, as people regard them over time. Everything said about their public role counts; their private life does not.`;
  const known = target.aliases?.length ? ` Also known as ${target.aliases.map((alias) => JSON.stringify(alias)).join(", ")}; entries using those names are about the same subject.` : "";
  return `Reading scope: the named subject as a whole — the product, service, company, site, film, app, place, topic or work itself — as people regard it over time, not any one page about it. Everything said about it counts, including its business decisions and its politics.${known}`;
}
