import { test } from "node:test";
import assert from "node:assert/strict";
import { headline, normaliseUrl, queryFallback, resolveByRule, shorten, slug } from "../src/lib/subject.ts";

const resolve = (url, title) => resolveByRule({ url, title });

test("shop and listing pages name the thing, keyed by the site's identifier", () => {
  const amazon = resolve("https://www.amazon.com.au/Sony-WH-1000XM6-Wireless-Cancelling-Headphones/dp/B0DZXYZ123/ref=sr_1_1?keywords=xm6", "Sony WH-1000XM6 Wireless Noise Cancelling Headphones, Black : Amazon.com.au: Electronics");
  assert.deepEqual(amazon, { key: "asin:B0DZXYZ123", name: "Sony WH-1000XM6 Wireless Noise Cancelling Headphones", kind: "product", category: "product" });
  const prefixed = resolve("https://www.amazon.com/dp/B0DZXYZ123", "Amazon.com: Dyson V15 Detect Cordless Vacuum : Home & Kitchen");
  assert.equal(prefixed.key, "asin:B0DZXYZ123");
  assert.equal(prefixed.name, "Dyson V15 Detect Cordless Vacuum");
  const film = resolve("https://www.imdb.com/title/tt15239678/", "Dune: Part Two (2024) ⭐ 8.5 | Action, Adventure, Drama");
  assert.deepEqual(film, { key: "imdb:tt15239678", name: "Dune: Part Two", kind: "film", category: "film" });
  assert.equal(resolve("https://www.imdb.com/title/tt0111161/", "The Shawshank Redemption (1994) - IMDb").name, "The Shawshank Redemption");
  const app = resolve("https://apps.apple.com/us/app/chatgpt/id6448311069", "‎ChatGPT on the App Store");
  assert.deepEqual(app, { key: "apple-app:6448311069", name: "ChatGPT", kind: "app", category: "app" });
  assert.equal(resolve("https://play.google.com/store/apps/details?id=com.openai.chatgpt&hl=en", "ChatGPT - Apps on Google Play").key, "play:com.openai.chatgpt");
  assert.equal(resolve("https://store.steampowered.com/app/1245620/ELDEN_RING/", "Save 30% on ELDEN RING on Steam").name, "ELDEN RING");
  assert.equal(resolve("https://github.com/withastro/astro", "GitHub - withastro/astro: The web framework").key, "github:withastro/astro");
  assert.equal(resolve("https://github.com/features/copilot", "GitHub Copilot"), "ask");
  assert.equal(resolve("https://www.google.com/maps/place/Harbour+Lane+Burgers/@-37.8,144.9,17z", "Harbour Lane Burgers - Google Maps").name, "Harbour Lane Burgers");
  assert.equal(resolve("https://letterboxd.com/film/dune-part-two/", "Dune: Part Two (2024) directed by Denis Villeneuve • Reviews, film + cast • Letterboxd").name, "Dune: Part Two");
});

test("news is an article found by link; utility pages are nothing; the rest is asked", () => {
  const article = resolve("https://www.cnn.com/2026/09/14/tech/some-story/index.html?utm_source=x", "Some story about a launch | CNN Business");
  assert.equal(article.kind, "article");
  assert.equal(article.name, "Some story about a launch");
  assert.equal(article.link, "https://cnn.com/2026/09/14/tech/some-story/index.html");
  assert.match(article.key, /^url:[0-9a-f]{16}$/);
  assert.equal(resolve("https://www.wikihow.com/Boil-Eggs", "How to Boil Eggs: 12 Steps - wikiHow"), null);
  assert.equal(resolve("https://support.google.com/accounts/answer/1", "Sign in - Google Accounts"), null);
  assert.equal(resolve("https://www.techradar.com/audio/headphones/sony-wh-1000xm6-review", "Sony WH-1000XM6 review: still the best"), "ask");
  assert.equal(resolve("https://en.wikipedia.org/wiki/Dune_(novel)", "Dune (novel) - Wikipedia"), "ask");
  assert.equal(resolve("ftp://example.com/x", "x"), null);
  assert.equal(resolve("https://example.com", "   "), null);
});

test("addresses lose tracking parameters and mobile prefixes; names slug cleanly", () => {
  assert.equal(normaliseUrl("https://m.example.com/a/b/?utm_campaign=x&id=5&fbclid=y#top"), "https://example.com/a/b?id=5");
  assert.equal(normaliseUrl("not a url"), null);
  assert.equal(slug("Sony WH-1000XM6 (Black)"), "sony-wh-1000xm6-black");
  assert.equal(slug("Café Été"), "cafe-ete");
  assert.equal(shorten("Sony WH-1000XM6 Wireless Headphones, Industry Leading Noise Cancelling with Auto Optimizer"), "Sony WH-1000XM6 Wireless Headphones");
  assert.equal(headline("Apple unveils the iPhone 17 - The Verge"), "Apple unveils the iPhone 17");
  assert.equal(headline("A title with - dashes inside that is long enough to keep - Site"), "A title with - dashes inside that is long enough to keep");
});

test("without an AI key a short, non-question query stands as typed", () => {
  assert.deepEqual(queryFallback("sony xm6 review"), { key: "name:sony-xm6", name: "sony xm6", kind: "entity", category: "general" });
  assert.equal(queryFallback("how to boil eggs"), null);
  assert.equal(queryFallback("is the xm6 worth it?"), null);
  assert.equal(queryFallback("a very long query with many many words in it indeed"), null);
});

test("a site's front page names the site itself, merging with the query's subject", () => {
  const home = resolve("https://www.youtube.com/", "YouTube");
  assert.deepEqual(home, { key: "name:youtube", name: "YouTube", kind: "company", category: "general" });
  assert.equal(resolve("https://www.netflix.com/au/", "Netflix Australia - Watch TV Shows Online, Watch Movies Online").name, "Netflix Australia");
  assert.equal(resolve("https://www.example.com/", "Home | Example Corp").name, "Example Corp");
  assert.equal(resolve("https://www.cnn.com/", "Breaking News, Latest News and Videos | CNN").name, "CNN");
  assert.equal(resolve("https://www.google.com/", "Google"), null);
  const video = resolve("https://www.youtube.com/watch?v=abcdefghijk", "A video - YouTube");
  assert.equal(video.key, "yt:abcdefghijk");
  assert.equal(video.name, "A video");
  assert.equal(video.link, "https://www.youtube.com/watch?v=abcdefghijk");
});
