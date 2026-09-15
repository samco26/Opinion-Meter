/* The card on a site. When the reader has turned "take the bar with you"
   on and lands on a site whose bar was loaded on Google, the same pill
   sits fixed at the top right of every page of that site with the reading
   the brain remembers; clicking it opens the drawer as on Google. Nothing
   about the page is read beyond its address, and nothing about it is sent
   anywhere: the reading comes from the brain's memory or not at all. */

import { createBar, isDark, openOverlay } from "./ui";
import { send, type SiteReply } from "./shared";

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
  });
  document.documentElement.append(bar.host);
  bar.set({ kind: "ready", gauge: reading.gauge });
}
void main();
