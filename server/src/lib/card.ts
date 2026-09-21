/* The card door's work: the full answer for one subject. From memory when
   a finished card is held; otherwise built from the bar's own sample while
   that is held (the same entries, the same verdicts: the card's numbers are
   the bar's), waiting for a bar still being read; and only when there is
   no such sample — it aged out, or the card came before any bar — read
   afresh, in which case the fresh reading becomes the subject's. A finished
   card is held for a quarter of an hour so a drawer that was prefetched
   when the results appeared opens at once. */

import { configured, settings } from "./env";
import { domainSubject } from "./target";
import { recoverSubject } from "./card-context";
import { claimFresh } from "./limits";
import { memory } from "./memory";
import { collectAdaptive } from "./sources/adaptive";
import { analyseCard } from "./analysis/analyse";
import { heldSample, isPending, rememberGaugeFromCard, sourcesFor } from "./gauge";
import type { CardResponse, GaugeRequest, Subject } from "./types";

/* Excerpts are platform content: a card lives this long and no longer. */
const CARD_TTL = 15 * 60;
/* Bumped whenever the classifier changes, so old cards are not served. */
const READING = 3;
/* How long a card waits for the bar's reading to finish before reading on its own. */
const WAIT_MS = 20_000;
const WAIT_STEP_MS = 400;

export async function cardFor(key: string, budgetMs: number, context?: GaugeRequest): Promise<CardResponse> {
  const m = memory();
  const started = Date.now();
  const subject = (key ? await m.get<Subject>(`subject:${key}`) : null) ?? (context ? await recoverSubject(key, context) : null);
  if (!subject) return { kind: "unknown", key, message: context ? "This link could not be identified as a specific subject. Unrecognised links need the server's AI connection; pages about nothing in particular are not rated." : "This reading has expired. Refresh the Google results and open the bar again." };
  key = subject.key;
  const held = await m.get<CardResponse>(`card:${READING}:${key}`);
  if (held?.kind === "card") return held;
  await m.set(`subject:${key}`, subject, settings.cacheTtlSeconds());
  if (subject.scope && !configured.openai()) return { kind: "unknown", key, message: "Link and website reputation need AI analysis. Connect OPENAI_API_KEY on the server to enable these readings. No reputation score has been invented." };

  /* The bar's reading, if it is still being made, is worth waiting for: the card built from it is the bar's own. */
  const deadline = Math.min(started + WAIT_MS, started + budgetMs - 25_000);
  while (await isPending(key) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  const sample = await heldSample(key);
  if (sample) {
    const analysed = await analyseCard(sample.target, sample.entries, sample.statuses, sample.window, Math.max(1000, Math.min(22_000, budgetMs - (Date.now() - started))), { classifications: sample.classifications, views: sample.views, dropped: sample.dropped });
    if (analysed.kind === "card") {
      const response: CardResponse = { kind: "card", card: { ...analysed.card, key, targetUrl: subject.link } };
      await m.set(`card:${READING}:${key}`, response, CARD_TTL);
      return response;
    }
    /* The bar found enough and the same entries cannot now be too few; if the model's answer still failed, read afresh below. */
  }

  if (!(await claimFresh())) throw new Error("Today's reading budget is used up. Please try again tomorrow.");
  const fallback = domainSubject(subject);
  let response: CardResponse = { kind: "unknown", key, message: "The reading did not finish. Please try again." };
  for (const target of [subject, ...(fallback ? [fallback] : [])]) {
  if (Date.now() - started > budgetMs - 5000) break;
  const { items, statuses, window } = await collectAdaptive(target.name, sourcesFor(target), { link: target.link, domain: target.scope === "domain" ? target.domain : undefined, aliases: target.aliases, depth: "full", budgetMs: Math.min(target.scope === "link" ? 10_000 : 16_000, Math.max(1, budgetMs - (Date.now() - started) - 8000)) });
  const opinions = items.filter((item) => item.kind !== "video").length;
  const minItems = settings.minItems();
  if (opinions < minItems) {
    response = { kind: "insufficient", key, subject: target.name, sources: statuses, window, message: target.scope ? "Not enough discussion about the specific link or its website was found on the connected platforms." : opinions ? `Only ${opinions} opinions came back, too few to describe honestly.` : "Nothing came back from the platforms that could be reached." };
  } else {
    const analysed = await analyseCard(target, items, statuses, window, Math.max(1000, Math.min(22_000, budgetMs - (Date.now() - started))));
    response = analysed.kind === "card"
      ? { kind: "card", card: { ...analysed.card, key, targetUrl: subject.link } }
      : { kind: "insufficient", key, subject: target.name, sources: analysed.sources, window, message: `Only ${analysed.relevant} of ${opinions} collected entries evaluated ${target.scope === "domain" ? "this website" : target.scope === "link" ? "this specific page" : "the subject"}.` };
    if (response.kind === "card") break;
  }
  }
  if (response.kind === "card") {
    await m.set(`card:${READING}:${key}`, response, CARD_TTL);
    await rememberGaugeFromCard(subject, response.card);
  }
  return response;
}
