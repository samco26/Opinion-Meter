/* Local-only fixture using the actual shared UI. All readings are synthetic. */
import { createBar, headerLevel, openOverlay, resultLevel } from "../src/ui";
import type { Gauge } from "../src/shared";

const dark = new URL(location.href).searchParams.get("theme") !== "light";
document.body.style.cssText = `margin:0;padding:90px 30px;min-height:2000px;font:16px Arial;background:${dark ? "#202124" : "#fff"};color:${dark ? "#e8eaed" : "#202124"}`;
document.body.innerHTML = `<header id="searchform" style="position:fixed;top:0;left:0;right:0;z-index:1000;padding:18px;background:#555;color:white">SYNTHETIC UI TEST — no real opinions <a href="/ui?theme=light">Light</a> <a href="/ui?theme=dark">Dark</a></header><p>Open a result bar, expand/collapse opinions, then scroll. Drag the floating YouTube bar.</p><p id="report" style="position:fixed;bottom:0;left:0;z-index:2147483647;background:#111;color:white;padding:8px;font:12px monospace;pointer-events:none"></p>`;
const gauge: Gauge = { key: "test", name: "YouTube", kind: "product", category: "product", split: { positive: 80, neutral: 10, negative: 10 }, count: 20, verdict: "positive", sentence: "SYNTHETIC hover paragraph — this should travel with the floating bar.", confidence: "medium", sources: [], updatedAt: new Date().toISOString() };
const layer = document.createElement("div");
layer.dataset.opinionMeter = "layer";
layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;pointer-events:none";
document.body.append(layer);
const placeLayer = () => { layer.style.zIndex = String(resultLevel()); };
placeLayer();
for (let i = 0; i < 8; i++) {
  const bar = createBar({ dark, title: "Synthetic result", onOpen: (_, anchor) => openOverlay({ url: `${location.origin}/embed?theme=${dark ? "dark" : "light"}`, anchor, title: "YouTube", dark, level: headerLevel() }) });
  bar.host.style.left = "100px"; bar.host.style.top = `${200 + i * 100}px`;
  layer.append(bar.host); bar.set({ kind: "ready", gauge });
}
const site = createBar({ site: true, big: true, dark, title: "YouTube", onOpen: (_, anchor) => openOverlay({ url: `${location.origin}/embed?theme=${dark ? "dark" : "light"}`, anchor, title: "YouTube", dark, fixed: true, onGauge: fresh => site.set({ kind: "ready", gauge: fresh }) }) });
document.documentElement.append(site.host); site.set({ kind: "ready", gauge });
window.addEventListener("scroll", () => {
  document.getElementById("searchform")!.style.zIndex = scrollY > 0 ? "100" : "1000";
  placeLayer();
});
window.setInterval(() => {
  const drawer = document.querySelector<HTMLElement>('[data-opinion-meter="drawer"]');
  const title = site.host.shadowRoot!.querySelector<HTMLElement>(".title")!;
  const data = { title: title.textContent, titleFits: title.scrollWidth <= title.clientWidth, pillWidth: site.host.offsetWidth, bars: layer.style.zIndex, drawer: drawer?.style.zIndex ?? "closed", drawerAboveBars: !drawer || Number(drawer.style.zIndex) > Number(layer.style.zIndex) };
  document.getElementById("report")!.textContent = JSON.stringify(data);
}, 250);
