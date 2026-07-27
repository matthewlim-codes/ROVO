/**
 * One-off script to seed August–September 2026 volleyball tournaments.
 * Sources: prepdig.com, usavolleyball.org, aausports.org (researched July 2026)
 *
 * Run with: pnpm --filter @workspace/scripts run seed-aug-sep-tournaments
 */

import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db/schema";

const tournaments = [
  // ── August 2026 ────────────────────────────────────────────────────────────
  {
    name: "Prep Dig Iowa Sizzle",
    location: "Xtreme Arena, Iowa River Landing, Davenport, IA",
    dates: "Aug 4–5, 2026",
    startDate: "2026-08-04",
    endDate: "2026-08-05",
    gender: "girls" as const,
    description:
      "Prep Dig recruiting showcase for top girls clubs in the Midwest. NCAA-certified scouts on site; all matches streamed on BallerTV. Hosted at Xtreme Arena in Iowa River Landing (Davenport area).",
  },
  {
    name: "Prep Dig Vegas Showcase",
    location: "Las Vegas, NV",
    dates: "Aug 22, 2026",
    startDate: "2026-08-22",
    endDate: "2026-08-22",
    gender: "girls" as const,
    description:
      "Prep Dig one-day girls recruiting showcase in Las Vegas. College coaches attend; all matches broadcast on BallerTV. Open to graduating classes 2027–2030.",
  },
  {
    name: "USAV Sitting Volleyball NTDP Training Camp",
    location: "Edmond, OK",
    dates: "Aug 27–30, 2026",
    startDate: "2026-08-27",
    endDate: "2026-08-30",
    gender: "coed" as const,
    description:
      "USA Volleyball national team development program training camp for sitting volleyball. Open to elite youth athletes in the NTDP pipeline.",
  },
  {
    name: "KSA Volleyball Fall Classic",
    location: "Kansas City, MO",
    dates: "Aug 29–30, 2026",
    startDate: "2026-08-29",
    endDate: "2026-08-30",
    gender: "girls" as const,
    description:
      "KSA Events season-opening fall tournament drawing top high school and club volleyball teams from across the nation to kick off the fall season.",
  },

  // ── September 2026 ─────────────────────────────────────────────────────────
  {
    name: "JV Titan Invitational",
    location: "Alliant Energy Arena, Des Moines, IA",
    dates: "Sep 5, 2026",
    startDate: "2026-09-05",
    endDate: "2026-09-05",
    gender: "girls" as const,
    description:
      "Annual one-day girls volleyball invitational to open the fall prep season. Multi-pool format with bracket play; 20+ teams from across Iowa and neighboring states.",
  },
  {
    name: "NORCECA Women's U21 Pan American Cup",
    location: "Greater Columbus Convention Center, Columbus, OH",
    dates: "Sep 1–6, 2026",
    startDate: "2026-09-01",
    endDate: "2026-09-06",
    gender: "girls" as const,
    description:
      "NORCECA continental championship for women's U21 national teams from North and Central America. USA Volleyball hosts at the Greater Columbus Convention Center.",
  },
  {
    name: "USAV Beach NTDP Fall Training Series",
    location: "Dania Beach, FL",
    dates: "Sep 25–27, 2026",
    startDate: "2026-09-25",
    endDate: "2026-09-27",
    gender: "girls" as const,
    description:
      "USA Volleyball Beach National Team Development Program fall training series in South Florida. Elite youth beach players in the national pipeline.",
  },
  {
    name: "Early Bird Fall Qualifier — Midwest",
    location: "Indiana Convention Center, Indianapolis, IN",
    dates: "Sep 12–13, 2026",
    startDate: "2026-09-12",
    endDate: "2026-09-13",
    gender: "girls" as const,
    description:
      "Early-season USAV regional qualifier for the 2026–27 club season. Bid berths in 14s–18s divisions. Hosted at Indiana Convention Center in Indianapolis.",
  },
  {
    name: "Lone Star Fall Invitational",
    location: "Henry B. González Convention Center, San Antonio, TX",
    dates: "Sep 19–21, 2026",
    startDate: "2026-09-19",
    endDate: "2026-09-21",
    gender: "girls" as const,
    description:
      "Early fall girls club volleyball invitational in San Antonio. Teams from Texas and surrounding states competing ahead of the main qualifier season.",
  },
  {
    name: "Rocky Mountain Fall Classic",
    location: "Colorado Convention Center, Denver, CO",
    dates: "Sep 26–27, 2026",
    startDate: "2026-09-26",
    endDate: "2026-09-27",
    gender: "coed" as const,
    description:
      "Season-opening boys and girls club volleyball classic in Denver. Regional teams from CO, UT, WY, and NM. Formats include 14s–18s divisions.",
  },
];

async function main() {
  console.log(`Inserting ${tournaments.length} Aug–Sep 2026 tournaments...`);

  for (const t of tournaments) {
    const [row] = await db
      .insert(tournamentsTable)
      .values(t)
      .onConflictDoNothing()
      .returning({ id: tournamentsTable.id, name: tournamentsTable.name });
    if (row) {
      console.log(`  ✓ ${row.name} (${row.id})`);
    } else {
      console.log(`  – skipped (already exists): ${t.name}`);
    }
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
