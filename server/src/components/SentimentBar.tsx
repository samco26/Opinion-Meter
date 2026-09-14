import type { SentimentSplit } from "@/lib/types";
import { sentimentPercentages } from "@/lib/sentiment";

const LABELS = ["positive", "neutral", "negative"] as const;

/* The three-colour bar. With no split at all the bar is drawn plain grey
   so the answer keeps its shape. compact drops the legend; figures adds
   the three percentages under a compact bar. The legend always carries
   the percentages when there is a split. */
export function SentimentBar({ split, note, compact, figures }: { split?: SentimentSplit; note?: string; compact?: boolean; figures?: boolean }) {
  const values = sentimentPercentages(split ?? { positive: 0, neutral: 0, negative: 0 });
  const empty = values.every((value) => value === 0);
  const classes = ["sentiment", empty ? "sentiment-empty" : "", compact ? "sentiment-compact" : ""].filter(Boolean).join(" ");
  const figure = (index: number) => `${values[index]}% ${LABELS[index]}`;
  return <div className={classes} role="img" aria-label={empty ? "No sentiment breakdown: not enough on-topic discussion was found." : `${values[0]}% positive, ${values[1]}% neutral, ${values[2]}% negative.${note ? ` ${note}.` : ""}`}>
    {note && !empty && <p className="sent-note" aria-hidden="true">{note}</p>}
    <div className="sentbar" aria-hidden="true">{!empty && values.map((value, i) => <span key={i} className={["sent-pos", "sent-neu", "sent-neg"][i]} style={{ flex: `0 0 ${value}%` }} />)}</div>
    {!compact && <div className="sent-legend" aria-hidden="true">{LABELS.map((label, i) => <span key={label}>{empty ? label.charAt(0).toUpperCase() + label.slice(1) : figure(i)}</span>)}</div>}
    {compact && figures && !empty && <div className="sent-figures" aria-hidden="true"><span className="f-pos">{figure(0)}</span><span className="f-neu">{figure(1)}</span><span className="f-neg">{figure(2)}</span></div>}
  </div>;
}
