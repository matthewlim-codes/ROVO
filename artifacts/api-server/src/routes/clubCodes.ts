import { Router } from "express";
import { db } from "@workspace/db";
import { clubCodesTable, clubsTable, insertClubCodeSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";
import { routeParam } from "../lib/matching";

const router = Router();

router.get("/club-codes", requireAdminAuth, async (req, res) => {
  try {
    const codes = await db
      .select({
        id: clubCodesTable.id,
        code: clubCodesTable.code,
        teamName: clubCodesTable.teamName,
        clubId: clubCodesTable.clubId,
        clubName: clubsTable.name,
        createdAt: clubCodesTable.createdAt,
      })
      .from(clubCodesTable)
      .leftJoin(clubsTable, eq(clubCodesTable.clubId, clubsTable.id))
      .orderBy(clubCodesTable.code);
    return res.json(codes);
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch club codes" });
  }
});

router.get("/club-codes/verify/:code", async (req, res) => {
  const code = routeParam(req.params.code);
  if (!code) {
    return res.status(400).json({ error: "Club code is required" });
  }
  try {
    const [row] = await db
      .select({
        code: clubCodesTable.code,
        teamName: clubCodesTable.teamName,
        clubId: clubCodesTable.clubId,
        clubName: clubsTable.name,
      })
      .from(clubCodesTable)
      .leftJoin(clubsTable, eq(clubCodesTable.clubId, clubsTable.id))
      .where(eq(clubCodesTable.code, code))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Invalid club code" });
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: "Failed to verify club code" });
  }
});

router.post("/club-codes", requireAdminAuth, async (req, res) => {
  const parsed = insertClubCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [code] = await db
      .insert(clubCodesTable)
      .values(parsed.data)
      .returning();
    return res.status(201).json(code);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique")) {
      return res.status(409).json({ error: "Code already exists" });
    }
    return res.status(500).json({ error: "Failed to create club code" });
  }
});

router.put("/club-codes/:id", requireAdminAuth, async (req, res) => {
  const parsed = insertClubCodeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [code] = await db
      .update(clubCodesTable)
      .set(parsed.data)
      .where(eq(clubCodesTable.id, req.params.id as string))
      .returning();
    if (!code) return res.status(404).json({ error: "Code not found" });
    return res.json(code);
  } catch (e) {
    return res.status(500).json({ error: "Failed to update club code" });
  }
});

router.delete("/club-codes/:id", requireAdminAuth, async (req, res) => {
  try {
    await db.delete(clubCodesTable).where(eq(clubCodesTable.id, req.params.id as string));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to delete club code" });
  }
});

export default router;
