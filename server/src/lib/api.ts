/* What every door shares: JSON answers that any origin may read (the
   extension's install token and the rate limits are the protection, not
   the origin), never cached by the browser. */

import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Install-Token",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(data, { status: init.status ?? 200, headers: { "Cache-Control": "no-store", ...CORS, ...init.headers } });
}

export const preflight = () => new Response(null, { status: 204, headers: CORS });

/* Who is asking: the install token when it looks like one, else the address. */
export function callerId(request: Request): string {
  const token = request.headers.get("x-install-token") ?? "";
  if (/^[0-9a-f-]{36}$/i.test(token)) return `t:${token.toLowerCase()}`;
  return `ip:${request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"}`;
}
