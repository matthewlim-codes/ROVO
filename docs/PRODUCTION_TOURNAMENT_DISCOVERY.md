# Production: tournament lifecycle + NCVA discovery

Exact steps for the existing Replit autoscale app. **Do not run migration from this agent against production.**

## What is implemented

| Piece | Status |
|-------|--------|
| `ncva_calendar` adapter | **Implemented** — NCVA WordPress REST calendar (`/wp-json/wp/v2/pages?slug=events`) |
| `manual_json` | **Implemented** — HTTPS JSON array or inline events (import workflow) |
| `static_fixture` | **Test-only** — blocked unless `ALLOW_TEST_ADAPTERS=true` |
| `aes_official` / `jva_calendar` / `usav_events` | **Proposed** — not implemented (see blockers below) |

## Blockers for other sources (verified)

- **AES / SportsEngine** (`results.advancedeventsystems.com`): public routes return the SPA HTML shell; OData roots do not expose a searchable event catalog. Needs official API/partner access.
- **USAV `/events/`**: HTML listing only; no public `wp/v2` events collection. Useful for human cross-check (e.g. Far Western boys also listed with Event Website → `ncva.com/boysbid/`).
- **SCVA tournaments page**: Wix site; no structured calendar API found.

## 1. Migration (preserve existing tournaments)

On a maintenance window, with a DB backup:

```bash
# From repo root, against PRODUCTION DATABASE_URL (you run this):
pnpm --filter @workspace/db run push

# Backfill lifecycle fields (dev guard — set explicitly):
ALLOW_LIFECYCLE_BACKFILL=true pnpm --filter @workspace/db exec tsx src/migrate-tournament-lifecycle.ts
```

Backfill intent (see `lib/db/src/MIGRATION_TOURNAMENT_LIFECYCLE.md`):

- Existing future, non-hidden rows → `status=published`
- Past `end_date` → `status=archived`
- Default timezone `America/Los_Angeles` where unset
- **No deletes**; trips/messages unchanged

## 2. Publish on Replit (project-level — not “API only”)

Profile → **Manage club codes** opens **production** admin (`https://rovousa.com/api/admin`). Until the project is published with the new code, you will still see the old admin (no Pending tab).

**Important Replit detail:** there is **no** “publish only the API Server artifact” control. The **Publish** button is in the **upper-right of the project editor** (Build or Design mode). Publishing deploys the project’s artifacts **together**.

### Do this *before* Publish

1. **Update the development database schema** (Replit/dev `DATABASE_URL`, not production yet):
   ```bash
   pnpm --filter @workspace/db run push
   ALLOW_LIFECYCLE_BACKFILL=true pnpm --filter @workspace/db exec tsx src/migrate-tournament-lifecycle.ts
   ```
2. **Confirm a production database backup** exists and is restorable (Neon/Replit Postgres snapshot or dump). Do not Publish until this is confirmed.
3. Ensure `main` includes the lifecycle/admin PRs (already merged on GitHub).

### Then Publish

1. In Replit project editor → upper-right **Publish**.
2. After publish finishes, hard-refresh: `https://rovousa.com/api/admin#pending` (Basic Auth).
3. Confirm tabs include **Pending review**, Scheduled, Published, Club Codes, etc.
4. Only then run **production** schema push + backfill (section 1) if production DB was not already migrated in a maintenance window.
5. Configure CA clubs + `ncva_calendar`, run discovery, approve events.

Local/agent DB data (`rovo_pilot_dev`) does **not** appear on production.

## 3. Production secrets / env

Set on the API deployment (Replit Secrets):

| Variable | Action |
|----------|--------|
| `DATABASE_URL` | Already set — confirm |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Already set — confirm |
| `JOB_SECRET` | **You must set** — long random string (e.g. `openssl rand -hex 32`) |
| `ALLOW_TEST_ADAPTERS` | **Must be unset/false** in production |
| `ALLOW_LIFECYCLE_BACKFILL` | **Must be unset** after one-time backfill |

## 4. Admin configuration (your action after deploy)

1. Open `https://YOUR_API_HOST/api/admin` (Basic Auth).
2. **Sources & CA clubs**
   - Add California clubs that should count for attendance (real clubs only).
   - Add discovery source:
     - Name: `NCVA official calendar`
     - Adapter: `ncva_calendar`
     - Config (default from admin prompt):  
       `{ "baseUrl":"https://ncva.com", "calendarPageSlug":"events", "genders":["boys"], "includePast":false }`
3. **Auto-approve policy** — use the new form:
   - Start conservative: `minCaliforniaClubs=1`, accept `planned_schedule` + `registration_confirmed` + `organizer_team_list` + `admin_verified`, `requireRegistrationConfirmed=false`, enabled.
4. Click **Preview changes** (dry-run). Review pending vs approve reasons.
5. Click **Run discovery** when satisfied.

### Expected first NCVA result (as of inspection)

- **Boys' Far Western National Qualifier** — 2026-12-12 → 2026-12-13 — McClellan Park, CA — https://ncva.com/boysbid/
- **Expected publish date:** 2026-06-12 (6 calendar months before start)
- **Attendance evidence:** none from the calendar alone → **pending review** until a club schedule / registration list / admin verification is attached

## 5. Daily scheduler (Replit autoscale)

Do **not** use in-process `setInterval` for discovery/lifecycle.

**Option A — Replit Scheduled Deployments** (if available on your plan): daily job that hits the API.

**Option B — External HTTPS cron** (cron-job.org, EasyCron, GitHub Actions cron, etc.):

```bash
curl -sS -X POST "https://YOUR_API_HOST/api/jobs/run" \
  -H "Authorization: Bearer $JOB_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobType":"combined","dryRun":false}'
```

Recommended time: **06:00 America/Los_Angeles** daily.

Verify:

```bash
# Unauthorized should 401
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "https://YOUR_API_HOST/api/jobs/run" \
  -H "Content-Type: application/json" -d '{"jobType":"lifecycle"}'

# Authorized
curl -sS -X POST "https://YOUR_API_HOST/api/jobs/run" \
  -H "Authorization: Bearer $JOB_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobType":"combined","dryRun":true}'
```

Check Admin → **Job history** for counts/failures.

## 6. Manual JSON import workflow (when evidence exists)

When a club publishes an official schedule naming an event, or you have a registration/team list URL:

1. Build a JSON array matching `manual_json` (see below).
2. Host it on HTTPS **or** paste via Admin source config `{ "events": [ … ] }`.
3. Preview → Run.

`manual_json` required fields per event: `name`, `startDate`, `endDate` (`YYYY-MM-DD`).  
Recommended: `organizer`, `organizerEventId`, `timezone`, `city`, `state`, `venue`, `gender`, `eventUrl`, `attendanceEvidence[]` with `sourceUrl`, `evidenceType`, `clubOrTeamName`.

## 7. Your remaining actions checklist

- [ ] Backup production DB
- [ ] Run schema push + guarded backfill
- [ ] Deploy API (with admin static files)
- [ ] Set `JOB_SECRET`; ensure `ALLOW_TEST_ADAPTERS` is not set
- [ ] Configure CA clubs + `ncva_calendar` source in Admin
- [ ] Tune auto-approve policy form
- [ ] Dry-run preview, then first real discovery run
- [ ] Attach real attendance evidence (or approve manually) for Far Western boys
- [ ] Configure daily cron to `POST /api/jobs/run`
- [ ] Optionally upload city images with attribution
