/* The lite tier: the quick reading behind the bar. The model classifies
   a bounded sample and writes one sentence; the numbers are counted from
   the classification. Without an AI key a word count stands in, marked
   simulated. */

import { z } from "zod";
import { liteModel, structured } from "../ai";
import { configured, settings } from "../env";
import { normalise, verdictOf } from "../sentiment";
import { SOURCE_IDS, type Gauge, type SearchWindow, type SourceItem, type Subject } from "../types";
import { buildEvidence, type Classification } from "./evidence";
import { heuristicClassify, heuristicSentence } from "./heuristic";
import { CLASSIFY_RULES, formatItems, sample } from "./prompt";

const LITE_MAX = 60;
const Refs = z.array(z.number().int());
const Lite = z.object({
  classified: z.object({ positive: Refs, neutral: Refs, negative: Refs, irrelevant: Refs }),
  sentence: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const INSTRUCTIONS = `You read a sample of public discussion about a subject and say where opinion sits, for a general reader, in plain English.
- ${CLASSIFY_RULES}
- The sentence is one sentence of at most 160 characters, written the way a person who had read all of it would tell a friend what people think, with the subject as the grammatical subject and the views stated directly: "The XM6 sounds superb and cancels noise better than anything, but the price and the folding hinge draw complaints." No percentages, no "people say", no "opinion", no "sample".
- If almost nothing is about the subject, the sentence says so plainly.
- Confidence is about the evidence: how much there is, how consistent it is, how much is on topic.`;

export async function liteGauge(subject: Subject, items: SourceItem[], window: SearchWindow, timeoutMs: number): Promise<Gauge | null> {
  const entries = sample(items, LITE_MAX);
  const live = configured.openai();
  let classifications: Classification[];
  let sentence: string;
  let confidence: Gauge["confidence"];
  if (live) {
    const out = await structured(Lite, "lite_reading", INSTRUCTIONS,
      `Subject: ${JSON.stringify(subject.name)} (${subject.kind})\nOpinion window: ${window.from.slice(0, 10)} to ${window.to.slice(0, 10)}\n\n${entries.length} entries (JSON lines):\n${formatItems(entries)}`,
      { model: liteModel(), maxTokens: 2500, timeoutMs });
    classifications = (["positive", "neutral", "negative", "irrelevant"] as const).flatMap((sentiment) => out.classified[sentiment].map((ref) => ({ ref, sentiment })));
    sentence = out.sentence.trim();
    confidence = out.confidence;
  } else {
    classifications = heuristicClassify(entries);
    confidence = "low";
    sentence = "";
  }
  const evidence = buildEvidence(entries, classifications);
  if (evidence.relevantTotal < settings.minItems()) return null;
  const split = normalise(evidence.split);
  return {
    key: subject.key, name: subject.name, kind: subject.kind, category: subject.category,
    split, count: evidence.relevantTotal, verdict: verdictOf(split),
    sentence: live ? sentence : heuristicSentence(subject.name, split, evidence.relevantTotal),
    confidence,
    sources: SOURCE_IDS.filter((id) => evidence.relevant[id] > 0).map((id) => ({ source: id, count: evidence.relevant[id] })),
    window,
    ...(live ? {} : { simulated: true }),
    updatedAt: new Date().toISOString(),
  };
}
