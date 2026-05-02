import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tripsTable = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userTeam: text("user_team"),
  tournamentId: uuid("tournament_id").notNull(),
  airport: text("airport").notNull(),
  hotel: text("hotel").notNull(),
  hotelPlaceId: text("hotel_place_id"),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  mode: text("mode", { enum: ["arrival", "departure"] }).notNull(),
  baggageCount: integer("baggage_count"),
  partySize: integer("party_size"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTripSchema = createInsertSchema(tripsTable, {
  datetime: z.string().transform((s) => new Date(s)),
}).omit({ id: true, createdAt: true });
export const selectTripSchema = createSelectSchema(tripsTable);

export type Trip = typeof tripsTable.$inferSelect;
export type InsertTrip = z.input<typeof insertTripSchema>;
