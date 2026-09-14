/* The slice of the extension API this code uses, in the callback style
   that Chrome and Firefox both support. Kept here instead of a types
   package so the build has two dependencies, not three. */

declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined;
    function sendMessage(message: unknown, callback: (response: unknown) => void): void;
    function getManifest(): { version: string };
    const onMessage: { addListener(listener: (message: never, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void): void };
    const onInstalled: { addListener(listener: () => void): void };
  }
  namespace storage {
    namespace local {
      function get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void): void;
      function set(items: Record<string, unknown>, callback?: () => void): void;
      function remove(keys: string | string[], callback?: () => void): void;
    }
  }
}
