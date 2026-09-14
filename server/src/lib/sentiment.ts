import type { SentimentSplit, Verdict } from "./types";

/* Largest-remainder rounding keeps visible percentages at exactly 100. */
export function sentimentPercentages(split: SentimentSplit): number[] {
  const values = [split.positive, split.neutral, split.negative].map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return [0, 0, 0];
  const exact = values.map((value) => (value / total) * 100);
  const rounded = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - rounded[index] })).sort((a, b) => b.remainder - a.remainder);
  const missing = 100 - rounded.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < missing; index++) rounded[order[index].index]++;
  return rounded;
}

export function normalise(s: SentimentSplit): SentimentSplit {
  const p = Math.max(0, s.positive), n = Math.max(0, s.neutral), g = Math.max(0, s.negative);
  const total = p + n + g || 1;
  return { positive: p / total, neutral: n / total, negative: g / total };
}

/* The verdict is counted, never estimated: the share of opinionated
   entries that were positive, at the Rotten Tomatoes thresholds. */
export function verdictOf(split: SentimentSplit): Verdict {
  const opinionated = split.positive + split.negative;
  if (!opinionated) return "mixed";
  const approval = split.positive / opinionated;
  return approval >= 0.6 ? "positive" : approval <= 0.4 ? "negative" : "mixed";
}
