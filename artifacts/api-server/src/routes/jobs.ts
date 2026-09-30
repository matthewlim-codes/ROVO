import { Router } from "express";
import { db } from "@workspace/db";
import { jobRunsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";
import { requireJobSecret } from "../middlewares/jobAuth";
import { runJobs, type JobType } from "../lib/jobRunner";
import { z } from "zod/v4";

const router = Router();

const bodySchema = z.object({
  jobType: z.enum(["discovery", "lifecycle", "combined"]).default("combined"),
  dryRun: z.boolean().optional(),
});

/** External cron / scheduler trigger — protected by JOB_SECRET. */
router.post("/jobs/run", requireJobSecret, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const run = await runJobs({
      jobType: parsed.data.jobType as JobType,
      dryRun: parsed.data.dryRun,
      triggeredBy: "scheduler",
    });
    return res.status(run.status === "failed" ? 500 : 200).json(run);
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Job failed",
    });
  }
});

router.get("/jobs/runs", requireAdminAuth, async (req, res) => {
  try {
    const limit = Math.min(
      Number(req.query.limit) || 50,
      200,
    );
    const rows = await db
      .select()
      .from(jobRunsTable)
      .orderBy(desc(jobRunsTable.startedAt))
      .limit(limit);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to load job runs" });
  }
});

router.get("/jobs/runs/:id", requireAdminAuth, async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(jobRunsTable)
      .where(eq(jobRunsTable.id, String(req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "Failed to load job run" });
  }
});

/** Admin-triggered run (Basic auth). */
router.post("/jobs/admin-run", requireAdminAuth, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const run = await runJobs({
      jobType: parsed.data.jobType as JobType,
      dryRun: parsed.data.dryRun,
      triggeredBy: "admin",
    });
    return res.json(run);
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Job failed",
    });
  }
});

export default router;
