/* POST /api/gauge  { query, results: [{ url, title, snippet? }] }
   Names the subject behind each result and answers with a quick gauge
   per subject: from memory at once, computed within the budget when new,
   or "pending" with the work kept alive for the extension to poll.

   GET /api/gauge?keys=a,b  The poll: memory only, never new work. */

import { after } from "next/server";
import { callerId, json, preflight } from "@/lib/api";
import { gaugeFor, lookupGauges } from "@/lib/gauge";
import { checkLimit } from "@/lib/limits";
import type { GaugeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUDGET_MS = 20_000;

function readRequest(body: unknown): GaugeRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { query, results } = body as { query?: unknown; results?: unknown };
  if (typeof query !== "string" || !Array.isArray(results) || results.length > 20) return null;
  const clean: GaugeRequest["results"] = [];
  for (const r of results) {
    if (typeof r !== "object" || r === null) return null;
    const { url, title, snippet } = r as { url?: unknown; title?: unknown; snippet?: unknown };
    if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 2000 || typeof title !== "string" || title.length > 300) return null;
    clean.push({ url, title, ...(typeof snippet === "string" ? { snippet: snippet.slice(0, 500) } : {}) });
  }
  return { query: query.trim().slice(0, 200), results: clean };
}

export const OPTIONS = () => preflight();

export async function POST(request: Request) {
  const limit = await checkLimit(callerId(request));
  if (!limit.ok) return json({ error: limit.reason }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "The request body must be JSON." }, { status: 400 });
  }
  const req = readRequest(body);
  if (!req) return json({ error: "Send a query and up to twenty results with a title and an http(s) url." }, { status: 400 });
  return json(await gaugeFor(req, BUDGET_MS, (work) => after(() => work)));
}

export async function GET(request: Request) {
  const limit = await checkLimit(callerId(request));
  if (!limit.ok) return json({ error: limit.reason }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const keys = (new URL(request.url).searchParams.get("keys") ?? "").split(",").map((k) => k.trim()).filter((k) => k && k.length <= 120).slice(0, 20);
  if (!keys.length) return json({ error: "Send keys to look up." }, { status: 400 });
  return json({ subjects: await lookupGauges(keys) });
}
