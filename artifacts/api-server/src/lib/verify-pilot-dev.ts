/**
 * Isolated-dev verification of travel entry + matching against rovo_pilot_dev.
 * Does not call production and does not require Clerk (DB + matching lib only).
 *
 * Usage:
 *   DATABASE_URL=postgresql://rovo_dev:rovo_dev_local@127.0.0.1:5432/rovo_pilot_dev \
 *   pnpm --filter @workspace/api-server run verify-pilot-dev
 */

import assert from "node:assert/strict";
import { and, eq, ne } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  tripsTable,
  tournamentsTable,
  userProfilesTable,
} from "@workspace/db/schema";
import {
  hotelsMatch,
  isWithinMatchWindow,
  normalizeAirportCode,
  tripsMatchCriteria,
  MATCH_WINDOW_MS,
} from "./matching";
import { searchLocalAirports, airportFromCode } from "./airports";

const PILOT_TOURNAMENT_NAME =
  "[TEST DEV ONLY] Pilot Match Verification — Dallas";

function assertIsolatedDevDatabase(url: string) {
  const lower = url.toLowerCase();
  if (
    !(
      lower.includes("127.0.0.1") ||
      lower.includes("localhost") ||
      lower.includes("rovo_pilot_dev")
    )
  ) {
    throw new Error("Refusing verify: DATABASE_URL is not the isolated local pilot DB.");
  }
  for (const needle of ["rovousa.com", "neon.tech", "production"]) {
    if (lower.includes(needle)) {
      throw new Error(`Refusing verify: DATABASE_URL looks like production (${needle}).`);
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  assertIsolatedDevDatabase(url);

  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const check = (name: string, fn: () => void | Promise<void>) =>
    Promise.resolve()
      .then(fn)
      .then(() => {
        results.push({ name, ok: true });
        console.log(`PASS  ${name}`);
      })
      .catch((e: unknown) => {
        const detail = e instanceof Error ? e.message : String(e);
        results.push({ name, ok: false, detail });
        console.error(`FAIL  ${name}: ${detail}`);
      });

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.name, PILOT_TOURNAMENT_NAME))
    .limit(1);
  assert.ok(tournament, "Pilot tournament missing — run seed-pilot-dev first");

  await check("tournament is future / not past-filtered out", () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.ok(
      tournament.endDate >= today,
      `endDate ${tournament.endDate} should be >= today ${today}`,
    );
    assert.ok(
      tournament.name.includes("[TEST DEV ONLY]"),
      "tournament must be clearly labeled",
    );
  });

  await check("airport fallback finds DFW without Google", () => {
    const hits = searchLocalAirports("DFW", "Dallas");
    assert.ok(hits.some((h) => h.iataCode === "DFW"));
    const custom = airportFromCode("XYZ");
    assert.equal(custom?.iataCode, "XYZ");
  });

  const hotelA = "Marriott Marquis Dallas";
  const hotelB = "Hyatt Regency Dallas";
  const baseTime = new Date("2026-11-14T18:00:00.000Z");

  // Simulate travel entry for two families (same hotel, within window)
  await db.delete(tripsTable).where(eq(tripsTable.tournamentId, tournament.id));

  const [tripA] = await db
    .insert(tripsTable)
    .values({
      userId: "pilot-dev-user-a",
      userName: "Pilot Parent A",
      userTeam: "16 Pilot Dev",
      tournamentId: tournament.id,
      airport: normalizeAirportCode("dfw"),
      hotel: hotelA.trim(),
      hotelPlaceId: null,
      datetime: baseTime,
      mode: "arrival",
      partySize: 3,
    })
    .returning();

  const [tripB] = await db
    .insert(tripsTable)
    .values({
      userId: "pilot-dev-user-b",
      userName: "Pilot Parent B",
      userTeam: "16 Pilot Dev",
      tournamentId: tournament.id,
      airport: normalizeAirportCode("DFW"),
      hotel: hotelA.trim(),
      hotelPlaceId: null,
      datetime: new Date(baseTime.getTime() + 45 * 60 * 1000),
      mode: "arrival",
      partySize: 2,
    })
    .returning();

  await check("two families at same hotel within 60 min match", () => {
    assert.equal(tripsMatchCriteria(tripA, tripB), true);
    assert.equal(
      hotelsMatch(tripA.hotel, tripA.hotelPlaceId, tripB.hotel, tripB.hotelPlaceId),
      true,
    );
  });

  // Route-shaped candidate query (mirrors GET /trips/matches filters + lib check)
  await check("DB candidate query + matching finds peer trip", async () => {
    const candidates = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.tournamentId, tripA.tournamentId),
          eq(tripsTable.mode, tripA.mode),
          ne(tripsTable.userId, tripA.userId),
        ),
      );
    const matches = candidates.filter((t) => tripsMatchCriteria(tripA, t));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, tripB.id);
  });

  const [tripDiffHotel] = await db
    .insert(tripsTable)
    .values({
      userId: "pilot-dev-user-b",
      userName: "Pilot Parent B",
      userTeam: "16 Pilot Dev",
      tournamentId: tournament.id,
      airport: "DFW",
      hotel: hotelB,
      hotelPlaceId: null,
      datetime: baseTime,
      mode: "departure",
      partySize: 2,
    })
    .returning();

  await check("different hotel does not match", () => {
    assert.equal(tripsMatchCriteria(tripA, tripDiffHotel), false);
  });

  await check("missing Place IDs alone do not match different hotels", () => {
    assert.equal(
      hotelsMatch(hotelA, null, hotelB, null),
      false,
    );
    assert.equal(
      hotelsMatch(hotelA, undefined, hotelB, undefined),
      false,
    );
  });

  await check("46–60 minute offsets match; beyond 60 does not", () => {
    const at = (minutes: number, extraMs = 0) => ({
      ...tripB,
      hotel: hotelA,
      hotelPlaceId: null as string | null,
      datetime: new Date(baseTime.getTime() + minutes * 60_000 + extraMs),
      mode: "arrival" as const,
    });
    // Displayed matches / match notifications / cancellation all use tripsMatchCriteria
    assert.equal(tripsMatchCriteria(tripA, at(46)), true);
    assert.equal(tripsMatchCriteria(tripA, at(60)), true);
    assert.equal(tripsMatchCriteria(tripA, at(60, 1)), false);
    assert.equal(tripsMatchCriteria(tripA, at(61)), false);

    // Watches use the same isWithinMatchWindow helper
    assert.equal(isWithinMatchWindow(tripA.datetime, at(46).datetime), true);
    assert.equal(isWithinMatchWindow(tripA.datetime, at(60).datetime), true);
    assert.equal(isWithinMatchWindow(tripA.datetime, at(60, 1).datetime), false);
  });

  await check("out-of-window times do not match", () => {
    const far = {
      ...tripB,
      hotel: hotelA,
      hotelPlaceId: null as string | null,
      datetime: new Date(baseTime.getTime() + MATCH_WINDOW_MS + 60_000),
      mode: "arrival" as const,
    };
    assert.equal(tripsMatchCriteria(tripA, far), false);
  });

  await check("different airports do not match", () => {
    assert.equal(
      tripsMatchCriteria(tripA, { ...tripB, airport: "DAL", hotel: hotelA }),
      false,
    );
  });

  await check("arrival and departure coexist for same user/tournament", async () => {
    // Replace only departure for user A — arrival must remain
    await db.transaction(async (tx) => {
      await tx
        .delete(tripsTable)
        .where(
          and(
            eq(tripsTable.userId, "pilot-dev-user-a"),
            eq(tripsTable.tournamentId, tournament.id),
            eq(tripsTable.mode, "departure"),
          ),
        );
      await tx.insert(tripsTable).values({
        userId: "pilot-dev-user-a",
        userName: "Pilot Parent A",
        userTeam: "16 Pilot Dev",
        tournamentId: tournament.id,
        airport: "DFW",
        hotel: hotelA,
        hotelPlaceId: null,
        datetime: new Date(baseTime.getTime() + 2 * 24 * 3600_000),
        mode: "departure",
      });
    });

    const userATrips = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.userId, "pilot-dev-user-a"),
          eq(tripsTable.tournamentId, tournament.id),
        ),
      );
    assert.ok(userATrips.some((t) => t.mode === "arrival"));
    assert.ok(userATrips.some((t) => t.mode === "departure"));
    assert.equal(userATrips.length, 2);
  });

  await check("club-scoped listing only includes verified club members", async () => {
    // outsider profile without club membership
    await db
      .insert(userProfilesTable)
      .values({
        userId: "pilot-dev-outsider",
        name: "Outsider",
        email: "outsider@example.invalid",
        club: "",
        team: "",
        clubCodeEntered: "false",
      })
      .onConflictDoNothing();

    const members = await db
      .select()
      .from(userProfilesTable)
      .where(
        and(
          eq(userProfilesTable.club, "[TEST DEV ONLY] Pilot Club"),
          eq(userProfilesTable.clubCodeEntered, "true"),
        ),
      );
    assert.ok(members.every((m) => m.userId.startsWith("pilot-dev-user-")));
    assert.ok(!members.some((m) => m.userId === "pilot-dev-outsider"));
  });

  await check("manual hotel Place IDs are sanitized as non-matching IDs", () => {
    // Local/manual placeholders must not count as Google Place IDs
    assert.equal(
      hotelsMatch(hotelA, "manual-123", hotelA, "manual-456"),
      true,
    ); // falls back to name match
    assert.equal(
      hotelsMatch(hotelA, "ChIJ_real_1", hotelA, "ChIJ_real_2"),
      false,
    );
  });

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- summary ---");
  console.log(
    JSON.stringify(
      {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
        },
        passed: results.filter((r) => r.ok).length,
        failed: failed.length,
        failures: failed,
      },
      null,
      2,
    ),
  );

  await pool.end();
  if (failed.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
