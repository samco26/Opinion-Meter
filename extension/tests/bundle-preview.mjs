/* Builds the three bundles a standalone test page needs to run the real
   hands, the real site badge and the real card list with synthetic
   readings: dist/preview/hands.js, site.js, embed.js. Never part of a
   package; CI uploads them as "opinion-meter-preview" so a test page can
   be assembled without Node on the owner's machine. */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("..");
mkdirSync("dist/preview", { recursive: true });
const out = async (name, options) => {
  const result = await build({ bundle: true, write: false, format: "iife", target: ["chrome111"], logLevel: "warning", ...options });
  writeFileSync(`dist/preview/${name}.js`, result.outputFiles[0].contents);
};
await out("hands", { entryPoints: ["src/content.ts"] });
await out("site", { entryPoints: ["src/site.ts"] });
await out("embed", {
  stdin: {
    contents: `import React from "react"; import { createRoot } from "react-dom/client"; import { Embed } from "@/components/Embed";
      (window as unknown as { mountEmbed: (props: Record<string, unknown>) => void }).mountEmbed = (props) => createRoot(document.getElementById("root")!).render(React.createElement(Embed, props));`,
    resolveDir: resolve(root, "server"), loader: "tsx",
  },
  jsx: "automatic",
  alias: { "@": resolve(root, "server/src") },
  tsconfig: resolve(root, "server/tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: [resolve(root, "server/node_modules")],
});
console.log("preview bundles written to dist/preview");
