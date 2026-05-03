import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db/schema";
import { and, eq, gte, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router = Router();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

router.get("/messages/conversations", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const since = new Date(Date.now() - THREE_DAYS_MS);
  try {
    const recentMsgs = await db
      .select()
      .from(chatMessagesTable)
      .where(gte(chatMessagesTable.createdAt, since))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(2000);

    const userGroupIds = [
      ...new Set(recentMsgs.filter((m) => m.senderId === userId).map((m) => m.groupId)),
    ];

    const conversations = userGroupIds.map((groupId) => {
      const groupMsgs = recentMsgs.filter((m) => m.groupId === groupId);
      const last = groupMsgs[0];
      return {
        groupId,
        lastMessage: last.text,
        lastSenderName: last.senderName,
        lastTimestamp: last.createdAt.toISOString(),
      };
    });

    res.json(conversations);
  } catch {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/messages", requireAuth, async (req, res) => {
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  if (!groupId) return res.status(400).json({ error: "groupId is required" });
  const since = new Date(Date.now() - THREE_DAYS_MS);
  try {
    const msgs = await db
      .select()
      .from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.groupId, groupId), gte(chatMessagesTable.createdAt, since)))
      .orderBy(chatMessagesTable.createdAt)
      .limit(200);
    res.json(msgs);
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/messages", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      groupId: z.string().min(1),
      senderName: z.string().min(1),
      text: z.string().min(1).max(2000),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const senderId = getUserId(req);
  try {
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({ groupId: parsed.data.groupId, senderId, senderName: parsed.data.senderName, text: parsed.data.text })
      .returning();
    res.status(201).json(msg);
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
