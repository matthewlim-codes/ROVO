import { pgTable, text, uuid, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** California clubs used as attendance criteria — admin-managed, never guessed. */
export const californiaClubsTable = pgTable("california_clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  city: text("city"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCaliforniaClubSchema = createInsertSchema(
  californiaClubsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCaliforniaClubSchema = createSelectSchema(californiaClubsTable);

export type CaliforniaClub = typeof californiaClubsTable.$inferSelect;
export type InsertCaliforniaClub = z.infer<typeof insertCaliforniaClubSchema>;

export const discoverySourceKindEnum = [
  "official_feed",
  "club_schedule",
  "organizer_api",
  "structured_calendar",
  "manual_json",
] as const;

/** Trusted discovery sources with source-specific adapters. */
export const discoverySourcesTable = pgTable("discovery_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind", { enum: discoverySourceKindEnum }).notNull(),
  /** Adapter key: ncva_calendar | scva_tournaments | manual_json | static_fixture (test-only) | proposed stubs */
  adapterKey: text("adapter_key").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDiscoverySourceSchema = createInsertSchema(
  discoverySourcesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const selectDiscoverySourceSchema = createSelectSchema(
  discoverySourcesTable,
);

export type DiscoverySource = typeof discoverySourcesTable.$inferSelect;
export type InsertDiscoverySource = z.infer<typeof insertDiscoverySourceSchema>;
