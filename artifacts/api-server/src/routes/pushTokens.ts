import { Router } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db/schema";
import { z } from "zod/v4";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router = Router();

const body = z.object({
  token: z.string().min(1),
  platform: z.string().nullable().optional(),
});

router.post("/push-tokens", requireAuth, async (req, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const userId = getUserId(req);
    await db
      .insert(pushTokensTable)
      .values({
        token: parsed.data.token,
        userId,
        platform: parsed.data.platform ?? null,
      })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: {
          userId,
          platform: parsed.data.platform ?? null,
          updatedAt: new Date(),
        },
      });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to save push token" });
  }
});

export default router;
