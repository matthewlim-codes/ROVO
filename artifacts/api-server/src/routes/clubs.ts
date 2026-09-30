import { Router } from "express";
import { db } from "@workspace/db";
import { clubsTable, insertClubSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";

const router = Router();

router.get("/clubs", async (req, res) => {
  try {
    const clubs = await db.select().from(clubsTable).orderBy(clubsTable.name);
    return res.json(clubs);
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch clubs" });
  }
});

router.post("/clubs", requireAdminAuth, async (req, res) => {
  const parsed = insertClubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [club] = await db.insert(clubsTable).values(parsed.data).returning();
    return res.status(201).json(club);
  } catch (e) {
    return res.status(500).json({ error: "Failed to create club" });
  }
});

router.put("/clubs/:id", requireAdminAuth, async (req, res) => {
  const parsed = insertClubSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [club] = await db
      .update(clubsTable)
      .set(parsed.data)
      .where(eq(clubsTable.id, req.params.id as string))
      .returning();
    if (!club) return res.status(404).json({ error: "Club not found" });
    return res.json(club);
  } catch (e) {
    return res.status(500).json({ error: "Failed to update club" });
  }
});

router.delete("/clubs/:id", requireAdminAuth, async (req, res) => {
  try {
    await db.delete(clubsTable).where(eq(clubsTable.id, req.params.id as string));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to delete club" });
  }
});

export default router;
