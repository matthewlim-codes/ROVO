import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clubsTable } from "./clubs";

export const clubCodesTable = pgTable("club_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").unique().notNull(),
  clubId: uuid("club_id")
    .references(() => clubsTable.id, { onDelete: "cascade" })
    .notNull(),
  teamName: text("team_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClubCodeSchema = createInsertSchema(clubCodesTable).omit({
  id: true,
  createdAt: true,
});
export const selectClubCodeSchema = createSelectSchema(clubCodesTable);

export type ClubCode = typeof clubCodesTable.$inferSelect;
export type InsertClubCode = z.infer<typeof insertClubCodeSchema>;
