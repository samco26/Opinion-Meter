import { test } from "node:test";
import assert from "node:assert/strict";
import { liteGauge } from "../src/lib/analysis/lite.ts";
import { analyseCard } from "../src/lib/analysis/analyse.ts";
import { countPage, pageEntries, pointsFrom, verifyQuotes, PAGE_WEIGHT } from "../src/lib/analysis/page.ts";
import { readPageRequest } from "../src/lib/page.ts";
import { verdictOf } from "../src/lib/sentiment.ts";

/* Synthetic entries only; no server, credentials or real opinions. No AI key is set in tests, so the word-count stand-in classifies. */
const withoutAi = async (run) => {
  const saved = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, CHATGPT: process.env.CHATGPT };
  delete process.env.OPENAI_API_KEY; delete process.env.CHATGPT;
  try { return await run(); } finally { for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v; }
};
const subject = { key: "name:synthetic-thing", name: "Synthetic Thing", kind: "product", category: "product" };
const window = { from: "2023-09-21T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z", months: 36 };
const praise = ["love it, works well", "great build and reliable", "excellent value, recommend", "amazing sound, perfect fit", "solid and comfortable", "brilliant, happy with it"];
const gripes = ["terrible battery, disappointed", "broken after a week, awful", "overpriced and slow", "uncomfortable and buggy"];
const items = [...praise, ...gripes].map((text, i) => ({ id: `hn:comment:${i}`, source: i % 2 ? "hn" : "bluesky", kind: "comment", text, engagement: 0 }));
const statuses = [{ source: "hn", availability: "ok", itemsAnalysed: 5 }, { source: "bluesky", availability: "ok", itemsAnalysed: 5 }];

test("the bar's reading comes back with its sample and views, and a card built from it keeps the bar's numbers to the digit", () => withoutAi(async () => {
  const reading = await liteGauge(subject, items, window, 1000);
  assert.ok(reading, "enough opinions for a gauge");
  assert.equal(reading.entries.length, 10);
  assert.equal(reading.classifications.length, 10);
  assert.deepEqual(reading.views.map(([ref]) => ref).sort((a, b) => a - b), [...Array(10).keys()]);
  assert.equal(reading.gauge.verdict, "positive");
  /* The card takes the verdicts it is given, never its own: hand it the opposite reading and it counts the opposite. */
  const flipped = reading.classifications.map((c) => ({ ref: c.ref, sentiment: c.sentiment === "positive" ? "negative" : c.sentiment === "negative" ? "positive" : c.sentiment }));
  const card = await analyseCard(subject, reading.entries, statuses, window, 1000, { classifications: flipped, views: flipped.map((c) => [c.ref, c.sentiment]), dropped: 0 });
  assert.equal(card.kind, "card");
  assert.equal(card.card.verdict, "negative");
  assert.equal(card.card.sources.reduce((n, s) => n + (s.relevant ?? 0), 0), reading.gauge.count);
  /* And with the bar's own verdicts the card's split is the bar's exactly. */
  const same = await analyseCard(subject, reading.entries, statuses, window, 1000, { classifications: reading.classifications, views: reading.views, dropped: 0 });
  assert.deepEqual(same.card.sentiment, reading.gauge.split);
  assert.equal(same.card.verdict, reading.gauge.verdict);
}));

test("only quotes actually on the page survive, once each, and a page review weighs three platform posts", () => {
  const page = "Customer reviews\n“Absolutely love it — the battery lasts for days.”\nBy Sam. Another one: The hinge feels flimsy and creaks. Product description: the best headphones ever made.";
  const kept = verifyQuotes([
    "Absolutely love it — the battery lasts for days.",
    "absolutely love it — the battery lasts for days.",
    "The hinge feels flimsy and creaks.",
    "The hinge feels sturdy and silent.",
    "Nope",
  ], page);
  assert.deepEqual(kept, ["Absolutely love it — the battery lasts for days.", "The hinge feels flimsy and creaks."]);
  const req = { url: "https://shop.example/item/1", title: "Item", text: page };
  const entries = pageEntries(kept, req, [{ id: "hn:comment:1", source: "hn", kind: "comment", text: "Great battery indeed", engagement: 0, url: "https://news.ycombinator.com/item?id=1" }]);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].source, "page");
  const counted = countPage(entries, [{ ref: 0, sentiment: "positive" }, { ref: 1, sentiment: "negative" }, { ref: 2, sentiment: "positive" }, { ref: 7, sentiment: "positive" }]);
  assert.equal(counted.relevantTotal, 3);
  assert.equal(counted.relevant.get("page"), 2);
  assert.equal(counted.relevant.get("hn"), 1);
  assert.equal(counted.split.positive, PAGE_WEIGHT + 1);
  assert.equal(counted.split.negative, PAGE_WEIGHT);
  /* Two for, one against by heads; but the page review against outweighs the platform post for, so the verdict is not positive. */
  assert.equal(verdictOf(counted.split), "mixed");
  const points = pointsFrom([{ sentence: "The battery lasts", refs: [0, 2, 2] }, { sentence: "Lonely", refs: [1] }, { sentence: "Made up", refs: [9] }], entries, counted.labels, "pro");
  assert.equal(points.length, 1);
  assert.equal(points[0].support, 2);
  assert.equal(points[0].quotes[0].source, "page");
  assert.equal(points[0].quotes[0].url, req.url);
  assert.equal(points[0].quotes[1].url, "https://news.ycombinator.com/item?id=1");
});

test("the page door takes only a sane request and caps what it reads", () => {
  assert.equal(readPageRequest(null), null);
  assert.equal(readPageRequest({ url: "javascript:x", title: "t", text: "x" }), null);
  assert.equal(readPageRequest({ url: "https://a.example/", title: "t", text: "x".repeat(90_000) }), null);
  const ok = readPageRequest({ url: "https://a.example/p", title: " A  page ", text: "y".repeat(70_000), site: " Site ", description: "d", data: "{}", cookie: "never" });
  assert.equal(ok.title, "A page");
  assert.equal(ok.text.length, 60_000);
  assert.equal(ok.site, "Site");
  assert.equal("cookie" in ok, false);
});
