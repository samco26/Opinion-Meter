/* Reddit through its OAuth Data API, once the application for this project
   is approved. A client-credentials token, one search (by name, or by link
   with the url: filter for an article), then the top comments on each
   post. Read-only; usernames stay on the server for attribution and never
   reach the AI. */

import type { SourceItem } from "../types";
import { env, envInt } from "../env";
import { getJson, getOnce, inWindow, reasonFor, statusFor, type Collected, type CollectOptions, type Connector } from "../http";

const AUTH = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";

interface Listing<T> { data?: { children?: Array<{ kind?: string; data?: T }> } }
interface Post { id?: string; title?: string; selftext?: string; author?: string; subreddit?: string; score?: number; created_utc?: number; permalink?: string; over_18?: boolean }
interface Comment { id?: string; body?: string; score?: number; created_utc?: number; permalink?: string; author?: string; subreddit?: string }

const attribution = (author?: string, subreddit?: string) =>
  [author ? `u/${author}` : undefined, subreddit ? `r/${subreddit}` : undefined].filter(Boolean).join(" · ") || undefined;
const isoFromUtc = (s?: number) => (typeof s === "number" ? new Date(s * 1000).toISOString() : undefined);

async function token(signal: AbortSignal, agent: string): Promise<string> {
  const basic = Buffer.from(`${env("REDDIT_CLIENT_ID")}:${env("REDDIT_CLIENT_SECRET")}`).toString("base64");
  const res = await getJson<{ access_token?: string }>(AUTH, {
    method: "POST", signal, body: "grant_type=client_credentials",
    headers: { Authorization: `Basic ${basic}`, "User-Agent": agent, "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.access_token) throw new Error("Reddit returned no token.");
  return res.access_token;
}

/* The url: filter matches on host and path, so tracking parameters never matter. */
export function linkQuery(link: string): string {
  const u = new URL(link);
  return `url:${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
}

async function collect(opts: CollectOptions): Promise<Collected> {
  const agent = env("REDDIT_USER_AGENT") ?? "";
  const maxPosts = envInt("REDDIT_MAX_POSTS", 10, 1, 100);
  const perPost = envInt("REDDIT_COMMENTS_PER_POST", 12, 1, 50);
  const bearer = await getOnce("reddit:token", opts, () => token(opts.signal, agent));
  const headers = { Authorization: `bearer ${bearer}`, "User-Agent": agent };

  const search = new URL(`${API}/search`);
  search.searchParams.set("q", opts.link ? linkQuery(opts.link) : opts.subject);
  search.searchParams.set("sort", "relevance");
  search.searchParams.set("t", opts.from && opts.to && opts.to.getTime() - opts.from.getTime() <= 366 * 86_400_000 ? "year" : "all");
  search.searchParams.set("limit", String(maxPosts));
  search.searchParams.set("type", "link");
  search.searchParams.set("raw_json", "1");

  const found = await getOnce(search.toString(), opts, () => getJson<Listing<Post>>(search.toString(), { signal: opts.signal, headers }));
  const posts = (found.data?.children ?? [])
    .map((c) => c.data)
    .filter((p): p is Post => Boolean(p && p.id && p.title) && !p!.over_18)
    .filter((p) => inWindow(isoFromUtc(p.created_utc), opts.from, opts.to));

  const items: SourceItem[] = posts.map((p) => ({
    id: `reddit:post:${p.id}`, source: "reddit", kind: "thread", text: `${p.title}\n${p.selftext ?? ""}`.trim(), title: p.title,
    author: attribution(p.author, p.subreddit), url: p.permalink ? `https://www.reddit.com${p.permalink}` : undefined,
    publishedAt: isoFromUtc(p.created_utc), engagement: p.score,
  }));

  const failures: string[] = [];
  const runs = posts.map(async (p) => {
    const url = new URL(`${API}/comments/${p.id}`);
    url.searchParams.set("sort", "top");
    url.searchParams.set("limit", String(perPost));
    url.searchParams.set("depth", "1");
    url.searchParams.set("raw_json", "1");
    try {
      const res = await getOnce(url.toString(), opts, () => getJson<Array<Listing<Comment>>>(url.toString(), { signal: opts.signal, headers }));
      return (res[1]?.data?.children ?? [])
        .filter((c) => c.kind === "t1" && c.data?.body && c.data.id && c.data.body !== "[deleted]" && c.data.body !== "[removed]")
        .map((c) => c.data!)
        .filter((c) => inWindow(isoFromUtc(c.created_utc), opts.from, opts.to))
        .map((c): SourceItem => ({
          id: `reddit:comment:${c.id}`, source: "reddit", kind: "comment", text: c.body ?? "", parentId: `reddit:post:${p.id}`,
          author: attribution(c.author, c.subreddit ?? p.subreddit), url: c.permalink ? `https://www.reddit.com${c.permalink}` : undefined,
          publishedAt: isoFromUtc(c.created_utc), engagement: c.score,
        }));
    } catch (error) {
      failures.push(reasonFor(error, opts.signal.aborted));
      return [] as SourceItem[];
    }
  });
  for (const batch of await Promise.all(runs)) items.push(...batch);

  const asked = maxPosts + maxPosts * perPost;
  const note = [
    `Read ${items.length} of up to ${asked} Reddit posts and comments from ${posts.length} matching threads, filtered to the search window.`,
    failures.length ? `${failures.length} comment sections could not be read. ${[...new Set(failures)].join(" ")}` : "",
  ].filter(Boolean).join(" ");
  return { items, canExpand: posts.length === 0 || failures.length < posts.length, status: { ...statusFor("reddit", items.length, asked), note } };
}

export const reddit: Connector = {
  id: "reddit",
  configured: () => Boolean(env("REDDIT_CLIENT_ID") && env("REDDIT_CLIENT_SECRET") && env("REDDIT_USER_AGENT")),
  collect,
};
