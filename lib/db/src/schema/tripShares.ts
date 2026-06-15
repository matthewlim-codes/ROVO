import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const tripSharesTable = pgTable("trip_shares", {
  id: text("id").primaryKey(),
  tripId: uuid("trip_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTripShareSchema = createInsertSchema(tripSharesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectTripShareSchema = createSelectSchema(tripSharesTable);

export type TripShare = typeof tripSharesTable.$inferSelect;
export type InsertTripShare = typeof tripSharesTable.$inferInsert;
