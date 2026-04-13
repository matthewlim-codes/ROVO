import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, insertTournamentSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/tournaments", async (req, res) => {
  try {
    const tournaments = await db
      .select()
      .from(tournamentsTable)
      .orderBy(tournamentsTable.name);
    res.json(tournaments);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

router.post("/tournaments", async (req, res) => {
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

router.put("/tournaments/:id", async (req, res) => {
  const parsed = insertTournamentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [tournament] = await db
      .update(tournamentsTable)
      .set(parsed.data)
      .where(eq(tournamentsTable.id, req.params.id))
      .returning();
    if (!tournament)
      return res.status(404).json({ error: "Tournament not found" });
    res.json(tournament);
  } catch (e) {
    res.status(500).json({ error: "Failed to update tournament" });
  }
});

router.delete("/tournaments/:id", async (req, res) => {
  try {
    await db
      .delete(tournamentsTable)
      .where(eq(tournamentsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete tournament" });
  }
});

export default router;
