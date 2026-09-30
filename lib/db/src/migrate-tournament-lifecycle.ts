/**
 * Backfill existing tournaments after schema push (DEV / staging only).
 * Never run against production from an automated agent without explicit ops approval.
 *
 *   ALLOW_LIFECYCLE_BACKFILL=true DATABASE_URL=… pnpm --filter @workspace/db exec tsx src/migrate-tournament-lifecycle.ts
 */

import { db, pool } from "./index.js";
import { tournamentsTable } from "./schema/index.js";
import { sql } from "drizzle-orm";

async function main() {
  if (process.env.ALLOW_LIFECYCLE_BACKFILL !== "true") {
    throw new Error("Set ALLOW_LIFECYCLE_BACKFILL=true to run this backfill.");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (/rovousa|neon\.tech|production/i.test(url)) {
    throw new Error("Refusing backfill against a production-looking DATABASE_URL.");
  }

  // Published if still upcoming; archived if past. Preserve hidden.
  await db.execute(sql`
    UPDATE tournaments
    SET
      status = CASE
        WHEN end_date < CURRENT_DATE THEN 'archived'
        ELSE COALESCE(NULLIF(status, ''), 'published')
      END,
      timezone = COALESCE(NULLIF(timezone, ''), 'America/Los_Angeles'),
      updated_at = NOW()
    WHERE TRUE
  `);

  console.log("Backfill complete.");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
