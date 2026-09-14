# server

The always-on half: a Next.js project deployed to Vercel from this folder (set Vercel's Root Directory to `server`).

- `src/app/api/gauge`, `api/card`, `api/config` — the doors (see the root README, "Doors").
- `src/app/embed` — the card the drawer frames; `src/app/dev` — the test page; `src/app/privacy`.
- `src/lib/subject.ts` — the rule table that names subjects without an AI call; `analysis/name.ts` — the batched AI naming for the rest.
- `src/lib/sources/*` — one reader per platform, all returning the shared item shape; `adaptive.ts` widens the window.
- `src/lib/analysis/lite.ts` — the quick reading behind a bar; `analyse.ts` — the full card; `evidence.ts` — the counting; `heuristic.ts` — the no-key stand-in.
- `src/lib/memory.ts` — Upstash Redis, or a map in the process when unset; `limits.ts` — rate limits; `config.ts` — what the extension reads on start.

```bash
npm install
npm run dev      # http://localhost:3000/dev
npm test
npm run build
```

Keys go in `server/.env.local` (names in the root `.env.example`) or Vercel's Environment Variables. With none set, everything still answers from the free sources and a word-count estimate marked simulated.
