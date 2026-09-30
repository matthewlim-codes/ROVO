import { db } from "@workspace/db";
import { jobRunsTable, adminAuditLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  acquireJobLock,
  releaseJobLock,
  runLifecycleJob,
} from "./lifecycleJob";
import { runDiscoveryJob } from "../discovery/discoveryJob";

export type JobType = "discovery" | "lifecycle" | "combined";

export async function writeAudit(entry: {
  actor?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(adminAuditLogTable).values({
    actor: entry.actor ?? "admin",
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: (entry.before as Record<string, unknown>) ?? null,
    after: (entry.after as Record<string, unknown>) ?? null,
  });
}

export async function runJobs(opts: {
  jobType: JobType;
  dryRun?: boolean;
  triggeredBy?: string;
}) {
  const dryRun = !!opts.dryRun;
  const lockId = opts.jobType;
  const token = await acquireJobLock(lockId, opts.triggeredBy ?? "job");
  if (!token) {
    const [skipped] = await db
      .insert(jobRunsTable)
      .values({
        jobType: opts.jobType,
        status: "skipped_locked",
        dryRun,
        triggeredBy: opts.triggeredBy ?? "manual",
        summary: { reason: "Another run holds the lock" },
        completedAt: new Date(),
      })
      .returning();
    return skipped;
  }

  const [run] = await db
    .insert(jobRunsTable)
    .values({
      jobType: opts.jobType,
      status: "running",
      dryRun,
      lockToken: token,
      triggeredBy: opts.triggeredBy ?? "manual",
    })
    .returning();

  try {
    const summary: Record<string, unknown> = {};
    if (opts.jobType === "discovery" || opts.jobType === "combined") {
      summary.discovery = await runDiscoveryJob({ dryRun });
    }
    if (opts.jobType === "lifecycle" || opts.jobType === "combined") {
      summary.lifecycle = await runLifecycleJob({ dryRun });
    }
    const [done] = await db
      .update(jobRunsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        summary,
      })
      .where(eq(jobRunsTable.id, run.id))
      .returning();
    return done;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const [failed] = await db
      .update(jobRunsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: message,
      })
      .where(eq(jobRunsTable.id, run.id))
      .returning();
    return failed;
  } finally {
    await releaseJobLock(lockId, token);
  }
}
