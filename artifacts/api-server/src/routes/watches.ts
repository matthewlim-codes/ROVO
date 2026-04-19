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
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { getOrCreateProfile } from "../lib/profile";

const router = Router();

const FORTY_FIVE_MIN_MS = 45 * 60 * 1000;

const createWatchBody = z.object({
  tournamentId: z.string().uuid(),
  airport: z.string().min(1),
  hotel: z.string().min(1),
  hotelPlaceId: z.string().nullable().optional(),
  datetime: z.string().transform((s) => new Date(s)),
  mode: z.enum(["arrival", "departure"]),
});

router.get("/watches", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await db
      .select()
      .from(rideWatchesTable)
      .where(eq(rideWatchesTable.userId, userId));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch watches" });
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
        airport: parsed.data.airport,
        hotel: parsed.data.hotel,
        hotelPlaceId: parsed.data.hotelPlaceId ?? null,
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
          eq(tripsTable.airport, watch.airport),
        ),
      );
    const watchTime = new Date(watch.datetime).getTime();
    const matched = trips.filter(
      (t) =>
        t.userId !== watch.userId &&
        (t.hotel === watch.hotel ||
          (t.hotelPlaceId &&
            watch.hotelPlaceId &&
            t.hotelPlaceId === watch.hotelPlaceId)) &&
        Math.abs(new Date(t.datetime).getTime() - watchTime) <= FORTY_FIVE_MIN_MS,
    );

    if (matched.length) {
      const m = matched[0];
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

    res.status(201).json(watch);
  } catch (e) {
    res.status(500).json({ error: "Failed to save watch" });
  }
});

router.delete("/watches/:id", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    await db
      .delete(rideWatchesTable)
      .where(
        and(
          eq(rideWatchesTable.id, req.params.id as string),
          eq(rideWatchesTable.userId, userId),
        ),
      );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete watch" });
  }
});

export default router;
