import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

const router = Router();

router.get("/notifications", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!userId) return res.status(400).json({ error: "userId required" });
  const onlyUnread = req.query.unread === "true";
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        onlyUnread
          ? and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt))
          : eq(notificationsTable.userId, userId),
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(eq(notificationsTable.id, req.params.id as string));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to mark read" });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to mark read" });
  }
});

export default router;
