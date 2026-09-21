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
import type { Classification } from "./analysis/evidence";
import type { Bucket } from "./analysis/prompt";
import { youtubeVideoId } from "./sources/youtube";
import type { Card, Gauge, GaugeRequest, GaugeResponse, SearchWindow, SourceId, SourceItem, SourceStatus, Subject, SubjectStates } from "./types";

/* Every connected platform reads every subject by name, X included (the
   owner's decision of 21 September 2026: the bar and the card read the
   same platforms, so X is paid for once per subject, for both). Reddit is
   off until an application succeeds. A page is also looked up by link on
   the platforms that can, and a linked video's own comments are read. */
export const LITE_SOURCES: SourceId[] = ["youtube", "hn", "bluesky", "x"];
export const LINK_SOURCES: SourceId[] = ["hn", "bluesky", "x"];
/* A YouTube video is read from its own comments (the owner's rule for the
   Videos tab) and the posts that share it; any other link is looked up on
   the platforms that search by link. */
export const sourcesFor = (subject: Subject): SourceId[] => subject.link ? (youtubeVideoId(subject.link) ? ["youtube", "x"] : LINK_SOURCES) : LITE_SOURCES;
const MAX_RESULTS = 20;
const PENDING_TTL = 120;
const NONE_TTL = 6 * 3600;
/* Bumped whenever the classifier changes, so old readings are not served. */
export const READING = 3;
const SUBJECT_TTL = 86_400;
/* The bar's sample — entries and their verdicts — is held as long as a
   finished card is (a quarter of an hour, never on disk), so a card asked
   for in that time is built from the very same reading. */
export const SAMPLE_TTL = 15 * 60;

export type Stored = { state: "ready"; gauge: Gauge } | { state: "none"; reason: string; thin?: boolean };

/* What the bar was counted from: the target actually read (the subject, or
   its website when the page itself had too little), the sampled entries,
   each one's counted verdict and five-way view, the platform statuses and
   the window. */
export interface HeldSample { target: Subject; entries: SourceItem[]; classifications: Classification[]; views: Array<[number, Bucket]>; dropped: number; statuses: SourceStatus[]; window: SearchWindow }
export const heldSample = (key: string) => memory().get<HeldSample>(`sample:${READING}:${key}`);
export const isPending = async (key: string) => Boolean(await memory().get(`pending:${key}`));

export async function computeGauge(subject: Subject): Promise<Stored> {
  const m = memory();
  const before = await m.get<Stored>(`gauge:${READING}:${subject.key}`);
  let stored: Stored;
  let sample: HeldSample | undefined;
  try {
    if (subject.scope && !configured.openai()) {
      stored = { state: "none", reason: "Website/link opinions need AI analysis. The server's AI key is not connected yet." };
    } else if (!(await claimFresh())) {
      stored = { state: "none", reason: "Today's budget for new subjects is used up." };
    } else {
      stored = { state: "none", reason: "Not enough opinions were found to say what people think.", thin: true };
      const fallback = domainSubject(subject);
      for (const target of [subject, ...(fallback ? [fallback] : [])]) {
        // Different pages on the same domain reuse the domain reading.
        const cached = target.scope === "domain" ? await m.get<Stored>(`gauge:${READING}:${target.key}`) : null;
        if (cached?.state === "ready") {
          sample = (await heldSample(target.key)) ?? undefined;
          stored = { state: "ready", gauge: { ...cached.gauge, key: subject.key, targetUrl: subject.link } }; break;
        }
        /* The bar reads the whole three years, the same platforms and the
           same sample size as the card; the card is then built from this
           very sample while it is held, so the two cannot disagree. */
        const { items, statuses, window } = await collectAdaptive(target.name, sourcesFor(target), { link: target.link, domain: target.scope === "domain" ? target.domain : undefined, aliases: target.aliases, depth: "full", budgetMs: 12_000 });
        if (items.filter(item => item.kind !== "video").length < settings.minItems()) continue;
        const reading = await liteGauge(target, items, window, 12_000);
        if (!reading) continue;
        sample = { target, entries: reading.entries, classifications: reading.classifications, views: reading.views, dropped: reading.dropped, statuses, window };
        if (target.scope === "domain") {
          await m.set(`gauge:${READING}:${target.key}`, { state: "ready", gauge: reading.gauge }, settings.cacheTtlSeconds());
          await m.set(`sample:${READING}:${target.key}`, sample, SAMPLE_TTL);
        }
        stored = { state: "ready", gauge: { ...reading.gauge, key: subject.key, targetUrl: subject.link } }; break;
      }
    }
  } catch (err) {
    stored = { state: "none", reason: err instanceof Error ? err.message : "The analysis failed." };
  }
  /* A full card made meanwhile (a click that could not wait for this) has
     already written this subject's gauge from its own reading; that one
     stands, so the two never race. */
  const meanwhile = await m.get<Stored>(`gauge:${READING}:${subject.key}`);
  const overtaken = meanwhile?.state === "ready" && !(before?.state === "ready" && before.gauge.updatedAt === meanwhile.gauge.updatedAt);
  if (overtaken && meanwhile) stored = meanwhile;
  else {
    if (sample) await m.set(`sample:${READING}:${subject.key}`, sample, SAMPLE_TTL);
    await m.set(`gauge:${READING}:${subject.key}`, stored, stored.state === "ready" ? settings.cacheTtlSeconds() : NONE_TTL);
  }
  await m.del(`pending:${subject.key}`);
  return stored;
}

/* How long the first answer waits for a fresh reading before leaving it to the poll. */
const QUICK_MS = 2500;

export async function gaugeFor(req: GaugeRequest, budgetMs: number, keepAlive: (work: Promise<unknown>) => void): Promise<GaugeResponse> {
  const started = Date.now();
  const results = req.results.slice(0, MAX_RESULTS).map((r, i) => ({ ...r, i }));
  /* Names the memory has now; the model's naming of anything new runs on in the background and the hands ask again shortly. */
  const naming = await resultSubjects(req.query, results, Math.min(8000, budgetMs / 3), keepAlive);

  const subjects = new Map<string, Subject>();
  const add = (s: Subject | null) => {
    if (s && !subjects.has(s.key)) subjects.set(s.key, s);
    return s?.key ?? null;
  };
  const response: GaugeResponse = {
    query: { key: add(naming.query), ...(naming.queryLater ? { later: true } : {}) },
    results: results.map((r) => (naming.later.has(r.i) ? { url: r.url, key: null, later: true } : { url: r.url, key: add(naming.results.get(r.i) ?? null) })),
    subjects: {},
  };

  const m = memory();
  const remaining = () => Math.max(0, budgetMs - (Date.now() - started));
  await Promise.all([...subjects.values()].map(async (subject) => {
    const base = { name: subject.name, kind: subject.kind, category: subject.category };
    await m.set(`subject:${subject.key}`, subject, SUBJECT_TTL);
    const stored = await m.get<Stored>(`gauge:${READING}:${subject.key}`);
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
    /* A short wait for a quick reading; a slow one is reported pending and polled for, so the cached and the quick are never held up by the slow. */
    const outcome = await Promise.race([work, new Promise<null>((resolve) => setTimeout(resolve, Math.min(remaining(), QUICK_MS)))]);
    response.subjects[subject.key] = outcome ? { ...base, ...outcome } : { ...base, state: "pending" };
  }));
  return response;
}

/* A card made when no bar's sample was there to build it from (the sample
   aged out, or the card came first) becomes the subject's reading: the bar
   takes its numbers from then on. A bar already drawn on a page keeps what
   it shows; the next search shows these. */
/* The summary's first sentence, whole. It was cut at 160 characters with an
   ellipsis, and the card printed the cut ("…becomes less trust…"); the card
   wraps, so nothing is gained by cutting. */
export const firstSentence = (text: string) => (text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text).trim();
export async function rememberGaugeFromCard(subject: Subject, card: Card): Promise<Gauge> {
  const count = card.sources.reduce((total, status) => total + (status.relevant ?? 0), 0);
  const gauge: Gauge = {
    key: subject.key, name: card.subject, kind: card.kind, category: card.category,
    split: card.sentiment, count, verdict: card.verdict, sentence: firstSentence(card.summary), confidence: card.confidence.level,
    sources: card.sources.filter((status) => (status.relevant ?? 0) > 0).map((status) => ({ source: status.source, count: status.relevant ?? 0 })),
    window: card.window, updatedAt: card.updatedAt, scope: subject.scope, domain: subject.domain, targetUrl: subject.link,
  };
  await memory().set(`gauge:${READING}:${subject.key}`, { state: "ready", gauge } satisfies Stored, settings.cacheTtlSeconds());
  return gauge;
}

/* The poll: memory only, never new work. */
export async function lookupGauges(keys: string[]): Promise<SubjectStates> {
  const m = memory();
  const states: SubjectStates = {};
  await Promise.all(keys.map(async (key) => {
    const stored = await m.get<Stored>(`gauge:${READING}:${key}`);
    if (stored) states[key] = stored;
    else if (await m.get(`pending:${key}`)) states[key] = { state: "pending" };
    else states[key] = { state: "none", reason: "The reading did not finish. Search again to retry." };
  }));
  return states;
}
