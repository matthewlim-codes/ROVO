import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, insertTournamentSchema } from "@workspace/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";

const router = Router();

router.get("/tournaments", async (req, res) => {
  try {
    const gender = typeof req.query.gender === "string" ? req.query.gender : undefined;
    const includePast = req.query.includePast === "true";
    const includeHidden = req.query.includeHidden === "true";

    const conditions = [];
    if (!includePast) {
      conditions.push(gte(tournamentsTable.endDate, sql`CURRENT_DATE`));
    }
    if (!includeHidden) {
      conditions.push(eq(tournamentsTable.hidden, false));
    }
    if (gender === "boys" || gender === "girls" || gender === "coed") {
      conditions.push(eq(tournamentsTable.gender, gender));
    }

    const tournaments = await db
      .select()
      .from(tournamentsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(tournamentsTable.startDate);
    res.json(tournaments);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

router.post("/tournaments", requireAdminAuth, async (req, res) => {
  const parsed = insertTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [tournament] = await db
      .insert(tournamentsTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(tournament);
  } catch (e) {
    res.status(500).json({ error: "Failed to create tournament" });
  }
});

router.put("/tournaments/:id", requireAdminAuth, async (req, res) => {
  const parsed = insertTournamentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [tournament] = await db
      .update(tournamentsTable)
      .set(parsed.data)
      .where(eq(tournamentsTable.id, req.params.id as string))
      .returning();
    if (!tournament)
      return res.status(404).json({ error: "Tournament not found" });
    res.json(tournament);
  } catch (e) {
    res.status(500).json({ error: "Failed to update tournament" });
  }
});

router.delete("/tournaments/:id", requireAdminAuth, async (req, res) => {
  try {
    await db
      .delete(tournamentsTable)
      .where(eq(tournamentsTable.id, req.params.id as string));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete tournament" });
  }
});

export default router;
