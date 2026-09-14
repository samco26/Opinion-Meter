/* Abuse prevention: a ceiling per install (or per address) per minute and
   per day, and a global ceiling on fresh subjects analysed per day, which
   is what actually costs money. */

import { settings } from "./env";
import { memory } from "./memory";

export type LimitResult = { ok: true } | { ok: false; reason: string; retryAfter: number };

const today = () => new Date().toISOString().slice(0, 10);

export async function checkLimit(id: string): Promise<LimitResult> {
  const m = memory();
  const [perMinute, perDay] = await Promise.all([
    m.incr(`rl:m:${id}:${Math.floor(Date.now() / 60_000)}`, 90),
    m.incr(`rl:d:${id}:${today()}`, 90_000),
  ]);
  if (perMinute > settings.perMinute()) return { ok: false, reason: "Too many requests this minute.", retryAfter: 60 };
  if (perDay > settings.perDay()) return { ok: false, reason: "Today's request allowance is used up.", retryAfter: 3600 };
  return { ok: true };
}

/* True when today's budget still allows analysing one more new subject. */
export async function claimFresh(): Promise<boolean> {
  return (await memory().incr(`fresh:${today()}`, 90_000)) <= settings.freshPerDay();
}
