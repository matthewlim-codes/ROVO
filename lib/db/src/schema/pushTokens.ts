import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pushTokensTable = pgTable(
  "push_tokens",
  {
    token: text("token").primaryKey(),
    userId: text("user_id").notNull(),
    platform: text("platform"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: uniqueIndex("push_tokens_user_idx").on(t.userId, t.token),
  }),
);

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({
  updatedAt: true,
});
export type PushToken = typeof pushTokensTable.$inferSelect;
export type InsertPushToken = z.input<typeof insertPushTokenSchema>;
