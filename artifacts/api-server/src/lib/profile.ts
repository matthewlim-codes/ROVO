import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";

export async function getOrCreateProfile(userId: string) {
  const existing = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);
  if (existing.length) return existing[0];
  let name = "";
  let email = "";
  // Skip Clerk lookup for guest device IDs
  if (!userId.startsWith("guest-")) {
    try {
      const u = await clerkClient.users.getUser(userId);
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      name = fullName || u.username || "";
      email =
        u.primaryEmailAddress?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        "";
    } catch {}
  } else {
    name = "Guest";
  }
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
