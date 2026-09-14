import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvidence, reactionWeight, sourceUrl } from "../src/lib/analysis/evidence.ts";
import { sentimentPercentages, verdictOf } from "../src/lib/sentiment.ts";
import { heuristicClassify } from "../src/lib/analysis/heuristic.ts";
import { sample } from "../src/lib/analysis/prompt.ts";

const item = (id, source, text, extra = {}) => ({ id, source, kind: "comment", text, ...extra });

test("reactions weigh in on a log scale, never linearly", () => {
  assert.equal(reactionWeight(undefined), 1);
  assert.equal(reactionWeight(0), 1);
  assert.equal(Math.round(reactionWeight(9) * 100) / 100, 2);
  assert.equal(Math.round(reactionWeight(9999) * 100) / 100, 5);
});

test("the split is counted from classifications and grouped under real threads", () => {
  const items = [
    { id: "hn:story:1", source: "hn", kind: "thread", text: "A thread", title: "A thread", url: "https://news.ycombinator.com/item?id=1" },
    item("hn:comment:2", "hn", "Great stuff", { parentId: "hn:story:1", engagement: 9 }),
    item("hn:comment:3", "hn", "Terrible", { parentId: "hn:story:1" }),
    item("bluesky:post:4", "bluesky", "Not about it", { url: "https://bsky.app/profile/a/post/4" }),
    { id: "youtube:video:5", source: "youtube", kind: "video", text: "context" },
  ];
  const evidence = buildEvidence(items, [
    { ref: 1, sentiment: "positive" }, { ref: 2, sentiment: "negative" }, { ref: 3, sentiment: "irrelevant" }, { ref: 0, sentiment: "neutral" }, { ref: 99, sentiment: "positive" },
  ], [{ sentence: "It is great", sentiment: "positive", refs: [1, 2, 3] }, { sentence: "Lonely", sentiment: "neutral", refs: [0] }]);
  assert.equal(evidence.relevantTotal, 3);
  assert.equal(evidence.relevant.hn, 3);
  assert.equal(evidence.relevant.bluesky, 0);
  assert.equal(evidence.split.positive, 2);
  assert.equal(evidence.split.negative, 1);
  assert.equal(evidence.split.neutral, 1);
  const threads = evidence.threadsFor("hn");
  assert.equal(threads.length, 1);
  assert.equal(threads[0].url, "https://news.ycombinator.com/item?id=1");
  assert.equal(threads[0].comments.length, 3);
  assert.equal(evidence.opinions.length, 1);
  assert.equal(evidence.opinions[0].support, 2);
  assert.deepEqual(evidence.opinions[0].evidenceIds, ["hn:hn:story:1"]);
});

test("only collected links on the right platform are ever shown", () => {
  assert.equal(sourceUrl("https://news.ycombinator.com/item?id=1", "hn"), "https://news.ycombinator.com/item?id=1");
  assert.equal(sourceUrl("https://bsky.app/profile/a/post/b", "bluesky"), "https://bsky.app/profile/a/post/b");
  assert.equal(sourceUrl("https://evil.example/x", "reddit"), undefined);
  assert.equal(sourceUrl("http://www.reddit.com/r/a", "reddit"), undefined);
  assert.equal(sourceUrl("https://www.youtube.com/watch?v=1", "reddit"), undefined);
});

test("percentages sum to exactly 100 and verdicts follow the approval thresholds", () => {
  assert.deepEqual(sentimentPercentages({ positive: 1, neutral: 1, negative: 1 }), [34, 33, 33]);
  assert.deepEqual(sentimentPercentages({ positive: 0, neutral: 0, negative: 0 }), [0, 0, 0]);
  assert.equal(verdictOf({ positive: 6, neutral: 10, negative: 4 }), "positive");
  assert.equal(verdictOf({ positive: 4, neutral: 0, negative: 6 }), "negative");
  assert.equal(verdictOf({ positive: 5, neutral: 0, negative: 5 }), "mixed");
  assert.equal(verdictOf({ positive: 0, neutral: 3, negative: 0 }), "mixed");
});

test("the word-count stand-in leans the obvious way and skips videos", () => {
  const labels = heuristicClassify([
    { id: "v", source: "youtube", kind: "video", text: "great great" },
    item("a", "hn", "I love it, works well"),
    item("b", "hn", "Terrible and overpriced, avoid"),
    item("c", "hn", "Does it come in blue?"),
  ]);
  assert.deepEqual(labels.map((l) => [l.ref, l.sentiment]), [[1, "positive"], [2, "negative"], [3, "neutral"]]);
});

test("the sample gives every platform a turn and caps any one thread", () => {
  const items = [{ id: "youtube:video:v", source: "youtube", kind: "video", text: "context" }];
  for (let i = 0; i < 50; i++) items.push(item(`hn:comment:${i}`, "hn", `hn ${i}`, { parentId: "hn:story:1", engagement: 1000 - i }));
  for (let i = 0; i < 10; i++) items.push(item(`youtube:comment:${i}`, "youtube", `yt ${i}`, { parentId: "youtube:video:v", engagement: 1 }));
  for (let i = 0; i < 10; i++) items.push(item(`bluesky:post:${i}`, "bluesky", `bs ${i}`, { engagement: 0 }));
  const chosen = sample(items, 20);
  const opinions = chosen.filter((entry) => entry.kind !== "video");
  const count = (source) => opinions.filter((entry) => entry.source === source).length;
  assert.equal(opinions.length, 20);
  assert.deepEqual([count("hn"), count("youtube"), count("bluesky")], [7, 7, 6]);
  assert.ok(chosen.some((entry) => entry.id === "youtube:video:v"));
  assert.equal(opinions.find((entry) => entry.source === "hn").id, "hn:comment:0");
  /* One thread may fill at most two fifths of the sample. */
  const thin = items.filter((entry) => entry.source === "hn" || entry.id === "youtube:comment:0" || entry.id === "bluesky:post:0");
  const capped = sample(thin, 20).filter((entry) => entry.kind !== "video");
  assert.equal(capped.filter((entry) => entry.source === "hn").length, 8);
  assert.equal(capped.length, 10);
});
