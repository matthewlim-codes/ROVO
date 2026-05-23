/**
 * DEV-ONLY SEED SCRIPT — DO NOT RUN IN PRODUCTION
 *
 * This script inserts demo clubs, club codes, and tournaments for local
 * development and testing only. The demo codes (GOLD2024, STORM24, VBALL25,
 * ELITE25, FURY2025) are fictitious and must never be seeded into the
 * production database, as they would allow unintended access to the app.
 *
 * Run locally with: pnpm --filter @workspace/db run seed
 */

import { db } from "./index.js";
import { clubsTable, clubCodesTable, tournamentsTable } from "./schema/index.js";

async function seed() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "Refusing to seed demo data. Set ALLOW_DEMO_SEED=true to explicitly opt in. " +
        "This script must never be run in production.",
    );
  }

  console.log("Seeding database...");

  const existingClubs = await db.select().from(clubsTable);
  if (existingClubs.length === 0) {
    const clubs = await db
      .insert(clubsTable)
      .values([
        { name: "Gold Volleyball Club", city: "Dallas", state: "TX" },
        { name: "Storm Volleyball", city: "Houston", state: "TX" },
        { name: "Vball Academy", city: "Austin", state: "TX" },
        { name: "Elite Volleyball Club", city: "San Antonio", state: "TX" },
        { name: "Fury Volleyball", city: "Phoenix", state: "AZ" },
      ])
      .returning();

    const [gold, storm, vball, elite, fury] = clubs;

    await db.insert(clubCodesTable).values([
      { code: "GOLD2024", clubId: gold.id, teamName: "16 Gold" },
      { code: "STORM24", clubId: storm.id, teamName: "15 Storm" },
      { code: "VBALL25", clubId: vball.id, teamName: "17 Elite" },
      { code: "ELITE25", clubId: elite.id, teamName: "16 Elite" },
      { code: "FURY2025", clubId: fury.id, teamName: "18 Fury" },
    ]);

    console.log("Inserted clubs and codes");
  } else {
    console.log("Clubs already seeded, skipping clubs/codes.");
  }

  const existingTournaments = await db.select().from(tournamentsTable);
  if (existingTournaments.length === 0) {
    await db.insert(tournamentsTable).values([
      {
        name: "Lone Star Classic (Girls)",
        location: "Kay Bailey Hutchison Convention Center, Dallas, TX",
        dates: "Mar 13–15, 2026",
        startDate: "2026-03-13",
        endDate: "2026-03-15",
        gender: "girls",
        description:
          "One of the largest girls club volleyball tournaments in Texas. 800+ teams across all age groups.",
      },
      {
        name: "Lone Star Classic (Boys)",
        location: "Kay Bailey Hutchison Convention Center, Dallas, TX",
        dates: "Apr 18–19, 2026",
        startDate: "2026-04-18",
        endDate: "2026-04-19",
        gender: "boys",
        description:
          "The boys edition of the Lone Star Classic, hosted in Dallas.",
      },
      {
        name: "JVA West Coast Cup",
        location: "Anaheim Convention Center, Anaheim, CA",
        dates: "May 22–25, 2026",
        startDate: "2026-05-22",
        endDate: "2026-05-25",
        gender: "girls",
        description:
          "Premier West Coast girls junior volleyball event hosted by JVA.",
      },
      {
        name: "SCVA Boys Las Vegas Classic",
        location: "Las Vegas Convention Center, Las Vegas, NV",
        dates: "Feb 14–16, 2026",
        startDate: "2026-02-14",
        endDate: "2026-02-16",
        gender: "boys",
        description:
          "Major SCVA-sanctioned boys event drawing teams from across the western U.S.",
      },
      {
        name: "Northern Lights National Qualifier",
        location: "Minneapolis Convention Center, Minneapolis, MN",
        dates: "Apr 3–5, 2026",
        startDate: "2026-04-03",
        endDate: "2026-04-05",
        gender: "girls",
        description:
          "USAV girls national qualifier. Bid berths to USAV Junior Nationals.",
      },
      {
        name: "Triple Crown NIT (Girls)",
        location: "Kansas City Convention Center, Kansas City, MO",
        dates: "Apr 24–26, 2026",
        startDate: "2026-04-24",
        endDate: "2026-04-26",
        gender: "girls",
        description:
          "Triple Crown Sports National Invitational Tournament for girls clubs.",
      },
      {
        name: "Boys Junior National Championships (USAV)",
        location: "Phoenix Convention Center, Phoenix, AZ",
        dates: "Jun 30–Jul 7, 2026",
        startDate: "2026-06-30",
        endDate: "2026-07-07",
        gender: "boys",
        description:
          "USA Volleyball Boys Junior National Championships — the top boys club event of the year.",
      },
      {
        name: "Girls Junior National Championships (USAV)",
        location: "Indiana Convention Center, Indianapolis, IN",
        dates: "Jul 1–8, 2026",
        startDate: "2026-07-01",
        endDate: "2026-07-08",
        gender: "girls",
        description:
          "USA Volleyball Girls Junior National Championships — the top girls club event of the year.",
      },
      {
        name: "AAU Girls Junior Nationals",
        location: "Orange County Convention Center, Orlando, FL",
        dates: "Jun 16–25, 2026",
        startDate: "2026-06-16",
        endDate: "2026-06-25",
        gender: "girls",
        description:
          "AAU Girls Junior National Volleyball Championships. Thousands of teams.",
      },
      {
        name: "AAU Boys Junior Nationals",
        location: "Orange County Convention Center, Orlando, FL",
        dates: "Jun 11–14, 2026",
        startDate: "2026-06-11",
        endDate: "2026-06-14",
        gender: "boys",
        description:
          "AAU Boys Junior National Volleyball Championships in Orlando.",
      },
      {
        name: "Mideast Power League Championship",
        location: "Greater Columbus Convention Center, Columbus, OH",
        dates: "May 1–3, 2026",
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        gender: "girls",
        description:
          "Season-ending championship for the Mideast Power League (girls).",
      },
      {
        name: "Big South National Qualifier",
        location: "Georgia World Congress Center, Atlanta, GA",
        dates: "Mar 20–22, 2026",
        startDate: "2026-03-20",
        endDate: "2026-03-22",
        gender: "girls",
        description:
          "USAV girls national qualifier hosted in Atlanta. Bids to USAV Nationals.",
      },
      {
        name: "Windy City National Qualifier",
        location: "McCormick Place, Chicago, IL",
        dates: "Mar 27–29, 2026",
        startDate: "2026-03-27",
        endDate: "2026-03-29",
        gender: "girls",
        description:
          "Major Midwest girls national qualifier. National-bid event.",
      },
      {
        name: "Mid-East Qualifier (MEQ)",
        location: "Indiana Convention Center, Indianapolis, IN",
        dates: "Apr 17–19, 2026",
        startDate: "2026-04-17",
        endDate: "2026-04-19",
        gender: "girls",
        description:
          "One of the largest girls national qualifiers in the country.",
      },
      {
        name: "Colorado Crossroads",
        location: "Colorado Convention Center, Denver, CO",
        dates: "Mar 6–8, 2026",
        startDate: "2026-03-06",
        endDate: "2026-03-08",
        gender: "girls",
        description:
          "Premier Mountain region girls club tournament.",
      },
      {
        name: "Boys Bid Tournament — Las Vegas",
        location: "Las Vegas Convention Center, Las Vegas, NV",
        dates: "Apr 4–5, 2026",
        startDate: "2026-04-04",
        endDate: "2026-04-05",
        gender: "boys",
        description:
          "USAV boys bid tournament. Earn a bid to Boys Junior Nationals.",
      },
      {
        name: "Northeast Qualifier (NEQ)",
        location: "Pennsylvania Convention Center, Philadelphia, PA",
        dates: "Apr 10–12, 2026",
        startDate: "2026-04-10",
        endDate: "2026-04-12",
        gender: "girls",
        description:
          "USAV Northeast Qualifier. National bids on the line.",
      },
    ]);
    console.log("Inserted tournaments");
  } else {
    console.log("Tournaments already seeded, skipping.");
  }

  console.log("Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
