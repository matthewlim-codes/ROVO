import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, tripsTable } from "@workspace/db/schema";
import { and, eq, gte, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { sendPushToUsers } from "../lib/push";

const router = Router();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const prev = (rateLimitMap.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (prev.length >= RATE_LIMIT_MAX) return false;
  prev.push(now);
  rateLimitMap.set(userId, prev);
  return true;
}

async function getGroupMemberIds(groupId: string, senderId: string): Promise<string[]> {
  if (groupId.startsWith("rs-")) {
    const inner = groupId.slice(3);
    const sep = inner.indexOf("__");
    if (sep === -1) return [];
    const id1 = inner.slice(0, sep);
    const id2 = inner.slice(sep + 2);
    const rows = await db
      .select({ userId: tripsTable.userId })
      .from(tripsTable)
      .where(inArray(tripsTable.id, [id1, id2]));
    return rows.map((r) => r.userId).filter((uid) => uid !== senderId);
  }
  const since = new Date(Date.now() - THREE_DAYS_MS);
  const rows = await db
    .select({ senderId: chatMessagesTable.senderId })
    .from(chatMessagesTable)
    .where(and(eq(chatMessagesTable.groupId, groupId), gte(chatMessagesTable.createdAt, since)));
  return [...new Set(rows.map((r) => r.senderId))].filter((uid) => uid !== senderId);
}

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

  if (!checkRateLimit(senderId)) {
    return res.status(429).json({ error: "Too many messages. Slow down and try again." });
  }

  try {
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        groupId: parsed.data.groupId,
        senderId,
        senderName: parsed.data.senderName,
        text: parsed.data.text,
      })
      .returning();

    res.status(201).json(msg);

    getGroupMemberIds(parsed.data.groupId, senderId)
      .then((recipientIds) => {
        if (!recipientIds.length) return;
        return sendPushToUsers(
          recipientIds,
          parsed.data.senderName,
          parsed.data.text,
          { groupId: parsed.data.groupId, screen: "chat" },
        );
      })
      .catch(() => {});
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
