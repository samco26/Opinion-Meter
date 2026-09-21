/* The badge on every site (unless the menu turns it off). It sits at the
   top right of the page, below the site's own header, with two rows: the
   site's reading — carried from Google when the reader came from there,
   else fetched for the site by its address and the name it declares for
   itself — and the button "Analyse this page's subject". Hovering the
   first row grows it into the site's card; clicking keeps it open.
   Pressing the button sends the page's text to the server, once, and the
   same box grows into the page card. The × hides the badge on this page
   until it is next loaded. Nothing from the page is read until the button
   is pressed; nothing the reader types is ever read. */

import { createBar, isDark } from "./ui";
import { send, storage, type PageResponse, type SiteReply } from "./shared";
import { faviconUrl, readPage, siteLabel } from "./page";

interface Spot { left: number; top: number }
/* A reading still being made is asked about again this often, this many times. */
const AGAIN_MS = 3000, AGAIN_MAX = 10;

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
  const label = siteLabel();
  const ask = () => send<SiteReply>({ type: "site", url: location.href, label }).catch(() => null);
  const first = await ask();
  if (!first || first.state === "off") return;
  const { server } = first;
  /* Not on the server's own pages. */
  try { if (location.host === new URL(server).host) return; } catch { /* An odd server address is not a reason to stop. */ }
  const dark = isDark();
  let reading = first.reading;
  const drawer = () => reading ? `${server}/embed?key=${encodeURIComponent(reading.key)}&morph=1${dark ? "&theme=dark" : ""}#context=${encodeURIComponent(JSON.stringify(reading.context))}` : null;
  const bar = createBar({
    shape: "site", title: first.reading?.gauge.name ?? first.name ?? label ?? location.hostname.replace(/^www\./, ""), dark,
    drawer,
    /* The × hides the badge on this page until it is next loaded. */
    onDismiss: () => bar.remove(),
    page: {
      consented: async () => Boolean(await storage.get<boolean>("pageNoteSeen")),
      consent: () => storage.set({ pageNoteSeen: true }),
      analyse: () => send<PageResponse>({ type: "page", request: readPage() }),
      favicon: faviconUrl(),
    },
  });
  document.documentElement.append(bar.host);
  /* The site's reading as it stands: ready, none (an empty track), or still being made (the sweep, and another ask shortly). */
  const apply = (reply: SiteReply): boolean => {
    if (reply.state === "ready" && reply.reading) { reading = reply.reading; bar.set({ kind: "ready", gauge: reply.reading.gauge }); return true; }
    if (reply.state === "none") { bar.set({ kind: "empty", reason: reply.reason ?? "No reading for this site.", thin: reply.thin }); return true; }
    return false;
  };
  if (!apply(first)) {
    bar.set({ kind: "loading" });
    let tries = 0;
    const again = async () => {
      const reply = await ask();
      if (!reply || reply.state === "off") { bar.set({ kind: "empty", reason: "The reading could not finish." }); return; }
      if (apply(reply)) return;
      if (++tries < AGAIN_MAX) window.setTimeout(again, AGAIN_MS);
      else bar.set({ kind: "empty", reason: "Reading timed out." });
    };
    window.setTimeout(again, AGAIN_MS);
  }
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
     again when they come back to the very top. Scrolling closes the site's
     open card, never the page card, which is read against the page. Many
     sites scroll a box of their own rather than the window, so every
     scroll is heard (captured) and judged by what scrolled. */
  const faint = (event?: Event) => {
    const box = event && event.target !== document && event.target !== window ? event.target : document.scrollingElement;
    const scrolled = window.scrollY > 0 || (box instanceof Element && box.scrollTop > 0);
    if (scrolled && bar.state() === "open" && bar.mode() !== "page") bar.close();
    bar.host.toggleAttribute("data-faint", scrolled);
  };
  document.addEventListener("scroll", faint, { capture: true, passive: true });
  faint();
  /* A page that changes without loading (a video site, a shop) is a new page: the button comes back for it. */
  let href = location.href;
  window.setInterval(() => { if (location.href !== href) { href = location.href; bar.page({ kind: "button" }); } }, 1000);
}
void main();
