#!/usr/bin/env node
/**
 * Reusable job CLI for discovery + lifecycle.
 *
 *   pnpm --filter @workspace/api-server run jobs -- combined
 *   pnpm --filter @workspace/api-server run jobs -- discovery --dry-run
 *   pnpm --filter @workspace/api-server run jobs -- lifecycle
 *
 * Prefer external cron / Replit Scheduled Deployment hitting POST /api/jobs/run
 * with JOB_SECRET — do not rely on setInterval on autoscale.
 */

import { runJobs, type JobType } from "./lib/jobRunner";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const dryRun = args.includes("--dry-run");
  const typeArg = args.find((a) => !a.startsWith("--")) ?? "combined";
  if (!["discovery", "lifecycle", "combined"].includes(typeArg)) {
    console.error("Usage: jobs <discovery|lifecycle|combined> [--dry-run]");
    process.exit(2);
  }
  const result = await runJobs({
    jobType: typeArg as JobType,
    dryRun,
    triggeredBy: "cli",
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
