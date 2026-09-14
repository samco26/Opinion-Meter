/* What both tiers tell the model about classifying, and how the sample is
   written out: numbered references, so the model never repeats text and
   URLs never leave the server. */

import type { SourceId, SourceItem } from "../types";

export const CLASSIFY_RULES = `Classify EVERY supplied non-video entry exactly once by putting its numeric reference in one of the four classified lists. The numbers shown to readers are counted from these lists, so judge each entry's view OF THE SUBJECT AS A WHOLE, never the mood or tone of the writing:
  positive: a favourable view of the subject, wanting it, praising it, recommending it, or defending it against a criticism.
  negative: an unfavourable view of the subject itself: a complaint, a disappointment, a reason not to buy, go, watch or use.
  neutral: about the subject but with no clear favourable or unfavourable view: a question, a fact, a wish for a feature, a comparison without a verdict, or genuinely balanced.
  irrelevant: not about the subject, or a joke, spam, an advert, a remark about the video, the channel or another commenter, or a dig at a rival that says nothing about the subject.
  A bare report that the subject is down, broken, slow or not loading for the writer at that moment, or a question whether it is, says nothing lasting about the subject and is irrelevant; a view that it is unreliable, or has got worse, is negative.
  A blunt or sarcastic wording is not a negative view unless it is aimed at the subject; a swear word in praise is still praise. Never list a missing reference. Do not repeat entry text in the output.
Video titles and descriptions are context only, never opinions; a parent reference links a comment to its video.`;

export function formatItems(items: SourceItem[]): string {
  const references = new Map(items.map((item, index) => [item.id, index]));
  return items.map((it, index) => {
    const metadata = [it.kind, it.publishedAt?.slice(0, 10), it.engagement != null ? `${it.engagement} reactions` : null].filter(Boolean).join(", ");
    return JSON.stringify({ ref: index, source: it.source, metadata, parent: it.parentId ? references.get(it.parentId) : undefined, text: it.text });
  }).join("\n");
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
