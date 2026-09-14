/* Helpers the source readers share. */

import type { SourceId, SourceItem, SourceStatus } from "./types";

/* Some public doors refuse requests that do not say who is asking. */
export const USER_AGENT = "OpinionMeter/0.3 (+https://opinionmeter.vercel.app)";

export interface CollectOptions {
  subject: string;
  /* An article's address: readers that can search by link do, instead of by name. */
  link?: string;
  /* A website's hostname, when the subject is the site itself rather than a page on it. */
  domain?: string;
  depth?: "lite" | "full";
  timeoutMs?: number;
  from?: Date;
  to?: Date;
  signal: AbortSignal;
  /* Request-local only: reused while widening the same search, never kept. */
  memo?: Map<string, Promise<unknown>>;
  previousItems?: SourceItem[];
}

export interface Collected {
  items: SourceItem[];
  status: SourceStatus;
  canExpand?: boolean;
}

export interface Connector {
  id: SourceId;
  configured: () => boolean;
  collect: (opts: CollectOptions) => Promise<Collected>;
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly detail?: string) {
    super(message);
  }
}

/* Keep only the provider's short error explanation; never a URL or a key. */
function responseDetail(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { title?: unknown; detail?: unknown; message?: unknown; error?: { message?: unknown } | string; errors?: Array<{ message?: unknown; detail?: unknown }> };
    const error = typeof parsed.error === "object" && parsed.error ? parsed.error.message : parsed.error;
    const found = [parsed.errors?.[0]?.message, parsed.errors?.[0]?.detail, error, parsed.message, parsed.detail, parsed.title]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return found ? tidy(found, 300) : undefined;
  } catch {
    return undefined;
  }
}

export async function getJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...((init.headers as Record<string, string> | undefined) ?? {}) } });
  if (!res.ok) {
    const detail = responseDetail(await res.text());
    const host = new URL(url).host;
    console.error("Source request failed", { host, status: res.status, detail });
    throw new HttpError(res.status, `${res.status} from ${host}`, detail);
  }
  return (await res.json()) as T;
}

export function getOnce<T>(key: string, opts: CollectOptions, read: () => Promise<T>): Promise<T> {
  if (!opts.memo) return read();
  const existing = opts.memo.get(key);
  if (existing) return existing as Promise<T>;
  const pending = read();
  opts.memo.set(key, pending);
  return pending;
}

/* A plain-English reason for the answer, never the raw error. */
export function reasonFor(err: unknown, timedOut: boolean): string {
  if (timedOut) return "Did not respond in time.";
  if (err instanceof HttpError) {
    if (err.status === 402) return "Payment is required by this source.";
    if (err.status === 401 || err.status === 403) return "Access was refused.";
    if (err.status === 429) return "The request limit was reached for now.";
    if (err.status === 400 && err.detail) return `The request was rejected: ${err.detail}`;
    return `The service answered with an error (${err.status}).`;
  }
  return "Could not be reached.";
}

export function tidy(text: string, max = 600): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/* Plain text from a fragment of HTML, for sources that return markup. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\s*(br|p|div|li)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/* Partial when a source returned something but clearly less than asked. */
export function statusFor(id: SourceId, count: number, asked: number, note?: string): SourceStatus {
  if (count === 0) return { source: id, availability: "unavailable", itemsAnalysed: 0, note: note ?? "Nothing matched." };
  if (count < Math.ceil(asked / 3)) return { source: id, availability: "partial", itemsAnalysed: count, note: note ?? "Fewer items matched than were asked for." };
  return { source: id, availability: "ok", itemsAnalysed: count };
}

export function inWindow(iso: string | undefined, from?: Date, to?: Date): boolean {
  if (!iso || (!from && !to)) return true;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}
