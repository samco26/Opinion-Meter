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
- Use the official canonical name people would search for, in normal capitalisation, without the year, the site name, "review", or marketing words: "Sony WH-1000XM6", not "Sony XM6 headphones". Write every name the way it is usually written: "iPhone" for "iphone", "Peptides" for a topic typed as "peptides".
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

/* What the memory already knows, without asking the model: a subject, null
   (named before: nothing ratable), or undefined (never named). */
export async function cachedQueryName(query: string): Promise<Subject | null | undefined> {
  const stored = await memory().get<Stored>(queryKey(query));
  return stored ? stored.subject : undefined;
}
export async function cachedSiteNames(hosts: string[]): Promise<Map<string, Subject | null | undefined>> {
  const m = memory();
  const stored = await Promise.all(hosts.map((host) => m.get<Stored>(`name:site:${host}`)));
  return new Map(hosts.map((host, index) => [host, stored[index] ? stored[index]!.subject : undefined]));
}

export function toSubject(kind: string, name: string, url?: string, forQuery = false): Subject | null {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!(forQuery ? NAMEABLE_QUERY : NAMEABLE_RESULT).has(kind) || !clean) return null;
  if (kind === "article") {
    const link = url ? normaliseUrl(url) : null;
    return link ? subject(clean, "article", `url:${hashKey(link)}`, link) : null;
  }
  return subject(clean, kind as SubjectKind);
}

export interface Naming { query: Subject | null; results: Map<number, Subject | null> }

/* Sites the table in subject.ts does not know: named by the model from the
   address and the label Google prints, disambiguated by country where names
   clash (abc.net.au and abcnews.go.com are different ABC News). Remembered
   per host for a day. */
const SiteName = z.object({ host: z.string(), name: z.string(), kind: z.enum(["company", "app", "entity"]), aliases: z.array(z.string()) });
const SiteNames = z.object({ sites: z.array(SiteName) });
const SITE_INSTRUCTIONS = `You name the website or organisation behind each web address, the way people refer to it, so that public discussion of it can be looked up.

Rules:
- Use the name people actually use, in its current official form and usual capitalisation: "Medical News Today", "eSafety Commissioner", "Britannica".
- Where the same name belongs to different organisations in different countries, tell them apart by the address: abc.net.au is "ABC News (Australia)", the Australian Broadcasting Corporation; abcnews.go.com is "ABC News (US)"; bbc.co.uk is "BBC".
- kind: company for a business or organisation, app for an online service or app, entity for anything else.
- aliases: up to two other names discussion uses for the same site ("Australian Broadcasting Corporation", "ABC Australia"); an empty list when there are none.
- Return every host you were given, once.`;

export async function nameSites(sites: Array<{ host: string; label?: string; title?: string }>, timeoutMs: number): Promise<Map<string, Subject | null>> {
  const m = memory();
  const out = new Map<string, Subject | null>();
  const stored = await Promise.all(sites.map((site) => m.get<Stored>(`name:site:${site.host}`)));
  const pending = sites.filter((site, index) => {
    const known = stored[index];
    if (known) out.set(site.host, known.subject);
    return !known;
  });
  if (!pending.length || !configured.openai()) return out;
  try {
    const res = await structured(SiteNames, "site_names", SITE_INSTRUCTIONS,
      `Sites (JSON lines):\n${pending.map((site) => JSON.stringify(site)).join("\n")}`,
      { model: liteModel(), maxTokens: 800, timeoutMs });
    const byHost = new Map(res.sites.map((site) => [site.host, site]));
    await Promise.all(pending.map(async (site) => {
      const named = byHost.get(site.host);
      const clean = named?.name.replace(/\s+/g, " ").trim();
      const aliases = named ? [...new Set(named.aliases.map((alias) => alias.replace(/\s+/g, " ").trim()).filter((alias) => alias && alias.toLowerCase() !== clean?.toLowerCase()))].slice(0, 2) : [];
      const found = named && clean ? { ...subject(clean, named.kind), ...(aliases.length ? { aliases } : {}) } : null;
      out.set(site.host, found);
      await m.set(`name:site:${site.host}`, { subject: found }, TTL);
    }));
  } catch (err) {
    console.error("Site naming failed", err instanceof Error ? err.message : err);
  }
  return out;
}

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
