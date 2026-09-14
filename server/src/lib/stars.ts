/* The star rating on a category card, worked out from the split. Star
   sites are inflated (products cluster at 4.1 to 4.5) and scraped
   discussion runs the other way, so the stars are pinned to the Rotten
   Tomatoes thresholds: the share of opinionated entries that were positive,
   60% for 3.5 stars and 75% for 4. Small samples are pulled toward 3, and
   the approval share is always printed beside the stars. */

import type { SentimentSplit } from "./types";

const ANCHORS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0.15, 1], [0.30, 2], [0.50, 3], [0.60, 3.5], [0.75, 4], [0.90, 4.5], [1, 5]];
const PRIOR_WEIGHT = 10;

export interface StarRating { stars: number; approval: number }

export function rawStars(approval: number): number {
  const a = Math.min(1, Math.max(0, approval));
  for (let i = 1; i < ANCHORS.length; i++) {
    const [x0, y0] = ANCHORS[i - 1], [x1, y1] = ANCHORS[i];
    if (a <= x1) return y0 + (y1 - y0) * ((a - x0) / (x1 - x0));
  }
  return 5;
}

export function starRating(split: SentimentSplit, opinions: number): StarRating {
  const positive = Math.max(0, split.positive), neutral = Math.max(0, split.neutral), negative = Math.max(0, split.negative);
  const total = positive + neutral + negative;
  const opinionated = positive + negative;
  if (!total || !opinionated) return { stars: 3, approval: 0 };
  const approval = positive / opinionated;
  const conviction = Math.min(1, (1 - neutral / total) / 0.5);
  const prior = opinions / (opinions + PRIOR_WEIGHT);
  return { stars: Math.round((3 + (rawStars(approval) - 3) * conviction * prior) * 10) / 10, approval };
}
