/* The full card: the bounded sample goes to the model once and a
   structured answer comes back in the shape the overlay draws. The model
   may only cite entries it was given, by number; real titles and links are
   filled in here, so no link is ever invented. The numbers are counted
   from its per-entry classification, never estimated. */

import { z } from "zod";
import { cardModel, structured } from "../ai";
import { configured, settings } from "../env";
import { normalise, verdictOf } from "../sentiment";
import type { Card, SearchWindow, SourceId, SourceItem, SourceStatus, Subject } from "../types";
import { buildEvidence, type Classification } from "./evidence";
import { heuristicClassify, heuristicSentence } from "./heuristic";
import { CLASSIFY_RULES, formatItems, sample } from "./prompt";
import { targetInstructions } from "../target";

const CARD_MAX = 250;
const Refs = z.array(z.number().int());
const Theme = z.object({ title: z.string(), detail: z.string() });
const Analysis = z.object({
  summary: z.string(),
  recent: z.string(),
  agreement: z.enum(["strong", "moderate", "weak"]),
  confidence: z.object({ level: z.enum(["low", "medium", "high"]), reason: z.string() }),
  positives: z.array(Theme),
  negatives: z.array(Theme),
  classified: z.object({ positive: Refs, neutral: Refs, negative: Refs, irrelevant: Refs }),
  opinions: z.array(z.object({ sentence: z.string(), sentiment: z.enum(["positive", "neutral", "negative"]), refs: Refs })),
  bySource: z.array(z.object({ source: z.enum(["reddit", "youtube", "x", "hn", "bluesky"]), drawnFrom: Refs })),
});

const INSTRUCTIONS = `You read a sample of public discussion about a subject and describe where opinion sits. You write for a general reader in plain English. Never use first person plural ("we").

Rules:
- Describe the sample you were given, not everyone. A positive result is not the same as strong agreement; report agreement separately.
- The summary is one to three sentences, written the way a person who had read all of it would tell a friend what people think. The subject is the grammatical subject and the views are stated directly, as if they were your own: "Melbourne is beautiful, has a real urban buzz and plenty to eat and see, though it is expensive." Never write about the opinions from the outside: not "Opinion leans positive", not "People praise". Do not use the words opinion, sentiment, discussion, sample, commenters, evidence, posts or comments in the summary, and do not describe your analysis or its limits there.
- The summary is about the subject's general standing: what people value and what they complain about, as it holds over time. It never hinges on the news of the moment. Never mention an incident, outage, launch, update, controversy or date the reader has no context for; if much of the sample is reacting to one recent event, the summary states the lasting view and the event goes in recent.
- recent is one sentence of at most 160 characters, given only when the newest entries show a notable recent development that is changing how people feel — an outage, a redesign, a controversy, a price change, a new release — named plainly, with roughly when it happened taken from the entry dates ("A day-long outage in September 2026 left many questioning its reliability."). Otherwise recent is an empty string. Never invent an event or a date.
- Qualitative, no percentages, no lists. Where views are split, give both sides in the same voice. If almost nothing is about the subject, the summary is one plain sentence saying so.
- Sampling limits, off-topic material, dated material and thin evidence belong in confidence only. Use the entry dates to distinguish older and newer reactions; do not combine different product generations or describe historical views as current.
- Never introduce facts from memory. Claims in entries are what commenters believe, never established facts. Never treat a promotional description as a positive opinion.
- Positives and negatives are the themes people actually raise, up to three each, each with a title of a few words and a detail sentence. If the sample supports fewer, give fewer. Never invent a theme to fill a slot.
- Confidence is about the evidence: how much there is, who it comes from, how consistent it is. Say why in one sentence.
- For each platform that has opinions, list in bySource its drawnFrom: the numeric references of four to eight representative opinions from that platform, most representative first, only references from that platform.
- ${CLASSIFY_RULES}
- Extract up to 20 distinct recurring opinions across the relevant entries, ideally 5 to 20 only when supported. Each is one concise sentence (preferably under 100 characters) about the subject in general, its positive/neutral/negative sentiment, and the refs that actually support it. Require at least two independent relevant entries per sentence. Combine paraphrases, do not force equal positive and negative counts, and return fewer or none when evidence is thin. Sort by recurrence. Never invent references or quotations.`;

export type Analysed = { kind: "card"; card: Card } | { kind: "insufficient"; relevant: number; sources: SourceStatus[] };

export async function analyseCard(subject: Subject, items: SourceItem[], statuses: SourceStatus[], window: SearchWindow, timeoutMs: number): Promise<Analysed> {
  const entries = sample(items, CARD_MAX);
  const live = configured.openai();
  const out = live
    ? await structured(Analysis, "card_analysis", `${INSTRUCTIONS}\n${targetInstructions(subject)}`,
      `Subject: ${JSON.stringify(subject.name)} (${subject.kind})\nOpinion window: ${window.from.slice(0, 10)} to ${window.to.slice(0, 10)} (${window.months} months)\nToday: ${new Date().toISOString().slice(0, 10)}\nPlatforms with opinions: ${[...new Set(entries.filter((e) => e.kind !== "video").map((e) => e.source))].join(", ")}\n\n${entries.length} entries (JSON lines):\n${formatItems(entries)}`,
      { model: cardModel(), maxTokens: 16000, timeoutMs })
    : null;
  const classifications: Classification[] = out
    ? (["positive", "neutral", "negative", "irrelevant"] as const).flatMap((sentiment) => out.classified[sentiment].map((ref) => ({ ref, sentiment })))
    : heuristicClassify(entries);
  const readings: Array<{ source: SourceId; drawnFrom: number[] }> = out?.bySource ?? [];
  const evidence = buildEvidence(entries, classifications, out?.opinions ?? [], readings.flatMap((r) => r.drawnFrom.filter((ref) => entries[ref]?.source === r.source)));
  const sources = statuses.map((status) => ({ ...status, itemsAnalysed: entries.filter((e) => e.source === status.source && e.kind !== "video").length, relevant: evidence.relevant[status.source] }));
  if (evidence.relevantTotal < settings.minItems()) return { kind: "insufficient", relevant: evidence.relevantTotal, sources };
  const split = normalise(evidence.split);
  const present = new Set(entries.filter((e) => e.kind !== "video").map((e) => e.source));
  const bySource = (out ? readings.map((r) => r.source) : [...present]).filter((source, index, all) => present.has(source) && all.indexOf(source) === index);
  const recent = out?.recent.trim();
  return {
    kind: "card",
    card: {
      key: subject.key, subject: subject.name, kind: subject.kind, category: subject.category, window,
      summary: out?.summary.trim() ?? heuristicSentence(subject.name, split, evidence.relevantTotal),
      ...(recent ? { recent } : {}),
      opinions: evidence.opinions, sentiment: split, verdict: verdictOf(split),
      agreement: out?.agreement ?? "weak",
      confidence: out?.confidence ?? { level: "low", reason: "No AI key is set, so this is a word-count estimate." },
      positives: out?.positives.slice(0, 3) ?? [], negatives: out?.negatives.slice(0, 3) ?? [],
      sources,
      bySource: bySource.map((source) => ({ source, sentiment: normalise(evidence.splits[source]), threads: evidence.threadsFor(source) })),
      ...(live ? {} : { simulated: true }),
      updatedAt: new Date().toISOString(),
      scope: subject.scope, domain: subject.domain, targetUrl: subject.link,
    },
  };
}
