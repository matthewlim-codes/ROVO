/**
 * DEV-ONLY — seeds a clearly labeled future test tournament into an
 * isolated local database. Refuses to run against production-looking URLs.
 *
 * Usage:
 *   DATABASE_URL=postgresql://rovo_dev:rovo_dev_local@127.0.0.1:5432/rovo_pilot_dev \
 *   ALLOW_PILOT_DEV_SEED=true \
 *   pnpm --filter @workspace/db run seed-pilot-dev
 */

import { and, eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import {
  clubsTable,
  clubCodesTable,
  tournamentsTable,
  userProfilesTable,
  tripsTable,
} from "./schema/index.js";

const PILOT_CLUB_NAME = "[TEST DEV ONLY] Pilot Club";
const PILOT_CODE = "PILOTDEV";
const PILOT_TOURNAMENT_NAME =
  "[TEST DEV ONLY] Pilot Match Verification — Dallas";
const PILOT_START = "2026-11-14";
const PILOT_END = "2026-11-16";
const PILOT_DATES = "Nov 14–16, 2026";
const PILOT_LOCATION = "Dallas, TX";

function assertIsolatedDevDatabase(url: string) {
  const lower = url.toLowerCase();
  const forbidden = [
    "rovousa.com",
    "neon.tech",
    "supabase.co",
    "amazonaws.com",
    "railway.app",
    "render.com",
    "production",
  ];
  for (const needle of forbidden) {
    if (lower.includes(needle)) {
      throw new Error(
        `Refusing pilot seed: DATABASE_URL looks like a shared/production host (${needle}).`,
      );
    }
  }
  const isLocal =
    lower.includes("127.0.0.1") ||
    lower.includes("localhost") ||
    lower.includes("rovo_pilot_dev");
  if (!isLocal) {
    throw new Error(
      "Refusing pilot seed: DATABASE_URL must point at a local isolated DB " +
        "(localhost/127.0.0.1 or database name rovo_pilot_dev).",
    );
  }
}

async function seedPilotDev() {
  if (process.env.ALLOW_PILOT_DEV_SEED !== "true") {
    throw new Error(
      "Set ALLOW_PILOT_DEV_SEED=true to seed isolated pilot data. Never run against production.",
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  assertIsolatedDevDatabase(url);

  console.log("Seeding isolated pilot-dev data into", url.replace(/:[^:@/]+@/, ":***@"));

  let [club] = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.name, PILOT_CLUB_NAME))
    .limit(1);
  if (!club) {
    [club] = await db
      .insert(clubsTable)
      .values({ name: PILOT_CLUB_NAME, city: "Dallas", state: "TX" })
      .returning();
    console.log("Created club:", club.name);
  } else {
    console.log("Club already present:", club.name);
  }

  let [code] = await db
    .select()
    .from(clubCodesTable)
    .where(eq(clubCodesTable.code, PILOT_CODE))
    .limit(1);
  if (!code) {
    [code] = await db
      .insert(clubCodesTable)
      .values({
        code: PILOT_CODE,
        clubId: club.id,
        teamName: "16 Pilot Dev",
      })
      .returning();
    console.log("Created club code:", code.code);
  } else {
    console.log("Club code already present:", code.code);
  }

  let [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.name, PILOT_TOURNAMENT_NAME))
    .limit(1);
  if (!tournament) {
    [tournament] = await db
      .insert(tournamentsTable)
      .values({
        name: PILOT_TOURNAMENT_NAME,
        location: PILOT_LOCATION,
        dates: PILOT_DATES,
        startDate: PILOT_START,
        endDate: PILOT_END,
        gender: "girls",
        description:
          "ISOLATED DEV ONLY — clearly labeled future event for travel entry and matching verification. Do not treat as a real tournament.",
        hidden: false,
      })
      .returning();
    console.log("Created tournament:", tournament.name, tournament.startDate, "→", tournament.endDate);
  } else {
    console.log("Tournament already present:", tournament.name);
  }

  // Two synthetic club members for matching checks (not Clerk users).
  const profiles = [
    {
      userId: "pilot-dev-user-a",
      name: "Pilot Parent A",
      email: "pilot-a@example.invalid",
      club: PILOT_CLUB_NAME,
      team: "16 Pilot Dev",
      clubCodeEntered: "true",
    },
    {
      userId: "pilot-dev-user-b",
      name: "Pilot Parent B",
      email: "pilot-b@example.invalid",
      club: PILOT_CLUB_NAME,
      team: "16 Pilot Dev",
      clubCodeEntered: "true",
    },
  ];

  for (const p of profiles) {
    const existing = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, p.userId))
      .limit(1);
    if (!existing.length) {
      await db.insert(userProfilesTable).values(p);
      console.log("Created profile:", p.userId);
    } else {
      await db
        .update(userProfilesTable)
        .set({
          club: p.club,
          team: p.team,
          clubCodeEntered: "true",
          updatedAt: new Date(),
        })
        .where(eq(userProfilesTable.userId, p.userId));
      console.log("Updated profile:", p.userId);
    }
  }

  // Clear prior pilot trips for a clean matching run.
  await db
    .delete(tripsTable)
    .where(
      and(
        eq(tripsTable.tournamentId, tournament.id),
      ),
    );

  console.log(
    JSON.stringify(
      {
        ok: true,
        clubId: club.id,
        clubCode: code.code,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        users: profiles.map((p) => p.userId),
      },
      null,
      2,
    ),
  );
}

seedPilotDev()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.exit(1);
  });
