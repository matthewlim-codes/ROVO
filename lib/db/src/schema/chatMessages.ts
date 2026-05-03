import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: text("group_id").notNull(),
    senderId: text("sender_id").notNull(),
    senderName: text("sender_name").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("chat_messages_group_id_idx").on(t.groupId),
    index("chat_messages_sender_id_idx").on(t.senderId),
    index("chat_messages_created_at_idx").on(t.createdAt),
  ]
);

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type DbChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = z.input<typeof insertChatMessageSchema>;
