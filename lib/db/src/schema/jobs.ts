import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobTypeEnum = ["discovery", "lifecycle", "combined"] as const;
export const jobStatusEnum = [
  "running",
  "completed",
  "failed",
  "skipped_locked",
] as const;

export const jobRunsTable = pgTable("job_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: text("job_type", { enum: jobTypeEnum }).notNull(),
  status: text("status", { enum: jobStatusEnum }).notNull().default("running"),
  dryRun: boolean("dry_run").notNull().default(false),
  lockToken: text("lock_token"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  summary: jsonb("summary").$type<Record<string, unknown>>().default({}),
  error: text("error"),
  triggeredBy: text("triggered_by").notNull().default("manual"),
});

export const selectJobRunSchema = createSelectSchema(jobRunsTable);
export type JobRun = typeof jobRunsTable.$inferSelect;

/** Single-row advisory lock for overlapping job prevention. */
export const jobLocksTable = pgTable("job_locks", {
  id: text("id").primaryKey(), // e.g. "discovery", "lifecycle", "combined"
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockToken: text("lock_token"),
  owner: text("owner"),
});

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull().default("admin"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminAuditLogSchema = createInsertSchema(
  adminAuditLogTable,
).omit({ id: true, createdAt: true });
export type AdminAuditLog = typeof adminAuditLogTable.$inferSelect;

/** Key/value admin config — e.g. auto-approve policy. */
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;

export const AUTO_APPROVE_POLICY_KEY = "attendance_auto_approve_policy";

export type AutoApprovePolicy = {
  /** Minimum distinct CA clubs with evidence required for auto-approve. */
  minCaliforniaClubs: number;
  /** Evidence types that count toward auto-approve. */
  acceptedEvidenceTypes: string[];
  /** Require at least one registration_confirmed if true. */
  requireRegistrationConfirmed: boolean;
  enabled: boolean;
};
