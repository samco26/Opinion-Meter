/* Turns per-entry classifications into counted numbers and grouped
   evidence. Text is copied verbatim from what was collected, never
   written by the model, and only collected links on the right platform
   are ever shown. */

import { SOURCES, SOURCE_IDS, type OpinionSentiment, type RecurringOpinion, type SentimentSplit, type SourceId, type SourceItem, type SourceThread } from "../types";

export interface Classification { ref: number; sentiment: OpinionSentiment | "irrelevant" }
export interface OpinionDraft { sentence: string; sentiment: OpinionSentiment; refs: number[] }

/* A comment a thousand people liked stands for more of the audience than
   one nobody noticed. The weight grows with the logarithm of the
   reactions: none counts 1, ten count 2, a hundred 3, ten thousand 5. */
export function reactionWeight(engagement: number | undefined): number {
  const reactions = typeof engagement === "number" && Number.isFinite(engagement) ? Math.max(0, engagement) : 0;
  return 1 + Math.log10(1 + reactions);
}

export function sourceUrl(value: string | undefined, source: SourceId): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const domains = SOURCES.find((s) => s.id === source)?.domains ?? [];
    const allowed = url.protocol === "https:" && !url.username && !url.password && domains.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return allowed ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const emptySplits = () => Object.fromEntries(SOURCE_IDS.map((id) => [id, { positive: 0, neutral: 0, negative: 0 }])) as Record<SourceId, SentimentSplit>;

export function buildEvidence(items: SourceItem[], classifications: Classification[], drafts: OpinionDraft[] = [], preferred: number[] = []) {
  const byId = new Map(items.map((item) => [`${item.source}:${item.id}`, item]));
  const labels = new Map<number, Classification["sentiment"]>();
  for (const entry of classifications) {
    if (Number.isInteger(entry.ref) && items[entry.ref] && items[entry.ref].kind !== "video" && !labels.has(entry.ref)) labels.set(entry.ref, entry.sentiment);
  }
  const groups = new Map<string, SourceThread & { source: SourceId; rank: number }>();
  const groupForRef = new Map<number, string>();
  /* splits carry reaction-weighted totals; relevant is the plain number of
     entries classified as being about the subject. */
  const splits = emptySplits();
  const relevant = Object.fromEntries(SOURCE_IDS.map((id) => [id, 0])) as Record<SourceId, number>;
  items.forEach((item, ref) => {
    if (item.kind === "video" || labels.get(ref) === "irrelevant") return;
    const parent = item.parentId ? byId.get(`${item.source}:${item.parentId}`) : undefined;
    const root = parent ?? item;
    const key = `${root.source}:${root.id}`;
    const sentiment = labels.get(ref);
    if (sentiment && sentiment !== "irrelevant") {
      splits[item.source][sentiment] += reactionWeight(item.engagement);
      relevant[item.source]++;
    }
    const priority = preferred.indexOf(ref);
    let group = groups.get(key);
    if (!group) {
      group = { id: key, source: item.source, title: root.title || root.text, kind: root.kind, author: root.author, url: sourceUrl(root.url, root.source), comments: [], rank: priority < 0 ? Number.MAX_SAFE_INTEGER : priority };
      groups.set(key, group);
    }
    if (priority >= 0) group.rank = Math.min(group.rank, priority);
    if (!group.comments!.some((comment) => comment.id === item.id)) {
      group.comments!.push({ id: item.id, text: item.text, author: item.author, ...(sentiment && sentiment !== "irrelevant" ? { sentiment } : {}) });
    }
    groupForRef.set(ref, key);
  });
  const opinions = drafts.map((draft, index): RecurringOpinion => {
    const valid = [...new Set(draft.refs)].filter((ref) => Number.isInteger(ref) && groupForRef.has(ref) && labels.has(ref) && labels.get(ref) !== "irrelevant");
    const distinct = new Set(valid.map((ref) => items[ref].text.trim().toLowerCase().replace(/\s+/g, " ")));
    return { id: `opinion-${index}`, sentence: draft.sentence.trim(), sentiment: draft.sentiment, evidenceIds: [...new Set(valid.map((ref) => groupForRef.get(ref)!))], support: distinct.size };
  })
    .filter((opinion) => opinion.support >= 2 && opinion.sentence.length > 0)
    .sort((a, b) => b.support - a.support)
    .filter((opinion, index, all) => all.findIndex((other) => other.sentence.toLowerCase() === opinion.sentence.toLowerCase()) === index)
    .slice(0, 20);
  /* The overall split is the platforms' totals added together, so the
     bar and the platform bars can never disagree. */
  const split: SentimentSplit = { positive: 0, neutral: 0, negative: 0 };
  for (const source of SOURCE_IDS) for (const key of ["positive", "neutral", "negative"] as const) split[key] += splits[source][key];
  return {
    opinions, splits, split, relevant,
    relevantTotal: SOURCE_IDS.reduce((total, id) => total + relevant[id], 0),
    threadsFor: (source: SourceId): SourceThread[] => [...groups.values()]
      .filter((group) => group.source === source)
      .sort((a, b) => a.rank - b.rank || b.comments!.length - a.comments!.length)
      .map(({ source: _source, rank: _rank, ...thread }) => thread),
  };
}
