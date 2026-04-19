import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";

const expo = new Expo();

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!userIds.length) return;
  try {
    const tokens = await db
      .select()
      .from(pushTokensTable)
      .where(inArray(pushTokensTable.userId, userIds));

    const messages: ExpoPushMessage[] = [];
    for (const t of tokens) {
      if (!Expo.isExpoPushToken(t.token)) continue;
      messages.push({
        to: t.token,
        sound: "default",
        title,
        body,
        data: data ?? {},
      });
    }
    if (!messages.length) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (e) {
        logger.warn({ err: e }, "expo push send failed");
      }
    }
  } catch (e) {
    logger.warn({ err: e }, "sendPushToUsers failed");
  }
}
