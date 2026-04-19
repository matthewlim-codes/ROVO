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

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## ReadySetGo Domain

Mobile app (`artifacts/mobile`) for club volleyball families to coordinate airport/hotel rides at tournaments. Backed by `artifacts/api-server` (Express + Drizzle) and the shared `@workspace/db` schema.

### Tables (lib/db/src/schema)
- `clubs`, `club_codes`, `tournaments` — admin-managed reference data
- `trips` — server-mirrored copy of trips (also stored locally in mobile AsyncStorage as a cache); used for cross-user matching
- `ride_watches` — "notify me when someone matches my ride" subscriptions; auto-deactivated after firing
- `notifications` — per-user inbox (in-app banner)
- `push_tokens` — Expo push tokens registered per user
- `feedback` — user-submitted feedback

### Key flows
- POST `/api/trips` and POST `/api/watches` both run cross-matching (same tournament, mode, airport, hotel within ±45 min). On match: insert into `notifications`, send Expo push via `expo-server-sdk`, deactivate the watch.
- Mobile registers a push token on session load (`utils/push.ts`).
- Admin page (`/api/admin`, basic auth via ADMIN_USERNAME/ADMIN_PASSWORD) includes a Feedback tab.
- Admin UI gating in mobile is via `EXPO_PUBLIC_ADMIN_EMAILS` (`.env`).

### Known limitations
- The new endpoints (trips, watches, notifications, push-tokens) trust client-supplied `userId`. There is no server-side auth in the app — login is local-only via AsyncStorage. Treat the matching system as cooperative, not adversarial. Adding real auth (e.g. session/JWT) would require refactoring login to be server-backed.
