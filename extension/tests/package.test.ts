import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const targets = ["chrome", "edge", "firefox", "safari"];
const sizes = [16, 32, 48, 128];
for (const target of targets) {
  test(`${target}: cream fallback and valid icon files`, () => {
    const root = `dist/${target}`;
    const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8"));
    for (const size of sizes) {
      assert.equal(manifest.icons[size], `icons/icon${size}.png`);
      assert.equal(manifest.action.default_icon[size], manifest.icons[size]);
      for (const prefix of ["icon", "grey"]) {
        const png = readFileSync(`${root}/icons/${prefix}${size}.png`);
        assert.equal(png.subarray(1, 4).toString(), "PNG");
        assert.equal(png.readUInt32BE(16), size);
        assert.equal(png.readUInt32BE(20), size);
        assert.deepEqual(png, readFileSync(`icons/${prefix}${size}.png`));
      }
    }
    if (target === "safari") {
      assert.deepEqual(manifest.icon_variants, manifest.action.icon_variants);
      assert.deepEqual(manifest.icon_variants.map(v => v.color_schemes), [["light"], ["dark"]]);
      assert.equal(manifest.icon_variants[0][32], "icons/grey32.png");
      assert.equal(manifest.icon_variants[1][32], "icons/icon32.png");
    }
    if (target === "firefox") {
      for (const icon of manifest.action.theme_icons) {
        // Firefox's light means light TEXT on a dark toolbar.
        assert.equal(icon.light, `icons/icon${icon.size}.png`);
        assert.equal(icon.dark, `icons/grey${icon.size}.png`);
      }
    }
    for (const script of ["content", "background", "site", "popup"]) {
      assert.deepEqual(readFileSync(`${root}/${script}.js`), readFileSync(`dist/chrome/${script}.js`));
    }
  });
}

test("all simultaneous Google readings survive and follow onto their sites", async () => {
  // Synthetic readings only; no server, credentials or real opinions.
  const results = ["alpha", "beta", "gamma"].map(name => ({ url: `https://${name}.example/article`, title: name, key: name }));
  const subjects = Object.fromEntries(results.map(r => [r.key, { state: "ready", gauge: { name: `Simulated ${r.key}`, count: 8 } }]));
  let listener;
  let saved = {};
  let fetches = 0;
  const local = { token: "synthetic-test-token" };
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(fn) { listener = fn; } },
    },
    storage: {
      local: {
        get(key, callback) { callback({ [key]: local[key] }); },
        set(items, callback) { Object.assign(local, items); callback?.(); },
      },
      session: {
        async get(key) { return structuredClone({ [key]: saved[key] }); },
        async set(items) {
          // Force writes to overlap in the uncorrected build.
          await new Promise(resolve => setTimeout(resolve, 2));
          Object.assign(saved, structuredClone(items));
        },
      },
    },
  };
  runInNewContext(readFileSync(process.env.BACKGROUND_UNDER_TEST ?? "dist/safari/background.js", "utf8"), {
    chrome, URL, crypto: { randomUUID: () => "synthetic-test-token" },
    fetch: async () => { fetches++; return { ok: true, json: async () => ({ query: { key: null }, results, subjects }) }; },
  });
  const send = message => new Promise(resolve => listener(message, {}, resolve));
  await send({ type: "gauge", request: { query: "synthetic test", results } });
  for (const result of results) {
    const reply = await send({ type: "site", url: result.url.replace("article", "another-page") });
    assert.equal(reply.reading?.key, result.key);
  }
  assert.equal(fetches, 1, "visiting sites never calls the server");
  assert.equal((await send({ type: "site", url: "https://unknown.example/" })).reading, null);
  local.sitesOff = true;
  assert.equal((await send({ type: "site", url: results[0].url })).reading, null);
});
