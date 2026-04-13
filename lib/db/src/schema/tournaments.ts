import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  dates: text("dates").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({
  id: true,
  createdAt: true,
});
export const selectTournamentSchema = createSelectSchema(tournamentsTable);

export type Tournament = typeof tournamentsTable.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
