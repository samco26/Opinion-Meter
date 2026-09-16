import { json } from "@/lib/api";
import { configured } from "@/lib/env";
import { memory } from "@/lib/memory";
export const dynamic = "force-dynamic";
export async function GET() {
  let memoryReachable = false;
  try { await memory().get("health:probe"); memoryReachable = true; } catch { /* Status only; no credentials or provider errors. */ }
  return json({ version: "0.16.2", analysis: configured.openai() ? "ai-configured" : "word-count-estimate", sources: { youtube: configured.youtube(), reddit: configured.reddit(), hn: true, bluesky: true, blueskyLogin: configured.blueskyLogin() }, memory: { persistent: configured.memory(), reachable: memoryReachable } });
}
