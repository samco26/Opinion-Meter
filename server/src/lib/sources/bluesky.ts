/* Bluesky: the public AppView when it will answer, or a signed-in session
   with an app password when one is configured (the public search door
   sometimes refuses server requests). Posts by name — the most-liked and
   the newest — or posts that link to a page or to a website. Each post is
   one opinion. */

import type { SourceItem } from "../types";
import { env } from "../env";
import { normaliseUrl } from "../subject";
import { getJson, getOnce, HttpError, inWindow, statusFor, type Collected, type CollectOptions, type Connector } from "../http";

const PUBLIC_API = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const PDS = "https://bsky.social/xrpc";
const PAGE = 100;
/* Most-liked pages per reading; the newest get one page. */
const TOP_PAGES = { lite: 1, full: 5 } as const;
const LATEST_PAGES = 1;

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

interface Query { q: string; sort: "top" | "latest"; url?: string; domain?: string; pages: number }
type Session = { token: string; expires: number };
const shared = globalThis as unknown as { __blueskySession?: Promise<Session> };

export const blueskyLogin = () => Boolean(env("BLUESKY_IDENTIFIER") && env("BLUESKY_APP_PASSWORD"));

/* One signed-in session per server instance, renewed well before it expires. */
async function session(signal: AbortSignal): Promise<Session | null> {
  const identifier = env("BLUESKY_IDENTIFIER"), password = env("BLUESKY_APP_PASSWORD");
  if (!identifier || !password) return null;
  const cached = await shared.__blueskySession?.catch(() => null);
  if (cached && cached.expires > Date.now()) return cached;
  shared.__blueskySession = (async () => {
    const res = await fetch(`${PDS}/com.atproto.server.createSession`, { method: "POST", cache: "no-store", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
    if (!res.ok) throw new HttpError(res.status, `${res.status} from bsky.social`, "Bluesky sign-in failed.");
    const data = (await res.json()) as { accessJwt?: string };
    if (!data.accessJwt) throw new Error("Bluesky sign-in returned no token.");
    return { token: data.accessJwt, expires: Date.now() + 90 * 60_000 };
  })();
  return shared.__blueskySession;
}

function convert(res: SearchResponse, opts: CollectOptions): SourceItem[] {
  return (res.posts ?? []).flatMap((p): SourceItem[] => {
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
}

async function collect(opts: CollectOptions): Promise<Collected> {
  const auth = await session(opts.signal).catch(() => null);
  const base = auth ? `${PDS}/app.bsky.feed.searchPosts` : PUBLIC_API;
  const headers = auth ? { Authorization: `Bearer ${auth.token}` } : undefined;
  const top = opts.depth === "full" ? TOP_PAGES.full : TOP_PAGES.lite;
  const queries: Query[] = opts.link
    ? [{ q: new URL(opts.link).hostname.replace(/^www\./, ""), sort: "top", url: opts.link, pages: top }]
    : opts.domain
      ? [{ q: opts.domain, sort: "top", domain: opts.domain, pages: top }, { q: opts.subject, sort: "latest", domain: opts.domain, pages: LATEST_PAGES }]
      : [{ q: opts.subject, sort: "top", pages: top }, { q: opts.subject, sort: "latest", pages: LATEST_PAGES }];

  const selected = new Map<string, SourceItem>();
  let limited = false, failure = "", refused = false;
  for (const query of queries) {
    const url = new URL(base);
    url.searchParams.set("q", query.q);
    url.searchParams.set("sort", query.sort);
    url.searchParams.set("limit", String(PAGE));
    url.searchParams.set("lang", "en");
    if (query.url) url.searchParams.set("url", query.url);
    if (query.domain) url.searchParams.set("domain", query.domain);
    if (opts.from) url.searchParams.set("since", opts.from.toISOString());
    if (opts.to) url.searchParams.set("until", opts.to.toISOString());
    const cursors = new Set<string>();
    for (let page = 0; page < query.pages; page++) {
      let res: SearchResponse;
      try { res = await getOnce(url.toString(), opts, () => getJson<SearchResponse>(url.toString(), { signal: opts.signal, headers })); }
      catch (err) {
        if (err instanceof HttpError && (err.status === 401 || err.status === 403)) { refused = true; break; }
        if (!selected.size) throw err;
        failure = opts.signal.aborted ? "Time limit reached; retained earlier pages." : "A later page was unavailable; retained earlier pages.";
        break;
      }
      for (const item of convert(res, opts)) selected.set(item.id, item);
      if (res.cursor) limited = true;
      if (!res.cursor || cursors.has(res.cursor) || !res.posts?.length) break;
      cursors.add(res.cursor);
      url.searchParams.set("cursor", res.cursor);
    }
    if (refused || opts.signal.aborted) break;
  }

  const items = [...selected.values()];
  if (refused && !items.length) {
    const note = auth
      ? "Bluesky refused the signed-in search. Check the app password in BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD."
      : "Bluesky's public search door refused the request. Sign the server in with a Bluesky app password (BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD) to read Bluesky.";
    return { items, canExpand: false, status: { source: "bluesky", availability: "unavailable", itemsAnalysed: 0, note } };
  }
  const how = `most-liked and newest posts, ${PAGE} per page${opts.depth === "full" ? ", up to five pages of most-liked across all dates" : ""}${auth ? ", signed in" : ""}`;
  return {
    items, canExpand: true,
    status: { ...statusFor("bluesky", items.length, PAGE), ...(failure || limited ? { availability: items.length ? "partial" as const : "unavailable" as const } : {}), note: `Collected ${items.length} Bluesky posts (${how}). ${failure || (limited ? "More matches may exist beyond the pages read." : "Reached the end of the returned results.")}` },
  };
}

export const bluesky: Connector = { id: "bluesky", configured: () => true, collect };
