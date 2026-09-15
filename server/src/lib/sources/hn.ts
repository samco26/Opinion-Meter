/* Hacker News through Algolia's public search API: no key, generous
   limits. Stories by name — every name the subject goes by — or by link
   for an article, then the top comments on each. Comment text arrives as
   HTML and is flattened. */

import type { SourceItem } from "../types";
import { normaliseUrl } from "../subject";
import { getJson, getOnce, inWindow, reasonFor, searchTerms, statusFor, stripHtml, type Collected, type CollectOptions, type Connector } from "../http";

const API = "https://hn.algolia.com/api/v1/search";
const MAX_STORIES = 15;
const PER_STORY = 30;
/* Stories kept when several names were searched, most-pointed first. */
const MERGED_STORIES = 24;

interface Hits<T> { hits?: T[]; nbPages?: number; nbHits?: number }
interface Story { objectID?: string; title?: string; url?: string; author?: string; points?: number; created_at?: string; story_text?: string }
interface Comment { objectID?: string; comment_text?: string; author?: string; points?: number | null; created_at?: string; story_id?: number; story_title?: string }

const item = (id: string) => `https://news.ycombinator.com/item?id=${id}`;
const linkQuery = (link: string) => { const u = new URL(link); return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`; };
const since = (opts: CollectOptions) => (opts.from ? { numericFilters: `created_at_i>=${Math.floor(opts.from.getTime() / 1000)}` } : {});

/* What to search for: the link, the website, or every name of the subject. */
function queries(opts: CollectOptions): Array<{ query: string; byUrl: boolean }> {
  if (opts.link) return [{ query: linkQuery(opts.link), byUrl: true }];
  if (opts.domain) return [{ query: opts.domain, byUrl: true }];
  return searchTerms(opts).map((term) => ({ query: term, byUrl: false }));
}

async function collect(opts: CollectOptions): Promise<Collected> {
  if (opts.depth === "full") return collectFull(opts);
  const searches = queries(opts).map(({ query, byUrl }) => {
    const search = new URL(API);
    search.searchParams.set("query", query);
    if (byUrl) search.searchParams.set("restrictSearchableAttributes", "url");
    search.searchParams.set("tags", "story");
    search.searchParams.set("hitsPerPage", String(MAX_STORIES));
    for (const [key, value] of Object.entries(since(opts))) search.searchParams.set(key, value);
    return search.toString();
  });
  const found = await Promise.all(searches.map((url) => getOnce(url, opts, () => getJson<Hits<Story>>(url, { signal: opts.signal }))));
  const seen = new Set<string>();
  const stories = found.flatMap((res) => res.hits ?? [])
    .filter((s): s is Story & { objectID: string; title: string } => Boolean(s.objectID && s.title))
    .filter((s) => !seen.has(s.objectID) && seen.add(s.objectID))
    .filter((s) => !opts.link || (s.url && normaliseUrl(s.url) === normaliseUrl(opts.link)))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, MERGED_STORIES);
  const items: SourceItem[] = stories.map((s) => ({
    id: `hn:story:${s.objectID}`, source: "hn", kind: "thread", title: s.title, author: s.author, url: item(s.objectID),
    text: `${s.title}\n${s.story_text ? stripHtml(s.story_text) : ""}`.trim(), publishedAt: s.created_at, engagement: s.points,
  }));

  const failures: string[] = [];
  const runs = stories.map(async (s) => {
    const url = new URL(API);
    url.searchParams.set("tags", `comment,story_${s.objectID}`);
    url.searchParams.set("hitsPerPage", String(PER_STORY));
    try {
      const res = await getOnce(url.toString(), opts, () => getJson<Hits<Comment>>(url.toString(), { signal: opts.signal }));
      return (res.hits ?? [])
        .filter((c): c is Comment & { objectID: string; comment_text: string } => Boolean(c.objectID && c.comment_text))
        .filter((c) => inWindow(c.created_at, opts.from, opts.to))
        .map((c): SourceItem => ({
          id: `hn:comment:${c.objectID}`, source: "hn", kind: "comment", text: stripHtml(c.comment_text), parentId: `hn:story:${s.objectID}`,
          author: c.author, url: item(c.objectID), publishedAt: c.created_at, engagement: c.points ?? 0,
        }))
        .filter((c) => c.text.length > 0);
    } catch (error) {
      failures.push(reasonFor(error, opts.signal.aborted));
      return [] as SourceItem[];
    }
  });
  for (const batch of await Promise.all(runs)) items.push(...batch);

  const asked = MAX_STORIES + MAX_STORIES * PER_STORY;
  const terms = searchTerms(opts);
  const note = [
    `Read ${items.length} Hacker News stories and comments from ${stories.length} matching threads${!opts.link && !opts.domain && terms.length > 1 ? ` (searched ${terms.join(", ")})` : ""}.`,
    failures.length ? `${failures.length} comment sections could not be read. ${[...new Set(failures)].join(" ")}` : "",
  ].filter(Boolean).join(" ");
  return { items, canExpand: stories.length === 0 || failures.length < stories.length, status: { ...statusFor("hn", items.length, asked), note } };
}

/* Algolia exposes at most its configured pagination window (normally
   1,000 hits). Use the largest page over the whole three years in the
   drawer. A separate comment query finds mentions buried in unrelated
   threads. */
async function collectFull(opts: CollectOptions): Promise<Collected> {
  const selected = new Map<string, SourceItem>();
  let limited = false, failure = "";
  const request = async <T>(params: Record<string, string>): Promise<T[]> => {
    const url = new URL(API);
    for (const [key, value] of Object.entries({ ...params, hitsPerPage: "1000", page: "0", ...since(opts) })) url.searchParams.set(key, value);
    const res = await getOnce(url.toString(), opts, () => getJson<Hits<T>>(url.toString(), { signal: opts.signal }));
    if ((res.nbHits ?? 0) > (res.hits?.length ?? 0)) limited = true;
    return res.hits ?? [];
  };
  const addComment = (c: Comment) => {
    if (!c.objectID || !c.comment_text || !inWindow(c.created_at, opts.from, opts.to)) return;
    const text = stripHtml(c.comment_text);
    if (!text) return;
    if (c.story_id && !selected.has(`hn:story:${c.story_id}`)) selected.set(`hn:story:${c.story_id}`, { id: `hn:story:${c.story_id}`, source: "hn", kind: "thread", text: c.story_title ?? "Hacker News discussion", title: c.story_title ?? "Hacker News discussion", url: item(String(c.story_id)) });
    selected.set(`hn:comment:${c.objectID}`, { id: `hn:comment:${c.objectID}`, source: "hn", kind: "comment", text, parentId: c.story_id ? `hn:story:${c.story_id}` : undefined, author: c.author, url: item(c.objectID), publishedAt: c.created_at, engagement: c.points ?? 0 });
  };
  try {
    const seen = new Set<string>();
    const stories: Array<Story & { objectID: string; title: string }> = [];
    for (const { query, byUrl } of queries(opts)) {
      const hits = await request<Story>({ query, tags: "story", ...(byUrl ? { restrictSearchableAttributes: "url" } : {}) });
      for (const s of hits) {
        if (!s.objectID || !s.title || seen.has(s.objectID)) continue;
        if (opts.link && !(s.url && normaliseUrl(s.url) === normaliseUrl(opts.link))) continue;
        seen.add(s.objectID);
        stories.push(s as Story & { objectID: string; title: string });
      }
    }
    for (const s of stories) selected.set(`hn:story:${s.objectID}`, { id: `hn:story:${s.objectID}`, source: "hn", kind: "thread", title: s.title, text: `${s.title}\n${stripHtml(s.story_text ?? "")}`.trim(), author: s.author, url: item(s.objectID), publishedAt: s.created_at, engagement: s.points });
    // Read all matching story IDs in URL-sized groups. Stop when the
    // reading's comment or time budget is reached; report that explicitly.
    let comments = 0;
    for (let offset = 0; offset < stories.length && comments < 1000; offset += 20) {
      const group = stories.slice(offset, offset + 20);
      const found = await request<Comment>({ tags: `comment,(${group.map(s => `story_${s.objectID}`).join(",")})` });
      for (const c of found) { if (comments >= 1000) { limited = true; break; } addComment(c); comments++; }
      if (offset + 20 < stories.length && comments >= 1000) limited = true;
    }
    for (const term of opts.link ? [opts.link] : opts.domain ? [opts.domain] : searchTerms(opts)) {
      if (comments >= 1000) break;
      const mentions = await request<Comment>({ query: term, tags: "comment", restrictSearchableAttributes: "comment_text" });
      for (const c of mentions) {
        if (comments >= 1000) { limited = true; break; }
        if (selected.has(`hn:comment:${c.objectID}`)) continue;
        if (opts.link && !(c.comment_text?.match(/https?:\/\/[^\s<>"']+/g) ?? []).some(url => normaliseUrl(url.replace(/&amp;/g, "&")) === normaliseUrl(opts.link!))) continue;
        addComment(c); comments++;
      }
    }
  } catch (err) {
    if (!selected.size) throw err;
    failure = `${reasonFor(err, opts.signal.aborted)} Earlier results were retained.`;
  }
  const items = [...selected.values()];
  return { items, canExpand: false, status: { source: "hn", availability: !items.length ? "unavailable" : limited || failure ? "partial" : "ok", itemsAnalysed: items.length, note: `Collected ${items.length} Hacker News entries from the last three years. Search requests use up to 1,000 hits; up to 1,000 comments per reading. ${failure || (limited ? "The API or reading budget limited coverage." : "Reached the end of the returned matches.")}` } };
}

export const hn: Connector = { id: "hn", configured: () => true, collect };
