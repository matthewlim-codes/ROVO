import { Router } from "express";
import { db } from "@workspace/db";
import { feedbackTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAdminAuth } from "../middlewares/adminAuth";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { getOrCreateProfile } from "../lib/profile";

const router = Router();

const body = z.object({
  message: z.string().min(1).max(5000),
});

router.post("/feedback", requireAuth, async (req, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const userId = getUserId(req);
    const profile = await getOrCreateProfile(userId);
    const [row] = await db
      .insert(feedbackTable)
      .values({
        userId,
        userName: profile?.name ?? null,
        userEmail: profile?.email ?? null,
        message: parsed.data.message,
      })
      .returning();
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

router.get("/feedback", requireAdminAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(feedbackTable)
      .orderBy(desc(feedbackTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

router.delete("/feedback/:id", requireAdminAuth, async (req, res) => {
  try {
    await db.delete(feedbackTable).where(eq(feedbackTable.id, req.params.id as string));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

export default router;
