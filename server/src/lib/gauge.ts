/* The gauge door's work: name the subject behind each result, merge
   duplicates, answer from memory where possible, and compute the rest
   within the request's budget. Anything still running when the budget
   ends is kept alive by the caller and finished into memory; the
   extension polls for it. */

import { settings } from "./env";
import { claimFresh } from "./limits";
import { memory } from "./memory";
import { collectAdaptive } from "./sources/adaptive";
import { resolveByRule, type RawResult } from "./subject";
import { liteGauge } from "./analysis/lite";
import { nameSubjects } from "./analysis/name";
import type { Gauge, GaugeRequest, GaugeResponse, SourceId, Subject, SubjectStates } from "./types";

export const LITE_SOURCES: SourceId[] = ["reddit", "youtube", "hn", "bluesky"];
export const LINK_SOURCES: SourceId[] = ["reddit", "hn", "bluesky"];
const MAX_RESULTS = 12;
const PENDING_TTL = 120;
const NONE_TTL = 6 * 3600;
const SUBJECT_TTL = 7 * 86_400;

export type Stored = { state: "ready"; gauge: Gauge } | { state: "none"; reason: string };

export async function computeGauge(subject: Subject): Promise<Stored> {
  const m = memory();
  let stored: Stored;
  try {
    if (!(await claimFresh())) {
      stored = { state: "none", reason: "Today's budget for new subjects is used up." };
    } else {
      const { items, window } = await collectAdaptive(subject.name, subject.link ? LINK_SOURCES : LITE_SOURCES, { link: subject.link });
      const opinions = items.filter((item) => item.kind !== "video").length;
      if (opinions < settings.minItems()) {
        stored = { state: "none", reason: opinions ? `Only ${opinions} opinions were found.` : "Nothing was found on the connected platforms." };
      } else {
        const gauge = await liteGauge(subject, items, window, 20_000);
        stored = gauge ? { state: "ready", gauge } : { state: "none", reason: "Too little of what was found is about the subject." };
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
  const byIndex = new Map<number, Subject | null>();
  const unknown: Array<RawResult & { i: number }> = [];
  for (const r of results) {
    const out = resolveByRule(r);
    if (out === "ask") unknown.push(r);
    else byIndex.set(r.i, out);
  }
  const naming = await nameSubjects(req.query, unknown, Math.min(8000, budgetMs / 3));
  for (const [i, s] of naming.results) byIndex.set(i, s);

  const subjects = new Map<string, Subject>();
  const add = (s: Subject | null) => {
    if (s && !subjects.has(s.key)) subjects.set(s.key, s);
    return s?.key ?? null;
  };
  const response: GaugeResponse = {
    query: { key: add(naming.query) },
    results: results.map((r) => ({ url: r.url, key: add(byIndex.get(r.i) ?? null) })),
    subjects: {},
  };

  const m = memory();
  const remaining = () => Math.max(0, budgetMs - (Date.now() - started));
  await Promise.all([...subjects.values()].map(async (subject) => {
    const base = { name: subject.name, kind: subject.kind, category: subject.category };
    keepAlive(m.set(`subject:${subject.key}`, subject, SUBJECT_TTL));
    const stored = await m.get<Stored>(`gauge:${subject.key}`);
    if (stored) {
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
