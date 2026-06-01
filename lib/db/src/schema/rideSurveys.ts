import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rideSurveyRatingEnum = z.enum(["great", "good", "okay", "didnt_ride"]);

export const rideSurveysTable = pgTable(
  "ride_surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    matchEventId: uuid("match_event_id").notNull(),
    rating: text("rating"),
    moneySavedDollars: integer("money_saved_dollars"),
    notes: text("notes"),
    dismissed: text("dismissed").notNull().default("false"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ride_surveys_user_match_event_idx").on(t.userId, t.matchEventId),
    index("ride_surveys_user_id_idx").on(t.userId),
  ],
);

export const insertRideSurveySchema = createInsertSchema(rideSurveysTable, {
  rating: rideSurveyRatingEnum.optional(),
  moneySavedDollars: z.number().int().min(0).max(10000).optional(),
  notes: z.string().max(2000).optional(),
}).omit({ id: true, createdAt: true });

export type RideSurvey = typeof rideSurveysTable.$inferSelect;
export type InsertRideSurvey = z.input<typeof insertRideSurveySchema>;
