/* Search-query opinion and destination reputation are separate readings.
   A result never inherits the main query's verdict. */
import { hashKey, normaliseUrl, subject, type RawResult } from "./subject";
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
export function targetInstructions(target: Subject): string {
  if (target.scope === "link") return `Reading scope: the specific page ${target.link}, titled ${JSON.stringify(target.name)}. Classify views of that page's content, claims, usefulness, accuracy or trustworthiness. General opinions about the product/topic it mentions are irrelevant unless they directly evaluate this page. A shared link or promotional title alone is not an opinion. Never turn reactions to bad news into a negative rating for its publisher.`;
  if (target.scope === "domain") return `Reading scope: the website/domain ${target.domain}, not an individual page or product it sells. Classify first-hand experiences, trust, usefulness and service/reputation of that website. Mere links to it, syndicated headlines, and opinions about products/topics it mentions without evaluating the website are irrelevant. State clearly in the summary that this is about the website.`;
  return "Reading scope: opinions about the named subject of the search query.";
}
