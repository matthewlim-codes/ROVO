import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable, updateUserProfileSchema } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { z } from "zod/v4";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router = Router();

async function ensureProfile(userId: string) {
  const existing = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);
  if (existing.length) return existing[0];
  let name = "";
  let email = "";
  try {
    const u = await clerkClient.users.getUser(userId);
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    name = fullName || u.username || "";
    email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? "";
  } catch {}
  const [row] = await db
    .insert(userProfilesTable)
    .values({ userId, name, email })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const refetch = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);
  return refetch[0];
}

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const profile = await ensureProfile(userId);
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

const clubCodeBody = z.object({
  club: z.string(),
  team: z.string(),
});

router.post("/profile/club-code", requireAuth, async (req, res) => {
  const parsed = clubCodeBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const userId = getUserId(req);
    await ensureProfile(userId);
    const [row] = await db
      .update(userProfilesTable)
      .set({
        club: parsed.data.club,
        team: parsed.data.team,
        clubCodeEntered: "true",
        updatedAt: new Date(),
      })
      .where(eq(userProfilesTable.userId, userId))
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to save club code" });
  }
});

router.put("/profile", requireAuth, async (req, res) => {
  const parsed = updateUserProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const userId = getUserId(req);
    await ensureProfile(userId);
    if (parsed.data.email) {
      const conflict = await db
        .select()
        .from(userProfilesTable)
        .where(
          and(
            eq(userProfilesTable.email, parsed.data.email),
            ne(userProfilesTable.userId, userId),
          ),
        )
        .limit(1);
      if (conflict.length) {
        return res.status(409).json({ error: "That email is already in use." });
      }
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.avatarUri !== undefined) {
      updates.avatarUri = parsed.data.avatarUri;
    }
    if (parsed.data.userTeamName !== undefined) {
      updates.userTeamName = parsed.data.userTeamName;
    }
    const [row] = await db
      .update(userProfilesTable)
      .set(updates)
      .where(eq(userProfilesTable.userId, userId))
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
