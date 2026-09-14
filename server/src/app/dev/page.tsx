"use client";
import { useState } from "react";
import type { GaugeResponse } from "@/lib/types";

/* The developer test page: pretend to be the extension. Paste a query and
   a few results as the hands would read them off Google, knock on the
   gauge door, and see what comes back. */

const SAMPLE = JSON.stringify({
  query: "sony wh-1000xm6 review",
  results: [
    { url: "https://www.amazon.com/Sony-WH-1000XM6-Wireless-Cancelling-Headphones/dp/B0DZXYZ123", title: "Sony WH-1000XM6 Wireless Noise Cancelling Headphones : Amazon.com: Electronics" },
    { url: "https://www.techradar.com/audio/headphones/sony-wh-1000xm6-review", title: "Sony WH-1000XM6 review: still the best | TechRadar" },
    { url: "https://en.wikipedia.org/wiki/Sony_WH-1000XM6", title: "Sony WH-1000XM6 - Wikipedia" },
    { url: "https://www.wikihow.com/Pair-Headphones", title: "How to Pair Headphones - wikiHow" },
  ],
}, null, 2);

export default function Dev() {
  const [input, setInput] = useState(SAMPLE);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/gauge", { method: "POST", headers: { "Content-Type": "application/json" }, body: input });
      const data = await res.json() as GaugeResponse | { error: string };
      setOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setOutput(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  const keys = output ? [...output.matchAll(/"key": "([^"]+)"/g)].map((m) => m[1]).filter((k, i, all) => all.indexOf(k) === i) : [];
  return (
    <main className="page">
      <section className="glass page-card">
        <h1>Developer test page</h1>
        <p className="quiet">Send a query and results to the gauge door, as the extension would. Keys in the answer link to the card.</p>
        <textarea className="dev-input" value={input} onChange={(e) => setInput(e.target.value)} rows={14} spellCheck={false} />
        <p><button type="button" className="text-action" onClick={() => void ask()} disabled={busy}>{busy ? "Asking…" : "Ask the gauge door"}</button></p>
        {keys.length > 0 && <p className="quiet">{keys.map((k) => <span key={k}><a href={`/embed?key=${encodeURIComponent(k)}`}>{k}</a> · </span>)}</p>}
        <pre className="dev-output">{output}</pre>
      </section>
    </main>
  );
}
