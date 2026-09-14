/* What both tiers tell the model about classifying, and how the sample is
   written out: numbered references, so the model never repeats text and
   URLs never leave the server. */

import type { SourceItem } from "../types";

export const CLASSIFY_RULES = `Classify EVERY supplied non-video entry exactly once by putting its numeric reference in one of the four classified lists. The numbers shown to readers are counted from these lists, so judge each entry's view OF THE SUBJECT, never the mood or tone of the writing:
  positive: a favourable view of the subject, wanting it, praising it, recommending it, or defending it against a criticism.
  negative: an unfavourable view of the subject itself: a complaint, a disappointment, a reason not to buy, go, watch or use.
  neutral: about the subject but with no clear favourable or unfavourable view: a question, a fact, a wish for a feature, a comparison without a verdict, or genuinely balanced.
  irrelevant: not about the subject, or a joke, spam, an advert, a remark about the video, the channel or another commenter, or a dig at a rival that says nothing about the subject.
  A blunt or sarcastic wording is not a negative view unless it is aimed at the subject; a swear word in praise is still praise. Never list a missing reference. Do not repeat entry text in the output.
Video titles and descriptions are context only, never opinions; a parent reference links a comment to its video.`;

export function formatItems(items: SourceItem[]): string {
  const references = new Map(items.map((item, index) => [item.id, index]));
  return items.map((it, index) => {
    const metadata = [it.kind, it.publishedAt?.slice(0, 10), it.engagement != null ? `${it.engagement} reactions` : null].filter(Boolean).join(", ");
    return JSON.stringify({ ref: index, source: it.source, metadata, parent: it.parentId ? references.get(it.parentId) : undefined, text: it.text });
  }).join("\n");
}

/* The bounded sample a tier reads: every video (context) and the most
   reacted-to opinions up to the cap. */
export function sample(items: SourceItem[], max: number): SourceItem[] {
  const videos = items.filter((item) => item.kind === "video");
  const opinions = items.filter((item) => item.kind !== "video").sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)).slice(0, max);
  const parents = new Set(opinions.map((item) => item.parentId));
  return [...videos.filter((video) => parents.has(video.id)), ...opinions];
}
