/* GET /api/config  What the extension reads on start: the kill switch,
   the selectors, the polling rhythm. See src/lib/config.ts. */

import { json, preflight } from "@/lib/api";
import { currentConfig } from "@/lib/config";

export const runtime = "nodejs";

export const OPTIONS = () => preflight();

export async function GET() {
  return json(await currentConfig(), { headers: { "Cache-Control": "public, max-age=300" } });
}
