/* Local-only fixture using the actual shared UI. All readings are synthetic. */
import { createBar, resultLevel } from "../src/ui";
import type { Gauge } from "../src/shared";

const dark = new URL(location.href).searchParams.get("theme") !== "light";
document.body.style.cssText = `margin:0;padding:90px 30px;min-height:2000px;font:16px Arial;background:${dark ? "#202124" : "#fff"};color:${dark ? "#e8eaed" : "#202124"}`;
document.body.innerHTML = `<header id="searchform" style="position:fixed;top:0;left:0;right:0;z-index:1000;padding:18px;background:#555;color:white">SYNTHETIC UI TEST — no real opinions <a href="/ui?theme=light">Light</a> <a href="/ui?theme=dark">Dark</a></header><p>Hover a result bar (it grows to show the sentence), click it (it grows into the card), then scroll. Drag the floating YouTube bar.</p><p id="report" style="position:fixed;bottom:0;left:0;z-index:2147483647;background:#111;color:white;padding:8px;font:12px monospace;pointer-events:none"></p>`;
const gauge: Gauge = { key: "test", name: "YouTube", kind: "product", category: "product", split: { positive: 80, neutral: 10, negative: 10 }, count: 20, verdict: "positive", sentence: "SYNTHETIC hover paragraph — this should show inside the growing card.", confidence: "medium", sources: [], updatedAt: new Date().toISOString() };
const embed = `${location.origin}/embed?theme=${dark ? "dark" : "light"}&morph=1`;
const layer = document.createElement("div");
layer.dataset.opinionMeter = "layer";
layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;pointer-events:none";
document.body.append(layer);
const placeLayer = () => { layer.style.zIndex = String(resultLevel()); };
placeLayer();
const bars = [];
for (let i = 0; i < 8; i++) {
  const bar = createBar({ dark, title: "Synthetic result", drawer: () => embed });
  bar.host.style.left = "100px"; bar.host.style.top = `${200 + i * 100}px`;
  layer.append(bar.host); bar.set({ kind: "ready", gauge });
  bars.push(bar);
}
const site = createBar({ site: true, big: true, dark, title: "YouTube", drawer: () => embed, onGauge: fresh => site.set({ kind: "ready", gauge: fresh }) });
document.documentElement.append(site.host); site.set({ kind: "ready", gauge: { ...gauge, verdict: "mixed", split: { positive: 45, neutral: 10, negative: 45 } } });
// Reproduce a remembered drag spot: the initial mixed verdict must fit too.
site.host.style.left = "300px"; site.host.style.top = "100px"; site.host.style.right = "auto";
window.addEventListener("scroll", () => {
  document.getElementById("searchform")!.style.zIndex = scrollY > 0 ? "100" : "1000";
  placeLayer();
  if (site.state() === "open") site.close();
});
window.setInterval(() => {
  const title = site.host.shadowRoot!.querySelector<HTMLElement>(".title")!;
  const data = { title: title.textContent, titleFits: title.scrollWidth <= title.clientWidth, pillWidth: site.host.offsetWidth, bars: layer.style.zIndex, site: site.state(), grown: bars.map(b => b.state()).filter(s => s !== "rest").length };
  document.getElementById("report")!.textContent = JSON.stringify(data);
}, 250);
