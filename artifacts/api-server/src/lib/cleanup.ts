import { db } from "@workspace/db";
import { chatMessagesTable, tripsTable } from "@workspace/db/schema";
import { lt } from "drizzle-orm";
import { logger } from "./logger";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function runCleanup(): Promise<void> {
  try {
    const msgCutoff = new Date(Date.now() - THREE_DAYS_MS);
    await db.delete(chatMessagesTable).where(lt(chatMessagesTable.createdAt, msgCutoff));

    const tripCutoff = new Date(Date.now() - NINETY_DAYS_MS);
    await db.delete(tripsTable).where(lt(tripsTable.createdAt, tripCutoff));

    logger.info("DB cleanup complete");
  } catch (e) {
    logger.warn({ err: e }, "DB cleanup failed");
  }
}

export function startCleanupJob(): void {
  void runCleanup();
  setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS);
}
