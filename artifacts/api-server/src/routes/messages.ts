import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, tripsTable } from "@workspace/db/schema";
import { and, eq, gte, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { sendPushToUsers } from "../lib/push";
import {
  hotelsMatch,
  normalizeAirportCode,
  isValidPlaceId,
} from "../lib/matching";

const router = Router();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const prev = (rateLimitMap.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (prev.length >= RATE_LIMIT_MAX) return false;
  prev.push(now);
  rateLimitMap.set(userId, prev);
  return true;
}

function parseDmTripIds(groupId: string): [string, string] | null {
  if (!groupId.startsWith("rs-")) return null;
  const inner = groupId.slice(3);
  const sep = inner.indexOf("__");
  if (sep === -1) return null;
  const id1 = inner.slice(0, sep);
  const id2 = inner.slice(sep + 2);
  if (!id1 || !id2) return null;
  return [id1, id2];
}

/**
 * Group chat IDs: `{tournamentId}-{airport}-{hotelPlaceId|hotel}-{mode}`
 * tournamentId is a UUID (contains hyphens), so parse from the right.
 */
function parseGroupChatId(groupId: string): {
  tournamentId: string;
  airport: string;
  hotelKey: string;
  mode: "arrival" | "departure";
} | null {
  if (groupId.startsWith("rs-")) return null;
  const modeMatch = groupId.match(/-(arrival|departure)$/);
  if (!modeMatch || modeMatch.index === undefined) return null;
  const mode = modeMatch[1] as "arrival" | "departure";
  const withoutMode = groupId.slice(0, modeMatch.index);
  const uuidMatch = withoutMode.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i,
  );
  if (!uuidMatch) return null;
  const tournamentId = uuidMatch[1];
  const rest = uuidMatch[2];
  const airportSep = rest.indexOf("-");
  if (airportSep === -1) return null;
  const airport = rest.slice(0, airportSep);
  const hotelKey = rest.slice(airportSep + 1);
  if (!airport || !hotelKey) return null;
  return { tournamentId, airport, hotelKey, mode };
}

async function userOwnsDmTrip(
  userId: string,
  groupId: string,
): Promise<boolean> {
  const ids = parseDmTripIds(groupId);
  if (!ids) return false;
  const rows = await db
    .select({ id: tripsTable.id, userId: tripsTable.userId })
    .from(tripsTable)
    .where(inArray(tripsTable.id, ids));
  if (rows.length !== 2) return false;
  return rows.some((r) => r.userId === userId);
}

async function userInGroupChat(
  userId: string,
  groupId: string,
): Promise<boolean> {
  const parsed = parseGroupChatId(groupId);
  if (!parsed) return false;

  const userTrips = await db
    .select()
    .from(tripsTable)
    .where(
      and(
        eq(tripsTable.userId, userId),
        eq(tripsTable.tournamentId, parsed.tournamentId),
        eq(tripsTable.mode, parsed.mode),
      ),
    );

  return userTrips.some((t) => {
    if (normalizeAirportCode(t.airport) !== normalizeAirportCode(parsed.airport)) {
      return false;
    }
    const hotelKey = isValidPlaceId(t.hotelPlaceId)
      ? t.hotelPlaceId
      : t.hotel;
    // Exact key used when building group IDs on the client
    if (hotelKey === parsed.hotelKey) return true;
    // Also accept if hotel matching would group them together
    return hotelsMatch(t.hotel, t.hotelPlaceId, parsed.hotelKey, parsed.hotelKey);
  });
}

async function assertConversationMember(
  userId: string,
  groupId: string,
): Promise<boolean> {
  if (groupId.startsWith("rs-")) {
    return userOwnsDmTrip(userId, groupId);
  }
  return userInGroupChat(userId, groupId);
}

async function getGroupMemberIds(
  groupId: string,
  senderId: string,
): Promise<string[]> {
  if (groupId.startsWith("rs-")) {
    const ids = parseDmTripIds(groupId);
    if (!ids) return [];
    const rows = await db
      .select({ userId: tripsTable.userId })
      .from(tripsTable)
      .where(inArray(tripsTable.id, ids));
    return rows.map((r) => r.userId).filter((uid) => uid !== senderId);
  }

  const parsed = parseGroupChatId(groupId);
  if (!parsed) return [];

  const trips = await db
    .select()
    .from(tripsTable)
    .where(
      and(
        eq(tripsTable.tournamentId, parsed.tournamentId),
        eq(tripsTable.mode, parsed.mode),
      ),
    );

  const members = trips
    .filter(
      (t) =>
        normalizeAirportCode(t.airport) ===
          normalizeAirportCode(parsed.airport) &&
        (isValidPlaceId(t.hotelPlaceId)
          ? t.hotelPlaceId === parsed.hotelKey
          : t.hotel === parsed.hotelKey ||
            hotelsMatch(t.hotel, t.hotelPlaceId, parsed.hotelKey, null)),
    )
    .map((t) => t.userId);

  return [...new Set(members)].filter((uid) => uid !== senderId);
}

async function conversationGroupIdsForUser(userId: string): Promise<Set<string>> {
  const groupIds = new Set<string>();
  const since = new Date(Date.now() - THREE_DAYS_MS);

  // Groups the user has sent to
  const sent = await db
    .select({ groupId: chatMessagesTable.groupId })
    .from(chatMessagesTable)
    .where(
      and(
        eq(chatMessagesTable.senderId, userId),
        gte(chatMessagesTable.createdAt, since),
      ),
    );
  for (const row of sent) groupIds.add(row.groupId);

  // DMs and group chats the user is a member of via trips — so incoming
  // messages appear before the recipient replies.
  const userTrips = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.userId, userId));

  for (const trip of userTrips) {
    const hotelKey = isValidPlaceId(trip.hotelPlaceId)
      ? trip.hotelPlaceId
      : trip.hotel;
    groupIds.add(
      `${trip.tournamentId}-${trip.airport}-${hotelKey}-${trip.mode}`,
    );

    // Pair with other matching trips for DM group ids
    const others = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.tournamentId, trip.tournamentId),
          eq(tripsTable.mode, trip.mode),
        ),
      );
    for (const other of others) {
      if (other.userId === userId) continue;
      if (
        !hotelsMatch(
          trip.hotel,
          trip.hotelPlaceId,
          other.hotel,
          other.hotelPlaceId,
        )
      ) {
        continue;
      }
      if (
        normalizeAirportCode(trip.airport) !==
        normalizeAirportCode(other.airport)
      ) {
        continue;
      }
      const sorted = [trip.id, other.id].sort();
      groupIds.add(`rs-${sorted[0]}__${sorted[1]}`);
    }
  }

  return groupIds;
}

router.get("/messages/conversations", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const since = new Date(Date.now() - THREE_DAYS_MS);
  try {
    const memberGroups = await conversationGroupIdsForUser(userId);
    if (!memberGroups.size) {
      return res.json([]);
    }

    const recentMsgs = await db
      .select()
      .from(chatMessagesTable)
      .where(gte(chatMessagesTable.createdAt, since))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(2000);

    const conversations = [...memberGroups]
      .map((groupId) => {
        const groupMsgs = recentMsgs.filter((m) => m.groupId === groupId);
        if (!groupMsgs.length) return null;
        const last = groupMsgs[0];
        return {
          groupId,
          lastMessage: last.text,
          lastSenderName: last.senderName,
          lastTimestamp: last.createdAt.toISOString(),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort(
        (a, b) =>
          new Date(b.lastTimestamp).getTime() -
          new Date(a.lastTimestamp).getTime(),
      );

    return res.json(conversations);
  } catch {
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/messages", requireAuth, async (req, res) => {
  const groupId =
    typeof req.query.groupId === "string" ? req.query.groupId : undefined;
  if (!groupId) return res.status(400).json({ error: "groupId is required" });
  const userId = getUserId(req);
  const since = new Date(Date.now() - THREE_DAYS_MS);
  try {
    const allowed = await assertConversationMember(userId, groupId);
    if (!allowed) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }
    const msgs = await db
      .select()
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.groupId, groupId),
          gte(chatMessagesTable.createdAt, since),
        ),
      )
      .orderBy(chatMessagesTable.createdAt)
      .limit(200);
    return res.json(msgs);
  } catch {
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/messages", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      groupId: z.string().min(1),
      senderName: z.string().min(1),
      text: z.string().min(1).max(2000),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const senderId = getUserId(req);

  if (!checkRateLimit(senderId)) {
    return res
      .status(429)
      .json({ error: "Too many messages. Slow down and try again." });
  }

  try {
    const allowed = await assertConversationMember(senderId, parsed.data.groupId);
    if (!allowed) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }

    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        groupId: parsed.data.groupId,
        senderId,
        senderName: parsed.data.senderName,
        text: parsed.data.text,
      })
      .returning();

    res.status(201).json(msg);

    getGroupMemberIds(parsed.data.groupId, senderId)
      .then((recipientIds) => {
        if (!recipientIds.length) return;
        return sendPushToUsers(
          recipientIds,
          parsed.data.senderName,
          parsed.data.text,
          { groupId: parsed.data.groupId, screen: "chat" },
        );
      })
      .catch(() => {});
    return;
  } catch {
    return res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
