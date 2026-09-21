/* The shapes every part of the server reads, and the wire shapes the
   extension reads. Nothing here is stored beyond the memory's 24 hours. */

export type SourceId = "reddit" | "youtube" | "x" | "hn" | "bluesky";

export interface SourceInfo {
  id: SourceId;
  name: string;
  /* Only links on these hosts are ever shown for this source. */
  domains: string[];
}

export const SOURCES: ReadonlyArray<SourceInfo> = [
  { id: "reddit", name: "Reddit", domains: ["reddit.com"] },
  { id: "youtube", name: "YouTube", domains: ["youtube.com", "youtu.be"] },
  { id: "x", name: "X", domains: ["x.com", "twitter.com"] },
  { id: "hn", name: "Hacker News", domains: ["news.ycombinator.com"] },
  { id: "bluesky", name: "Bluesky", domains: ["bsky.app"] },
];

export const SOURCE_IDS: ReadonlyArray<SourceId> = SOURCES.map((s) => s.id);

export function sourceName(id: SourceId): string {
  return SOURCES.find((s) => s.id === id)?.name ?? id;
}

export type SourceAvailability = "ok" | "partial" | "unavailable";

export interface SearchWindow {
  from: string;
  to: string;
  months: number;
}

export interface SourceStatus {
  source: SourceId;
  availability: SourceAvailability;
  itemsAnalysed: number;
  /* How many of those the analysis classified as being about the subject. */
  relevant?: number;
  note?: string;
  window?: SearchWindow;
}

/* One collected item, whatever platform it came from. */
export interface SourceItem {
  id: string;
  source: SourceId;
  kind: "video" | "comment" | "post" | "reply" | "thread";
  text: string;
  title?: string;
  author?: string;
  url?: string;
  publishedAt?: string;
  engagement?: number;
  /* Links an opinion to its context without counting that context as a vote. */
  parentId?: string;
}

export type Verdict = "positive" | "mixed" | "negative";
export type Agreement = "strong" | "moderate" | "weak";
export type ConfidenceLevel = "low" | "medium" | "high";
export interface Confidence { level: ConfidenceLevel; reason: string }
export interface Theme { title: string; detail: string }
export type OpinionSentiment = "positive" | "neutral" | "negative";

export interface SentimentSplit {
  positive: number;
  neutral: number;
  negative: number;
}

export interface EvidenceComment {
  id: string;
  author?: string;
  text: string;
  sentiment?: OpinionSentiment;
}

/* A thread, video or post the analysis drew on, with its real link. */
export interface SourceThread {
  id?: string;
  title: string;
  kind: SourceItem["kind"];
  author?: string;
  url?: string;
  comments?: EvidenceComment[];
}

export interface RecurringOpinion {
  id: string;
  sentence: string;
  sentiment: OpinionSentiment;
  evidenceIds: string[];
  /* Distinct collected opinions behind it. */
  support: number;
}

export interface SourceAnalysis {
  source: SourceId;
  sentiment?: SentimentSplit;
  threads: SourceThread[];
}

/* What kind of thing a subject is. The category picks the card's shape;
   the kind is finer, for the eyebrow line and for search choices. */
export type SubjectKind = "product" | "film" | "app" | "place" | "game" | "book" | "tool" | "company" | "article" | "entity" | "person" | "topic";
export type Category = "film" | "product" | "place" | "app" | "general";

export interface Subject {
  /* Canonical memory key: "asin:B0…", "imdb:tt…", "url:…", "name:sony-wh-1000xm6". */
  key: string;
  name: string;
  kind: SubjectKind;
  category: Category;
  /* Set for an article: discussion is found by link rather than by name. */
  link?: string;
  /* Other names discussion uses for the same thing ("Twitter" for X); searched too. */
  aliases?: string[];
  scope?: "link" | "domain";
  domain?: string;
}

/* The quick answer behind the bar. */
export interface Gauge {
  key: string;
  name: string;
  kind: SubjectKind;
  category: Category;
  split: SentimentSplit;
  /* Opinions found to be about the subject. */
  count: number;
  verdict: Verdict;
  sentence: string;
  confidence: ConfidenceLevel;
  sources: Array<{ source: SourceId; count: number }>;
  window?: SearchWindow;
  /* True when no AI key exists and the split came from a word-count estimate. */
  simulated?: boolean;
  updatedAt: string;
  scope?: "link" | "domain";
  targetUrl?: string;
  domain?: string;
}

export type GaugeState =
  | { state: "ready"; gauge: Gauge }
  | { state: "pending" }
  /* thin: a named subject that was read but had too few opinions; drawn as an empty bar. */
  | { state: "none"; reason: string; thin?: boolean };

export interface GaugeRequest {
  query: string;
  /* site: the name Google prints beside the result's favicon ("Google Play", "eSafety Commissioner"). */
  results: Array<{ url: string; title: string; snippet?: string; site?: string }>;
}

/* Name, kind and category travel with the first answer; a poll for a
   pending key carries only the state. */
export type SubjectStates = Record<string, GaugeState & { name?: string; kind?: SubjectKind; category?: Category }>;

export interface GaugeResponse {
  /* The search query as a subject, when it names a thing; later: its name is still being made, ask again shortly. */
  query: { key: string | null; later?: boolean };
  /* later: the site's name is still being made (key null for now), ask again shortly. */
  results: Array<{ url: string; key: string | null; later?: boolean }>;
  subjects: SubjectStates;
}

/* The full answer behind the overlay. */
export interface Card {
  key: string;
  subject: string;
  kind: SubjectKind;
  category: Category;
  window?: SearchWindow;
  summary: string;
  /* A notable recent development changing how people feel, when there is one. */
  recent?: string;
  opinions: RecurringOpinion[];
  sentiment: SentimentSplit;
  verdict: Verdict;
  agreement: Agreement;
  confidence: Confidence;
  positives: Theme[];
  negatives: Theme[];
  sources: SourceStatus[];
  bySource: SourceAnalysis[];
  simulated?: boolean;
  updatedAt: string;
  scope?: "link" | "domain";
  targetUrl?: string;
  domain?: string;
}

export type CardResponse =
  | { kind: "card"; card: Card }
  | { kind: "insufficient"; key: string; subject: string; message: string; sources: SourceStatus[]; window?: SearchWindow }
  | { kind: "unknown"; key: string; message: string };

/* What the extension fetches on start. Anything here can be changed from
   the memory (key config:override) without a deploy or a store update. */
export interface ExtensionConfig {
  version: number;
  enabled: boolean;
  message?: string;
  minExtensionVersion: string;
  /* How long the extension keeps this before asking again, in minutes. */
  ttlMinutes: number;
  /* Milliseconds between polls for pending subjects, and how many polls. */
  pollMs: number;
  polls: number;
  google: {
    enabled: boolean;
    queryBar: boolean;
    /* CSS selectors the hands use; patched here when Google changes its page. */
    results: string;
    anchor: string;
    ads: string;
    maxResults: number;
  };
}

/* ---- The page card: "Analyse this page's subject" ----------------------
   What the site badge's second button asks for: the page's own text goes
   to the server once, on that click, and comes back as one reading of the
   page's subject built from the reviews found on the page (first) and the
   platforms (supplementary). */

export interface PageRequest {
  url: string;
  title: string;
  /* The site's own declared name (og:site_name), when the page states one. */
  site?: string;
  description?: string;
  /* The page's visible text, reviews and comments first, capped by the hands. */
  text: string;
  /* Structured data the page carries (JSON-LD), when any: ratings and reviews often live there. */
  data?: string;
}

/* Where an opinion in a page reading came from: a platform, or the page itself. */
export type PageSource = SourceId | "page";

export interface PageQuote {
  text: string;
  source: PageSource;
  url?: string;
  title?: string;
}

/* One recurring point for or against the subject, with the entries behind it. */
export interface PagePoint {
  id: string;
  sentence: string;
  /* Distinct entries supporting it. */
  support: number;
  quotes: PageQuote[];
}

export interface PageCard {
  key: string;
  subject: string;
  kind: SubjectKind;
  category: Category;
  split: SentimentSplit;
  verdict: Verdict;
  /* Opinions counted: on the page plus on the platforms. */
  count: number;
  pageCount: number;
  platformCount: number;
  sentence: string;
  summary: string;
  confidence: Confidence;
  pros: PagePoint[];
  cons: PagePoint[];
  sources: Array<{ source: PageSource; count: number }>;
  window?: SearchWindow;
  simulated?: boolean;
  updatedAt: string;
}

export type PageResponse =
  | { kind: "page"; page: PageCard }
  /* A subject was named, but neither the page nor the platforms hold enough opinions about it. */
  | { kind: "insufficient"; subject: string; message: string; pageCount: number; platformCount: number }
  /* The page is about nothing in particular (a login page, a listing, a search). */
  | { kind: "nothing"; message: string };
