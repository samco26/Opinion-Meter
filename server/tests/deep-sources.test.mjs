import { test } from "node:test";
import assert from "node:assert/strict";
import { bluesky } from "../src/lib/sources/bluesky.ts";
import { hn } from "../src/lib/sources/hn.ts";
import { collectAdaptive } from "../src/lib/sources/adaptive.ts";
const opts = { subject: "example.com", depth: "full", signal: new AbortController().signal };
const post = (author, id) => ({ uri: `at://${author}/app.bsky.feed.post/${id}`, author: { handle: author }, record: { text: "Useful site", createdAt: "2020-01-01T00:00:00Z" } });
async function mock(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = async url => new Response(JSON.stringify(await handler(new URL(url))), { headers: { "Content-Type": "application/json" } });
  try { return await run(); } finally { globalThis.fetch = original; }
}
test("Bluesky uses 100-per-page cursors and distinguishes identical rkeys from different authors", async () => {
  const calls = [];
  const out = await mock(u => { calls.push(u); return u.searchParams.has("cursor") ? { posts: [post("two", "same") ] } : { posts: [post("one", "same")], cursor: "next" }; }, () => bluesky.collect(opts));
  assert.equal(out.items.length, 2);
  assert.equal(calls[0].searchParams.get("limit"), "100");
  assert.equal(calls[1].searchParams.get("cursor"), "next");
  assert.equal(calls[0].searchParams.has("since"), false);
});
test("Bluesky retains early pages after a later error and stops repeated cursors", async () => {
  let count = 0;
  const partial = await mock(() => { if (count++) throw new Error("timeout"); return { posts: [post("one", "1")], cursor: "next" }; }, () => bluesky.collect(opts));
  assert.equal(partial.items.length, 1); assert.equal(partial.status.availability, "partial");
  count = 0;
  await mock(() => { count++; return { posts: [post("one", "1")], cursor: "same" }; }, () => bluesky.collect(opts));
  // Two most-liked pages (the repeated cursor stops the second) and one page of the newest.
  assert.equal(count, 3);
});
test("Hacker News exact-link matches do not include sibling pages", async () => {
  const calls = [];
  await mock(u => {
    calls.push(u);
    if (u.searchParams.get("tags") === "story") return { hits: [{ objectID: "1", title: "Match", url: "https://example.com/a" }, { objectID: "2", title: "Other", url: "https://example.com/a/other" }] };
    return { hits: [] };
  }, () => hn.collect({ ...opts, link: "https://example.com/a" }));
  assert.equal(calls[0].searchParams.get("hitsPerPage"), "1000");
  assert.ok(calls.some(u => u.searchParams.get("tags") === "comment,(story_1)"));
  assert.ok(calls.every(u => !u.searchParams.get("tags")?.includes("story_2")));
});
test("deep HN/Bluesky search has no date cutoff and does not stop at fifty posts", async () => {
  const calls = [];
  const out = await collectAdaptive("example", ["hn", "bluesky"], { depth: "full", collect: async (sources, options) => {
    calls.push(options);
    return { items: [], statuses: sources.map(source => ({ source, availability: "unavailable", itemsAnalysed: 0 })), expandable: [] };
  } });
  assert.equal(calls.length, 1); assert.equal(calls[0].from, undefined); assert.equal(calls[0].depth, "full");
  assert.equal(out.window.from, "2006-01-01T00:00:00.000Z");
});
