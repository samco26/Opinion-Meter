/* The card on a site. When the reader has turned "take the bar with you"
   on and lands on a site whose bar was loaded on Google, the same pill
   sits fixed at the top right of every page of that site with the reading
   the brain remembers; clicking it opens the drawer as on Google. Nothing
   about the page is read beyond its address, and nothing about it is sent
   anywhere: the reading comes from the brain's memory or not at all. */

import { createBar, isDark, openOverlay } from "./ui";
import { send, storage, type SiteReply } from "./shared";

interface Spot { left: number; top: number }

async function main() {
  if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
  const reply = await send<SiteReply>({ type: "site", url: location.href }).catch(() => null);
  if (!reply?.reading) return;
  const { reading, server } = reply;
  const dark = isDark();
  const bar = createBar({
    big: true, site: true, title: reading.gauge.name, dark,
    onOpen: (gauge, anchor) => {
      const fragment = encodeURIComponent(JSON.stringify(reading.context));
      openOverlay({
        url: `${server}/embed?key=${encodeURIComponent(reading.key)}${dark ? "&theme=dark" : ""}#context=${fragment}`,
        anchor, title: gauge?.name ?? reading.gauge.name, dark, fixed: true,
        onGauge: (fresh) => bar.set({ kind: "ready", gauge: fresh }),
      });
    },
    /* The × hides the card on this site until its bar is next loaded on Google. */
    onDismiss: () => { bar.remove(); send({ type: "site-hide", url: location.href }).catch(() => { /* Hidden on this page either way. */ }); },
    /* Where it is dragged to is where it appears next time, on every site. */
    onMove: (spot) => { storage.set({ sitePos: spot }).catch(() => { /* Stays put on this page regardless. */ }); },
  });
  document.documentElement.append(bar.host);
  bar.set({ kind: "ready", gauge: reading.gauge });
  const place = (spot: Spot) => {
    const w = bar.host.offsetWidth || 224, h = bar.host.offsetHeight || 46;
    bar.host.style.left = `${Math.round(Math.max(4, Math.min(window.innerWidth - w - 4, spot.left)))}px`;
    bar.host.style.top = `${Math.round(Math.max(4, Math.min(window.innerHeight - h - 4, spot.top)))}px`;
    bar.host.style.right = "auto";
  };
  const saved = await storage.get<Spot>("sitePos").catch(() => undefined);
  if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) place(saved);
  window.addEventListener("resize", () => {
    if (bar.host.style.right !== "auto") return;
    const box = bar.host.getBoundingClientRect();
    place({ left: box.left, top: box.top });
  });
  /* Solid at the top of the page; faint once the reader scrolls at all
     (still there, still clickable, full again under the cursor); solid
     again when they come back to the very top. */
  const faint = () => bar.host.toggleAttribute("data-faint", window.scrollY > 0);
  window.addEventListener("scroll", faint, { passive: true });
  faint();
}
void main();
