import { Router } from "express";
import { db } from "@workspace/db";
import { pushTokensTable, insertPushTokenSchema } from "@workspace/db/schema";

const router = Router();

router.post("/push-tokens", async (req, res) => {
  const parsed = insertPushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    await db
      .insert(pushTokensTable)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: { userId: parsed.data.userId, platform: parsed.data.platform, updatedAt: new Date() },
      });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to save push token" });
  }
});

export default router;
