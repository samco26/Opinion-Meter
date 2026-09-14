/* Server-only reads of the environment. No key is ever returned to a
   response: the routes only ask whether a source is configured. */

export function env(name: string): string | undefined {
  const alias = name === "OPENAI_API_KEY" ? "CHATGPT" : name === "YOUTUBE_API_KEY" ? "YOUTUBE" : undefined;
  const v = (alias ? process.env[alias]?.trim() : undefined) || process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/* An integer setting with a default and a range, so a typo in Vercel's
   settings cannot ask a source for ten thousand items. */
export function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(env(name) ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export const configured = {
  openai: () => Boolean(env("OPENAI_API_KEY")),
  youtube: () => Boolean(env("YOUTUBE_API_KEY")),
  x: () => Boolean(env("X_BEARER_TOKEN")),
  reddit: () => Boolean(env("REDDIT_CLIENT_ID") && env("REDDIT_CLIENT_SECRET") && env("REDDIT_USER_AGENT")),
  hn: () => true,
  bluesky: () => true,
  blueskyLogin: () => Boolean(env("BLUESKY_IDENTIFIER") && env("BLUESKY_APP_PASSWORD")),
  memory: () => Boolean(env("UPSTASH_REDIS_REST_URL") && env("UPSTASH_REDIS_REST_TOKEN")),
};

export const settings = {
  minItems: () => envInt("MIN_ITEMS", 8, 1, 100),
  cacheTtlSeconds: () => envInt("CACHE_TTL_HOURS", 24, 1, 24) * 3600,
  freshPerDay: () => envInt("FRESH_SUBJECTS_PER_DAY", 5000, 1, 1_000_000),
  perMinute: () => envInt("RATE_PER_TOKEN_MINUTE", 20, 1, 10_000),
  perDay: () => envInt("RATE_PER_TOKEN_DAY", 500, 1, 1_000_000),
};
