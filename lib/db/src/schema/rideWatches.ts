import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rideWatchesTable = pgTable("ride_watches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  tournamentId: uuid("tournament_id").notNull(),
  airport: text("airport").notNull(),
  hotel: text("hotel").notNull(),
  hotelPlaceId: text("hotel_place_id"),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  mode: text("mode", { enum: ["arrival", "departure"] }).notNull(),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRideWatchSchema = createInsertSchema(rideWatchesTable, {
  datetime: z.string().transform((s) => new Date(s)),
}).omit({ id: true, createdAt: true, active: true });

export type RideWatch = typeof rideWatchesTable.$inferSelect;
export type InsertRideWatch = z.input<typeof insertRideWatchSchema>;
