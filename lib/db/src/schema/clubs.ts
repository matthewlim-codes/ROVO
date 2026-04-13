import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clubsTable = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city"),
  state: text("state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClubSchema = createInsertSchema(clubsTable).omit({
  id: true,
  createdAt: true,
});
export const selectClubSchema = createSelectSchema(clubsTable);

export type Club = typeof clubsTable.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
