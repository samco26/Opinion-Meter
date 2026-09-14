import type { SourceId } from "@/lib/types";

const FILES: Record<SourceId, string> = { reddit: "/logos/reddit.png", youtube: "/logos/youtube.png", x: "/logos/x.png", hn: "/logos/hn.svg", bluesky: "/logos/bluesky.svg" };

/* Decorative mark; each containing control or section supplies an accessible name. */
export function Logo({ id, size = 18 }: { id: SourceId; size?: number }) {
  return <img src={FILES[id]} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "contain", flex: "0 0 auto" }} />;
}
