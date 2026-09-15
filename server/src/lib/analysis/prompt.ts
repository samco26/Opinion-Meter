/* What both tiers tell the model about classifying, how junk is kept out
   of the sample, and how the sample is written out: numbered references,
   so the model never repeats text and URLs never leave the server. */

import type { SourceId, SourceItem } from "../types";

export const CLASSIFY_RULES = `Classify EVERY supplied non-video entry exactly once by putting its numeric reference in one of the five classified lists. The numbers shown to readers are counted from the first three, so judge each entry's view OF THE SUBJECT AS A WHOLE — whatever the subject is (a product, a service, a company, a film, a game, a place), positive means the writer likes, wants, recommends or defends it and negative means they dislike it, regret it, warn against it or want it changed — never the mood or tone of the writing:
  positive: a favourable view of the subject: liking it, wanting it, praising it, recommending it, or defending it against a criticism.
  negative: an unfavourable view of the subject itself: a complaint, a disappointment, a reason not to buy, go, watch or use.
  neutral: a considered view of the subject that is deliberately middling or mixed — "it's fine", "decent but nothing special", "as much good as bad". Rare. A question, a fact, a feature wish or a comparison without a verdict carries no view and is irrelevant, not neutral.
  event: a reaction to one specific incident or development — an outage, a ban, a price change, a redesign, an announcement, a lawsuit, a takeover — that says nothing lasting about the subject. Counted separately; never part of the bar. A lasting judgement prompted by an incident ("this is why I left, it has become toxic") is a positive or negative view, not an event.
  irrelevant: anything that carries no view of the subject: not about it, a question, a fact, a feature wish, a comparison without a verdict, a joke, spam, an advert, a remark about the video, the channel or another commenter, a dig at a rival that says nothing about the subject, or a bare report that the subject is down, broken, slow or not loading for the writer right now.
  A blunt or sarcastic wording is not a negative view unless it is aimed at the subject; a swear word in praise is still praise. Never list a missing reference. Do not repeat entry text in the output.
Video titles and descriptions are context only, never opinions; a parent reference links a comment to its video.`;

export function formatItems(items: SourceItem[]): string {
  const references = new Map(items.map((item, index) => [item.id, index]));
  return items.map((it, index) => {
    const metadata = [it.kind, it.publishedAt?.slice(0, 10), it.engagement != null ? `${it.engagement} reactions` : null].filter(Boolean).join(", ");
    return JSON.stringify({ ref: index, source: it.source, metadata, parent: it.parentId ? references.get(it.parentId) : undefined, text: it.text });
  }).join("\n");
}

const JUNK = /^(first|second|third|early|lol|lmao|nice|cool|wow|same|this|bump|\+1|f|rip|w|l|ok|okay|yes|no|true|facts|based)[.!?]*$/i;
const CHATTER = /^(who('s| is| else( is)?)? (here|watching|listening)|anyone (here|watching|else)|\d{1,2}:\d{2}\b|\d{4}\s*(anyone|gang)|like if|subscribe|sub(bed)? to|check out my|follow me|link in bio|first comment)/i;

/* Comments that could never carry a view — a timestamp, "first!", an
   emoji, a bare link, two words — are dropped before anything is sampled
   or sent to the model. Threads and videos stay as context. */
export function prefilter(items: SourceItem[]): { kept: SourceItem[]; dropped: number } {
  let dropped = 0;
  const kept = items.filter((item) => {
    if (item.kind === "video" || item.kind === "thread") return true;
    const text = item.text.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
    const letters = (text.match(/\p{L}/gu) ?? []).length;
    const words = text.split(" ").filter(Boolean).length;
    const junk = text.length < 10 || words < 2 || letters < 6 || JUNK.test(text) || CHATTER.test(text);
    if (junk) dropped++;
    return !junk;
  });
  return { kept, dropped };
}

/* The bounded sample a tier reads. Every platform gets a fair share of
   the places, taken in turns from its most-reacted-to opinions, and no
   single thread may fill more than two fifths of the sample, so a busy
   Hacker News history cannot crowd out YouTube or one outage thread
   drown the rest. Videos travel along as context for their comments. */
export function sample(items: SourceItem[], max: number): SourceItem[] {
  const videos = items.filter((item) => item.kind === "video");
  const bySource = new Map<SourceId, SourceItem[]>();
  for (const item of items) {
    if (item.kind === "video") continue;
    bySource.set(item.source, [...(bySource.get(item.source) ?? []), item]);
  }
  const queues = [...bySource.values()].map((list) => ({ list: list.sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)), index: 0 }));
  const threadCap = Math.max(5, Math.ceil(max * 0.4));
  const perThread = new Map<string, number>();
  const chosen: SourceItem[] = [];
  while (chosen.length < max) {
    let progress = false;
    for (const queue of queues) {
      while (queue.index < queue.list.length) {
        const item = queue.list[queue.index++];
        const thread = `${item.source}:${item.parentId ?? item.id}`;
        const used = perThread.get(thread) ?? 0;
        if (used >= threadCap) continue;
        perThread.set(thread, used + 1);
        chosen.push(item);
        progress = true;
        break;
      }
      if (chosen.length >= max) break;
    }
    if (!progress) break;
  }
  const parents = new Set(chosen.map((item) => item.parentId));
  return [...videos.filter((video) => parents.has(video.id)), ...chosen];
}

/* The model's five lists as the evidence builder's three plus "not counted". */
export type Bucket = "positive" | "neutral" | "negative" | "event" | "irrelevant";
export const BUCKETS: ReadonlyArray<Bucket> = ["positive", "neutral", "negative", "event", "irrelevant"];
export const counted = (bucket: Bucket): "positive" | "neutral" | "negative" | "irrelevant" => (bucket === "event" ? "irrelevant" : bucket);
