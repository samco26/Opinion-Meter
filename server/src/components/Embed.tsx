"use client";
import { useEffect, useRef, useState } from "react";
import { sourceName, type CardResponse, type RecurringOpinion, type SourceId } from "@/lib/types";
import { Answer, Insufficient } from "./Answer";
import { OpinionPills } from "./OpinionPills";
import { PlatformEvidence, PostList } from "./PlatformEvidence";
import { Logo } from "./Logo";

type Phase = { name: "loading" } | { name: "done"; response: CardResponse } | { name: "error"; message: string };
type View = { kind: "source"; source: SourceId } | { kind: "opinion"; opinion: RecurringOpinion } | { kind: "how" };
const tell = (message: Record<string, unknown>) => { if (window.parent !== window) window.parent.postMessage({ om: true, ...message }, "*"); };

export function Embed({ subjectKey }: { subjectKey: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [view, setView] = useState<View | null>(null);
  const [attempt, setAttempt] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const viewHeading = useRef<HTMLDivElement>(null);
  const card = phase.name === "done" && phase.response.kind === "card" ? phase.response.card : null;
  const name = card?.subject ?? (phase.name === "done" && phase.response.kind === "insufficient" ? phase.response.subject : "Opinion Meter");
  useEffect(() => {
    tell({ type: "ready" });
    let context: unknown;
    try { context = JSON.parse(new URLSearchParams(window.location.hash.slice(1)).get("context") ?? "null"); } catch { context = null; }
    if (!subjectKey && !context) { setPhase({ name: "error", message: "No subject was given." }); return; }
    setPhase({ name: "loading" });
    const controller = new AbortController();
    fetch(context ? "/api/card" : `/api/card?key=${encodeURIComponent(subjectKey)}`, {
      signal: controller.signal, cache: "no-store",
      ...(context ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: subjectKey, context }) } : {}),
    }).then(async res => {
      const data = await res.json() as CardResponse | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `The server answered ${res.status}.`);
      if (!controller.signal.aborted) setPhase({ name: "done", response: data });
    }).catch((err: unknown) => { if (!controller.signal.aborted) setPhase({ name: "error", message: err instanceof Error ? err.message : "The reading failed." }); });
    return () => controller.abort();
  }, [subjectKey, attempt]);
  useEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => tell({ type: "resize", height: Math.ceil(node.scrollHeight + 76) });
    const observer = new ResizeObserver(measure);
    observer.observe(node); measure();
    return () => observer.disconnect();
  }, [phase, view]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (view) setView(null); else tell({ type: "close" }); }
      if (event.key === "Tab") {
        const nodes = [...document.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);
  useEffect(() => { if (view) viewHeading.current?.focus({ preventScroll: true }); }, [view]);
  const source = view?.kind === "source" ? card?.bySource.find(reading => reading.source === view.source) : undefined;

  return <div className="embed">
    <section className="embed-card" aria-label="What people think">
      <header className="embed-head">
        {view ? <button className="back-button" onClick={() => setView(null)}>← Back</button> : <span className="subject-chip ctl"><span>{name}</span></span>}
        <button type="button" className="close ctl" onClick={() => tell({ type: "close" })} aria-label="Close">×</button>
      </header>
      <div className="embed-scroll"><div className="embed-content" ref={content}>
        {!view && <>
          {phase.name === "loading" && <div className="loading-state"><div className="liquid-track" role="progressbar" aria-label="Reading discussion"><span /><span /></div><p>Finding what people think…</p></div>}
          {phase.name === "error" && <div className="result-copy"><p className="overall-answer">Something interrupted the reading.</p><p className="quiet">{phase.message}</p><button className="text-action" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
          {phase.name === "done" && phase.response.kind === "unknown" && <div className="result-copy"><p className="overall-answer">No reading available yet.</p><p className="quiet">{phase.response.message}</p></div>}
          {phase.name === "done" && phase.response.kind === "insufficient" && <Insufficient response={phase.response} />}
          {card && <>
            <Answer card={card} onChoose={source => setView({ kind: "source", source })} />
            <h2 className="section-label">Recurring opinions</h2>
            <OpinionPills opinions={card.opinions} onSelect={opinion => setView({ kind: "opinion", opinion })} />
            <button className="text-action" onClick={() => setView({ kind: "how" })}>How it works · sources and confidence</button>
          </>}
        </>}
        {view && <div className="detail-content" ref={viewHeading} tabIndex={-1}>
          {source && <PlatformEvidence analysis={source} />}
          {view.kind === "opinion" && <><h2 className="opinion-heading">{view.opinion.sentence}</h2>{card?.bySource.map(reading => {
            const threads = reading.threads.filter(thread => thread.id && view.opinion.evidenceIds.includes(thread.id));
            return threads.length ? <section key={reading.source} className="opinion-evidence" aria-label={sourceName(reading.source)}><Logo id={reading.source} size={24} /><PostList threads={threads} source={reading.source} /></section> : null;
          })}</>}
          {view.kind === "how" && card && <>
            <h2>Sources and confidence</h2>
            <p className="quiet">{card.confidence.level} confidence · {card.confidence.reason}</p>
            <p className="quiet">Agreement: {card.agreement}. Positive reactions do not necessarily mean strong agreement.</p>
            <p className="quiet">The main bar describes what you searched for. A result's bar describes the thing its page is about — a product, a service, a film, a site — as people regard it over time. A notable recent development, when there is one, is noted separately under the summary.</p>
            <p className="quiet">Percentages come from classified posts and comments, weighted by reactions. These selected online comments are not a representative public survey. Fewer than eight relevant opinions means no verdict.</p>
            <p className="quiet">Open a platform or an opinion to see original posts and excerpts. Full analysis and evidence are fetched only when a bar is opened.</p>
            {card.sources.map(status => <p className="quiet" key={status.source}><strong>{sourceName(status.source)}</strong> · {status.relevant ?? 0} relevant of {status.itemsAnalysed} analysed. {status.note}</p>)}
          </>}
          {card?.simulated && <p className="quiet">Unverified word-count estimate. The server has no AI key.</p>}
        </div>}
      </div></div>
    </section>
    <span className="sr-only" role="status" aria-live="polite">{phase.name === "loading" ? "Reading discussion." : phase.name === "done" ? "Reading complete." : "Reading failed."}</span>
  </div>;
}
