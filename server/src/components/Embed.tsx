"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardResponse, RecurringOpinion, SourceId } from "@/lib/types";
import { Answer, Insufficient } from "./Answer";
import { CategoryCard, isCategoryCard, usePhone } from "./CategoryCard";
import { OpinionPills } from "./OpinionPills";
import { PlatformEvidence, PostList } from "./PlatformEvidence";
import { Logo } from "./Logo";

/* The card the drawer frames. It asks the card door for its subject, draws
   the answer (a category card when the subject is a film, product, place or
   app), lists the recurring opinions under it, and opens the platform or
   opinion evidence over itself. It tells the page around it when it is
   ready and when the reader asks to close it. */

type Phase = { name: "loading" } | { name: "done"; response: CardResponse } | { name: "error"; message: string };
type View = { kind: "source"; source: SourceId } | { kind: "opinion"; opinion: RecurringOpinion };

const tell = (message: Record<string, unknown>) => { if (window.parent !== window) window.parent.postMessage({ om: true, ...message }, "*"); };

export function Embed({ subjectKey }: { subjectKey: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [history, setHistory] = useState<View[]>([]);
  const [general, setGeneral] = useState(false);
  const phone = usePhone();
  const panel = useRef<HTMLElement>(null);
  const view = history.at(-1);
  const card = phase.name === "done" && phase.response.kind === "card" ? phase.response.card : null;
  const category = Boolean(card && isCategoryCard(card) && !general);
  const name = card?.subject ?? (phase.name === "done" && phase.response.kind === "insufficient" ? phase.response.subject : undefined);

  useEffect(() => {
    tell({ type: "ready" });
    if (!subjectKey) { setPhase({ name: "error", message: "No subject was given." }); return; }
    const controller = new AbortController();
    fetch(`/api/card?key=${encodeURIComponent(subjectKey)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const data = await res.json() as CardResponse | { error: string };
        if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `The server answered ${res.status}.`);
        setPhase({ name: "done", response: data });
      })
      .catch((err: unknown) => { if (!controller.signal.aborted) setPhase({ name: "error", message: err instanceof Error ? err.message : "The reading failed." }); });
    return () => controller.abort();
  }, [subjectKey]);

  const back = useCallback(() => setHistory((current) => current.slice(0, -1)), []);
  const close = useCallback(() => tell({ type: "close" }), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); if (history.length) back(); else close(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history.length, back, close]);
  useEffect(() => { if (view) panel.current?.focus({ preventScroll: true }); }, [view]);

  const open = (next: View) => setHistory((current) => [...current, next]);
  const source = view?.kind === "source" ? card?.bySource.find((reading) => reading.source === view.source) : undefined;

  return <div className="embed">
    <section className="glass embed-card" aria-label="What people think">
      <header className="embed-head">
        <span className="subject-chip ctl"><span>{name ?? (phase.name === "loading" ? "Reading…" : "Opinion Meter")}</span></span>
        <button type="button" className="close ctl" onClick={close} aria-label="Close">×</button>
      </header>
      <div className="embed-body">
        {phase.name === "loading" && <div className="loading-state"><div className="liquid-track" role="progressbar" aria-label="Reading discussion" aria-valuetext="Reading"><span /><span /></div><p>Finding what people think…</p></div>}
        {phase.name === "error" && <div className="result-copy"><p className="overall-answer">Something interrupted the reading.</p><p className="quiet">{phase.message}</p></div>}
        {phase.name === "done" && phase.response.kind === "unknown" && <div className="result-copy"><p className="overall-answer">This subject is no longer in memory.</p><p className="quiet">{phase.response.message}</p></div>}
        {phase.name === "done" && phase.response.kind === "insufficient" && <Insufficient response={phase.response} />}
        {card && (category
          ? <CategoryCard card={card} onChoose={(id) => open({ kind: "source", source: id })} onOpinion={(opinion) => open({ kind: "opinion", opinion })} onGeneral={() => setGeneral(true)} />
          : <Answer card={card} onChoose={(id) => open({ kind: "source", source: id })} />)}
      </div>
      {card && (!category || phone) && <OpinionPills opinions={card.opinions} onSelect={(opinion) => open({ kind: "opinion", opinion })} />}
      {view && <section className="glass evidence-screen" ref={panel} tabIndex={-1} aria-label={view.kind === "source" ? `${view.source} evidence` : "Supporting posts"}>
        <div className="evidence-nav"><button type="button" className="back-button" onClick={back}><span aria-hidden="true">←</span> Back</button><span className="subject-chip ctl"><span>{name}</span></span></div>
        <div className="evidence-scroll" key={view.kind === "source" ? view.source : view.opinion.id}>
          {source && <PlatformEvidence analysis={source} />}
          {view.kind === "opinion" && <><h2 className="opinion-heading">{view.opinion.sentence}</h2>{card?.bySource.map((reading) => {
            const threads = reading.threads.filter((thread) => thread.id && view.opinion.evidenceIds.includes(thread.id));
            return threads.length ? <section key={reading.source} className="opinion-evidence" aria-label={reading.source}><Logo id={reading.source} size={24} /><PostList threads={threads} source={reading.source} /></section> : null;
          })}</>}
        </div>
        {card?.simulated && <p className="evidence-footer">Estimated from word counts: the server has no AI key.</p>}
      </section>}
    </section>
    <span className="sr-only" role="status" aria-live="polite">{phase.name === "loading" ? "Reading discussion." : phase.name === "done" ? "Reading complete." : "Reading failed."}</span>
  </div>;
}
