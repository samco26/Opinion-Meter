/* The slice of the extension API this code uses. Messages and local
   storage in the callback style Chrome and Firefox both support; the
   newer parts (session storage, optional permissions, script
   registration) in the promise style, reached through `browser` where it
   exists (Firefox) and `chrome` otherwise (see `api` in background.ts).
   Kept here instead of a types package so the build has two dependencies,
   not three. */

declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined;
    function sendMessage(message: unknown, callback: (response: unknown) => void): void;
    function getManifest(): { version: string; content_scripts?: Array<{ matches?: string[] }> };
    function openOptionsPage(): Promise<void>;
    const onMessage: { addListener(listener: (message: never, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void): void };
    const onInstalled: { addListener(listener: () => void): void };
    const onStartup: { addListener(listener: () => void): void };
  }
  namespace storage {
    namespace local {
      function get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void): void;
      function set(items: Record<string, unknown>, callback?: () => void): void;
      function remove(keys: string | string[], callback?: () => void): void;
    }
    /* Cleared when the browser closes; where carried readings live. */
    namespace session {
      function get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      function set(items: Record<string, unknown>): Promise<void>;
    }
  }
  namespace permissions {
    interface Permissions { origins?: string[]; permissions?: string[] }
    function contains(permissions: Permissions): Promise<boolean>;
    function request(permissions: Permissions): Promise<boolean>;
    function remove(permissions: Permissions): Promise<boolean>;
    const onRemoved: { addListener(listener: (permissions: Permissions) => void): void };
  }
  namespace scripting {
    interface RegisteredContentScript { id: string; matches: string[]; excludeMatches?: string[]; js?: string[]; runAt?: "document_start" | "document_end" | "document_idle"; persistAcrossSessions?: boolean }
    function registerContentScripts(scripts: RegisteredContentScript[]): Promise<void>;
    function unregisterContentScripts(filter?: { ids?: string[] }): Promise<void>;
  }
  namespace action {
    const onClicked: { addListener(listener: () => void): void };
  }
}
