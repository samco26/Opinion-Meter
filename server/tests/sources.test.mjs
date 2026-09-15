import { test } from "node:test";
import assert from "node:assert/strict";
import { hn } from "../src/lib/sources/hn.ts";
import { bluesky } from "../src/lib/sources/bluesky.ts";
import { linkQuery } from "../src/lib/sources/reddit.ts";
import { xTerms } from "../src/lib/sources/x.ts";
import { collectAdaptive } from "../src/lib/sources/adaptive.ts";
import { stripHtml } from "../src/lib/http.ts";

const withFetch = async (handler, run) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const body = handler(String(url));
    return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { "Content-Type": "application/json" } });
  };
  try { return await run(); } finally { globalThis.fetch = original; }
};
const opts = (extra = {}) => ({ subject: "Keychron K2", signal: new AbortController().signal, memo: new Map(), ...extra });

test("Hacker News stories and their comments become items with real links", async () => {
  const seen = [];
  const collected = await withFetch((url) => {
    seen.push(url);
    if (url.includes("tags=story")) return { hits: [{ objectID: "1", title: "Keychron K2 thoughts", author: "pg", points: 42, created_at: "2026-08-01T00:00:00Z" }] };
    if (url.includes("tags=comment%2Cstory_1")) return { hits: [{ objectID: "2", comment_text: "<p>Love the &quot;keys&quot; &amp; the feel</p>", author: "a", created_at: "2026-08-02T00:00:00Z" }, { objectID: "3", comment_text: "", author: "b" }] };
    return null;
  }, () => hn.collect(opts()));
  assert.equal(collected.items.length, 2);
  assert.equal(collected.items[0].url, "https://news.ycombinator.com/item?id=1");
  assert.equal(collected.items[1].text, 'Love the "keys" & the feel');
  assert.equal(collected.items[1].parentId, "hn:story:1");
  assert.ok(seen[0].includes("query=Keychron+K2"));
  const byLink = await withFetch((url) => { seen.push(url); return { hits: [] }; }, () => hn.collect(opts({ link: "https://www.cnn.com/2026/09/14/story" })));
  assert.equal(byLink.status.availability, "unavailable");
  assert.ok(seen.at(-1).includes("restrictSearchableAttributes=url") && seen.at(-1).includes("cnn.com%2F2026%2F09%2F14%2Fstory"));
});

test("Bluesky posts become items with profile links and combined reactions", async () => {
  const collected = await withFetch(() => ({ posts: [
    { uri: "at://did:plc:abc/app.bsky.feed.post/3k", author: { handle: "sam.bsky.social" }, record: { text: "The K2 is lovely", createdAt: "2026-08-01T00:00:00Z" }, likeCount: 3, repostCount: 2 },
    { uri: "at://did:plc:abc/app.bsky.feed.post/3m", author: { handle: "x" }, record: { text: "   " } },
  ] }), () => bluesky.collect(opts()));
  assert.equal(collected.items.length, 1);
  assert.deepEqual(collected.items[0], { id: "bluesky:post:at://did:plc:abc/app.bsky.feed.post/3k", source: "bluesky", kind: "post", text: "The K2 is lovely", author: "@sam.bsky.social", url: "https://bsky.app/profile/sam.bsky.social/post/3k", publishedAt: "2026-08-01T00:00:00Z", engagement: 5 });
});

test("link searches strip www, tracking and trailing slashes", () => {
  assert.equal(linkQuery("https://www.cnn.com/2026/09/14/story/?utm_source=x"), "url:cnn.com/2026/09/14/story");
  assert.equal(xTerms({ subject: "x", link: "https://www.bbc.co.uk/news/articles/abc" }), 'url:"bbc.co.uk/news/articles/abc"');
  assert.equal(xTerms({ subject: 'Say "hi"' }), '"Say hi"');
  assert.equal(stripHtml("a<br>b &#39;c&#x27; &lt;d&gt;"), "a b 'c' <d>");
});

test("the window widens while too little is found and keeps earlier items", async () => {
  const calls = [];
  const collect = async (sources, o) => {
    calls.push({ sources, from: o.from.toISOString().slice(0, 7) });
    return { items: [{ id: `i${calls.length}`, source: "hn", kind: "comment", text: "x" }], statuses: sources.map((source) => ({ source, availability: "partial", itemsAnalysed: 1 })), expandable: sources };
  };
  const out = await collectAdaptive("K2", ["hn", "bluesky"], { to: new Date("2026-09-14T00:00:00Z"), collect });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((c) => c.from), ["2026-06", "2025-09", "2023-09"]);
  assert.equal(out.items.length, 3);
  assert.equal(out.window.months, 36);
  assert.equal(out.statuses.find((s) => s.source === "hn").itemsAnalysed, 3);
});

test("every name of a subject is searched", () => {
  assert.equal(xTerms({ subject: "X", aliases: ["Twitter"] }), '("X" OR "Twitter")');
  assert.equal(xTerms({ subject: "X", aliases: ["X"] }), '"X"');
});
