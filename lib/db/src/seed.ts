import { db } from "./index.js";
import { clubsTable, clubCodesTable, tournamentsTable } from "./schema/index.js";

async function seed() {
  console.log("Seeding database...");

  const existing = await db.select().from(clubsTable);
  if (existing.length > 0) {
    console.log("Database already seeded. Skipping.");
    return;
  }

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

  console.log("Inserted clubs:", clubs.map((c) => c.name));

  const [gold, storm, vball, elite, fury] = clubs;

  await db.insert(clubCodesTable).values([
    { code: "GOLD2024", clubId: gold.id, teamName: "16 Gold" },
    { code: "STORM24", clubId: storm.id, teamName: "15 Storm" },
    { code: "VBALL25", clubId: vball.id, teamName: "17 Elite" },
    { code: "ELITE25", clubId: elite.id, teamName: "16 Elite" },
    { code: "FURY2025", clubId: fury.id, teamName: "18 Fury" },
  ]);

  console.log("Inserted club codes");

  await db.insert(tournamentsTable).values([
    {
      name: "Lone Star Classic",
      location: "Dallas, TX",
      dates: "Jan 10-12, 2026",
      description: "Annual Dallas volleyball showcase",
    },
    {
      name: "AAU Nationals",
      location: "Orlando, FL",
      dates: "Jun 20-25, 2026",
      description: "AAU Junior National Volleyball Championships",
    },
    {
      name: "Sand Volleyball Invitational",
      location: "Anaheim, CA",
      dates: "Mar 14-16, 2026",
      description: "Beach volleyball tournament at the Anaheim Convention Center",
    },
    {
      name: "Chicago Open",
      location: "Chicago, IL",
      dates: "Feb 21-23, 2026",
      description: "Midwest regional open tournament",
    },
    {
      name: "Rocky Mountain Classic",
      location: "Denver, CO",
      dates: "Apr 4-6, 2026",
      description: "High altitude volleyball competition",
    },
  ]);

  console.log("Inserted tournaments");
  console.log("Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
