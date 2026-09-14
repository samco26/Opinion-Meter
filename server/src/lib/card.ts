/* The card door's work: the full answer for one subject, from memory or
   computed now. X joins the readers here, and only here, when a token
   exists: the paid source is read on a click, never for a bar. */

import { settings } from "./env";
import { memory } from "./memory";
import { collectAdaptive } from "./sources/adaptive";
import { analyseCard } from "./analysis/analyse";
import { LINK_SOURCES, LITE_SOURCES } from "./gauge";
import type { CardResponse, Subject } from "./types";

const INSUFFICIENT_TTL = 6 * 3600;

export async function cardFor(key: string, budgetMs: number): Promise<CardResponse> {
  const m = memory();
  const stored = await m.get<CardResponse>(`card:${key}`);
  if (stored) return stored;
  const subject = await m.get<Subject>(`subject:${key}`);
  if (!subject) return { kind: "unknown", key, message: "This subject is no longer in memory. Search again to read it afresh." };

  const started = Date.now();
  const sources = subject.link ? [...LINK_SOURCES, "x" as const] : [...LITE_SOURCES, "x" as const];
  const { items, statuses, window } = await collectAdaptive(subject.name, sources, { link: subject.link });
  const opinions = items.filter((item) => item.kind !== "video").length;
  const minItems = settings.minItems();
  let response: CardResponse;
  if (opinions < minItems) {
    response = { kind: "insufficient", key, subject: subject.name, sources: statuses, window, message: opinions ? `Only ${opinions} opinion${opinions === 1 ? "" : "s"} came back, too few to describe honestly.` : "Nothing came back from the platforms that could be reached." };
  } else {
    const analysed = await analyseCard(subject, items, statuses, window, Math.max(5000, budgetMs - (Date.now() - started)));
    response = analysed.kind === "card"
      ? analysed
      : { kind: "insufficient", key, subject: subject.name, sources: analysed.sources, window, message: analysed.relevant ? `Only ${analysed.relevant} of the ${opinions} opinions that came back were about the subject.` : `None of the ${opinions} opinions that came back were about the subject.` };
  }
  await m.set(`card:${key}`, response, response.kind === "card" ? settings.cacheTtlSeconds() : INSUFFICIENT_TTL);
  return response;
}
