"use client";
import { SOURCES, sourceName, type Card, type CardResponse, type SourceId, type SourceStatus } from "@/lib/types";
import { Logo } from "./Logo";
import { SentimentBar } from "./SentimentBar";

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
  const say = (status: SourceStatus) => status.availability !== "unavailable" ? "has limited coverage" : /refused|sign the server in/i.test(status.note ?? "") ? "could not be read" : "returned nothing";
  return <p className="coverage-note">{missing.map((status) => `${sourceName(status.source)} ${say(status)}`).join(". ")}.</p>;
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
    <SentimentBar compact />
    <div className="under-bar"><div className="under-left"><SourceButtons sources={response.sources} bySource={[]} /></div></div>
  </div>;
}

/* The answer: the summary, the "Lately" line, the bar across the whole
   card, then one line with the platform buttons on the left and the
   count and confidence on the right. No stars (the owner's decision of
   15 September 2026). */
export function Answer({ card, onChoose }: { card: Card; onChoose: (id: SourceId) => void }) {
  const analysed = analysedCount(card);
  return <div className="result-copy">
    {card.simulated && <p className="sample-label">Estimated from word counts · the server has no AI key</p>}
    <p className="overall-answer">{card.summary}</p>
    {card.recent && <p className="recent-note"><span className="recent-tag">Lately</span><span>{card.recent}</span></p>}
    <SentimentBar compact figures split={card.sentiment} note={analysed < LIMITED_BELOW ? "Limited results on subject found" : undefined} />
    <div className="under-bar">
      <div className="under-left">
        <SourceButtons sources={card.sources} bySource={card.bySource.map((reading) => reading.source)} onChoose={onChoose} />
      </div>
      <p className="reading-count">{analysed} relevant opinions · {card.confidence.level} confidence</p>
    </div>
  </div>;
}
