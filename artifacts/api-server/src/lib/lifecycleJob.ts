import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { tournamentsTable, jobLocksTable, type Tournament } from "@workspace/db/schema";
import {
  shouldArchivePublished,
  shouldPublishApproved,
  expectedPublishDate,
} from "./tournamentLifecycle";

const LOCK_TTL_MS = 15 * 60 * 1000;

export async function acquireJobLock(
  lockId: string,
  owner: string,
): Promise<string | null> {
  const token = `${owner}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date();
  const [existing] = await db
    .select()
    .from(jobLocksTable)
    .where(eq(jobLocksTable.id, lockId))
    .limit(1);

  if (!existing) {
    await db.insert(jobLocksTable).values({
      id: lockId,
      lockedAt: now,
      lockToken: token,
      owner,
    });
    return token;
  }

  const lockedAt = existing.lockedAt ? new Date(existing.lockedAt).getTime() : 0;
  const expired = !existing.lockToken || now.getTime() - lockedAt > LOCK_TTL_MS;
  if (!expired) return null;

  await db
    .update(jobLocksTable)
    .set({ lockedAt: now, lockToken: token, owner })
    .where(eq(jobLocksTable.id, lockId));
  return token;
}

export async function releaseJobLock(lockId: string, token: string) {
  await db
    .update(jobLocksTable)
    .set({ lockedAt: null, lockToken: null, owner: null })
    .where(and(eq(jobLocksTable.id, lockId), eq(jobLocksTable.lockToken, token)));
}

export type LifecycleSummary = {
  published: number;
  archived: number;
  examined: number;
  dryRun: boolean;
  candidates: Array<{ id: string; name: string; action: string; expectedPublishDate?: string }>;
};

export async function runLifecycleJob(opts: {
  dryRun?: boolean;
  now?: Date;
}): Promise<LifecycleSummary> {
  const dryRun = !!opts.dryRun;
  const now = opts.now ?? new Date();
  const summary: LifecycleSummary = {
    published: 0,
    archived: 0,
    examined: 0,
    dryRun,
    candidates: [],
  };

  const approved = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.status, "approved"));

  for (const t of approved) {
    summary.examined += 1;
    if (
      shouldPublishApproved({
        startDate: t.startDate,
        endDate: t.endDate,
        timezone: t.timezone,
        now,
      })
    ) {
      summary.candidates.push({
        id: t.id,
        name: t.name,
        action: "publish",
        expectedPublishDate: expectedPublishDate(t.startDate),
      });
      if (!dryRun) {
        await db
          .update(tournamentsTable)
          .set({
            status: "published",
            publishedAt: now,
            updatedAt: now,
          })
          .where(eq(tournamentsTable.id, t.id));
      }
      summary.published += 1;
    }
  }

  const published = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.status, "published"));

  for (const t of published) {
    summary.examined += 1;
    if (
      shouldArchivePublished({
        endDate: t.endDate,
        timezone: t.timezone,
        now,
      })
    ) {
      summary.candidates.push({
        id: t.id,
        name: t.name,
        action: "archive",
      });
      if (!dryRun) {
        await db
          .update(tournamentsTable)
          .set({
            status: "archived",
            archivedAt: now,
            updatedAt: now,
          })
          .where(eq(tournamentsTable.id, t.id));
      }
      summary.archived += 1;
    }
  }

  return summary;
}

export function publicTournamentFilter() {
  return and(
    eq(tournamentsTable.status, "published"),
    eq(tournamentsTable.hidden, false),
  );
}

export function withExpectedPublishDate<T extends Tournament>(t: T) {
  return {
    ...t,
    expectedPublishDate: expectedPublishDate(t.startDate),
  };
}
