import type { CSSProperties } from "react";
import type { RecurringOpinion } from "@/lib/types";

/* Every recurring opinion, as a list of quiet rows: a 2 px stance tick on
   the leading edge (green positive, grey neutral, red negative), the
   sentence, and how many opinions stand behind it. Colour lives only in
   the tick (the design handoff of 16 September 2026). */
export function OpinionPills({ opinions, onSelect }: { opinions: RecurringOpinion[]; onSelect: (opinion: RecurringOpinion) => void }) {
  if (!opinions.length) return <p className="quiet embed-quiet">There is not enough repeated evidence to identify distinct recurring opinions.</p>;
  return <div className="opinion-list" aria-label="Recurring opinions">
    {opinions.map((opinion, index) => <button key={opinion.id} type="button" className={`opinion-pill opinion-${opinion.sentiment}`} style={{ "--pill-order": Math.min(index, 8) } as CSSProperties} onClick={() => onSelect(opinion)} aria-label={`${opinion.sentiment}: ${opinion.sentence} ${opinion.support} supporting opinions. Explore supporting posts.`}><i className="tick" aria-hidden="true" /><span>{opinion.sentence}</span><small>{opinion.support}</small></button>)}
  </div>;
}
