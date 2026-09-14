"use client";
import { useState } from "react";
import { sourceName, type SourceAnalysis, type SourceId, type SourceThread } from "@/lib/types";
import { sourceUrl } from "@/lib/analysis/evidence";
import { SentimentBar } from "./SentimentBar";
import { Logo } from "./Logo";

export function PlatformEvidence({ analysis }: { analysis: SourceAnalysis }) {
  return <div className="platform-evidence">
    <div className="platform-heading"><span role="img" aria-label={sourceName(analysis.source)}><Logo id={analysis.source} size={30} /></span><SentimentBar split={analysis.sentiment} /></div>
    <PostList threads={analysis.threads} source={analysis.source} />
  </div>;
}

/* Original titles, then a few verbatim excerpts in sentiment-coloured
   pills; the whole section opens the original post. */
export function PostList({ threads, source }: { threads: SourceThread[]; source: SourceId }) {
  const [all, setAll] = useState(false);
  if (!threads.length) return <p className="quiet">No supporting posts are available for this opinion.</p>;
  return <>
    <ul className="post-list">
      {threads.slice(0, all ? undefined : 5).map((thread, index) => {
        const url = sourceUrl(thread.url, source);
        const content = <>
          <h3>{thread.title}</h3>
          {thread.author && <p className="post-attribution">{thread.author}</p>}
          {thread.comments?.length ? <div className="comment-pills">{thread.comments.slice(0, 3).map((comment) => <blockquote key={comment.id} className={`comment-pill opinion-${comment.sentiment ?? "unclassified"}`}>
            <span className={comment.sentiment ? "sr-only" : "unclassified-note"}>{comment.sentiment ?? "Sentiment unavailable"}: </span>
            {comment.text.length > 260 ? <>{comment.text.slice(0, 260)}<span aria-label="Excerpt continues">…</span></> : comment.text}
            {comment.author && <cite className="comment-attribution">{comment.author}</cite>}
          </blockquote>)}</div> : <p className="quiet">Comment excerpts are unavailable for this post.</p>}
        </>;
        return <li key={thread.id ?? index}>{url ? <a className="post-section" href={url} target="_blank" rel="noopener noreferrer" aria-label={`${thread.title}. Open original post in a new tab.`}>{content}</a> : <article className="post-section">{content}</article>}</li>;
      })}
    </ul>
    {threads.length > 5 && <button className="text-action" type="button" onClick={() => setAll((value) => !value)} aria-expanded={all}>{all ? "Show less" : "Show more"}</button>}
  </>;
}
