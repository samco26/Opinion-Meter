import type { CSSProperties } from "react";
import type { RecurringOpinion } from "@/lib/types";

/* Every recurring opinion, as a list that scrolls on its own under the
   answer: green for positive, grey for neutral, red for negative. */
export function OpinionPills({ opinions, onSelect }: { opinions: RecurringOpinion[]; onSelect: (opinion: RecurringOpinion) => void }) {
  if (!opinions.length) return <p className="quiet embed-quiet">There is not enough repeated evidence to identify distinct recurring opinions.</p>;
  return <div className="opinion-list" aria-label="Recurring opinions">
    {opinions.map((opinion, index) => <button key={opinion.id} type="button" className={`opinion-pill opinion-${opinion.sentiment}`} style={{ "--pill-order": Math.min(index, 8) } as CSSProperties} onClick={() => onSelect(opinion)} aria-label={`${opinion.sentiment}: ${opinion.sentence} ${opinion.support} supporting opinions. Explore supporting posts.`}><span>{opinion.sentence}</span><small>{opinion.support} ↗</small></button>)}
  </div>;
}
