/* What the hands, the brain and the options page share: the server's
   address, the messages between them, and the storage. The wire shapes
   are the server's own types, imported for checking only. */

import type { ExtensionConfig, Gauge, GaugeRequest, GaugeResponse, SubjectStates } from "../../server/src/lib/types";

export type { ExtensionConfig, Gauge, GaugeRequest, GaugeResponse, SubjectStates };

export const DEFAULT_SERVER = "https://opinionmeter.vercel.app";

export type Message =
  | { type: "config" }
  | { type: "gauge"; request: GaugeRequest }
  | { type: "poll"; keys: string[] };

export interface ConfigReply { server: string; config: ExtensionConfig }

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
