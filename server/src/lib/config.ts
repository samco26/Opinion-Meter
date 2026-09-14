/* What the extension fetches on start. The defaults live here; to change
   anything instantly, without a deploy or a store update, set the memory
   key config:override to a JSON object with the fields to replace (for
   example {"enabled":false} is the kill switch). */

import { memory } from "./memory";
import type { ExtensionConfig } from "./types";

export const DEFAULT_CONFIG: ExtensionConfig = {
  version: 2,
  enabled: true,
  minExtensionVersion: "0.2.0",
  ttlMinutes: 60,
  pollMs: 8000,
  polls: 4,
  google: {
    enabled: true,
    queryBar: true,
    results: "#rso, #search",
    anchor: "a[href]:has(h3)",
    ads: "[data-text-ad], #tads, #tadsb, #bottomads, [aria-label='Ads']",
    maxResults: 12,
  },
};

export async function currentConfig(): Promise<ExtensionConfig> {
  const override = await memory().get<Partial<ExtensionConfig>>("config:override").catch(() => null);
  if (!override) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...override, google: { ...DEFAULT_CONFIG.google, ...(override.google ?? {}) } };
}
