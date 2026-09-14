/* Bluesky through the public AppView: no key. Posts by name, or posts
   that link to an article. Each post is one opinion. */

import type { SourceItem } from "../types";
import { getJson, getOnce, inWindow, statusFor, type Collected, type CollectOptions, type Connector } from "../http";

const API = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const MAX_POSTS = 25;

interface SearchResponse {
  posts?: Array<{
    uri?: string;
    author?: { handle?: string; displayName?: string };
    record?: { text?: string; createdAt?: string };
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
  url.searchParams.set("lang", "en");
  if (opts.from) url.searchParams.set("since", opts.from.toISOString());
  if (opts.to) url.searchParams.set("until", opts.to.toISOString());

  const res = await getOnce(url.toString(), opts, () => getJson<SearchResponse>(url.toString(), { signal: opts.signal }));
  const items = (res.posts ?? []).flatMap((p): SourceItem[] => {
    const rkey = p.uri?.split("/").pop();
    const text = p.record?.text?.trim();
    if (!rkey || !text || !p.author?.handle || !inWindow(p.record?.createdAt, opts.from, opts.to)) return [];
    return [{
      id: `bluesky:post:${rkey}`, source: "bluesky", kind: "post", text, author: `@${p.author.handle}`,
      url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`, publishedAt: p.record?.createdAt,
      engagement: (p.likeCount ?? 0) + (p.repostCount ?? 0),
    }];
  });
  return { items, canExpand: true, status: { ...statusFor("bluesky", items.length, MAX_POSTS), note: `Read ${items.length} of up to ${MAX_POSTS} Bluesky posts.` } };
}

export const bluesky: Connector = { id: "bluesky", configured: () => true, collect };
