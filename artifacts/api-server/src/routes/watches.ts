import { Router } from "express";
import { db } from "@workspace/db";
import {
  rideWatchesTable,
  tripsTable,
  notificationsTable,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { sendPushToUsers } from "../lib/push";
import { recordWatchMatchEvent } from "../lib/matchEvents";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { getOrCreateProfile } from "../lib/profile";
import {
  hotelsMatch,
  isWithinMatchWindow,
  normalizeAirportCode,
  routeParam,
} from "../lib/matching";

const router = Router();

const createWatchBody = z.object({
  tournamentId: z.string().uuid(),
  airport: z.string().min(1),
  hotel: z.string().min(1),
  hotelPlaceId: z.string().nullable().optional(),
  datetime: z.string().transform((s) => new Date(s)),
  mode: z.enum(["arrival", "departure"]),
});

function sanitizeHotelPlaceId(
  placeId: string | null | undefined,
): string | null {
  if (!placeId) return null;
  const id = placeId.trim();
  if (!id) return null;
  if (
    id.startsWith("manual-") ||
    id.startsWith("shared-") ||
    id.startsWith("local-")
  ) {
    return null;
  }
  return id;
}

router.get("/watches", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(rideWatchesTable)
      .where(eq(rideWatchesTable.userId, userId));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to fetch watches" });
  }
});

router.post("/watches", requireAuth, async (req, res) => {
  const parsed = createWatchBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const userId = getUserId(req);
    const profile = await getOrCreateProfile(userId);
    const userName = profile?.name || "A traveler";
    const airport = normalizeAirportCode(parsed.data.airport);
    const hotel = parsed.data.hotel.trim();
    const hotelPlaceId = sanitizeHotelPlaceId(parsed.data.hotelPlaceId);

    await db
      .delete(rideWatchesTable)
      .where(
        and(
          eq(rideWatchesTable.userId, userId),
          eq(rideWatchesTable.tournamentId, parsed.data.tournamentId),
          eq(rideWatchesTable.mode, parsed.data.mode),
        ),
      );
    const [watch] = await db
      .insert(rideWatchesTable)
      .values({
        userId,
        userName,
        tournamentId: parsed.data.tournamentId,
        airport,
        hotel,
        hotelPlaceId,
        datetime: parsed.data.datetime,
        mode: parsed.data.mode,
      })
      .returning();

    const trips = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.tournamentId, watch.tournamentId),
          eq(tripsTable.mode, watch.mode),
        ),
      );
    const matched = trips.filter(
      (t) =>
        t.userId !== watch.userId &&
        normalizeAirportCode(t.airport) === watch.airport &&
        hotelsMatch(t.hotel, t.hotelPlaceId, watch.hotel, watch.hotelPlaceId) &&
        isWithinMatchWindow(t.datetime, watch.datetime),
    );

    if (matched.length) {
      const m = matched[0];
      await recordWatchMatchEvent(
        {
          userId: watch.userId,
          tournamentId: watch.tournamentId,
          mode: watch.mode,
          datetime: watch.datetime,
        },
        m,
      );

      const title = "Someone is heading the same way!";
      const body = `${m.userName} is going ${m.mode === "arrival" ? "to" : "from"} ${m.hotel} via ${m.airport}.`;
      await db.insert(notificationsTable).values({
        userId: watch.userId,
        kind: "ride_match",
        title,
        body,
        data: { tournamentId: watch.tournamentId, tripId: m.id, mode: watch.mode },
      });
      await db
        .update(rideWatchesTable)
        .set({ active: "false" })
        .where(eq(rideWatchesTable.id, watch.id));
      await sendPushToUsers([watch.userId], title, body, {
        tournamentId: watch.tournamentId,
        tripId: m.id,
      });
    }

    return res.status(201).json(watch);
  } catch {
    return res.status(500).json({ error: "Failed to save watch" });
  }
});

router.delete("/watches/:id", requireAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Watch id is required" });
  }
  try {
    const userId = getUserId(req);
    await db
      .delete(rideWatchesTable)
      .where(
        and(
          eq(rideWatchesTable.id, id),
          eq(rideWatchesTable.userId, userId),
        ),
      );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete watch" });
  }
});

export default router;
