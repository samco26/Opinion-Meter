/* What the hands, the brain and the options page share: the server's
   address, the messages between them, and the storage. The wire shapes
   are the server's own types, imported for checking only. */

import type { ExtensionConfig, Gauge, GaugeRequest, GaugeResponse, SubjectStates } from "../../server/src/lib/types";

export type { ExtensionConfig, Gauge, GaugeRequest, GaugeResponse, SubjectStates };

export const DEFAULT_SERVER = "https://opinion-meter.vercel.app";

export type Message =
  | { type: "config" }
  | { type: "gauge"; request: GaugeRequest }
  | { type: "poll"; keys: string[] };

export interface ConfigReply { server: string; config: ExtensionConfig }

export function send<T>(message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const failure = chrome.runtime.lastError?.message ?? (response as { error?: string } | undefined)?.error;
      if (failure) reject(new Error(failure));
      else resolve(response as T);
    });
  });
}

export const storage = {
  get: <T>(key: string) => new Promise<T | undefined>((resolve) => chrome.storage.local.get(key, (items) => resolve(items[key] as T | undefined))),
  set: (items: Record<string, unknown>) => new Promise<void>((resolve) => chrome.storage.local.set(items, resolve)),
  remove: (keys: string | string[]) => new Promise<void>((resolve) => chrome.storage.local.remove(keys, resolve)),
};

export const serverUrl = async () => ((await storage.get<string>("server")) ?? DEFAULT_SERVER).replace(/\/+$/, "");
