import { Router } from "express";
import { db } from "@workspace/db";
import { feedbackTable, insertFeedbackSchema } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";

const router = Router();

router.post("/feedback", async (req, res) => {
  const parsed = insertFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [row] = await db.insert(feedbackTable).values(parsed.data).returning();
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
