import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const userId = getUserId(req);
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

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, req.params.id as string),
          eq(notificationsTable.userId, userId),
        ),
      );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to mark read" });
  }
});

router.post("/notifications/read-all", requireAuth, async (_req, res) => {
  try {
    const userId = getUserId(_req);
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
