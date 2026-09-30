import {
  pgTable,
  text,
  uuid,
  timestamp,
  date,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cityImagesTable } from "./cityImages";

export const tournamentStatusEnum = [
  "pending_review",
  "approved",
  "published",
  "archived",
  "rejected",
] as const;
export type TournamentStatus = (typeof tournamentStatusEnum)[number];

export const tournamentsTable = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  dates: text("dates").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  gender: text("gender", { enum: ["boys", "girls", "coed"] })
    .notNull()
    .default("coed"),
  description: text("description"),
  imageUrl: text("image_url"),
  /** Manual hide — independent of lifecycle status. */
  hidden: boolean("hidden").notNull().default(false),
  status: text("status", { enum: tournamentStatusEnum })
    .notNull()
    .default("published"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  organizer: text("organizer"),
  organizerEventId: text("organizer_event_id"),
  eventUrl: text("event_url"),
  venue: text("venue"),
  city: text("city"),
  state: text("state"),
  /** Stable identity for dedupe when organizer IDs are absent. */
  normalizedIdentity: text("normalized_identity"),
  cityImageId: uuid("city_image_id").references(() => cityImagesTable.id, {
    onDelete: "set null",
  }),
  imageAltText: text("image_alt_text"),
  imageCredit: text("image_credit"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  lastSourceCheckAt: timestamp("last_source_check_at", { withTimezone: true }),
  hasDiscrepancy: boolean("has_discrepancy").notNull().default(false),
  discrepancyNotes: text("discrepancy_notes"),
  /** Field names an admin has manually corrected — discovery must not overwrite. */
  manualFields: jsonb("manual_fields").$type<string[]>().notNull().default([]),
  sourcePayload: jsonb("source_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectTournamentSchema = createSelectSchema(tournamentsTable);

export type Tournament = typeof tournamentsTable.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type TournamentGender = "boys" | "girls" | "coed";

/** Public list publish window — keep in sync with api-server tournamentLifecycle. */
export const PUBLISH_LEAD_MONTHS = 6;
/** @deprecated Use PUBLISH_LEAD_MONTHS */
export const PUBLISH_LEAD_DAYS = PUBLISH_LEAD_MONTHS * 30;
