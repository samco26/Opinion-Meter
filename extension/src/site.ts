/* The card on a site. When "take the bar with you" is on and the reader
   lands on a site whose bar was loaded on Google, the same pill sits fixed
   at the top right of every page of that site with the reading the brain
   remembers; hovering shows the sentence, clicking grows it into the full
   card. Nothing about the page is read beyond its address, and nothing
   about it is sent anywhere: the reading comes from the brain's memory or
   not at all. */

import { createBar, isDark } from "./ui";
import { send, type SiteReply } from "./shared";

interface Spot { left: number; top: number }

async function main() {
  if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
  const reply = await send<SiteReply>({ type: "site", url: location.href }).catch(() => null);
  if (!reply?.reading) return;
  const { reading, server } = reply;
  const dark = isDark();
  const fragment = encodeURIComponent(JSON.stringify(reading.context));
  const bar = createBar({
    big: true, site: true, title: reading.gauge.name, dark,
    drawer: () => `${server}/embed?key=${encodeURIComponent(reading.key)}&morph=1${dark ? "&theme=dark" : ""}#context=${fragment}`,
    onGauge: (fresh) => bar.set({ kind: "ready", gauge: fresh }),
    /* The × hides the card on this site until its bar is next loaded on Google. */
    onDismiss: () => { bar.remove(); send({ type: "site-hide", url: location.href }).catch(() => { /* Hidden on this page either way. */ }); },
  });
  document.documentElement.append(bar.host);
  bar.set({ kind: "ready", gauge: reading.gauge });
  /* Every page starts with the card in the top right corner; a drag moves it for that page only. */
  const place = (spot: Spot) => {
    if (bar.state() !== "rest") return;
    const w = bar.host.offsetWidth || 224, h = bar.host.offsetHeight || 46;
    bar.host.style.left = `${Math.round(Math.max(4, Math.min(window.innerWidth - w - 4, spot.left)))}px`;
    bar.host.style.top = `${Math.round(Math.max(4, Math.min(window.innerHeight - h - 4, spot.top)))}px`;
    bar.host.style.right = "auto";
  };
  const keepInside = () => {
    if (bar.host.style.right !== "auto" || bar.state() !== "rest") return;
    const box = bar.host.getBoundingClientRect();
    place({ left: box.left, top: box.top });
  };
  window.addEventListener("resize", keepInside);
  /* A fresh verdict can make the pill wider; a dragged pill stays inside the window. */
  new ResizeObserver(keepInside).observe(bar.host);
  /* Solid at the top of the page; faint once the reader scrolls at all
     (still there, still clickable, full again under the cursor); solid
     again when they come back to the very top. Scrolling closes an open
     card. */
  const faint = () => {
    if (window.scrollY > 0 && bar.state() === "open") bar.close();
    bar.host.toggleAttribute("data-faint", window.scrollY > 0);
  };
  window.addEventListener("scroll", faint, { passive: true });
  faint();
}
void main();
