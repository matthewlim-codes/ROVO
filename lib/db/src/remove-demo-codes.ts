/**
 * One-time cleanup script to remove demo/seed club codes from any environment.
 *
 * The following codes (GOLD2024, STORM24, VBALL25, ELITE25, FURY2025) were
 * inserted by the dev-only seed script. This script deletes them and their
 * parent clubs if no real data depends on them.
 *
 * Safe to run multiple times — all statements are idempotent.
 *
 * Run with: pnpm --filter @workspace/db run remove-demo-codes
 */

import { db } from "./index.js";
import { clubCodesTable, clubsTable } from "./schema/index.js";
import { inArray, eq } from "drizzle-orm";

const DEMO_CODES = ["GOLD2024", "STORM24", "VBALL25", "ELITE25", "FURY2025"];
const DEMO_CLUB_NAMES = [
  "Gold Volleyball Club",
  "Storm Volleyball",
  "Vball Academy",
  "Elite Volleyball Club",
  "Fury Volleyball",
];

async function removeDemoCodes() {
  console.log("Checking for demo club codes...");

  const existingCodes = await db
    .select({ id: clubCodesTable.id, code: clubCodesTable.code, clubId: clubCodesTable.clubId })
    .from(clubCodesTable)
    .where(inArray(clubCodesTable.code, DEMO_CODES));

  if (existingCodes.length === 0) {
    console.log("No demo club codes found. Nothing to remove.");
  } else {
    console.log(`Found ${existingCodes.length} demo code(s): ${existingCodes.map((r) => r.code).join(", ")}`);

    const deleted = await db
      .delete(clubCodesTable)
      .where(inArray(clubCodesTable.code, DEMO_CODES))
      .returning({ code: clubCodesTable.code });

    console.log(`Deleted club codes: ${deleted.map((r) => r.code).join(", ")}`);
  }

  console.log("Checking for demo clubs with no remaining codes...");

  const demoClusters = await db
    .select({ id: clubsTable.id, name: clubsTable.name })
    .from(clubsTable)
    .where(inArray(clubsTable.name, DEMO_CLUB_NAMES));

  const demoClustersToRemove: string[] = [];
  for (const club of demoClusters) {
    const remainingCodes = await db
      .select({ id: clubCodesTable.id })
      .from(clubCodesTable)
      .where(eq(clubCodesTable.clubId, club.id));

    if (remainingCodes.length === 0) {
      demoClustersToRemove.push(club.id);
      console.log(`  Club "${club.name}" has no codes — will remove.`);
    } else {
      console.log(`  Club "${club.name}" has ${remainingCodes.length} real code(s) — keeping.`);
    }
  }

  if (demoClustersToRemove.length > 0) {
    const deletedClubs = await db
      .delete(clubsTable)
      .where(inArray(clubsTable.id, demoClustersToRemove))
      .returning({ name: clubsTable.name });

    console.log(`Deleted clubs: ${deletedClubs.map((r) => r.name).join(", ")}`);
  } else {
    console.log("No empty demo clubs to remove.");
  }

  console.log("Done.");
}

removeDemoCodes()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
