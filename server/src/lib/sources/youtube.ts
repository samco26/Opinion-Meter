/* YouTube Data API v3 with an API key: a video search by views for every
   name the subject goes by (one call, "X | Twitter"), then the comments
   on each video — a full page of the most relevant, a page of the newest
   when that page came back short, and more pages for the full card. A
   linked video's own comments are read several pages deep. Titles and
   descriptions are context; the comments are the opinions.

   A search costs 100 of the free 10,000 daily quota units and a comment
   page 1, so the list of videos found for a subject is remembered for a
   day: the bar, the prefetched card and a later drawer share one search. */

import type { SourceItem } from "../types";
import { env } from "../env";
import { memory } from "../memory";
import { hashKey } from "../subject";
import { getJson, getOnce, HttpError, inWindow, reasonFor, searchTerms, tidy, type Collected, type CollectOptions, type Connector } from "../http";

const API = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 20;
const PER_PAGE = 100;
/* Pages of most-relevant comments per video, by tier; a linked video's own comments. */
const PAGES = { lite: 1, full: 2 } as const;
const LINKED_VIDEO_PAGES = 5;
const SEARCH_TTL = 86_400;
const QUOTA_NOTE = "YouTube's free daily reading quota is used up; it resets at midnight Pacific time (5 pm Sydney time).";

interface Video { id?: { videoId?: string }; snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string } }
interface SearchResponse { items?: Video[] }

interface CommentThreadsResponse {
  nextPageToken?: string;
  items?: Array<{ snippet?: { topLevelComment?: { id?: string; snippet?: { textOriginal?: string; textDisplay?: string; likeCount?: number; publishedAt?: string; authorDisplayName?: string } } } }>;
}

export function youtubeVideoId(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link), host = u.hostname.replace(/^(www|m)\./, "");
    const id = host === "youtu.be" ? u.pathname.slice(1) : host === "youtube.com" ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]) : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

const quotaExhausted = (err: unknown) => err instanceof HttpError && (err.status === 403 || err.status === 429) && /quota|limit/i.test(err.detail ?? "");

/* The videos for a subject: from memory when found today, else one search. */
async function findVideos(q: string, key: string, opts: CollectOptions): Promise<Video[]> {
  const m = memory();
  const memoKey = `yt:videos:${hashKey(q)}`;
  const held = await m.get<Video[]>(memoKey).catch(() => null);
  if (held) return held;
  const search = new URL(`${API}/search`);
  search.searchParams.set("part", "snippet");
  search.searchParams.set("type", "video");
  search.searchParams.set("q", q);
  search.searchParams.set("maxResults", String(MAX_VIDEOS));
  search.searchParams.set("order", "viewCount");
  search.searchParams.set("fields", "items(id/videoId,snippet(title,description,publishedAt,channelTitle))");
  search.searchParams.set("relevanceLanguage", "en");
  search.searchParams.set("safeSearch", "moderate");
  search.searchParams.set("key", key);
  const found = await getOnce(`youtube:videos:${q}`, opts, () => getJson<SearchResponse>(search.toString(), { signal: opts.signal }));
  const videos = (found.items ?? []).filter((v) => v.id?.videoId && v.snippet);
  await m.set(memoKey, videos, SEARCH_TTL).catch(() => undefined);
  return videos;
}

async function collect(opts: CollectOptions): Promise<Collected> {
  const key = env("YOUTUBE_API_KEY") ?? "";
  const linked = youtubeVideoId(opts.link);
  const q = searchTerms(opts).join(" | ");
  const failures: string[] = [];
  let videos: Video[] = [];
  try {
    videos = await findVideos(q, key, opts);
  } catch (err) {
    /* A linked video can still be read when the search itself fails. */
    if (!linked) return { items: [], canExpand: false, status: { source: "youtube", availability: "unavailable", itemsAnalysed: 0, note: quotaExhausted(err) ? QUOTA_NOTE : reasonFor(err, opts.signal.aborted) } };
    failures.push(quotaExhausted(err) ? QUOTA_NOTE : reasonFor(err, opts.signal.aborted));
  }
  videos = videos.slice();
  if (linked && !videos.some((v) => v.id?.videoId === linked)) videos.unshift({ id: { videoId: linked }, snippet: { title: opts.subject } });
  const items: SourceItem[] = videos.map((v) => ({
    id: `youtube:video:${v.id!.videoId}`, source: "youtube", kind: "video",
    text: tidy(`${v.snippet!.title ?? ""}. ${v.snippet!.description ?? ""}`, 600),
    title: v.snippet!.title, author: v.snippet!.channelTitle,
    url: `https://www.youtube.com/watch?v=${v.id!.videoId}`, publishedAt: v.snippet!.publishedAt,
  }));

  let disabled = 0, quota = false;
  const pagesPerVideo = opts.depth === "full" ? PAGES.full : PAGES.lite;
  const runs = videos.map(async (v) => {
    const id = v.id!.videoId!;
    const pages = id === linked ? LINKED_VIDEO_PAGES : pagesPerVideo;
    const read = (order: "relevance" | "time", pageToken?: string) => {
      const url = new URL(`${API}/commentThreads`);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("videoId", id);
      url.searchParams.set("maxResults", String(PER_PAGE));
      url.searchParams.set("order", order);
      url.searchParams.set("textFormat", "plainText");
      url.searchParams.set("fields", "nextPageToken,items(snippet/topLevelComment(id,snippet(textOriginal,textDisplay,likeCount,publishedAt,authorDisplayName)))");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      url.searchParams.set("key", key);
      return getOnce(`youtube:${id}:${order}:${pageToken ?? ""}`, opts, () => getJson<CommentThreadsResponse>(url.toString(), { signal: opts.signal }));
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
      /* An old video's top comments can also be old, so its newest comments
         are requested at the same time rather than after the top ones arrive. */
      const recent = read("time").then((res) => ({ res }), (err: unknown) => ({ err }));
      const pool = new Map<string, SourceItem>();
      let token: string | undefined;
      for (let page = 0; page < pages; page++) {
        const res = await read("relevance", token);
        for (const item of convert(res)) if (!selected.has(item.id)) pool.set(item.id, item);
        token = res.nextPageToken;
        if (!token) break;
      }
      if (selected.size + pool.size < PER_PAGE * pages) {
        const outcome = await recent;
        if ("res" in outcome) {
          for (const item of convert(outcome.res)) if (!selected.has(item.id)) pool.set(item.id, item);
        } else if (quotaExhausted(outcome.err)) {
          quota = true;
        } else if (!(outcome.err instanceof HttpError && outcome.err.status === 403)) {
          failures.push(reasonFor(outcome.err, opts.signal.aborted));
        }
      }
      for (const item of [...pool.values()].sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))) {
        if (selected.size >= PER_PAGE * pages) break;
        selected.set(item.id, item);
      }
      return [...selected.values()];
    } catch (err) {
      /* Comments switched off on the video answer 403 with a plain reason. */
      if (quotaExhausted(err)) quota = true;
      else if (err instanceof HttpError && err.status === 403 && /disabled/i.test(err.detail ?? "")) disabled++;
      else failures.push(reasonFor(err, opts.signal.aborted));
      return [];
    }
  });
  for (const batch of await Promise.all(runs)) items.push(...batch);

  const count = items.filter((item) => item.kind === "comment").length;
  const asked = Math.max(1, videos.length) * PER_PAGE * pagesPerVideo;
  const terms = searchTerms(opts);
  const notes = [
    `Read ${count} comments from ${videos.length} of up to ${MAX_VIDEOS} matching videos${terms.length > 1 ? ` (searched ${terms.join(", ")})` : ""} (up to ${PER_PAGE * pagesPerVideo} per video, most relevant first, plus the newest when a video came back short${linked ? `; the linked video's own comments up to ${PER_PAGE * LINKED_VIDEO_PAGES}` : ""}), filtered to the search window.`,
    quota ? QUOTA_NOTE : "",
    disabled ? `${disabled} of the videos have comments turned off.` : "",
    failures.length ? `${failures.length} requests could not be read. ${[...new Set(failures)].join(" ")}` : "",
  ].filter(Boolean);
  return {
    items,
    canExpand: videos.length > 0 && failures.length < videos.length && !quota,
    status: { source: "youtube", availability: count === 0 ? "unavailable" : count < asked / 3 ? "partial" : "ok", itemsAnalysed: count, ...(notes.length ? { note: notes.join(" ") } : {}) },
  };
}

export const youtube: Connector = { id: "youtube", configured: () => Boolean(env("YOUTUBE_API_KEY")), collect };
