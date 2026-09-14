/* GET /api/card?key=…  The full answer for one subject the gauge door
   has already named: from memory, or computed now within the budget. */

import { callerId, json, preflight } from "@/lib/api";
import { cardFor } from "@/lib/card";
import { checkLimit } from "@/lib/limits";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUDGET_MS = 55_000;

export const OPTIONS = () => preflight();

export async function GET(request: Request) {
  const limit = await checkLimit(callerId(request));
  if (!limit.ok) return json({ error: limit.reason }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  if (!key || key.length > 120) return json({ error: "Send the subject's key." }, { status: 400 });
  try {
    return json(await cardFor(key, BUDGET_MS));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "The analysis failed." }, { status: 502 });
  }
}
