import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";
import { californiaClubsTable, discoverySourcesTable } from "./discovery";

export const attendanceEvidenceTypeEnum = [
  /** Club published schedule listing the event (planned). */
  "planned_schedule",
  /** Organizer team list / registration confirmation. */
  "registration_confirmed",
  /** Organizer registration page showing CA club registered. */
  "organizer_team_list",
  /** Other documented evidence reviewed by admin. */
  "admin_verified",
] as const;

export const attendanceEvidenceTable = pgTable("attendance_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .references(() => tournamentsTable.id, { onDelete: "restrict" })
    .notNull(),
  sourceId: uuid("source_id").references(() => discoverySourcesTable.id, {
    onDelete: "set null",
  }),
  californiaClubId: uuid("california_club_id").references(
    () => californiaClubsTable.id,
    { onDelete: "set null" },
  ),
  sourceUrl: text("source_url").notNull(),
  evidenceType: text("evidence_type", {
    enum: attendanceEvidenceTypeEnum,
  }).notNull(),
  clubOrTeamName: text("club_or_team_name").notNull(),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttendanceEvidenceSchema = createInsertSchema(
  attendanceEvidenceTable,
).omit({ id: true, createdAt: true });
export const selectAttendanceEvidenceSchema = createSelectSchema(
  attendanceEvidenceTable,
);

export type AttendanceEvidence = typeof attendanceEvidenceTable.$inferSelect;
export type InsertAttendanceEvidence = z.infer<
  typeof insertAttendanceEvidenceSchema
>;
