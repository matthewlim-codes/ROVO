import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feedbackTable = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable, {
  message: z.string().min(1).max(5000),
}).omit({ id: true, createdAt: true });

export type Feedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = z.input<typeof insertFeedbackSchema>;
