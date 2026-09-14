/* The stand-in classifier for a server with no AI key: a word count,
   good enough to see the whole flow work, and always marked simulated so
   nobody mistakes it for a reading. */

import type { SentimentSplit, SourceItem } from "../types";
import { verdictOf } from "../sentiment";
import type { Classification } from "./evidence";

const POSITIVE = /\b(love|loved|great|amazing|excellent|best|fantastic|awesome|perfect|recommend|worth|brilliant|superb|solid|impressed|happy|enjoy|enjoyed|favou?rite|good|incredible|wonderful|beautiful|comfortable|reliable|works well)\b/gi;
const NEGATIVE = /\b(hate|hated|terrible|awful|worst|bad|poor|disappointing|disappointed|broken|overpriced|expensive|waste|useless|garbage|trash|annoying|buggy|slow|ugly|uncomfortable|regret|refund|avoid|scam|mediocre|boring|don't buy|do not buy)\b/gi;

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

export function heuristicClassify(items: SourceItem[]): Classification[] {
  return items.flatMap((item, ref): Classification[] => {
    if (item.kind === "video") return [];
    const good = count(item.text, POSITIVE), bad = count(item.text, NEGATIVE);
    return [{ ref, sentiment: good > bad ? "positive" : bad > good ? "negative" : "neutral" }];
  });
}

export function heuristicSentence(name: string, split: SentimentSplit, opinions: number): string {
  const lean = { positive: "mostly positive", negative: "mostly negative", mixed: "split" }[verdictOf(split)];
  return `Talk about ${name} is ${lean} across ${opinions} posts and comments. Estimated from word counts: no AI key is set.`;
}
