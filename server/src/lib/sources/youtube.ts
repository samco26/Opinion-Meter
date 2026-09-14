/* YouTube Data API v3 with an API key: a video search by views, then the
   top comments on each video. Titles and descriptions are context; the
   comments are the opinions. A search costs 100 quota units, a comment
   list 1, so a subject is about 120 of the free 10,000 a day. */

import type { SourceItem } from "../types";
import { env } from "../env";
import { getJson, getOnce, inWindow, reasonFor, tidy, type Collected, type CollectOptions, type Connector } from "../http";

const API = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 10;
const PER_VIDEO = 30;

interface SearchResponse {
  items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string } }>;
}

interface CommentThreadsResponse {
  items?: Array<{ snippet?: { topLevelComment?: { id?: string; snippet?: { textOriginal?: string; textDisplay?: string; likeCount?: number; publishedAt?: string; authorDisplayName?: string } } } }>;
}

async function collect(opts: CollectOptions): Promise<Collected> {
  const key = env("YOUTUBE_API_KEY") ?? "";
  const search = new URL(`${API}/search`);
  search.searchParams.set("part", "snippet");
  search.searchParams.set("type", "video");
  search.searchParams.set("q", opts.subject);
  search.searchParams.set("maxResults", String(MAX_VIDEOS));
  search.searchParams.set("order", "viewCount");
  search.searchParams.set("fields", "items(id/videoId,snippet(title,description,publishedAt,channelTitle))");
  search.searchParams.set("relevanceLanguage", "en");
  search.searchParams.set("safeSearch", "moderate");
  if (opts.to) search.searchParams.set("publishedBefore", opts.to.toISOString());
  search.searchParams.set("key", key);

  const found = await getOnce("youtube:videos", opts, () => getJson<SearchResponse>(search.toString(), { signal: opts.signal }));
  const videos = (found.items ?? []).filter((v) => v.id?.videoId && v.snippet);
  const items: SourceItem[] = videos.map((v) => ({
    id: `youtube:video:${v.id!.videoId}`, source: "youtube", kind: "video",
    text: tidy(`${v.snippet!.title ?? ""}. ${v.snippet!.description ?? ""}`, 600),
    title: v.snippet!.title, author: v.snippet!.channelTitle,
    url: `https://www.youtube.com/watch?v=${v.id!.videoId}`, publishedAt: v.snippet!.publishedAt,
  }));

  const failures: string[] = [];
  const runs = videos.map(async (v) => {
    const id = v.id!.videoId!;
    const read = (order: "relevance" | "time") => {
      const url = new URL(`${API}/commentThreads`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("videoId", id);
      url.searchParams.set("maxResults", String(PER_VIDEO));
      url.searchParams.set("order", order);
      url.searchParams.set("textFormat", "plainText");
      url.searchParams.set("fields", "items(snippet/topLevelComment(id,snippet(textOriginal,textDisplay,likeCount,publishedAt,authorDisplayName)))");
      url.searchParams.set("key", key);
      return getOnce(`youtube:${id}:${order}`, opts, () => getJson<CommentThreadsResponse>(url.toString(), { signal: opts.signal }));
    };
    const convert = (res: CommentThreadsResponse): SourceItem[] => (res.items ?? []).flatMap((t) => {
      const comment = t.snippet?.topLevelComment;
      const c = comment?.snippet;
      const text = c?.textOriginal ?? c?.textDisplay;
      if (!text?.trim() || !comment?.id || !inWindow(c?.publishedAt, opts.from, opts.to)) return [];
      return [{
        id: `youtube:comment:${comment.id}`, source: "youtube", kind: "comment", text, parentId: `youtube:video:${id}`,
        author: c?.authorDisplayName, url: `https://www.youtube.com/watch?v=${id}&lc=${comment.id}`, publishedAt: c?.publishedAt, engagement: c?.likeCount,
      }];
    });
    try {
      const selected = new Map<string, SourceItem>();
      for (const item of (opts.previousItems ?? []).filter((item) => item.parentId === `youtube:video:${id}`)) selected.set(item.id, item);
      /* An old video's top comments can also be old, so its recent comments
         are requested at the same time rather than after the top ones arrive. */
      const recent = read("time").then((res) => ({ res }), (err: unknown) => ({ err }));
      const pool = new Map<string, SourceItem>();
      for (const item of convert(await read("relevance"))) if (!selected.has(item.id)) pool.set(item.id, item);
      if (selected.size + pool.size < PER_VIDEO) {
        const outcome = await recent;
        if ("res" in outcome) {
          for (const item of convert(outcome.res)) if (!selected.has(item.id)) pool.set(item.id, item);
        } else {
          failures.push(reasonFor(outcome.err, opts.signal.aborted));
        }
      }
      for (const item of [...pool.values()].sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))) {
        if (selected.size >= PER_VIDEO) break;
        selected.set(item.id, item);
      }
      return [...selected.values()];
    } catch (err) {
      failures.push(reasonFor(err, opts.signal.aborted));
      return [];
    }
  });
  for (const batch of await Promise.all(runs)) items.push(...batch);

  const count = items.filter((item) => item.kind === "comment").length;
  const shortfall = count < MAX_VIDEOS * PER_VIDEO;
  const notes = [
    shortfall ? `Read ${count} of up to ${MAX_VIDEOS * PER_VIDEO} comments from ${videos.length} of ${MAX_VIDEOS} matching videos, filtered to the search window.` : "",
    failures.length ? `${failures.length} comment sections could not be read. ${[...new Set(failures)].join(" ")}` : "",
  ].filter(Boolean);
  return {
    items,
    canExpand: videos.length > 0 && failures.length < videos.length,
    status: { source: "youtube", availability: count === 0 ? "unavailable" : shortfall ? "partial" : "ok", itemsAnalysed: count, ...(notes.length ? { note: notes.join(" ") } : {}) },
  };
}

export const youtube: Connector = { id: "youtube", configured: () => Boolean(env("YOUTUBE_API_KEY")), collect };
