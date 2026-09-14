/* The memory: recent answers, so one answer serves everyone, and the
   counters behind the rate limits. Upstash Redis over its REST door when
   configured; otherwise a map in this process, which is enough for local
   work and nothing more (a serverless instance forgets it). Only derived
   answers are ever stored, for at most CACHE_TTL_HOURS. */

import { configured, env } from "./env";

export interface Memory {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /* Adds one and returns the count; the key expires ttl seconds after it first appeared. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class Upstash implements Memory {
  constructor(private readonly url: string, private readonly token: string) {}

  private async send<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.url}${path}`, {
      method: "POST", cache: "no-store", body: JSON.stringify(body),
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Memory answered ${res.status}.`);
    return (await res.json()) as T;
  }

  async get<T>(key: string): Promise<T | null> {
    const { result } = await this.send<{ result: string | null }>("", ["GET", key]);
    return result == null ? null : (JSON.parse(result) as T);
  }
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.send("", ["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
  }
  async del(key: string): Promise<void> {
    await this.send("", ["DEL", key]);
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const [first] = await this.send<Array<{ result: number }>>("/pipeline", [["INCR", key], ["EXPIRE", key, ttlSeconds, "NX"]]);
    return first.result;
  }
}

class Local implements Memory {
  private readonly store = new Map<string, { value: unknown; expires: number }>();

  private live(key: string) {
    const entry = this.store.get(key);
    if (entry && entry.expires <= Date.now()) this.store.delete(key);
    return entry && entry.expires > Date.now() ? entry : undefined;
  }
  async get<T>(key: string): Promise<T | null> {
    return (this.live(key)?.value as T) ?? null;
  }
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.live(key) ?? { value: 0, expires: Date.now() + ttlSeconds * 1000 };
    entry.value = (entry.value as number) + 1;
    this.store.set(key, entry);
    return entry.value as number;
  }
}

const cache = globalThis as unknown as { __memory?: Memory };

export function memory(): Memory {
  cache.__memory ??= configured.memory() ? new Upstash(env("UPSTASH_REDIS_REST_URL")!, env("UPSTASH_REDIS_REST_TOKEN")!) : new Local();
  return cache.__memory;
}
