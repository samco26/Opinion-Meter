/* The badge on a site. When "take the bar with you" is on and the reader
   lands on a site whose bar was loaded on Google, the badge sits at the
   top right of every page of that site, below the site's own header,
   with the reading the brain remembers; hovering grows it into the card,
   clicking keeps it open. Nothing about the page is read beyond its
   address and the height of its header, and nothing about it is sent
   anywhere: the reading comes from the brain's memory or not at all. */

import { createBar, isDark } from "./ui";
import { send, type SiteReply } from "./shared";

interface Spot { left: number; top: number }

/* The bottom edge of a header fixed or stuck to the top of the window, if the site has one, so the badge never covers its controls. */
function headerBottom(): number {
  let bottom = 0;
  for (const el of document.elementsFromPoint(Math.max(20, window.innerWidth - 40), 6)) {
    if (!(el instanceof HTMLElement) || el.closest("[data-opinion-meter]")) continue;
    const style = getComputedStyle(el);
    if ((style.position === "fixed" || style.position === "sticky") && el.getBoundingClientRect().height < window.innerHeight / 2) bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
  }
  return Math.min(bottom, window.innerHeight / 2);
}

async function main() {
  if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
  const reply = await send<SiteReply>({ type: "site", url: location.href }).catch(() => null);
  if (!reply?.reading) return;
  const { reading, server } = reply;
  const dark = isDark();
  const fragment = encodeURIComponent(JSON.stringify(reading.context));
  const bar = createBar({
    shape: "site", title: reading.gauge.name, dark,
    drawer: () => `${server}/embed?key=${encodeURIComponent(reading.key)}&morph=1${dark ? "&theme=dark" : ""}#context=${fragment}`,
    onGauge: (fresh) => bar.set({ kind: "ready", gauge: fresh }),
    /* The × hides the badge on this site until its bar is next loaded on Google. */
    onDismiss: () => { bar.remove(); send({ type: "site-hide", url: location.href }).catch(() => { /* Hidden on this page either way. */ }); },
  });
  document.documentElement.append(bar.host);
  bar.set({ kind: "ready", gauge: reading.gauge });
  /* Top right, under the site's header; a drag moves it for this page only. */
  bar.host.style.top = `${Math.round(headerBottom() + 12)}px`;
  const place = (spot: Spot) => {
    if (bar.state() !== "rest") return;
    const w = bar.host.offsetWidth || 224, h = bar.host.offsetHeight || 34;
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
  /* A fresh verdict can make the badge wider; a dragged badge stays inside the window. */
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
