/* What a result stands for. A result's bar is about the site it sits
   beside — X, Google Play, Wikipedia, the eSafety Commissioner — as
   people regard that site or service over time; the one exception is a
   YouTube video, which is the video itself (its own comments). Well-known
   sites come from the table in subject.ts; any other site is named by the
   model from its address and Google's label, so that two ABC News are
   told apart. The query names the thing the reader typed, by the batched
   AI call, with the other names discussion uses for it. A page about
   nothing in particular gets no bar. */
import { cachedQueryName, cachedSiteNames, nameSites, nameSubjects } from "./analysis/name";
import { configured } from "./env";
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

/* later: results (by index) and queryLater: the query, whose names are still being made in the background; the hands ask again shortly. */
export interface ResultSubjects { query: Subject | null; results: Map<number, Subject | null>; later: Set<number>; queryLater: boolean }

/* The site behind a result, or the video, without any AI. */
export function resultSubject(result: RawResult): Subject | null {
  const rule = resolveByRule(result);
  if (rule !== null && rule !== "ask" && rule.key.startsWith("yt:")) return rule;
  return siteSubject(result);
}

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, ""); } catch { return null; } };

/* background: given, a name the model has yet to make is started in the background and reported as "later" rather than
   waited for, so results that are already known (and their readings) are not held up by the ones that are not. */
export async function resultSubjects(query: string, results: Array<RawResult & { i: number }>, timeoutMs: number, background?: (work: Promise<unknown>) => void): Promise<ResultSubjects> {
  const byIndex = new Map<number, Subject | null>();
  const later = new Set<number>();
  let queryLater = false;
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
  let named: { query: Subject | null };
  let sites: Map<string, Subject | null | undefined>;
  /* A site asking for its own reading sends no query: nothing to name there. The results' titles go along as context for the query's name. */
  const titles = results.map((result) => result.title.trim()).filter(Boolean);
  const blank = !query.trim();
  if (background && configured.openai()) {
    /* Only what the memory knows now; the rest is made in the background and asked for again. */
    const [storedQuery, storedSites] = await Promise.all([blank ? null : cachedQueryName(query), cachedSiteNames([...unknown.keys()])]);
    if (storedQuery === undefined) { queryLater = true; background(nameSubjects(query, [], timeoutMs, titles)); }
    named = { query: storedQuery ?? null };
    sites = storedSites;
    const unnamed = [...unknown.values()].filter((entry) => sites.get(entry.host) === undefined);
    if (unnamed.length) {
      for (const entry of unnamed) for (const index of entry.indexes) later.add(index);
      background(nameSites(unnamed.map(({ host, label, title }) => ({ host, label, title })), timeoutMs));
    }
  } else {
    [named, sites] = await Promise.all([
      blank ? Promise.resolve({ query: null }) : nameSubjects(query, [], timeoutMs, titles),
      unknown.size ? nameSites([...unknown.values()].map(({ host, label, title }) => ({ host, label, title })), timeoutMs) : Promise.resolve(new Map<string, Subject | null>()),
    ]);
  }
  for (const entry of unknown.values()) {
    const site = sites.get(entry.host);
    /* The model's name wins; when it has nothing, Google's label stands. */
    if (site) for (const index of entry.indexes) byIndex.set(index, site);
  }
  return { query: named.query, results: byIndex, later, queryLater };
}

export function targetInstructions(target: Subject): string {
  if (target.scope === "link") return `Reading scope: the specific page ${target.link}, titled ${JSON.stringify(target.name)}. Classify views of that page's content, claims, usefulness, accuracy or trustworthiness. General opinions about the product/topic it mentions are irrelevant unless they directly evaluate this page. A shared link or promotional title alone is not an opinion. Never turn reactions to bad news into a negative rating for its publisher.`;
  if (target.scope === "domain") return `Reading scope: the website or service ${target.domain} as a whole, not an individual page or product it sells. Classify first-hand experiences, trust, usefulness, quality and service of that website over time. Mere links to it, syndicated headlines, and opinions about products/topics it mentions without evaluating the website are irrelevant.`;
  if (target.kind === "person") return `Reading scope: ${target.name} as a public figure — their work, performance and public conduct, as people regard them over time. Everything said about their public role counts; their private life does not.`;
  const known = target.aliases?.length ? ` Also known as ${target.aliases.map((alias) => JSON.stringify(alias)).join(", ")}; entries using those names are about the same subject.` : "";
  return `Reading scope: the named subject as a whole — the product, service, company, site, film, app, place, topic or work itself — as people regard it over time, not any one page about it. Everything said about it counts, including its business decisions and its politics.${known}`;
}
