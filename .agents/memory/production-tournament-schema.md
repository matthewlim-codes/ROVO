---
name: Production tournament schema
description: Safe deployment sequence for tournament discovery schema on Replit-managed production PostgreSQL.
---

Use Replit's Publish flow to apply development schema changes to the managed production database. Do not run a direct schema push against production even if a project runbook describes doing so.

**Why:** The runbook predates the current managed-database Publish workflow; production schema changes are surfaced and applied by Publish, with rename and destructive-change review. The lifecycle backfill example is guarded against production-looking connections, so it cannot be treated as an agent-run production step.

**How to apply:** Check live development and production schemas before publishing; ensure a recoverable production backup exists first. Apply the schema to development, review the Publish diff and let the user publish. Plan any one-time data backfill separately after schema deployment, under explicit operations oversight, rather than putting production DDL or DML into build/startup hooks.