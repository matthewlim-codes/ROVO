import { Router } from "express";
import { db } from "@workspace/db";
import {
  tripsTable,
  rideWatchesTable,
  notificationsTable,
} from "@workspace/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { sendPushToUsers } from "../lib/push";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { getOrCreateProfile } from "../lib/profile";

const router = Router();

const FORTY_FIVE_MIN_MS = 45 * 60 * 1000;
const SIXTY_MIN_MS = 60 * 60 * 1000;

const createTripBody = z.object({
  tournamentId: z.string().uuid(),
  airport: z.string().min(1),
  hotel: z.string().min(1),
  hotelPlaceId: z.string().nullable().optional(),
  datetime: z.string().transform((s) => new Date(s)),
  mode: z.enum(["arrival", "departure"]),
  baggageCount: z.number().int().nullable().optional(),
  partySize: z.number().int().min(1).nullable().optional(),
});

router.get("/trips", async (req, res) => {
  const tournamentId =
    typeof req.query.tournamentId === "string" ? req.query.tournamentId : undefined;
  try {
    const rows = await db
      .select()
      .from(tripsTable)
      .where(tournamentId ? eq(tripsTable.tournamentId, tournamentId) : undefined);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch trips" });
  }
});

router.get("/trips/matches", requireAuth, async (req, res) => {
  const tripId = typeof req.query.tripId === "string" ? req.query.tripId : undefined;
  if (!tripId) {
    return res.status(400).json({ error: "tripId is required" });
  }
  try {
    const [trip] = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.id, tripId));

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const tripTime = new Date(trip.datetime).getTime();

    const matches = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.tournamentId, trip.tournamentId),
          eq(tripsTable.airport, trip.airport),
          eq(tripsTable.mode, "arrival"),
          ne(tripsTable.userId, trip.userId),
          sql`ABS(EXTRACT(EPOCH FROM (${tripsTable.datetime} - ${trip.datetime}::timestamptz)) * 1000) <= ${SIXTY_MIN_MS}`,
        ),
      );

    const sorted = matches.sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );

    res.json(sorted);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch rideshare matches" });
  }
});

router.post("/trips", requireAuth, async (req, res) => {
  const parsed = createTripBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const userId = getUserId(req);
    const profile = await getOrCreateProfile(userId);
    const userName = profile?.name || "A traveler";
    const userTeam = profile?.team || null;

    await db
      .delete(tripsTable)
      .where(
        and(
          eq(tripsTable.userId, userId),
          eq(tripsTable.tournamentId, parsed.data.tournamentId),
        ),
      );
    const [trip] = await db
      .insert(tripsTable)
      .values({
        userId,
        userName,
        userTeam,
        tournamentId: parsed.data.tournamentId,
        airport: parsed.data.airport,
        hotel: parsed.data.hotel,
        hotelPlaceId: parsed.data.hotelPlaceId ?? null,
        datetime: parsed.data.datetime,
        mode: parsed.data.mode,
        baggageCount: parsed.data.baggageCount ?? null,
        partySize: parsed.data.partySize ?? null,
      })
      .returning();

    const watches = await db
      .select()
      .from(rideWatchesTable)
      .where(
        and(
          eq(rideWatchesTable.tournamentId, trip.tournamentId),
          eq(rideWatchesTable.mode, trip.mode),
          eq(rideWatchesTable.airport, trip.airport),
          eq(rideWatchesTable.active, "true"),
        ),
      );

    const tripTime = new Date(trip.datetime).getTime();
    const matched = watches.filter(
      (w) =>
        w.userId !== trip.userId &&
        (w.hotel === trip.hotel ||
          (w.hotelPlaceId && trip.hotelPlaceId && w.hotelPlaceId === trip.hotelPlaceId)) &&
        Math.abs(new Date(w.datetime).getTime() - tripTime) <= FORTY_FIVE_MIN_MS,
    );

    if (matched.length) {
      const title = "Someone matched your ride!";
      const body = `${trip.userName} is going ${trip.mode === "arrival" ? "to" : "from"} ${trip.hotel} via ${trip.airport}.`;
      await db.insert(notificationsTable).values(
        matched.map((w) => ({
          userId: w.userId,
          kind: "ride_match",
          title,
          body,
          data: { tournamentId: trip.tournamentId, tripId: trip.id, mode: trip.mode },
        })),
      );
      await Promise.all(
        matched.map((w) =>
          db
            .update(rideWatchesTable)
            .set({ active: "false" })
            .where(eq(rideWatchesTable.id, w.id)),
        ),
      );
      await sendPushToUsers(
        matched.map((w) => w.userId),
        title,
        body,
        { tournamentId: trip.tournamentId, tripId: trip.id },
      );
    }

    res.status(201).json(trip);
  } catch (e) {
    res.status(500).json({ error: "Failed to save trip" });
  }
});

export default router;
