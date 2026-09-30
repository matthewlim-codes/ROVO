/**
 * Migration plan — Tournament lifecycle & discovery (DO NOT apply to production
 * from this agent run).
 *
 * Goal: preserve existing tournaments and all related trips/messages.
 *
 * 1. Backup production DB.
 * 2. Push schema (drizzle-kit push) or apply equivalent SQL in a maintenance window.
 * 3. Backfill existing tournaments:
 *      - status = 'published' WHERE end_date >= CURRENT_DATE AND hidden = false
 *      - status = 'archived'  WHERE end_date < CURRENT_DATE
 *      - timezone = 'America/Los_Angeles' where null
 *      - city/state parsed from location when possible (nullable)
 *      - manual_fields = '[]', has_discrepancy = false
 * 4. Do NOT delete tournament rows. Soft-archive / reject only.
 * 5. Related tables (trips, messages, watches) keep tournament_id; no cascade delete.
 * 6. Create empty california_clubs / discovery_sources — admin must configure
 *    before discovery produces approvals (setup-required state).
 * 7. Verify GET /api/tournaments returns only status='published' AND NOT hidden.
 *
 * Local/dev only example:
 *   DATABASE_URL=postgresql://…/rovo_pilot_dev pnpm --filter @workspace/db run push
 *   DATABASE_URL=… pnpm --filter @workspace/db exec tsx src/migrate-tournament-lifecycle.ts
 */

export {};
