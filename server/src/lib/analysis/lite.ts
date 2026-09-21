/* The lite tier: the quick reading behind the bar. The model classifies
   a bounded sample and writes one sentence; the numbers are counted from
   the classification. Without an AI key a word count stands in, marked
   simulated. The sample and its classification come back with the gauge
   so the card can be built from the very same entries and verdicts: one
   reading, whichever way it is looked at. */

import { z } from "zod";
import { liteModel, structured } from "../ai";
import { configured, settings } from "../env";
import { normalise, verdictOf } from "../sentiment";
import { SOURCE_IDS, type Gauge, type SearchWindow, type SourceItem, type Subject } from "../types";
import { buildEvidence, type Classification } from "./evidence";
import { heuristicClassify, heuristicSentence } from "./heuristic";
import { BUCKETS, CLASSIFY_RULES, counted, formatItems, prefilter, sample, type Bucket } from "./prompt";
import { targetInstructions } from "../target";

/* The same sample size as the card, so the bar and the drawer agree. */
const LITE_MAX = 250;
const Refs = z.array(z.number().int());
const Lite = z.object({
  classified: z.object({ positive: Refs, neutral: Refs, negative: Refs, event: Refs, irrelevant: Refs }),
  sentence: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const INSTRUCTIONS = `You read a sample of public discussion about a subject and say where opinion sits, for a general reader, in plain English.
- ${CLASSIFY_RULES}
- The sentence is one sentence of at most 160 characters, written the way a person who had read all of it would tell a friend what people think, with the subject as the grammatical subject and the views stated directly: "The XM6 sounds superb and cancels noise better than anything, but the price and the folding hinge draw complaints." No percentages, no "people say", no "opinion", no "sample".
- The sentence is about how people regard the subject over the whole window, up to three years — what they value and what they complain about — never the news of the moment. It is drawn from the positive, neutral and negative entries only; event entries never shape it. Never mention an incident, outage, launch, update or date the reader has no context for.
- If almost nothing is about the subject, the sentence says so plainly.
- Confidence is about the evidence: how much there is, how consistent it is, how much is on topic.`;

/* The gauge and what it was counted from: the sampled entries (videos as
   context), each entry's counted verdict, and the model's own five-way
   view of it (event kept apart from irrelevant, for the card's "lately"). */
export interface LiteReading { gauge: Gauge; entries: SourceItem[]; classifications: Classification[]; views: Array<[number, Bucket]>; dropped: number }

export async function liteGauge(subject: Subject, items: SourceItem[], window: SearchWindow, timeoutMs: number): Promise<LiteReading | null> {
  const { kept, dropped } = prefilter(items);
  const entries = sample(kept, LITE_MAX);
  const live = configured.openai();
  let classifications: Classification[];
  let views: Array<[number, Bucket]>;
  let sentence: string;
  let confidence: Gauge["confidence"];
  if (live) {
    const out = await structured(Lite, "lite_reading", `${INSTRUCTIONS}\n${targetInstructions(subject)}`,
      `Subject: ${JSON.stringify(subject.name)} (${subject.kind})\nOpinion window: ${window.from.slice(0, 10)} to ${window.to.slice(0, 10)}\n\n${entries.length} entries (JSON lines):\n${formatItems(entries)}`,
      { model: liteModel(), maxTokens: 2500, timeoutMs });
    classifications = BUCKETS.flatMap((bucket) => out.classified[bucket].map((ref) => ({ ref, sentiment: counted(bucket) })));
    views = BUCKETS.flatMap((bucket) => out.classified[bucket].map((ref): [number, Bucket] => [ref, bucket]));
    sentence = out.sentence.trim();
    confidence = out.confidence;
  } else {
    classifications = heuristicClassify(entries);
    views = classifications.map((c): [number, Bucket] => [c.ref, c.sentiment]);
    confidence = "low";
    sentence = "";
  }
  const evidence = buildEvidence(entries, classifications);
  if (evidence.relevantTotal < settings.minItems()) return null;
  const split = normalise(evidence.split);
  const gauge: Gauge = {
    key: subject.key, name: subject.name, kind: subject.kind, category: subject.category,
    split, count: evidence.relevantTotal, verdict: verdictOf(split),
    sentence: live ? sentence : heuristicSentence(subject.name, split, evidence.relevantTotal),
    confidence,
    sources: SOURCE_IDS.filter((id) => evidence.relevant[id] > 0).map((id) => ({ source: id, count: evidence.relevant[id] })),
    window,
    ...(live ? {} : { simulated: true }),
    updatedAt: new Date().toISOString(),
    scope: subject.scope, domain: subject.domain, targetUrl: subject.link,
  };
  return { gauge, entries, classifications, views, dropped };
}
