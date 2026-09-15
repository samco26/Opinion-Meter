/* What the hands, the brain and the options page share: the server's
   address, the messages between them, and the storage. The wire shapes
   are the server's own types, imported for checking only. */

import type { ExtensionConfig, Gauge, GaugeRequest, GaugeResponse, SubjectStates } from "../../server/src/lib/types";

export type { ExtensionConfig, Gauge, GaugeRequest, GaugeResponse, SubjectStates };

export const DEFAULT_SERVER = "https://opinionmeter.vercel.app";

export type Message =
  | { type: "config" }
  | { type: "gauge"; request: GaugeRequest }
  | { type: "poll"; keys: string[] }
  /* Ask the server to prepare a subject's full card now, so the drawer opens at once later. */
  | { type: "prefetch"; key: string }
  /* From a page on another site: the reading remembered for it, if any (none while the menu has the card turned off). */
  | { type: "site"; url: string }
  /* The × on a site's card: hide it on that site until its bar is next loaded on Google. */
  | { type: "site-hide"; url: string };

export interface ConfigReply { server: string; config: ExtensionConfig }

/* A reading carried from Google to a site: the subject, its numbers, and
   the request that made it, so the drawer can recover the card. */
export interface SiteReading { key: string; gauge: Gauge; context: GaugeRequest; at: number }
export interface SiteReply { reading: SiteReading | null; server: string }

/* The site a host belongs to: kia.com for www.kia.com, abc.net.au for
   www.abc.net.au, bbc.co.uk for www.bbc.co.uk. */
const TWO_PART = /(?:^|\.)(?:com|co|net|org|gov|edu|ac|or|ne|go)\.[a-z]{2}$/i;
export function siteOf(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, "");
  return h.split(".").slice(-(TWO_PART.test(h) ? 3 : 2)).join(".");
}
export const hostOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");
/* The page itself, without its fragment. */
export const pageOf = (url: string) => { const u = new URL(url); return `${u.origin}${u.pathname}${u.search}`; };

function once<T>(message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const failure = chrome.runtime.lastError?.message ?? (response as { error?: string } | undefined)?.error;
      if (failure) reject(new Error(failure));
      else resolve(response as T);
    });
  });
}

/* The brain is a background worker the browser may put to sleep between
   messages; a message that lands while it wakes is simply sent again. */
export async function send<T>(message: Message, attempt = 0): Promise<T> {
  try {
    return await once<T>(message);
  } catch (err) {
    const transient = /message channel closed|Receiving end does not exist|message port closed/i.test(String(err));
    if (transient && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      return send<T>(message, attempt + 1);
    }
    throw err;
  }
}

export const storage = {
  get: <T>(key: string) => new Promise<T | undefined>((resolve) => chrome.storage.local.get(key, (items) => resolve(items[key] as T | undefined))),
  set: (items: Record<string, unknown>) => new Promise<void>((resolve) => chrome.storage.local.set(items, resolve)),
  remove: (keys: string | string[]) => new Promise<void>((resolve) => chrome.storage.local.remove(keys, resolve)),
};

export const serverUrl = async () => ((await storage.get<string>("server")) ?? DEFAULT_SERVER).replace(/\/+$/, "");
