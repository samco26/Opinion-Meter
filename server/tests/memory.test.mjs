import { test } from "node:test";
import assert from "node:assert/strict";
import { memory } from "../src/lib/memory.ts";
import { checkLimit, claimFresh } from "../src/lib/limits.ts";
import { lookupGauges } from "../src/lib/gauge.ts";
import { currentConfig, DEFAULT_CONFIG } from "../src/lib/config.ts";

test("the local memory expires, counts and forgets", async () => {
  const m = memory();
  await m.set("t:a", { x: 1 }, 60);
  assert.deepEqual(await m.get("t:a"), { x: 1 });
  await m.del("t:a");
  assert.equal(await m.get("t:a"), null);
  assert.equal(await m.incr("t:c", 60), 1);
  assert.equal(await m.incr("t:c", 60), 2);
  await m.set("t:e", 1, -1);
  assert.equal(await m.get("t:e"), null);
});

test("limits cut in per minute and per day, and the fresh-subject budget is global", async () => {
  process.env.RATE_PER_TOKEN_MINUTE = "2";
  process.env.FRESH_SUBJECTS_PER_DAY = "1";
  assert.deepEqual(await checkLimit("t:one"), { ok: true });
  assert.deepEqual(await checkLimit("t:one"), { ok: true });
  const third = await checkLimit("t:one");
  assert.equal(third.ok, false);
  assert.equal(third.retryAfter, 60);
  assert.deepEqual(await checkLimit("t:two"), { ok: true });
  assert.equal(await claimFresh(), true);
  assert.equal(await claimFresh(), false);
  delete process.env.RATE_PER_TOKEN_MINUTE;
  delete process.env.FRESH_SUBJECTS_PER_DAY;
});

test("polling reads memory only", async () => {
  const m = memory();
  await m.set("gauge:3:name:k2", { state: "ready", gauge: { key: "name:k2" } }, 60);
  await m.set("pending:name:k3", true, 60);
  const states = await lookupGauges(["name:k2", "name:k3", "name:k4"]);
  assert.equal(states["name:k2"].state, "ready");
  assert.equal(states["name:k3"].state, "pending");
  assert.equal(states["name:k4"].state, "none");
});

test("the config override merges over the defaults", async () => {
  assert.deepEqual(await currentConfig(), DEFAULT_CONFIG);
  await memory().set("config:override", { enabled: false, google: { maxResults: 5 } }, 60);
  const config = await currentConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.google.maxResults, 5);
  assert.equal(config.google.anchor, DEFAULT_CONFIG.google.anchor);
  await memory().del("config:override");
});
