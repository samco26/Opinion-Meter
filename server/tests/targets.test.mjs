import { test } from "node:test";
import assert from "node:assert/strict";
import { resultSubject, targetInstructions, linkSubject, domainSubject } from "../src/lib/target.ts";
import { recoverSubject, readContext } from "../src/lib/card-context.ts";
import { computeGauge } from "../src/lib/gauge.ts";
import { memory } from "../src/lib/memory.ts";
import { configured, env } from "../src/lib/env.ts";
import { youtubeVideoId } from "../src/lib/sources/youtube.ts";

test("a result's bar is about the site it sits beside, named as people call it", () => {
  const x = resultSubject({ url: "https://x.com/", title: "X. It's what's happening / X" });
  assert.equal(x.key, "name:x");
  assert.equal(x.name, "X");
  assert.deepEqual(x.aliases, ["Twitter"]);
  assert.equal(resultSubject({ url: "https://twitter.com/", title: "تويتر" }).key, "name:x");
  assert.equal(resultSubject({ url: "https://play.google.com/store/apps/details?id=com.twitter.android", title: "X (Formerly Twitter) – Apps on Google Play", site: "Google Play" }).name, "Google Play");
  assert.equal(resultSubject({ url: "https://apps.apple.com/us/app/x/id333903271", title: "X - App Store - Apple", site: "Apple" }).name, "App Store");
  const esafety = resultSubject({ url: "https://www.esafety.gov.au/key-topics/x", title: "X (formerly Twitter) | eSafety Commissioner", site: "eSafety Commissioner" });
  assert.equal(esafety.name, "eSafety Commissioner");
  assert.equal(esafety.key, "name:esafety-commissioner");
  assert.equal(resultSubject({ url: "https://www.britannica.com/topic/Twitter", title: "X (formerly Twitter) | History & Facts | Britannica" }).name, "Britannica");
  assert.equal(resultSubject({ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "A video - YouTube", site: "YouTube · Someone" }).key, "yt:abcdefghijk");
  assert.equal(resultSubject({ url: "https://www.youtube.com/channel/UC123", title: "Someone - YouTube", site: "YouTube · Someone" }).name, "YouTube");
  assert.equal(resultSubject({ url: "https://example.org/page", title: "A page - Some Site", site: "Some Site · Section" }).name, "Some Site");
  assert.equal(resultSubject({ url: "https://www.google.com/maps/place/x", title: "x" }), null);
});

test("the reading scope names the aliases and keeps the page and website scopes", () => {
  assert.match(targetInstructions({ key: "name:x", name: "X", kind: "app", category: "app", aliases: ["Twitter"] }), /Also known as "Twitter"/);
  const a = linkSubject({ url: "https://shop.example/a", title: "a" });
  assert.match(targetInstructions(a), /General opinions about the product\/topic.*irrelevant/);
  assert.match(targetInstructions(domainSubject(a)), /not an individual page or product/);
});

test("invalid and internal Google URLs are not subjects", () => {
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "https://www.google.com/shopping/product/1"]) assert.equal(resultSubject({ url, title: "Test" }), null);
});

test("a drawer recovers its exact result without persistent memory", async () => {
  const context = { query: "twitter", results: [{ url: "https://www.esafety.gov.au/key-topics/x", title: "X | eSafety Commissioner", site: "eSafety Commissioner" }] };
  const expected = resultSubject(context.results[0]);
  assert.deepEqual(await recoverSubject(expected.key, context), expected);
  assert.equal(await recoverSubject("name:forged", context), null);
});

test("card recovery validates context bounds, keeps the site label and discards unrelated fields", () => {
  assert.equal(readContext({ query: "x", results: [{ url: "javascript:x", title: "x" }] }), null);
  assert.equal(readContext({ query: "x".repeat(201), results: [] }), null);
  assert.equal(readContext({ query: "x", results: [1, 2] }), null);
  assert.deepEqual(readContext({ query: " x ", results: [{ url: "https://example.com", title: "x", site: " Example ", cookie: "never send" }] }), { query: "x", results: [{ url: "https://example.com", title: "x", site: "Example" }] });
});

test("without AI a site is still named and a page-scoped reading is not invented", async () => {
  const old = process.env.OPENAI_API_KEY;
  const oldAlias = process.env.CHATGPT;
  delete process.env.OPENAI_API_KEY;
  delete process.env.CHATGPT;
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("No fetch expected"); };
  try {
    const target = linkSubject({ url: "https://apple.com/iphone", title: "Buy iPhone" });
    await memory().del(`subject:${target.key}`);
    assert.equal((await computeGauge(target)).state, "none");
    assert.equal(resultSubject({ url: "https://apple.com/iphone", title: "Buy iPhone" }).name, "Apple");
  } finally { globalThis.fetch = original; if (old) process.env.OPENAI_API_KEY = old; if (oldAlias) process.env.CHATGPT = oldAlias; }
});

test("the owner's CHATGPT and YOUTUBE variable names activate the existing connectors", () => {
  const before = { CHATGPT: process.env.CHATGPT, YOUTUBE: process.env.YOUTUBE };
  try {
    process.env.CHATGPT = "test-only-ai"; process.env.YOUTUBE = "test-only-youtube";
    assert.equal(configured.openai(), true); assert.equal(configured.youtube(), true);
    assert.equal(env("OPENAI_API_KEY"), "test-only-ai"); assert.equal(env("YOUTUBE_API_KEY"), "test-only-youtube");
  } finally { for (const [key, value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("YouTube destination results read the exact video's comments", () => {
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtu.be/abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtube.com.evil.example/watch?v=abcdefghijk"), null);
});
