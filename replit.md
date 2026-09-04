# Elite FF Tournament Platform

A Free Fire mobile tournament management app where players register for tournaments, track results, and receive notifications — powered by Supabase Authentication and Drizzle database persistence.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/elite-ff run dev` — run the frontend Vite dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `DATABASE_URL`

## Vercel + Git deployment

- Import the repository at its root in Vercel. Keep the repository's package manager set to pnpm; `vercel.json` supplies the build command, static output directory, API function route, and SPA fallback.
- Add these variables to the Vercel project for Preview and Production:
  - `DATABASE_URL` — a PostgreSQL connection string reachable from Vercel, containing the same schema as the app.
  - `SUPABASE_URL` and `SUPABASE_ANON_KEY` — server-side values used to validate Supabase bearer tokens.
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — the same Supabase project values exposed to the Vite browser build.
- Never commit these values to Git. The Vite-prefixed Supabase anon key is intended for browser use; the database URL must remain server-only.
- After each deploy, verify `/api/healthz` and `/api/tournaments` on the Vercel domain before testing authenticated host actions.
- Add the Vercel domain to Supabase Auth's allowed redirect URLs and site URL. The app uses the current browser origin for Google OAuth callbacks.
- The public SEO shell includes robots rules, a sitemap, Open Graph/Twitter metadata, canonical URLs, and WebApplication structured data. Replace the relative sitemap host with the final custom domain if the SEO provider requires absolute `<loc>` values.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + Wouter routing
- API: Express 5
- Auth: Supabase Auth (Google OAuth only)
- Data backend: PostgreSQL through Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/elite-ff/src/` — React frontend
  - `pages/` — all page components (Home, Tournaments, TournamentDetail, Results, Alerts, Settings, HostSettings, Feedback, Profile, EditTournament, UploadResults, LiveScoreboard, PaymentVerification, HumanVerification)
  - `components/` — Header, BottomNav, LoginSheet, CreateTournamentModal
  - `contexts/AuthContext.tsx` — Supabase-backed auth context (user state, login/logout)
  - `contexts/AppContext.tsx` — theme + human verification state
  - `App.tsx` — Supabase auth context + QueryClientProvider + Router
- `artifacts/api-server/src/` — Express API
  - `routes/` — auth, tournaments, registrations, notifications, results, feedback, stats
  - `middlewares/authMiddleware.ts` — Supabase token verification and DB user upsert
- `lib/db/src/schema/` — Drizzle schema (tournaments, registrations, notifications, results, users, etc.)
- `lib/api-spec/openapi.yaml` — source-of-truth OpenAPI spec
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas
- `lib/api-client-react/src/generated/` — generated React Query hooks

## Architecture decisions

- **Supabase Auth replaces Clerk**: The browser keeps a Supabase session and sends its bearer token to the API. The API verifies the token with Supabase Auth and upserts the matching app user on first sign-in.
- **Host access via email allowlist**: `HOST_EMAILS = ["venomx2424@gmail.com", "knightxvenom@gmail.com"]` in both `authMiddleware.ts` (server) and `AuthContext.tsx` (client). The role is persisted to the DB on first login.
- **`users.mobile` stores Supabase user ID**: Rather than phone numbers, the `mobile` varchar column stores the Supabase Auth user ID as the join key between Supabase Auth and the DB.
- **Orval codegen post-processing**: The codegen script rewrites `lib/api-zod/src/index.ts` after orval runs because orval v8 in split mode generates an index referencing `api.schemas` that it doesn't actually produce for the Zod client.

## Product

- Human verification gate before app access
- Browse and register for Free Fire tournaments (solo, duo, squad)
- Pay entry fee via UPI (QR code generated client-side via external API)
- View room credentials (ID + password) once approved by host
- Live scoreboard per tournament
- Notification center for tournament updates
- Results/prize history
- Host panel: create/edit/cancel/delay tournaments, approve/decline registrations, upload results, manage scoreboard

## User preferences

- Host emails: venomx2424@gmail.com and knightxvenom@gmail.com (admin/host access)
- All other users get player role
- Keep all existing UI unchanged — auth-only changes to files

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Run `pnpm --filter @workspace/db run push` after changing DB schema
- The `minimumReleaseAge: 1440` in pnpm-workspace.yaml blocks packages published <1 day ago — add to `minimumReleaseAgeExclude` if needed
- `BASE_PATH` defaults to `"/"` in `vite.config.ts` if not set by the platform
- Images used in app are at `/attached_assets/*.png` (workspace root `attached_assets/` folder)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the Supabase integration connection and `artifacts/elite-ff/src/lib/auth.ts` for Supabase Auth configuration
