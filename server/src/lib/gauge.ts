/* The gauge door's work: name the subject behind each result, merge
   duplicates, answer from memory where possible, and compute the rest
   within the request's budget. Anything still running when the budget
   ends is kept alive by the caller and finished into memory; the
   extension polls for it. */

import { configured, settings } from "./env";
import { claimFresh } from "./limits";
import { memory } from "./memory";
import { collectAdaptive } from "./sources/adaptive";
import { domainSubject, resultSubjects } from "./target";
import { liteGauge } from "./analysis/lite";
import { youtubeVideoId } from "./sources/youtube";
import type { Gauge, GaugeRequest, GaugeResponse, SourceId, Subject, SubjectStates } from "./types";

/* Every connected platform reads every subject by name; a page is also
   looked up by link on the platforms that can, and a linked video's own
   comments are read. */
export const LITE_SOURCES: SourceId[] = ["reddit", "youtube", "hn", "bluesky"];
export const LINK_SOURCES: SourceId[] = ["reddit", "hn", "bluesky"];
export const sourcesFor = (subject: Subject): SourceId[] => subject.link ? [...LINK_SOURCES, ...(youtubeVideoId(subject.link) ? ["youtube" as const] : [])] : LITE_SOURCES;
const MAX_RESULTS = 20;
const PENDING_TTL = 120;
const NONE_TTL = 6 * 3600;
const SUBJECT_TTL = 86_400;

export type Stored = { state: "ready"; gauge: Gauge } | { state: "none"; reason: string };

export async function computeGauge(subject: Subject): Promise<Stored> {
  const m = memory();
  let stored: Stored;
  try {
    if (subject.scope && !configured.openai()) {
      stored = { state: "none", reason: "Website/link opinions need AI analysis. The server's AI key is not connected yet." };
    } else if (!(await claimFresh())) {
      stored = { state: "none", reason: "Today's budget for new subjects is used up." };
    } else {
      stored = { state: "none", reason: "Not enough relevant opinions about this page or its website." };
      const fallback = domainSubject(subject);
      for (const target of [subject, ...(fallback ? [fallback] : [])]) {
        // Different pages on the same domain reuse the domain reading.
        const cached = target.scope === "domain" ? await m.get<Stored>(`gauge:${target.key}`) : null;
        if (cached?.state === "ready") {
          stored = { state: "ready", gauge: { ...cached.gauge, key: subject.key, targetUrl: subject.link } }; break;
        }
        const { items, window } = await collectAdaptive(target.name, sourcesFor(target), { link: target.link, domain: target.scope === "domain" ? target.domain : undefined, budgetMs: 10_000 });
        if (items.filter(item => item.kind !== "video").length < settings.minItems()) continue;
        const gauge = await liteGauge(target, items, window, 12_000);
        if (!gauge) continue;
        if (target.scope === "domain") await m.set(`gauge:${target.key}`, { state: "ready", gauge }, settings.cacheTtlSeconds());
        stored = { state: "ready", gauge: { ...gauge, key: subject.key, targetUrl: subject.link } }; break;
      }
    }
  } catch (err) {
    stored = { state: "none", reason: err instanceof Error ? err.message : "The analysis failed." };
  }
  await m.set(`gauge:${subject.key}`, stored, stored.state === "ready" ? settings.cacheTtlSeconds() : NONE_TTL);
  await m.del(`pending:${subject.key}`);
  return stored;
}

export async function gaugeFor(req: GaugeRequest, budgetMs: number, keepAlive: (work: Promise<unknown>) => void): Promise<GaugeResponse> {
  const started = Date.now();
  const results = req.results.slice(0, MAX_RESULTS).map((r, i) => ({ ...r, i }));
  const naming = await resultSubjects(req.query, results, Math.min(8000, budgetMs / 3));

  const subjects = new Map<string, Subject>();
  const add = (s: Subject | null) => {
    if (s && !subjects.has(s.key)) subjects.set(s.key, s);
    return s?.key ?? null;
  };
  const response: GaugeResponse = {
    query: { key: add(naming.query) },
    results: results.map((r) => ({ url: r.url, key: add(naming.results.get(r.i) ?? null) })),
    subjects: {},
  };

  const m = memory();
  const remaining = () => Math.max(0, budgetMs - (Date.now() - started));
  await Promise.all([...subjects.values()].map(async (subject) => {
    const base = { name: subject.name, kind: subject.kind, category: subject.category };
    await m.set(`subject:${subject.key}`, subject, SUBJECT_TTL);
    const stored = await m.get<Stored>(`gauge:${subject.key}`);
    const outdated = configured.openai() && (stored?.state === "ready" ? stored.gauge.simulated : stored?.state === "none" && /AI key|AI analysis/.test(stored.reason));
    if (stored && !outdated) {
      response.subjects[subject.key] = { ...base, ...stored };
      return;
    }
    if (await m.get(`pending:${subject.key}`)) {
      response.subjects[subject.key] = { ...base, state: "pending" };
      return;
    }
    await m.set(`pending:${subject.key}`, true, PENDING_TTL);
    const work = computeGauge(subject);
    keepAlive(work);
    const outcome = await Promise.race([work, new Promise<null>((resolve) => setTimeout(resolve, remaining()))]);
    response.subjects[subject.key] = outcome ? { ...base, ...outcome } : { ...base, state: "pending" };
  }));
  return response;
}

/* The poll: memory only, never new work. */
export async function lookupGauges(keys: string[]): Promise<SubjectStates> {
  const m = memory();
  const states: SubjectStates = {};
  await Promise.all(keys.map(async (key) => {
    const stored = await m.get<Stored>(`gauge:${key}`);
    if (stored) states[key] = stored;
    else if (await m.get(`pending:${key}`)) states[key] = { state: "pending" };
    else states[key] = { state: "none", reason: "The reading did not finish. Search again to retry." };
  }));
  return states;
}
