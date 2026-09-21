/* POST /api/page  { url, title, site?, description?, text, data? }
   One reading of the page the reader is on, from its subject: the page's
   own reviews first, the platforms as a supplement. Sent only when the
   reader presses "Analyse this page's subject"; the text is read once and
   never kept. */

import { callerId, json, preflight } from "@/lib/api";
import { checkLimit } from "@/lib/limits";
import { pageFor, readPageRequest } from "@/lib/page";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUDGET_MS = 55_000;

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
  const req = readPageRequest(body);
  if (!req) return json({ error: "Send the page's address, title and text." }, { status: 400 });
  try {
    return json(await pageFor(req, BUDGET_MS));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "The reading failed." }, { status: 502 });
  }
}
