import { Router } from "express";
import { db } from "@workspace/db";
import {
  tripsTable,
  insertTripSchema,
  rideWatchesTable,
  notificationsTable,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { sendPushToUsers } from "../lib/push";

const router = Router();

const FORTY_FIVE_MIN_MS = 45 * 60 * 1000;

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

router.post("/trips", async (req, res) => {
  const parsed = insertTripSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    // Replace any existing trip by same user for same tournament
    await db
      .delete(tripsTable)
      .where(
        and(
          eq(tripsTable.userId, parsed.data.userId),
          eq(tripsTable.tournamentId, parsed.data.tournamentId),
        ),
      );
    const [trip] = await db.insert(tripsTable).values(parsed.data).returning();

    // Find matching active watches (different user, same tournament, mode, airport, hotel, within 45min)
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
      // Deactivate fired watches so user only gets the first match alert
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
