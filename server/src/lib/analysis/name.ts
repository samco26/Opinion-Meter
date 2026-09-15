/* The batched naming call: the query and every result no rule could
   name go to the model once per page, and come back as canonical
   subject names, or as nothing. Anyone and anything named can be a
   subject; only pages about nothing in particular name nothing. Answers are
   remembered for a week, keyed by the result, so a page seen before
   costs nothing. */

import { z } from "zod";
import { liteModel, structured } from "../ai";
import { configured } from "../env";
import { memory } from "../memory";
import { hashKey, normaliseUrl, queryFallback, subject, type RawResult } from "../subject";
import type { Subject, SubjectKind } from "../types";

const Kind = z.enum(["product", "film", "app", "place", "game", "book", "tool", "company", "article", "entity", "person", "topic", "none"]);
const Named = z.object({
  query: z.object({ kind: Kind, name: z.string(), aliases: z.array(z.string()) }),
  results: z.array(z.object({ i: z.number().int(), kind: Kind, name: z.string() })),
});

const INSTRUCTIONS = `You name the one specific thing a web search, and each of its results, is about, so that public discussion of that thing can be looked up.

Rules:
- A subject is one specific named thing that has its own listing somewhere: a product or model (product), a film, series or album (film), a game (game), a book (book), an app or online service (app), a venue or chain (place), a software library or developer tool (tool), a company or brand (company), or one particular news article or blog post (article). Anything else that is a single named thing is entity.
- A review, comparison, guide or news story ABOUT a thing names that thing, not the page: "Sony WH-1000XM6 review: still the best" is the product Sony WH-1000XM6.
- Use the official canonical name people would search for, in normal capitalisation, without the year, the site name, "review", or marketing words: "Sony WH-1000XM6", not "Sony XM6 headphones".
- A site's front page (an address with no path, like x.com or netflix.com), an app-store listing and a shop's page for a service or product all name that service or product by its current official name, in its current form: "X", not "X (Formerly Twitter)" and not "Twitter"; "Netflix", not "Netflix Australia". A business is company; an app or online service is app.
- A broad class, a how-to, a generic question or a list ("best headphones 2026", "how to boil eggs", "smartphones") is topic. A page that is about nothing in particular (a login page, a category page, a search page) is none.
- A named individual, living or dead, is person, named as they are publicly known ("Francis Bourgeois"). Never return a person under any other kind.
- For the query, do the same with the words the person typed: "sony xm6 review" is the product Sony WH-1000XM6; "how to boil eggs" is topic.
- For the query also give aliases: up to two other names that discussion uses for the same thing, so that searches find it — "Twitter" for X, "XM6" for Sony WH-1000XM6, "Play Store" for Google Play. An empty list when there are none. Never a different thing.
- Return every result index you were given, once.`;

const TTL = 86_400;
/* A result page that is a list or a how-to is not a thing people have
   views on; the same words typed as the query are, so topic counts there. */
const NAMEABLE_RESULT = new Set<string>(["product", "film", "app", "place", "game", "book", "tool", "company", "article", "entity", "person"]);
const NAMEABLE_QUERY = new Set<string>([...NAMEABLE_RESULT, "topic"]);
type Stored = { subject: Subject | null };

const resultKey = (r: RawResult) => `name:r:${hashKey(`${r.url}|${r.title}`)}`;
const queryKey = (query: string) => `name:q2:${hashKey(query.toLowerCase().trim())}`;

function toSubject(kind: string, name: string, url?: string, forQuery = false): Subject | null {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!(forQuery ? NAMEABLE_QUERY : NAMEABLE_RESULT).has(kind) || !clean) return null;
  if (kind === "article") {
    const link = url ? normaliseUrl(url) : null;
    return link ? subject(clean, "article", `url:${hashKey(link)}`, link) : null;
  }
  return subject(clean, kind as SubjectKind);
}

export interface Naming { query: Subject | null; results: Map<number, Subject | null> }

export async function nameSubjects(query: string, unknown: Array<RawResult & { i: number }>, timeoutMs: number): Promise<Naming> {
  const m = memory();
  const results = new Map<number, Subject | null>();
  const [storedQuery, ...storedResults] = await Promise.all([m.get<Stored>(queryKey(query)), ...unknown.map((r) => m.get<Stored>(resultKey(r)))]);
  const pending = unknown.filter((r, index) => {
    const stored = storedResults[index];
    if (stored) results.set(r.i, stored.subject);
    return !stored;
  });
  let querySubject = storedQuery?.subject;
  if (storedQuery && !pending.length) return { query: querySubject ?? null, results };

  if (!configured.openai()) {
    for (const r of pending) results.set(r.i, null);
    return { query: storedQuery ? querySubject ?? null : queryFallback(query), results };
  }
  try {
    const out = await structured(Named, "subject_names", INSTRUCTIONS,
      `Query: ${JSON.stringify(query)}\nResults (JSON lines):\n${pending.map((r) => JSON.stringify({ i: r.i, title: r.title, url: r.url, snippet: r.snippet ?? "" })).join("\n")}`,
      { model: liteModel(), maxTokens: 1200, timeoutMs });
    const byIndex = new Map(out.results.map((r) => [r.i, r]));
    const writes: Array<Promise<void>> = [];
    for (const r of pending) {
      const named = byIndex.get(r.i);
      const found = named ? toSubject(named.kind, named.name, r.url) : null;
      results.set(r.i, found);
      writes.push(m.set(resultKey(r), { subject: found }, TTL));
    }
    if (!storedQuery) {
      querySubject = toSubject(out.query.kind, out.query.name, undefined, true);
      const aliases = [...new Set(out.query.aliases.map((alias) => alias.replace(/\s+/g, " ").trim()).filter((alias) => alias && alias.toLowerCase() !== out.query.name.trim().toLowerCase()))].slice(0, 2);
      if (querySubject && aliases.length) querySubject = { ...querySubject, aliases };
      writes.push(m.set(queryKey(query), { subject: querySubject }, TTL));
    }
    await Promise.all(writes);
  } catch (err) {
    console.error("Naming failed", err instanceof Error ? err.message : err);
    for (const r of pending) if (!results.has(r.i)) results.set(r.i, null);
  }
  return { query: querySubject ?? null, results };
}
