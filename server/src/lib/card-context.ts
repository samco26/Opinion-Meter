/* A drawer can land on a different server instance. Re-name the original
   query/result if memory has expired; never trust a client-supplied subject. */
import { nameSubjects } from "./analysis/name";
import { resultSubjects } from "./target";
import type { GaugeRequest, Subject } from "./types";

export function readContext(value: unknown): GaugeRequest | null {
  if (!value || typeof value !== "object") return null;
  const { query, results } = value as GaugeRequest;
  if (typeof query !== "string" || query.length > 200 || !Array.isArray(results) || results.length > 1) return null;
  for (const r of results) {
    if (!r || typeof r.url !== "string" || r.url.length > 2000 || typeof r.title !== "string" || !r.title.trim() || r.title.length > 300) return null;
    try { if (!/^https?:$/.test(new URL(r.url).protocol)) return null; } catch { return null; }
  }
  return { query: query.trim(), results: results.map(({ url, title, site }) => ({ url, title, ...(typeof site === "string" && site.trim() ? { site: site.trim().slice(0, 120) } : {}) })) };
}

export async function recoverSubject(key: string, context: GaugeRequest): Promise<Subject | null> {
  const result = context.results[0];
  const found = result
    ? (await resultSubjects(context.query, [{ ...result, i: 0 }], 8000)).results.get(0) ?? null
    : (await nameSubjects(context.query, [], 8000)).query;
  return found && (!key || found.key === key) ? found : null;
}
