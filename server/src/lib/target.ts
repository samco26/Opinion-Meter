/* What a result stands for. A result's bar is about the site it sits
   beside — X, Google Play, Wikipedia, the eSafety Commissioner — as
   people regard that site or service over time; the one exception is a
   YouTube video, which is the video itself (its own comments). Well-known
   sites come from the table in subject.ts; any other site is named by the
   model from its address and Google's label, so that two ABC News are
   told apart. The query names the thing the reader typed, by the batched
   AI call, with the other names discussion uses for it. A page about
   nothing in particular gets no bar. */
import { nameSites, nameSubjects } from "./analysis/name";
import { hashKey, knownSite, normaliseUrl, resolveByRule, siteSubject, subject, type RawResult } from "./subject";
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

/* The site behind a result, or the video, without any AI. */
export function resultSubject(result: RawResult): Subject | null {
  const rule = resolveByRule(result);
  if (rule !== null && rule !== "ask" && rule.key.startsWith("yt:")) return rule;
  return siteSubject(result);
}

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, ""); } catch { return null; } };

export async function resultSubjects(query: string, results: Array<RawResult & { i: number }>, timeoutMs: number): Promise<ResultSubjects> {
  const byIndex = new Map<number, Subject | null>();
  const unknown = new Map<string, { host: string; label?: string; title: string; indexes: number[] }>();
  for (const result of results) {
    const found = resultSubject(result);
    byIndex.set(result.i, found);
    const host = hostOf(result.url);
    if (!found || !host || found.key.startsWith("yt:") || host === "merchant.invalid" || knownSite(host)) continue;
    const entry = unknown.get(host) ?? { host, label: result.site, title: result.title, indexes: [] };
    entry.indexes.push(result.i);
    unknown.set(host, entry);
  }
  const [named, sites] = await Promise.all([
    nameSubjects(query, [], timeoutMs),
    unknown.size ? nameSites([...unknown.values()].map(({ host, label, title }) => ({ host, label, title })), timeoutMs) : Promise.resolve(new Map<string, Subject | null>()),
  ]);
  for (const entry of unknown.values()) {
    const site = sites.get(entry.host);
    /* The model's name wins; when it has nothing, Google's label stands. */
    if (site) for (const index of entry.indexes) byIndex.set(index, site);
  }
  return { query: named.query, results: byIndex };
}

export function targetInstructions(target: Subject): string {
  if (target.scope === "link") return `Reading scope: the specific page ${target.link}, titled ${JSON.stringify(target.name)}. Classify views of that page's content, claims, usefulness, accuracy or trustworthiness. General opinions about the product/topic it mentions are irrelevant unless they directly evaluate this page. A shared link or promotional title alone is not an opinion. Never turn reactions to bad news into a negative rating for its publisher.`;
  if (target.scope === "domain") return `Reading scope: the website or service ${target.domain} as a whole, not an individual page or product it sells. Classify first-hand experiences, trust, usefulness, quality and service of that website over time. Mere links to it, syndicated headlines, and opinions about products/topics it mentions without evaluating the website are irrelevant.`;
  if (target.kind === "person") return `Reading scope: ${target.name} as a public figure — their work, performance and public conduct, as people regard them over time. Everything said about their public role counts; their private life does not.`;
  const known = target.aliases?.length ? ` Also known as ${target.aliases.map((alias) => JSON.stringify(alias)).join(", ")}; entries using those names are about the same subject.` : "";
  return `Reading scope: the named subject as a whole — the product, service, company, site, film, app, place, topic or work itself — as people regard it over time, not any one page about it. Everything said about it counts, including its business decisions and its politics.${known}`;
}
