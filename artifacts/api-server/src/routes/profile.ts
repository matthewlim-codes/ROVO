import { Router } from "express";
import { db } from "@workspace/db";
import {
  userProfilesTable,
  updateUserProfileSchema,
  clubCodesTable,
  clubsTable,
} from "@workspace/db/schema";
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
    email =
      u.primaryEmailAddress?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      "";
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
    return res.json(profile);
  } catch {
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

const clubCodeBody = z.object({
  code: z.string().min(1),
});

router.post("/profile/club-code", requireAuth, async (req, res) => {
  const parsed = clubCodeBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const userId = getUserId(req);
    await ensureProfile(userId);

    // Verify the club code on the server — never trust client club/team claims.
    const [row] = await db
      .select({
        code: clubCodesTable.code,
        teamName: clubCodesTable.teamName,
        clubId: clubCodesTable.clubId,
        clubName: clubsTable.name,
      })
      .from(clubCodesTable)
      .leftJoin(clubsTable, eq(clubCodesTable.clubId, clubsTable.id))
      .where(eq(clubCodesTable.code, parsed.data.code.trim()))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "Invalid club code" });
    }

    const [updated] = await db
      .update(userProfilesTable)
      .set({
        club: row.clubName ?? "",
        team: row.teamName,
        clubCodeEntered: "true",
        updatedAt: new Date(),
      })
      .where(eq(userProfilesTable.userId, userId))
      .returning();
    return res.json(updated);
  } catch {
    return res.status(500).json({ error: "Failed to save club code" });
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
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
