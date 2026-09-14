/* Bluesky through the public AppView: no key. Posts by name, or posts
   that link to an article. Each post is one opinion. */

import type { SourceItem } from "../types";
import { normaliseUrl } from "../subject";
import { getJson, getOnce, inWindow, statusFor, type Collected, type CollectOptions, type Connector } from "../http";

const API = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const MAX_POSTS = 100;
const MAX_PAGES = 10;

interface SearchResponse {
  cursor?: string;
  posts?: Array<{
    uri?: string;
    author?: { handle?: string; displayName?: string };
    record?: { text?: string; createdAt?: string; facets?: Array<{ features?: Array<{ uri?: string }> }>; embed?: { external?: { uri?: string } } };
    embed?: { external?: { uri?: string } };
    likeCount?: number;
    repostCount?: number;
  }>;
}

async function collect(opts: CollectOptions): Promise<Collected> {
  const url = new URL(API);
  if (opts.link) {
    url.searchParams.set("q", new URL(opts.link).hostname.replace(/^www\./, ""));
    url.searchParams.set("url", opts.link);
  } else {
    url.searchParams.set("q", opts.subject);
  }
  url.searchParams.set("limit", String(MAX_POSTS));
  url.searchParams.set("sort", "top");
  if (opts.from) url.searchParams.set("since", opts.from.toISOString());
  if (opts.to) url.searchParams.set("until", opts.to.toISOString());

  const selected = new Map<string, SourceItem>();
  const cursors = new Set<string>();
  let pages = 0, limited = false, failure = "";
  for (; pages < (opts.depth === "full" ? MAX_PAGES : 1); pages++) {
  let res: SearchResponse;
  try { res = await getOnce(url.toString(), opts, () => getJson<SearchResponse>(url.toString(), { signal: opts.signal })); }
  catch (err) { if (!selected.size) throw err; failure = opts.signal.aborted ? "Time limit reached; retained earlier pages." : "A later page was unavailable; retained earlier pages."; break; }
  const items = (res.posts ?? []).flatMap((p): SourceItem[] => {
    if (opts.link) {
      const links = [...(p.record?.facets ?? []).flatMap(f => (f.features ?? []).map(feature => feature.uri)), p.record?.embed?.external?.uri, p.embed?.external?.uri];
      if (!links.some(link => link && normaliseUrl(link) === normaliseUrl(opts.link!))) return [];
    }
    const rkey = p.uri?.split("/").pop();
    const text = p.record?.text?.trim();
    if (!rkey || !text || !p.author?.handle || !inWindow(p.record?.createdAt, opts.from, opts.to)) return [];
    return [{
      id: `bluesky:post:${p.uri}`, source: "bluesky", kind: "post", text, author: `@${p.author.handle}`,
      url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`, publishedAt: p.record?.createdAt,
      engagement: (p.likeCount ?? 0) + (p.repostCount ?? 0),
    }];
  });
  for (const item of items) selected.set(item.id, item);
  limited = Boolean(res.cursor);
  if (!res.cursor || cursors.has(res.cursor) || !res.posts?.length) break;
  cursors.add(res.cursor); url.searchParams.set("cursor", res.cursor);
  }
  const items = [...selected.values()];
  return { items, canExpand: true, status: { ...statusFor("bluesky", items.length, MAX_POSTS), ...(failure || limited ? { availability: items.length ? "partial" as const : "unavailable" as const } : {}), note: `Collected ${items.length} Bluesky posts, 100 per page${opts.depth === "full" ? ", searching all available dates; up to 10 pages per reading" : " in the quick pass"}. ${failure || (limited ? "More matches may exist beyond the cursor/time budget." : "Reached the end of the returned results.")}` } };
}

export const bluesky: Connector = { id: "bluesky", configured: () => true, collect };
