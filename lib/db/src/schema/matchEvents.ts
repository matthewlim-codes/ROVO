import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const matchEventsTable = pgTable(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id").notNull(),
    tripId: uuid("trip_id").notNull(),
    matchedTripId: uuid("matched_trip_id").notNull(),
    userId: text("user_id").notNull(),
    matchedUserId: text("matched_user_id").notNull(),
    mode: text("mode", { enum: ["arrival", "departure"] }).notNull(),
    tripDatetime: timestamp("trip_datetime", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("match_events_user_id_idx").on(t.userId),
    index("match_events_matched_user_id_idx").on(t.matchedUserId),
    index("match_events_tournament_id_idx").on(t.tournamentId),
  ],
);

export const insertMatchEventSchema = createInsertSchema(matchEventsTable).omit({
  id: true,
  createdAt: true,
});

export type MatchEvent = typeof matchEventsTable.$inferSelect;
export type InsertMatchEvent = typeof matchEventsTable.$inferInsert;
