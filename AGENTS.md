# AGENTS.md — Rovo Codebase Reference

> **Audience:** AI coding agents working in this repository.
> **Product:** Rovo (repo folder: `ROVO`; legacy internal name: ReadySetGo / `rsg_*` keys).
> **Domain:** `rovousa.com` (Replit autoscale deployment).
> **Last verified against codebase:** 2026-05-31.

This document is the canonical reference for understanding what the app does, how it is structured, and where to make changes safely. Prefer this over `replit.md` for auth, matching, and security — `replit.md` contains stale information (see §12).

---

## 1. Product summary

Rovo is a **mobile-first app for club volleyball families** coordinating airport/hotel travel at tournaments.

**Core user loop:**

```
Sign in (Clerk) → Onboarding → Club code → Browse tournaments
  → Enter travel details → Get matched → Chat → Receive push/in-app notifications
```

**Target users:**

| Role | Access |
|------|--------|
| Parents/families | Mobile app — trips, matching, chat, notifications |
| Club admins | Web admin SPA at `/api/admin` — clubs, codes, tournaments, feedback |
| App admins | Mobile profile link to admin SPA; gated by `EXPO_PUBLIC_ADMIN_EMAILS` |

---

## 2. Monorepo layout

```
ROVO/
├── AGENTS.md                    ← this file
├── replit.md                    ← stack/commands (partially stale — see §12)
├── package.json                 ← root: typecheck + build orchestration
├── pnpm-workspace.yaml          ← artifacts/*, lib/*, scripts
│
├── artifacts/
│   ├── mobile/                  ← @workspace/mobile — Expo 54 app (main product)
│   │   ├── app/                 ← Expo Router screens (15 routes)
│   │   ├── components/          ← shared UI
│   │   ├── context/             ← AuthContext, TripContext, NotificationsContext
│   │   ├── utils/               ← api.ts, push.ts, time.ts
│   │   ├── scripts/build.js     ← production build (web + native bundles)
│   │   └── server/serve.js      ← static server for deployed web build
│   │
│   ├── api-server/              ← @workspace/api-server — Express 5 API
│   │   └── src/
│   │       ├── index.ts         ← entry: listen + cleanup job
│   │       ├── app.ts           ← Express middleware stack
│   │       ├── routes/          ← 14 route modules
│   │       ├── middlewares/     ← requireAuth, adminAuth, clerkProxy
│   │       └── lib/             ← logger, push, cleanup, profile
│   │
│   └── mockup-sandbox/          ← @workspace/mockup-sandbox — Vite UI sandbox (scaffolded, unused)
│
├── lib/
│   ├── db/                      ← @workspace/db — Drizzle schema + PostgreSQL pool
│   │   └── src/schema/          ← 10 table definitions
│   ├── api-spec/                ← OpenAPI spec (minimal — only /healthz)
│   ├── api-client-react/        ← Orval-generated React Query hooks (NOT used by mobile)
│   └── api-zod/                 ← Orval-generated Zod schemas (minimal)
│
├── scripts/                     ← post-merge.sh, seed-tournament-images.ts
└── .agents/memory/              ← agent notes (e.g. build-timeout fix)
```

**Package manager:** pnpm only (enforced in root `preinstall` script).

---

## 3. Tech stack

| Layer | Technology | Version notes |
|-------|------------|---------------|
| Runtime | Node.js | 24 |
| Language | TypeScript | 5.9 |
| Monorepo | pnpm workspaces | — |
| Mobile | Expo, React Native, Expo Router | Expo 54, RN 0.81, React 19 |
| Auth | Clerk | `@clerk/expo` (client), `@clerk/express` (server) |
| API | Express | 5.x, esbuild bundle → `dist/index.mjs` |
| Database | PostgreSQL + Drizzle ORM | Schema push via `pnpm --filter db push` |
| Validation | Zod | v4 (`zod/v4`) |
| Push | Expo Notifications + expo-server-sdk | — |
| Places | Google Maps Places API | Server-side proxy in `routes/places.ts` |
| Logging | Pino | Via `pino-http` |

---

## 4. Key commands

```bash
pnpm run typecheck                              # Full TS check (run before committing)
pnpm run build                                  # typecheck + build all packages
pnpm --filter @workspace/api-server run dev     # Local API server
pnpm --filter @workspace/db run push            # Push Drizzle schema to DB (dev)
pnpm --filter @workspace/api-spec run codegen   # Regenerate Orval client (spec is minimal)
```

**No automated tests or CI exist.** Quality gate is `pnpm run typecheck` only.

**Post-merge hook** (`scripts/post-merge.sh`): `pnpm install --frozen-lockfile` + `pnpm --filter db push`.

---

## 5. Mobile app

### 5.1 Entry routing (`artifacts/mobile/app/index.tsx`)

Gate sequence enforced on app launch:

```
!signedIn        → /login
!onboardingDone  → /onboarding   (AsyncStorage key: rsg_onboarding_done)
!clubCodeEntered → /club-code
else             → /tournaments
```

### 5.2 Screens

| Route file | Purpose |
|------------|---------|
| `app/login.tsx`, `sign-up.tsx`, `sso-callback.tsx` | Clerk authentication |
| `app/onboarding.tsx` | First-run carousel |
| `app/club-code.tsx` | Verify club code, save club/team to profile |
| `app/tournaments.tsx` | Main hub — tournament list, trip status, navigation |
| `app/travel-info.tsx` | Enter/edit travel details |
| `app/rideshare-matches.tsx` | Server-fetched 1:1 matches (±60 min) |
| `app/matches.tsx` | Client-side group matches (±45 min) |
| `app/chat/[groupId].tsx` | Chat for a group or 1:1 DM |
| `app/conversations.tsx` | Recent chat threads |
| `app/edit-profile.tsx` | Profile editing; admin link for privileged users |

### 5.3 State management

Three React contexts — **do not add a fourth without strong reason**:

| Context | File | Responsibility |
|---------|------|----------------|
| `AuthContext` | `context/AuthContext.tsx` | Clerk session, server profile sync, club code, push registration |
| `TripContext` | `context/TripContext.tsx` | Tournaments, trips, local cache, client matching, messages |
| `NotificationsContext` | `context/NotificationsContext.tsx` | In-app notification inbox (30s poll) |

**API layer:** All server calls go through `utils/api.ts` → `apiFetch()`. Clerk JWT attached via `setAuthTokenGetter`. React Query is wired in `_layout.tsx` but **most data fetching uses context + manual polling**, not generated hooks.

### 5.4 Local persistence (AsyncStorage)

| Key | Data |
|-----|------|
| `rsg_onboarding_done` | Onboarding completion flag |
| `rsg_trips` | Trip cache (optimistic + offline) |
| `rsg_messages` | Message cache |
| `rsg_tournament_images` | Local tournament image overrides |

Server trips are the source of truth for cross-user matching. Local cache is supplementary.

### 5.5 Polling intervals

- Trips: refreshed every **30s** when a tournament is selected (`TripContext`)
- Notifications: refreshed every **30s** + on app foreground (`NotificationsContext`)

There is **no WebSocket or SSE**. All updates are poll-based.

---

## 6. Backend (API server)

### 6.1 Middleware stack (`artifacts/api-server/src/app.ts`)

Order matters:

1. `pino-http` — structured request logging
2. `/api/__clerk` — Clerk Frontend API proxy (production only)
3. `cors({ credentials: true, origin: true })`
4. `express.json()` / `express.urlencoded()`
5. `clerkMiddleware()` — attaches auth to every request
6. `/api/static` — static files from `public/`
7. `/api` — route router

### 6.2 Auth model

| Route type | Middleware | Identity source |
|------------|------------|-----------------|
| User mutations/reads | `requireAuth` | Clerk JWT → `getUserId(req)` |
| Admin CRUD | `requireAdminAuth` | HTTP Basic Auth (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) |
| Public reads | none | — |

**Important:** On protected routes, `userId` is always derived from the JWT. Client-supplied `userId` in request bodies (still present in some mobile calls) is **ignored** by the server.

Clerk proxy (`middlewares/clerkProxyMiddleware.ts`): enables auth on custom domains without CNAME. Active only when `NODE_ENV=production`. Mobile uses dynamic proxy URL on web: `{origin}/api/__clerk`.

### 6.3 Route modules (`artifacts/api-server/src/routes/`)

| File | Mount prefix | Auth |
|------|-------------|------|
| `health.ts` | `/healthz` | Public |
| `clubs.ts` | `/clubs` | GET public; mutations admin |
| `clubCodes.ts` | `/club-codes` | verify public; CRUD admin |
| `tournaments.ts` | `/tournaments` | GET public; mutations admin |
| `places.ts` | `/places/*` | Public |
| `trips.ts` | `/trips` | GET public ⚠️; POST/DELETE/matches auth |
| `watches.ts` | `/watches` | Auth |
| `notifications.ts` | `/notifications` | Auth |
| `pushTokens.ts` | `/push-tokens` | Auth |
| `profile.ts` | `/profile` | Auth |
| `messages.ts` | `/messages` | Auth |
| `metrics.ts` | `/metrics` | Admin — funnel + survey aggregates |
| `surveys.ts` | `/surveys/*` | Auth — post-ride survey |
| `feedback.ts` | `/feedback` | POST auth; GET/DELETE admin |
| `admin.ts` | `/admin` | Basic auth SPA |

### 6.4 Matching engine (`routes/trips.ts`, `routes/watches.ts`)

**Match criteria (all must hold):**

- Same `tournamentId`
- Same `mode` (`arrival` | `departure`)
- Same `airport`
- Same `hotel` (case-insensitive name OR matching `hotelPlaceId`)
- Datetime within time window

**Time windows (inconsistency — see §12):**

| Trigger | Window |
|---------|--------|
| `POST /trips` trip-to-trip matching | ±45 min |
| `POST /trips` watch matching | ±45 min |
| `GET /trips/matches` (rideshare screen) | ±60 min |
| Client `groupTripsIntoMatches` (matches screen) | ±45 min |

**On match:** insert `match_events` row(s), insert `notifications`, send Expo push, deactivate matched watches.

**On trip delete:** notify previously matched users (`ride_cancelled` kind).

**One trip per user per tournament:** creating a trip deletes any existing trip by that user for that tournament.

### 6.5 Chat (`routes/messages.ts`)

- Messages stored in `chat_messages` table
- **Retention:** 3 days (enforced by daily cleanup job + query filters)
- **Rate limit:** 20 messages/minute/user (in-memory `Map` — lost on restart)
- **Group ID formats:**
  - Group chat: `{tournamentId}-{airport}-{hotelPlaceId|hotel}-{mode}`
  - 1:1 DM: `rs-{tripId1}__{tripId2}` (trip IDs sorted alphabetically)
- Push sent to other group members on new message
- Deep link: push data `{ groupId, screen: "chat" }` → `/chat/[groupId]`

### 6.6 Push notifications (`lib/push.ts`)

- Tokens stored in `push_tokens` (upsert on register)
- Sent via `expo-server-sdk`
- Triggered on: ride match, ride cancellation, new chat message
- Mobile registers token on sign-in: `utils/push.ts` → `POST /api/push-tokens`

### 6.7 Daily cleanup (`lib/cleanup.ts`)

Runs on server start + every 24 hours:

- Delete `chat_messages` older than **3 days**
- Delete `trips` older than **90 days**

### 6.8 Admin panel (`routes/admin.ts`)

Single inline HTML SPA (~500 lines). Tabs: Clubs, Club Codes, Tournaments (with CSV import), Feedback. Protected by HTTP Basic Auth. **Do not extend this file without considering extraction** — it is already large.

---

## 7. Database schema

All tables defined in `lib/db/src/schema/`. Applied via Drizzle push (no migration files).

| Table | Primary purpose | Key columns |
|-------|----------------|-------------|
| `clubs` | Volleyball organizations | `id`, `name` |
| `club_codes` | Invite codes → club + team | `code` (unique), `clubId`, `teamName` |
| `tournaments` | Admin-managed events | `name`, `location`, `dates`, `startDate`, `endDate`, `gender`, `imageUrl`, `hidden` |
| `trips` | User travel entries (matching source of truth) | `userId`, `userName`, `userTeam`, `tournamentId`, `airport`, `hotel`, `hotelPlaceId`, `datetime`, `mode`, `baggageCount`, `partySize` |
| `ride_watches` | "Notify me" subscriptions | Same location fields + `active` (`"true"`/`"false"` text) |
| `notifications` | In-app inbox | `userId`, `kind`, `title`, `body`, `data` (jsonb), `readAt` |
| `push_tokens` | Expo device tokens | `token` (unique), `userId`, `platform` |
| `user_profiles` | Extended user data | `userId` (PK), `name`, `email`, `club`, `team`, `userTeamName`, `clubCodeEntered`, `avatarUri` |
| `chat_messages` | Server chat | `groupId`, `senderId`, `senderName`, `text`; indexed on groupId, senderId, createdAt |
| `match_events` | Recorded ride matches (analytics) | `tripId`, `matchedTripId`, `userId`, `matchedUserId`, `tripDatetime`, `mode` |
| `ride_surveys` | Post-ride survey responses | `userId`, `matchEventId`, `rating`, `moneySavedDollars`, `dismissed` |
| `feedback` | User feedback | `userId`, `userName`, `userEmail`, `message` |

**Profile creation:** lazy — `ensureProfile()` / `getOrCreateProfile()` creates row from Clerk data on first API call.

---

## 8. API reference

Base path: `/api`. Mobile resolves via `EXPO_PUBLIC_DOMAIN` → `https://{domain}/api`.

### Public endpoints

```
GET  /healthz
GET  /tournaments?gender=&includePast=&includeHidden=
GET  /clubs
GET  /club-codes/verify/:code
GET  /trips?tournamentId=                    ⚠️ unauthenticated — exposes travel data
GET  /places/airports?location=&query=
GET  /places/hotels?location=&query=
```

### Authenticated endpoints (Bearer JWT)

```
GET    /profile
PUT    /profile                              body: { name?, email?, avatarUri?, userTeamName? }
POST   /profile/club-code                    body: { club, team }

POST   /trips                                body: { tournamentId, airport, hotel, hotelPlaceId?, datetime, mode, baggageCount?, partySize? }
DELETE /trips/:id                            ownership check
GET    /trips/matches?tripId=                ±60 min 1:1 matches

GET    /watches
POST   /watches                              body: { tournamentId, airport, hotel, hotelPlaceId?, datetime, mode }
DELETE /watches/:id

GET    /notifications?unread=true
POST   /notifications/:id/read
POST   /notifications/read-all

POST   /push-tokens                          body: { token, platform? }

GET    /messages/conversations               last 3 days, max 2000 msgs scanned
GET    /messages?groupId=                    last 3 days, max 200 msgs
POST   /messages                             body: { groupId, senderName, text } — rate limited

POST   /feedback                             body: { message }

GET    /surveys/pending                      post-ride surveys due (trip datetime passed)
POST   /surveys                              body: { matchEventId, rating, moneySavedDollars?, notes? }
POST   /surveys/dismiss                      body: { matchEventId }
```

### Admin endpoints (Basic Auth)

```
GET    /metrics                              funnel + survey aggregates
GET    /admin                                HTML SPA
POST/PUT/DELETE  /clubs, /club-codes, /tournaments, /feedback
GET              /club-codes, /feedback
```

---

## 9. Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | API, DB lib | PostgreSQL connection |
| `PORT` | API server | Listen port (required) |
| `CLERK_SECRET_KEY` | API server | Clerk server SDK + proxy |
| `CLERK_PUBLISHABLE_KEY` | API server | Clerk |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Mobile | Clerk client |
| `EXPO_PUBLIC_CLERK_PROXY_URL` | Mobile | `"dynamic"` sentinel for web prod builds |
| `EXPO_PUBLIC_DOMAIN` | Mobile | API base URL |
| `EXPO_PUBLIC_ADMIN_EMAILS` | Mobile | Comma-separated admin emails |
| `EXPO_PUBLIC_ADMIN_URL` | Mobile | Override admin SPA URL |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | API server | Admin Basic Auth |
| `GOOGLE_MAPS_API_KEY` | API server | Places search (returns empty without it) |
| `DEPLOYMENT_DOMAIN` | Replit | Production domain |
| `NODE_ENV` | API server | Enables Clerk proxy when `production` |
| `ALLOW_DEMO_SEED` | DB seed script | Must be `true` to run demo seed |

---

## 10. Deployment

**Platform:** Replit autoscale (Cloud Run-style, ~2 min build budget).

Three Replit artifacts:

| Artifact | Port | Build | Serve |
|----------|------|-------|-------|
| Mobile | 18115 | `artifacts/mobile/scripts/build.js` | `server/serve.js` |
| API Server | 8080 | esbuild → `dist/index.mjs` | Node |
| Mockup sandbox | 8081 | Vite | Dev at `/__mockup` |

**Build constraint:** See `.agents/memory/build-timeout.md`. iOS + Android Metro bundle downloads must run in parallel (`Promise.all` in `build.js`).

---

## 11. Conventions for agents

### Do

- Match existing patterns: Zod validation in routes, Drizzle for DB, `requireAuth` for protected endpoints
- Derive `userId` from JWT on server — never trust client-supplied IDs
- Use `apiFetch` in mobile — do not introduce a second HTTP client
- Run `pnpm run typecheck` after changes
- Keep mobile changes scoped to the relevant context/screen
- Use `hotelPlaceId` alongside hotel name for matching reliability

### Do not

- Do not use `@workspace/api-client-react` in mobile (unused; mobile uses raw `apiFetch`)
- Do not extend `lib/api-spec/openapi.yaml` without also updating codegen workflow — spec currently only has `/healthz`
- Do not run `lib/db/src/seed.ts` in production (`ALLOW_DEMO_SEED` guard exists)
- Do not add sequential long-running steps to mobile `build.js` without checking build timeout budget
- Do not commit `.env` files or secrets
- Do not create git commits unless explicitly asked

### Naming drift (do not propagate)

Legacy names coexist — prefer **Rovo** in user-facing strings, but expect:

- AsyncStorage keys: `rsg_*`
- Internal docs: ReadySetGo
- Repo folder: ROVO

---

## 12. Known issues and architectural debt

Read this section before making changes to matching, auth, or API security.

### 12.1 Dual matching systems (HIGH)

Two parallel implementations with different behavior:

| Aspect | Arrivals (`rideshare-matches.tsx`) | Departures (`matches.tsx`) |
|--------|-------------------------------------|----------------------------|
| Match source | Server `GET /trips/matches` | Client `TripContext.getMatches()` |
| Time window | ±60 min | ±45 min |
| Chat model | 1:1 DMs (`rs-{id}__{id}`) | Group chat (`{tournament}-{airport}-{hotel}-{mode}`) |
| Screen used | `rideshare-matches` | `matches` |

**Bug:** `tournaments.tsx` routes to `rideshare-matches` for both modes, bypassing the departure-specific `matches` screen.

**Agent guidance:** Any matching change should aim to unify these systems. Do not add a third matching path.

### 12.2 Unauthenticated trip listing (SECURITY)

`GET /api/trips` has no auth. Anyone can list all trips for a tournament including names, hotels, and times. Fix by adding `requireAuth` and/or scoping results.

### 12.3 Demo data in production client

`DEMO_TRIPS` array in `TripContext.tsx` is loaded into state on every app start. Can pollute client-side group matching. Should be gated behind dev flag or removed.

### 12.4 Stale documentation

`replit.md` §Known limitations claims:
- "login is local-only via AsyncStorage" — **FALSE**, Clerk is implemented
- "endpoints trust client-supplied userId" — **FALSE**, server uses JWT

Trust this file (`AGENTS.md`) over `replit.md` for auth and security.

### 12.5 Unused codegen pipeline

- `lib/api-spec/openapi.yaml` defines only `/healthz`
- `@workspace/api-client-react` is a mobile dependency but never imported
- All real routes are hand-written Express + inline Zod

### 12.6 Other limitations

- Chat rate limits are in-memory (reset on server restart)
- Message retention is 3 days only
- No automated tests
- No CI/CD (no `.github/` workflows)
- Admin UI is inline HTML in one route file
- Many `catch {}` blocks silently swallow errors in mobile contexts
- `lib/integrations/*` referenced in workspace config but directory is empty

---

## 13. Common change patterns

### Add a new API endpoint

1. Define route in `artifacts/api-server/src/routes/{module}.ts`
2. Add Zod schema for request body/query
3. Use `requireAuth` or `requireAdminAuth` as appropriate
4. Register router in `routes/index.ts` if new module
5. Add corresponding `apiFetch` call in mobile context or screen
6. Update this file's §8 if the endpoint is significant

### Add a DB column

1. Edit table in `lib/db/src/schema/{table}.ts`
2. Update insert/select Zod schemas in same file
3. Run `pnpm --filter @workspace/db run push` (dev only)
4. Update API route and mobile types

### Add a mobile screen

1. Create file in `artifacts/mobile/app/{name}.tsx`
2. Register in `_layout.tsx` Stack if needed (Expo Router auto-discovers most routes)
3. Add navigation from existing screen
4. Use existing contexts — avoid duplicating server state

### Modify matching logic

1. Check BOTH server (`routes/trips.ts`, `routes/watches.ts`) AND client (`TripContext.groupTripsIntoMatches`)
2. Align time windows and hotel matching criteria
3. Update notification/push triggers if match conditions change
4. Consider chat group ID format impact

---

## 14. File quick-reference

| Task | Start here |
|------|-----------|
| Auth / profile | `context/AuthContext.tsx`, `routes/profile.ts`, `middlewares/requireAuth.ts` |
| Trips / matching | `context/TripContext.tsx`, `routes/trips.ts`, `routes/watches.ts` |
| Chat | `app/chat/[groupId].tsx`, `routes/messages.ts` |
| Notifications | `context/NotificationsContext.tsx`, `routes/notifications.ts`, `lib/push.ts` |
| Tournaments list | `app/tournaments.tsx`, `routes/tournaments.ts` |
| Travel input | `app/travel-info.tsx`, `components/AirportSearch.tsx`, `components/HotelSearch.tsx` |
| Admin | `routes/admin.ts`, `routes/metrics.ts`, `routes/clubs.ts`, `routes/clubCodes.ts`, `routes/tournaments.ts` |
| DB schema | `lib/db/src/schema/` |
| API client | `artifacts/mobile/utils/api.ts` |
| Build/deploy | `artifacts/mobile/scripts/build.js`, `.replit`, `.agents/memory/build-timeout.md` |
| Clerk proxy | `middlewares/clerkProxyMiddleware.ts`, `app/_layout.tsx` (proxyUrl logic) |

---

## 15. Data flow

```
Mobile (Expo)
  │
  ├─ Clerk Auth ──────────────────────────► Clerk API (via /api/__clerk proxy in prod)
  │
  ├─ apiFetch (JWT) ──────────────────────► Express API (/api/*)
  │                                           │
  │                                           ├─► PostgreSQL (Drizzle)
  │                                           ├─► Google Places API
  │                                           └─► Expo Push API
  │
  └─ AsyncStorage (local cache: trips, messages, images)
```

**Matching flow on trip create:**

```
POST /api/trips
  → delete existing user trip for tournament
  → insert new trip
  → query existing trips (same tournament/mode/airport)
  → filter by hotel + ±45min
  → insert notifications + send push to matched users
  → query active watches
  → filter by hotel + ±45min
  → insert notifications + send push + deactivate watches
  → return trip
```
