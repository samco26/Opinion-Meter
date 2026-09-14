"use client";
import { SOURCES, sourceName, type Card, type CardResponse, type SourceId, type SourceStatus } from "@/lib/types";
import { Logo } from "./Logo";
import { SentimentBar } from "./SentimentBar";
import { Stars } from "./Stars";
import { starRating } from "@/lib/stars";

/* Below this many opinions the answer says the sample was thin. */
const LIMITED_BELOW = 50;

export const analysedCount = (card: Card) => card.sources.reduce((total, status) => total + (status.relevant ?? status.itemsAnalysed), 0);

/* A source that was never connected for this reading is not drawn at all;
   one that was tried and returned nothing is drawn greyed. */
const shownSources = (sources: SourceStatus[]) => SOURCES.filter((source) => {
  const status = sources.find((s) => s.source === source.id);
  return status && !/^(Not connected|X is switched off)/.test(status.note ?? "");
});

export function Coverage({ sources }: { sources: SourceStatus[] }) {
  const missing = shownSources(sources).map((source) => sources.find((s) => s.source === source.id)!).filter((status) => status.availability !== "ok");
  if (!missing.length) return null;
  return <p className="coverage-note">{missing.map((status) => `${sourceName(status.source)} ${status.availability === "unavailable" ? "returned nothing" : "has limited coverage"}`).join(". ")}.</p>;
}

export function SourceButtons({ sources, bySource, onChoose, className = "source-buttons" }: { sources: SourceStatus[]; bySource: SourceId[]; onChoose?: (id: SourceId) => void; className?: string }) {
  return <div className={className} aria-label="Explore a platform">
    {shownSources(sources).map((source) => {
      const available = Boolean(onChoose) && bySource.includes(source.id);
      return <button key={source.id} type="button" className="srcbtn ctl" disabled={!available} aria-label={available ? `Explore ${source.name}` : `${source.name} has nothing to show`} onClick={() => onChoose?.(source.id)}><Logo id={source.id} size={23} /></button>;
    })}
  </div>;
}

/* Too little on the subject: the shape of an answer with a plain sentence
   in its place, greyed buttons and an empty bar, so it never reads as a verdict. */
export function Insufficient({ response }: { response: Extract<CardResponse, { kind: "insufficient" }> }) {
  return <div className="result-copy">
    <p className="overall-answer">Not enough people are talking about “{response.subject}” to say what they think.</p>
    <p className="quiet">{response.message}</p>
    <Coverage sources={response.sources} />
    <div className="source-row"><SourceButtons sources={response.sources} bySource={[]} /><SentimentBar compact /></div>
  </div>;
}

export function Answer({ card, onChoose }: { card: Card; onChoose: (id: SourceId) => void }) {
  const analysed = analysedCount(card);
  const rating = !card.scope && card.category !== "general" ? starRating(card.sentiment, analysed) : null;
  return <div className="result-copy">
    {card.simulated && <p className="sample-label">Estimated from word counts · the server has no AI key</p>}
    {card.scope && <p className="scope-label">{card.scope === "domain" ? `Website fallback · ${card.domain}. Not a verdict on this specific page.` : "Opinions about this specific page"}{card.targetUrl && <a href={card.targetUrl} target="_blank" rel="noopener noreferrer">Open page ↗</a>}</p>}
    <p className="overall-answer">{card.summary}</p>
    <p className="reading-count">{analysed} relevant opinions · {card.confidence.level} confidence</p>
    <div className="source-row">
      {rating && <span className="rating-pill" title="Sentiment score, not submitted star reviews"><Stars value={rating.stars} /> {rating.stars.toFixed(1)}/5</span>}
      <SourceButtons sources={card.sources} bySource={card.bySource.map((reading) => reading.source)} onChoose={onChoose} />
      <SentimentBar compact split={card.sentiment} note={analysed < LIMITED_BELOW ? "Limited results on subject found" : undefined} />
    </div>
    <Coverage sources={card.sources} />
  </div>;
}
