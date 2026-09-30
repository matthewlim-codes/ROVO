/**
 * Local/dev helper: configure NCVA discovery source + California clubs,
 * then optionally print a dry-run discovery report.
 *
 * Refuses production-looking DATABASE_URL values.
 *
 * Usage:
 *   DATABASE_URL=postgresql://…/rovo_pilot_dev \
 *     pnpm --filter @workspace/api-server run configure-ncva-discovery
 */

import { db } from "@workspace/db";
import {
  californiaClubsTable,
  discoverySourcesTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { runDiscoveryJob } from "../discovery/discoveryJob";
import { expectedPublishDate } from "../lib/tournamentLifecycle";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (/rovousa|neon\.tech|production/i.test(url) && !/rovo_pilot_dev|127\.0\.0\.1|localhost/.test(url)) {
  console.error("Refusing to configure discovery against a production-looking DATABASE_URL");
  process.exit(1);
}

/** Real California clubs (public identities) — not claimed to attend any event here. */
const CA_CLUBS = [
  {
    name: "Force Performance Volleyball Club",
    city: "Elk Grove",
    websiteUrl: "https://forcevbc.com/boys-tournament-schedule",
    notes:
      "NorCal boys club with a public tournament schedule page. Schedule is evidence only when it names a specific event; do not assume Far Western attendance.",
  },
  {
    name: "City Beach Volleyball Club",
    city: "Pleasanton",
    websiteUrl: "https://www.citybeach.com/",
    notes: "NorCal club commonly active in NCVA events; configure schedule URL when verified.",
  },
  {
    name: "Absolute Volleyball Club",
    city: "San Jose",
    websiteUrl: "https://www.absolutevb.com/",
    notes: "Bay Area club; add schedule evidence when an official club schedule lists an event.",
  },
];

async function upsertClubs() {
  const existing = await db.select().from(californiaClubsTable);
  for (const club of CA_CLUBS) {
    const found = existing.find(
      (c) => c.name.toLowerCase() === club.name.toLowerCase(),
    );
    if (found) {
      await db
        .update(californiaClubsTable)
        .set({
          city: club.city,
          websiteUrl: club.websiteUrl,
          notes: club.notes,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(californiaClubsTable.id, found.id));
      console.log("updated CA club:", club.name);
    } else {
      await db.insert(californiaClubsTable).values({
        ...club,
        active: true,
      });
      console.log("created CA club:", club.name);
    }
  }
}

async function upsertNcvaSource() {
  const sources = await db.select().from(discoverySourcesTable);
  const found = sources.find((s) => s.adapterKey === "ncva_calendar");
  const config = {
    baseUrl: "https://ncva.com",
    calendarPageSlug: "events",
    genders: ["boys"],
    includePast: false,
  };
  if (found) {
    await db
      .update(discoverySourcesTable)
      .set({
        name: "NCVA official calendar",
        kind: "structured_calendar",
        adapterKey: "ncva_calendar",
        enabled: true,
        config,
        // Disable any leftover test fixtures on this DB
        updatedAt: new Date(),
      })
      .where(eq(discoverySourcesTable.id, found.id));
    console.log("updated source: NCVA official calendar");
  } else {
    await db.insert(discoverySourcesTable).values({
      name: "NCVA official calendar",
      kind: "structured_calendar",
      adapterKey: "ncva_calendar",
      enabled: true,
      config,
    });
    console.log("created source: NCVA official calendar");
  }

  // Keep test fixtures and unimplemented stubs out of active discovery on this DB
  for (const s of sources) {
    if (s.adapterKey === "ncva_calendar") continue;
    if (
      s.adapterKey === "static_fixture" ||
      s.adapterKey === "aes_official" ||
      s.adapterKey === "jva_calendar" ||
      s.adapterKey === "usav_events" ||
      s.enabled
    ) {
      // Disable everything except the NCVA source we just upserted / will upsert
      if (s.adapterKey !== "manual_json") {
        await db
          .update(discoverySourcesTable)
          .set({ enabled: false, updatedAt: new Date() })
          .where(eq(discoverySourcesTable.id, s.id));
        console.log("disabled non-production source:", s.name, s.adapterKey);
      }
    }
  }
}

function printReport(summary: Awaited<ReturnType<typeof runDiscoveryJob>>) {
  console.log("\n=== Discovery dry-run summary ===");
  console.log(
    JSON.stringify(
      {
        dryRun: summary.dryRun,
        setupRequired: summary.setupRequired,
        setupMessage: summary.setupMessage,
        sourcesChecked: summary.sourcesChecked,
        sourceFailures: summary.sourceFailures,
        created: summary.created,
        pendingReview: summary.pendingReview,
        autoApproved: summary.autoApproved,
        updated: summary.updated,
        discrepancies: summary.discrepancies,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Events ===");
  for (const change of summary.changes) {
    if (change.action !== "create" && change.action !== "update") {
      console.log("-", change.action, (change as { identity?: string }).identity);
      continue;
    }
    if (change.action === "update") {
      console.log(`\nUPDATE ${change.name}`);
      console.log("  fieldChanges:", change.fieldChanges);
      console.log("  discrepancy:", change.hasDiscrepancy);
      continue;
    }
    const e = change.event;
    const publishOn = expectedPublishDate(e.startDate);
    console.log(`\n${e.name}`);
    console.log(`  dates: ${e.startDate} → ${e.endDate} (${e.timezone})`);
    console.log(`  venue/city: ${e.venue ?? "—"} / ${e.city ?? "—"}, ${e.state ?? "—"}`);
    console.log(`  gender: ${e.gender}`);
    console.log(`  official URL: ${e.eventUrl ?? "—"}`);
    console.log(`  expected publish date: ${publishOn}`);
    console.log(`  attendance evidence count: ${e.attendanceEvidence.length}`);
    if (e.attendanceEvidence.length) {
      for (const ev of e.attendanceEvidence) {
        console.log(
          `    - ${ev.evidenceType} · ${ev.clubOrTeamName} · ${ev.sourceUrl}`,
        );
      }
    } else {
      console.log("    (none — not invented from proximity or popularity)");
    }
    console.log(`  decision: ${change.autoApprove ? "AUTO-APPROVE" : "PENDING REVIEW"}`);
    console.log(`  reason: ${change.reason}`);
    if (change.missingFields.length) {
      console.log(`  missing fields: ${change.missingFields.join(", ")}`);
    }
  }
}

async function main() {
  await upsertClubs();
  await upsertNcvaSource();
  const summary = await runDiscoveryJob({ dryRun: true });
  printReport(summary);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
