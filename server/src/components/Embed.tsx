"use client";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { sourceName, type CardResponse, type RecurringOpinion, type SourceId } from "@/lib/types";
import { Answer, Insufficient } from "./Answer";
import { OpinionPills } from "./OpinionPills";
import { PlatformEvidence, PostList } from "./PlatformEvidence";
import { Logo } from "./Logo";

type Phase = { name: "loading" } | { name: "done"; response: CardResponse } | { name: "error"; message: string };
type View = { kind: "source"; source: SourceId } | { kind: "opinion"; opinion: RecurringOpinion } | { kind: "how" };
const tell = (message: Record<string, unknown>) => { if (window.parent !== window) window.parent.postMessage({ om: true, ...message }, "*"); };
/* What the drawer says while the reading is made. */
const PHRASES = ["Scanning the web…", "Reading the room…", "Calculating sentiment…", "Weighing the opinions…", "Listening in…"];

/* dark: the drawer host is on Google's dark theme, so the card is drawn
   dark too. morph: the card is drawn inside the pill that grew to hold
   it, which already shows the name, the bar and the figures, so the
   title bar and the bar of its own are left out. */
export function Embed({ subjectKey, dark = false, morph = false }: { subjectKey: string; dark?: boolean; morph?: boolean }) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [view, setView] = useState<View | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phrase, setPhrase] = useState(0);
  const [fading, setFading] = useState(false);
  /* Each phrase fades out, the next fades in; a slow rotation. */
  useEffect(() => {
    if (phase.name !== "loading") return;
    let swap: number | undefined;
    const timer = window.setInterval(() => {
      setFading(true);
      swap = window.setTimeout(() => { setPhrase((value) => value + 1); setFading(false); }, 450);
    }, 3200);
    return () => { window.clearInterval(timer); window.clearTimeout(swap); };
  }, [phase.name]);
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
    setRecurringOpen(false);
    const controller = new AbortController();
    fetch(context ? "/api/card" : `/api/card?key=${encodeURIComponent(subjectKey)}`, {
      signal: controller.signal, cache: "no-store",
      ...(context ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: subjectKey, context }) } : {}),
    }).then(async res => {
      const data = await res.json() as CardResponse | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : `The server answered ${res.status}.`);
      if (controller.signal.aborted) return;
      setPhase({ name: "done", response: data });
      /* The bar that opened this drawer takes the card's numbers, so the two agree. */
      if (data.kind === "card") {
        const c = data.card;
        const count = c.sources.reduce((total, status) => total + (status.relevant ?? status.itemsAnalysed), 0);
        tell({ type: "gauge", gauge: { key: c.key, name: c.subject, kind: c.kind, category: c.category, split: c.sentiment, count, verdict: c.verdict, sentence: c.summary, confidence: c.confidence.level, sources: c.sources.filter((status) => (status.relevant ?? 0) > 0).map((status) => ({ source: status.source, count: status.relevant ?? 0 })), window: c.window, updatedAt: c.updatedAt } });
      }
    }).catch((err: unknown) => { if (!controller.signal.aborted) setPhase({ name: "error", message: err instanceof Error ? err.message : "The reading failed." }); });
    return () => controller.abort();
  }, [subjectKey, attempt]);
  useEffect(() => {
    const node = content.current;
    if (!node) return;
    /* The height the card wants: the opinions list at its full size (it
       shrinks to fit a short window and scrolls on its own) plus the
       frame — the title bar counted only once it is shown. */
    const measure = () => {
      const list = node.querySelector<HTMLElement>(".opinion-list");
      const folded = list ? Math.max(0, Math.min(300, list.scrollHeight) - list.clientHeight) : 0;
      tell({ type: "resize", height: Math.ceil(node.scrollHeight + folded + (phase.name === "loading" || (morph && !view) ? 26 : 76)) });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node); measure();
    return () => observer.disconnect();
  }, [phase, view, recurringOpen, morph]);
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

  /* Inside a pill that grew around this card, a click on anything that is not a control shrinks it back. */
  const plainClick = (event: ReactMouseEvent) => {
    if (!morph) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role='button'], .opinion-pill, .post-section")) return;
    tell({ type: "close" });
  };
  return <div className="embed" data-theme={dark ? "dark" : undefined} onClick={plainClick}>
    <section className="embed-card" aria-label="What people think">
      {phase.name !== "loading" && (!morph || view) && <header className="embed-head">
        {view ? <button className="back-button" onClick={() => setView(null)}>← Back</button> : <h1 className="embed-title">{name}</h1>}
        {!morph && <button type="button" className="close ctl" onClick={() => tell({ type: "close" })} aria-label="Close">×</button>}
      </header>}
      <div className="embed-scroll"><div className="embed-content" ref={content}>
        {!view && <>
          {phase.name === "loading" && <div className="loading-state"><div className="liquid-track" role="progressbar" aria-label="Reading discussion"><span /><span /></div><p className={fading ? "fade" : undefined}>{PHRASES[phrase % PHRASES.length]}</p></div>}
          {phase.name === "error" && <div className="result-copy"><p className="overall-answer">Something interrupted the reading.</p><p className="quiet">{phase.message}</p><button className="text-action" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
          {phase.name === "done" && phase.response.kind === "unknown" && <div className="result-copy"><p className="overall-answer">No reading available yet.</p><p className="quiet">{phase.response.message}</p></div>}
          {phase.name === "done" && phase.response.kind === "insufficient" && <Insufficient response={phase.response} bar={!morph} />}
          {card && <>
            <Answer card={card} bar={!morph} onChoose={source => setView({ kind: "source", source })} recurring={{ expanded: recurringOpen, controls: "recurring-opinions", onToggle: () => setRecurringOpen(open => !open) }} />
            <section id="recurring-opinions" className="recurring-section" hidden={!recurringOpen} aria-label="Recurring opinions">
              <h2 className="section-label">Recurring opinions</h2>
              <OpinionPills opinions={card.opinions} onSelect={opinion => setView({ kind: "opinion", opinion })} />
            </section>
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
