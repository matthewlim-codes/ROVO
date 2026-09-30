# Tournament discovery & lifecycle scheduling

Replit **autoscale** does not keep a single process alive, so discovery/lifecycle
must **not** rely on `setInterval` inside the API server.

## Job entrypoints

| Trigger | Command / endpoint | Auth |
|---------|-------------------|------|
| CLI | `pnpm --filter @workspace/api-server run jobs -- combined` | Local env / DB access |
| CLI dry-run | `pnpm --filter @workspace/api-server run jobs -- discovery --dry-run` | Local |
| HTTP | `POST /api/jobs/run` JSON `{ "jobType": "combined", "dryRun": false }` | `Authorization: Bearer $JOB_SECRET` or `X-Job-Secret` |
| Admin UI | Sources / Job history → Preview / Run | Admin Basic Auth |

Job types: `discovery` | `lifecycle` | `combined`.

Jobs are **idempotent**, use a **lock** to prevent overlap, and write a `job_runs` row with start/end, counts, and errors. A failed source never archives or deletes tournaments.

## Recommended scheduler (Replit)

1. Set `JOB_SECRET` (long random) on the API deployment secrets.
2. Use **Replit Scheduled Deployments** (or an external cron such as cron-job.org) to hit once daily:

```bash
curl -sS -X POST "https://YOUR_API_HOST/api/jobs/run" \
  -H "Authorization: Bearer $JOB_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobType":"combined","dryRun":false}'
```

3. Prefer ~06:00 America/Los_Angeles so California calendar-day boundaries are stable.

If Scheduled Deployments are unavailable on the plan, use any external HTTPS cron with the same request. Do **not** add an in-process interval for production.

## Environment variables

| Name | Purpose |
|------|---------|
| `JOB_SECRET` | Protects `POST /api/jobs/run` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin UI + admin job trigger |
| `DATABASE_URL` | Postgres |
| `ALLOW_LIFECYCLE_BACKFILL` | Dev-only schema backfill script |

## Source configuration

1. Admin → **Sources & CA clubs**
2. Add each California club that should count for attendance evidence.
3. Add a discovery source with an **implemented** adapter:
   - `manual_json` — HTTPS JSON array or inline `events` (implemented)
   - `static_fixture` — tests only
4. Proposed (not implemented): `aes_official`, `jva_calendar`, `usav_events`
5. Until at least one CA club and one enabled source exist, discovery returns **setup required** and does not guess.

## Image provider requirements

- Prefer admin upload (JPEG/PNG/WebP ≤ 5MB) with attribution + license text.
- Optional remote import allow-list: `upload.wikimedia.org`, `commons.wikimedia.org` (HTTPS only).
- Never scrape Google Images; never store expiring hotlink URLs as permanent assets without downloading into `/api/static/city-images/`.
- Placeholders are allowed when no licensed photo exists (`isPlaceholder`).
