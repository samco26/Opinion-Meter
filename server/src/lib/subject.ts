/* Naming the subject behind a search result without an AI call where a
   rule can: the sites people check for a kind of thing carry the thing's
   identity in their addresses, and a site's front page stands for the
   site itself. Anything else is "ask" (the batched AI call decides) or
   null (a page that is never about one thing). */

import { createHash } from "node:crypto";
import type { Category, Subject, SubjectKind } from "./types";

export interface RawResult { url: string; title: string; snippet?: string }
export type RuleOutcome = Subject | "ask" | null;

export const CATEGORY_OF: Record<SubjectKind, Category> = {
  product: "product", film: "film", app: "app", place: "place", game: "film", book: "film",
  tool: "general", company: "general", article: "general", entity: "general",
};

/* Tracking parameters and mobile prefixes never distinguish two addresses. */
export function normaliseUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^(www|m|amp)\./, "");
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|yclid|mc_|ref$|ref_|si$|feature$|ved$|sr_share)/.test(key)) u.searchParams.delete(key);
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return null;
  }
}

export function slug(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const hashKey = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 16);

export function subject(name: string, kind: SubjectKind, key = `name:${slug(name)}`, link?: string): Subject {
  return { key, name, kind, category: CATEGORY_OF[kind], ...(link ? { link } : {}) };
}

const cut = (title: string, ...patterns: RegExp[]) => patterns.reduce((t, re) => t.replace(re, ""), title).replace(/\s+/g, " ").trim();

/* A shop's long product title, reduced to the part people would type. */
export function shorten(name: string): string {
  const head = name.split(/,\s|\s[|–—]\s|\s-\s|\s\(|\swith\s|\sfor\s/i)[0].trim();
  return head.split(/\s+/).slice(0, 8).join(" ");
}

/* A headline without the site name that Google appends after the last separator. */
export const headline = (title: string) => cut(title, /\s+[-|–—]\s+[^-|–—]{2,40}$/);

const SITE_NOISE = /^(home|homepage|official (web)?site|welcome( to)?|the official (web)?site)$/i;

/* A front page's title, reduced to the name of the site: the part that
   echoes the address ("CNN" from "Breaking News … | CNN"), else the
   shortest part, else the address's own label. */
export function siteName(title: string, host: string): string {
  const label = host.replace(/^(www|m)\./, "").split(".")[0];
  const parts = title.split(/\s+[|–—-]\s+|\s*:\s+|\s+·\s+/).map((part) => part.trim()).filter((part) => part && !SITE_NOISE.test(part));
  const byHost = parts.find((part) => part.toLowerCase().replace(/[^a-z0-9]/g, "").includes(label.toLowerCase()));
  const chosen = byHost ?? [...parts].sort((a, b) => a.length - b.length)[0] ?? "";
  if (chosen && chosen.length <= 40) return chosen;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const NEWS = /(^|\.)(cnn|bbc|reuters|apnews|nytimes|washingtonpost|theguardian|wsj|bloomberg|ft|forbes|cnbc|nbcnews|cbsnews|foxnews|npr|politico|axios|theatlantic|newyorker|economist|time|abc\.net|news\.com|smh\.com|theage\.com|9news\.com|sbs\.com|theaustralian|afr|theconversation|stuff\.co|nzherald|businessinsider|vox|huffpost|dailymail|telegraph|independent|skynews|aljazeera|dw|france24|scmp|cbc|ctvnews|theglobeandmail|substack|medium)\.[a-z.]+$/;
const NEVER = /(^|\.)(google|bing|duckduckgo|facebook|instagram|tiktok|linkedin|pinterest|wikihow|w3schools|stackoverflow|stackexchange|microsoft)\./;
const SEARCH_ENGINES = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu)\./;
/* "/", "/au/", "/en-gb": a site's front page, possibly for one country. */
const FRONT = /^\/(?:[a-z]{2}(?:[-_][a-z]{2})?\/?)?$/i;
const UTILITY_HOST = /^(support|docs|developer|help|login|accounts?)\./;
const GITHUB_RESERVED = new Set(["features", "topics", "marketplace", "orgs", "settings", "login", "explore", "sponsors", "about", "pricing", "collections", "events", "trending", "search", "issues", "pulls"]);

type Rule = (u: URL, host: string, title: string) => RuleOutcome;

const RULES: Rule[] = [
  (u, host, title) => {
    const m = /^amazon\./.test(host) ? u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/) : null;
    if (!m) return null;
    const parts = cut(title, /^amazon(\.[a-z]+)+\s*:\s*/i, /\s*[:|]\s*amazon.*$/i, /\s+-\s+amazon.*$/i).split(/\s+:\s+/);
    if (parts.length > 1 && /^[a-z &',-]{2,30}$/i.test(parts[parts.length - 1])) parts.pop();
    const name = shorten(parts.join(": "));
    return name ? subject(name, "product", `asin:${m[1]}`) : null;
  },
  (u, host, title) => {
    const m = host === "imdb.com" ? u.pathname.match(/\/title\/(tt\d+)/) : null;
    return m ? subject(cut(title, /\s*⭐.*$/, /\s*\|.*$/, /\s*-\s*imdb$/i, /\s*\(\d{4}(?:[–-]\s?\d{0,4})?\)\s*$/), "film", `imdb:${m[1]}`) : null;
  },
  (u, host, title) => {
    const m = host === "rottentomatoes.com" ? u.pathname.match(/\/(?:m|tv)\/([^/]+)/) : null;
    return m ? subject(cut(title, /\s*[-|]\s*rotten tomatoes$/i), "film", `rt:${m[1]}`) : null;
  },
  (u, host, title) => {
    const m = host === "letterboxd.com" ? u.pathname.match(/\/film\/([^/]+)/) : null;
    return m ? subject(cut(title, /\s+directed by.*$/i, /\s*[•–|-]\s*letterboxd$/i, /\s*\(\d{4}\)\s*$/), "film", `letterboxd:${m[1]}`) : null;
  },
  (u, host, title) => {
    const m = host === "metacritic.com" ? u.pathname.match(/\/(movie|tv|game)\/([^/]+)/) : null;
    return m ? subject(cut(title, /\s*(?:reviews)?\s*[-|]\s*metacritic$/i, /\s+reviews$/i), m[1] === "game" ? "game" : "film", `metacritic:${m[2]}`) : null;
  },
  (u, host, title) => {
    const m = host === "apps.apple.com" ? u.pathname.match(/\/app\/(?:[^/]+\/)?id(\d+)/) : null;
    return m ? subject(cut(title, /^‎/, /\s*on the (?:mac )?app store\s*$/i), "app", `apple-app:${m[1]}`) : null;
  },
  (u, host, title) => {
    const id = host === "play.google.com" && u.pathname.startsWith("/store/apps/details") ? u.searchParams.get("id") : null;
    return id ? subject(cut(title, /\s*[-–]\s*apps on google play\s*$/i), "app", `play:${id}`) : null;
  },
  (u, host, title) => {
    const m = host === "store.steampowered.com" ? u.pathname.match(/\/app\/(\d+)/) : null;
    return m ? subject(cut(title, /^save \d+% on /i, /\s*on steam\s*$/i), "game", `steam:${m[1]}`) : null;
  },
  (u, host) => {
    const m = host === "github.com" ? u.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/?$/) : null;
    if (!m || GITHUB_RESERVED.has(m[1].toLowerCase())) return null;
    return subject(`${m[1]}/${m[2]}`, "tool", `github:${m[1].toLowerCase()}/${m[2].toLowerCase()}`);
  },
  (u, host) => {
    const m = host === "npmjs.com" ? u.pathname.match(/^\/package\/((?:@[^/]+\/)?[^/]+)/) : null;
    return m ? subject(m[1], "tool", `npm:${m[1]}`) : null;
  },
  (u, host) => {
    const m = host === "pypi.org" ? u.pathname.match(/^\/project\/([^/]+)/) : null;
    return m ? subject(m[1], "tool", `pypi:${m[1].toLowerCase()}`) : null;
  },
  (u, host) => {
    const m = /^google\./.test(host) ? u.pathname.match(/\/maps\/place\/([^/]+)/) : null;
    if (!m) return null;
    const name = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    return name ? subject(name, "place", `place:${slug(name)}`) : null;
  },
  (u, host, title) => (/^yelp\./.test(host) && /^\/biz\//.test(u.pathname) ? subject(title.split(/\s+-\s+/)[0], "place", `yelp:${u.pathname.split("/")[2]?.split("?")[0]}`) : null),
  (u, host, title) => (/^tripadvisor\./.test(host) && /_Review-/.test(u.pathname) ? subject(title.split(/\s+-\s+/)[0], "place", `tripadvisor:${slug(u.pathname)}`) : null),
  (u, host, title) => {
    const m = host === "goodreads.com" ? u.pathname.match(/\/book\/show\/(\d+)/) : null;
    return m ? subject(cut(title, /\s*\|\s*goodreads$/i), "book", `goodreads:${m[1]}`) : null;
  },
  /* A YouTube video: the video itself, found by its ID (its own comments
     and the posts that link to it). */
  (u, host, title) => {
    const id = host === "youtu.be" ? u.pathname.slice(1) : host === "youtube.com" ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts)\/([^/]+)/)?.[1]) : null;
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const name = cut(title, /\s*[-|]\s*youtube\s*$/i);
    return name ? subject(name, "article", `yt:${id}`, `https://www.youtube.com/watch?v=${id}`) : null;
  },
  (_u, host) => (/(^|\.)wikipedia\.org$/.test(host) ? "ask" : null),
  (u, host, title) => {
    if (u.pathname === "/" || u.pathname === "") return null;
    if (!NEWS.test(host) && !/\/20\d\d\/\d\d\//.test(u.pathname)) return null;
    const link = normaliseUrl(u.toString())!;
    const name = headline(title);
    return name ? subject(name, "article", `url:${hashKey(link)}`, link) : null;
  },
];

export function resolveByRule(result: RawResult): RuleOutcome {
  let u: URL;
  try {
    u = new URL(result.url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const title = result.title.replace(/\s+/g, " ").trim();
  if (!title) return null;
  for (const rule of RULES) {
    const out = rule(u, host, title);
    if (out) return out;
  }
  /* A site's front page (or its country front page, /au/ or /en-gb/) is
     the site itself, which people do have views on. */
  if (FRONT.test(u.pathname) && !u.search) {
    if (SEARCH_ENGINES.test(host) || UTILITY_HOST.test(host)) return null;
    return subject(siteName(title, host), "company");
  }
  if (NEVER.test(host) || UTILITY_HOST.test(host)) return null;
  return "ask";
}

const QUERY_NOISE = /\b(reviews?|vs\.?|versus|price|prices|buy|specs?|worth it|reddit|opinions?|thoughts|rating|ratings|any good|good\?|bad\?)\b/gi;
const QUESTION = /^(how|what|why|when|where|who|is|are|can|does|do|should|which|will)\b/i;

/* Without an AI key, a short query that is not a question stands as a
   subject as typed; the gauge behind it is marked simulated anyway. */
export function queryFallback(query: string): Subject | null {
  const name = query.replace(QUERY_NOISE, " ").replace(/[?"]/g, "").replace(/\s+/g, " ").trim();
  const words = name.split(" ").filter(Boolean);
  if (!words.length || words.length > 6 || QUESTION.test(name)) return null;
  return subject(name, "entity");
}
