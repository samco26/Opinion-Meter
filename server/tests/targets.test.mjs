import { test } from "node:test";
import assert from "node:assert/strict";
import { linkSubject, domainSubject, targetInstructions } from "../src/lib/target.ts";
import { recoverSubject, readContext } from "../src/lib/card-context.ts";
import { cardFor } from "../src/lib/card.ts";
import { computeGauge } from "../src/lib/gauge.ts";
import { memory } from "../src/lib/memory.ts";
import { configured, env } from "../src/lib/env.ts";
import { youtubeVideoId } from "../src/lib/sources/youtube.ts";

test("the same product on two sites gets two independent link readings", () => {
  const a = linkSubject({ url: "https://store-a.example/iphone?utm_source=g", title: "Buy iPhone" });
  const b = linkSubject({ url: "https://store-b.example/iphone", title: "Buy iPhone" });
  assert.notEqual(a.key, b.key);
  assert.equal(a.scope, "link");
  assert.equal(a.link, "https://store-a.example/iphone");
  assert.equal(a.key, linkSubject({ url: "https://store-a.example/iphone", title: "Different title" }).key);
});
test("domain fallback is explicit and shared only within the same hostname", () => {
  const a = linkSubject({ url: "https://shop.example/a", title: "a" });
  const b = linkSubject({ url: "https://shop.example/b", title: "b" });
  const fallback = domainSubject(a);
  assert.equal(fallback.key, domainSubject(b).key);
  assert.equal(fallback.scope, "domain");
  assert.equal(fallback.name, "shop.example");
  assert.equal(fallback.link, undefined);
  assert.match(targetInstructions(a), /General opinions about the product\/topic.*irrelevant/);
  assert.match(targetInstructions(fallback), /not an individual page or product/);
});
test("invalid and internal Google URLs are not website reputation subjects", () => {
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "https://www.google.com/shopping/product/1"]) assert.equal(linkSubject({ url, title: "Test" }), null);
});
test("a drawer recovers its exact result without persistent memory", async () => {
  const context = { query: "iPhone", results: [{ url: "https://apple.com/iphone", title: "Buy iPhone" }] };
  const expected = linkSubject(context.results[0]);
  assert.deepEqual(await recoverSubject(expected.key, context), expected);
  assert.equal(await recoverSubject("link:forged", context), null);
});
test("card recovery validates context bounds and discards unrelated fields", () => {
  assert.equal(readContext({ query: "x", results: [{ url: "javascript:x", title: "x" }] }), null);
  assert.equal(readContext({ query: "x".repeat(201), results: [] }), null);
  assert.equal(readContext({ query: "x", results: [1, 2] }), null);
  assert.deepEqual(readContext({ query: " x ", results: [{ url: "https://example.com", title: "x", cookie: "never send" }] }), { query: "x", results: [{ url: "https://example.com", title: "x" }] });
});
test("missing AI does not invent link reputation or fetch full evidence", async () => {
  const old = process.env.OPENAI_API_KEY;
  const oldAlias = process.env.CHATGPT;
  delete process.env.OPENAI_API_KEY;
  delete process.env.CHATGPT;
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("No fetch expected"); };
  try {
    const context = { query: "iPhone", results: [{ url: "https://apple.com/iphone", title: "Buy iPhone" }] };
    const target = linkSubject(context.results[0]);
    await memory().del(`subject:${target.key}`);
    assert.equal((await computeGauge(target)).state, "none");
    const result = await cardFor(target.key, 1000, context);
    assert.equal(result.kind, "unknown");
    assert.match(result.message, /Connect OPENAI_API_KEY/);
  } finally { globalThis.fetch = original; if (old) process.env.OPENAI_API_KEY = old; if (oldAlias) process.env.CHATGPT = oldAlias; }
});
test("the owner's CHATGPT and YOUTUBE variable names activate the existing connectors", () => {
  const before = { CHATGPT: process.env.CHATGPT, YOUTUBE: process.env.YOUTUBE };
  try {
    process.env.CHATGPT = "test-only-ai"; process.env.YOUTUBE = "test-only-youtube";
    assert.equal(configured.openai(), true); assert.equal(configured.youtube(), true);
    assert.equal(env("OPENAI_API_KEY"), "test-only-ai"); assert.equal(env("YOUTUBE_API_KEY"), "test-only-youtube");
  } finally { for (const [key,value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
test("YouTube destination results read the exact video's comments", () => {
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtu.be/abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtube.com.evil.example/watch?v=abcdefghijk"), null);
});
