/* Hacker News through Algolia's public search API: no key, generous
   limits. Stories by name (or by link for an article), then the top
   comments on each. Comment text arrives as HTML and is flattened. */

import type { SourceItem } from "../types";
import { getJson, getOnce, inWindow, reasonFor, statusFor, stripHtml, type Collected, type CollectOptions, type Connector } from "../http";

const API = "https://hn.algolia.com/api/v1/search";
const MAX_STORIES = 8;
const PER_STORY = 12;

interface Hits<T> { hits?: T[] }
interface Story { objectID?: string; title?: string; url?: string; author?: string; points?: number; created_at?: string; story_text?: string }
interface Comment { objectID?: string; comment_text?: string; author?: string; points?: number | null; created_at?: string }

const item = (id: string) => `https://news.ycombinator.com/item?id=${id}`;

async function collect(opts: CollectOptions): Promise<Collected> {
  const search = new URL(API);
  if (opts.link) {
    const u = new URL(opts.link);
    search.searchParams.set("query", `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`);
    search.searchParams.set("restrictSearchableAttributes", "url");
  } else {
    search.searchParams.set("query", opts.subject);
  }
  search.searchParams.set("tags", "story");
  search.searchParams.set("hitsPerPage", String(MAX_STORIES));
  if (opts.from) search.searchParams.set("numericFilters", `created_at_i>=${Math.floor(opts.from.getTime() / 1000)}`);

  const found = await getOnce(search.toString(), opts, () => getJson<Hits<Story>>(search.toString(), { signal: opts.signal }));
  const stories = (found.hits ?? []).filter((s): s is Story & { objectID: string; title: string } => Boolean(s.objectID && s.title));
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
  const note = [
    `Read ${items.length} Hacker News stories and comments from ${stories.length} matching threads.`,
    failures.length ? `${failures.length} comment sections could not be read. ${[...new Set(failures)].join(" ")}` : "",
  ].filter(Boolean).join(" ");
  return { items, canExpand: stories.length === 0 || failures.length < stories.length, status: { ...statusFor("hn", items.length, asked), note } };
}

export const hn: Connector = { id: "hn", configured: () => true, collect };
