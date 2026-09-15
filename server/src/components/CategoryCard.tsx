"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Card, RecurringOpinion, SourceId, SubjectKind } from "@/lib/types";
import { starRating } from "@/lib/stars";
import { analysedCount, SourceButtons } from "./Answer";
import { Stars } from "./Stars";

/* The category cards: the same answer with a star rating worked out from
   the split, shaped like the site people check for that kind of thing.
   One skeleton on desktop: head, a rating strip (a compact tile with the
   platform buttons beside it), the summary, the opinions in the
   category's shape. On phones only the summary and the strip; the
   opinions are drawn under the card by the embed. */

interface CardProps {
  card: Card;
  onChoose: (id: SourceId) => void;
  onOpinion: (opinion: RecurringOpinion) => void;
  onGeneral: () => void;
}

const KIND_LABEL: Record<SubjectKind, string> = { product: "Product", film: "Film", app: "App", place: "Place", game: "Game", book: "Book", tool: "Tool", company: "Company", article: "Article", entity: "Subject", person: "Person", topic: "Topic" };

export function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => { mq.removeEventListener("change", sync); window.removeEventListener("resize", sync); };
  }, []);
  return phone;
}

export const isCategoryCard = (card: Card) => card.category !== "general";

function GeneralView({ onClick }: { onClick: () => void }) {
  return <button type="button" className="general ctl" onClick={onClick} aria-label="Back to the general view">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5 7 10l5 5" /></svg>
    General view
  </button>;
}

function RatingStrip({ card, onChoose }: { card: Card; onChoose: CardProps["onChoose"] }) {
  const count = analysedCount(card);
  const rating = starRating(card.sentiment, count);
  return <div className="rating-strip">
    <div className="tile tile-strip ctl" role="img" aria-label={`${rating.stars.toFixed(1)} out of 5, ${Math.round(rating.approval * 100)}% positive from ${count} opinions`}>
      <span className="score score-md">{rating.stars.toFixed(1)}</span>
      <span className="tile-meta"><Stars value={rating.stars} /><span className="approval">{Math.round(rating.approval * 100)}% positive · {count} opinions</span></span>
    </div>
    <SourceButtons className="pstack" sources={card.sources} bySource={card.bySource.map((reading) => reading.source)} onChoose={onChoose} />
  </div>;
}

const Opinion = ({ opinion, shape, onOpinion }: { opinion: RecurringOpinion; shape: "rev" | "chip" | "card"; onOpinion: CardProps["onOpinion"] }) => {
  const posts = <span className={shape === "rev" ? "revmeta" : shape === "chip" ? "n" : "ttl"} aria-hidden="true">{shape === "chip" ? opinion.support : `${opinion.support} posts`}</span>;
  return <button type="button" className={`opinion-pill opinion-${opinion.sentiment} ${shape}`} onClick={() => onOpinion(opinion)} aria-label={`${opinion.sentiment}: ${opinion.sentence} ${opinion.support} posts. Explore supporting posts.`}>
    {shape === "card" && posts}{shape === "rev" ? <span>{opinion.sentence}</span> : opinion.sentence}{shape !== "card" && posts}
  </button>;
};

function DesktopCard({ card, onChoose, onGeneral, opinions, box, label }: CardProps & { opinions: ReactNode; box: "list" | "chips" | "cards"; label?: string }) {
  const app = card.category === "app";
  const rating = app ? starRating(card.sentiment, analysedCount(card)) : undefined;
  return <div className="result-copy ccard">
    {card.simulated && <p className="sample-label">Estimated from word counts · the server has no AI key</p>}
    {app && rating
      ? <div className="apphead">
          <div className="appicon" aria-hidden="true">{card.subject.replace(/^the\s+/i, "").charAt(0).toUpperCase()}</div>
          <div><h2 className="ctitle">{card.subject}</h2><div className="sub">{KIND_LABEL[card.kind]}</div><Stars value={rating.stars} /></div>
          <GeneralView onClick={onGeneral} />
        </div>
      : <>
          <div className="eyebrow"><span>{KIND_LABEL[card.kind]}</span><GeneralView onClick={onGeneral} /></div>
          <h2 className="ctitle">{card.subject}</h2>
        </>}
    <RatingStrip card={card} onChoose={onChoose} />
    {label && <span className="label">{label}</span>}
    <p className="answer-small">{card.summary}</p>
    <div className="csection"><span className="label">Common opinions</span><div className={box}>{opinions}</div></div>
  </div>;
}

export function CategoryCard(props: CardProps) {
  const phone = usePhone();
  const { card, onChoose, onOpinion } = props;
  const shape = card.category === "film" ? "rev" : card.category === "app" ? "card" : "chip";
  const box = shape === "rev" ? "list" : shape === "card" ? "cards" : "chips";
  if (phone) return <div className="result-copy pbody">
    {card.simulated && <p className="sample-label">Estimated from word counts · the server has no AI key</p>}
    <p className="answer-small">{card.summary}</p>
    <RatingStrip card={card} onChoose={onChoose} />
  </div>;
  return <DesktopCard {...props} box={box} label={card.category === "product" ? "People say" : undefined} opinions={card.opinions.map((opinion) => <Opinion key={opinion.id} opinion={opinion} shape={shape} onOpinion={onOpinion} />)} />;
}
