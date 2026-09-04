# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full type check across all packages
- `pnpm run typecheck:libs` — type check libs only
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec

## Architecture

### Frontend: `artifacts/elite-ff`
- React + Vite (port from `$PORT` env var)
- Routing: wouter
- State: React Query + Context API
- CSS: Tailwind v4 + custom OKLCH theme matching reference site
- Fonts: Bricolage Grotesque (display) + DM Sans (body)
- Theme: Dark navy (#0a0e27) with orange-red gradient (#ff6b35 → #ff4500)

### Backend: `artifacts/api-server`
- Express 5 API server (port 8080)
- PostgreSQL + Drizzle ORM
- REST API with OpenAPI spec at `lib/api-spec`

### Shared Libs
- `lib/api-spec` — OpenAPI spec + Orval codegen config
- `lib/api-client-react` — React Query hooks (auto-generated)
- `lib/api-zod` — Zod schemas (auto-generated)

## Frontend Architecture (Elite FF Tournaments)

### Auth System (Frontend-only, localStorage)
- `HOST_CREDENTIALS`: `{ "242526": "Marvel@2727", "246858": "Venom@2727", "303234": "Alex@2425" }`
- `localStorage` keys: `eliteff_accounts`, `eliteff_active_user`
- Roles: `"host"` | `"player"`
- Contexts: `AuthContext` (auth), `AppContext` (app state)

### Routes
- `/` — Home page with hero, stats, community links
- `/tournaments` — Tournament list with tabs (All, My Registered, History, Kill Rankings)
- `/tournaments/:id` — Tournament detail with Info/Scoreboard/Room tabs
- `/tournaments/:id/edit` — Edit tournament (host only)
- `/results` — My match results
- `/alerts` — Notifications
- `/settings` — Settings + host controls
- `/host-settings` — Advanced host settings (host only)
- `/feedback` — Feedback form

### localStorage Keys
- `eliteff_hv` — human verification flag ("1" = verified)
- `eliteff_accounts` — array of saved accounts
- `eliteff_active_user` — currently active user
- `eliteff_alerts` — notifications array
- `eliteff_app_identity` — custom app name + logo URL
- `eliteff_host_settings` — host toggle settings
- `eliteff_notif_events` — notification event preferences
- `eliteff_whatsapp_url` — WhatsApp group link (editable by host)
- `eliteff_instagram_url` — Instagram link (editable by host)
- `eliteff_my_tournaments_{username}` — user's registered tournament IDs
- `eliteff_feedbacks` — feedback submissions
- `eliteff_kill_rankings` — kill leaderboard data
- `eliteff_main_upi_id` — main UPI ID for payments
- `eliteff_deleted_history` — deleted result IDs

## Design System
- Background: `oklch(0.06 0.015 265)` ≈ `#0a0e27` (dark navy)
- Primary gradient: `linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)`
- Card bg: `oklch(0.12 0.025 265)`
- Border: `oklch(0.18 0.03 265)`
- Muted text: `oklch(0.65 0.01 0)`
