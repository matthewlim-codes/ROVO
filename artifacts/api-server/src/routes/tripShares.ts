import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { tournamentsTable, tripsTable, tripSharesTable } from "@workspace/db/schema";
import { getUserId, requireAuth } from "../middlewares/requireAuth";

const router = Router();

const createTripShareBody = z.object({
  tripId: z.string().min(1),
});

const uuidSchema = z.string().uuid();

function stripServerPrefix(id: string): string {
  return id.replace(/^srv-/, "");
}

function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

function makeShareId(): string {
  return randomBytes(6).toString("base64url");
}

async function createUniqueShareId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = makeShareId();
    const existing = await db
      .select({ id: tripSharesTable.id })
      .from(tripSharesTable)
      .where(eq(tripSharesTable.id, id))
      .limit(1);
    if (!existing.length) return id;
  }
  return randomBytes(9).toString("base64url");
}

router.post("/trip-shares", requireAuth, async (req, res) => {
  const parsed = createTripShareBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const tripId = stripServerPrefix(parsed.data.tripId);
  if (!isUuid(tripId)) {
    return res.status(409).json({ error: "Trip is still syncing. Try sharing again in a moment." });
  }
  const userId = getUserId(req);

  try {
    const [trip] = await db
      .select()
      .from(tripsTable)
      .where(and(eq(tripsTable.id, tripId), eq(tripsTable.userId, userId)))
      .limit(1);

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    let existing: typeof tripSharesTable.$inferSelect | undefined;
    try {
      [existing] = await db
        .select()
        .from(tripSharesTable)
        .where(and(eq(tripSharesTable.tripId, trip.id), eq(tripSharesTable.userId, userId)))
        .limit(1);
    } catch {
      // If the share table has not been pushed yet, fall back to the opaque
      // trip UUID. The URL still avoids putting trip details in query params.
      return res.status(200).json({ id: trip.id, tripId: trip.id, fallback: "trip-id" });
    }

    if (existing) {
      return res.status(200).json({ id: existing.id, tripId: trip.id });
    }

    const shareId = await createUniqueShareId();
    let share: typeof tripSharesTable.$inferSelect;
    try {
      [share] = await db
        .insert(tripSharesTable)
        .values({ id: shareId, tripId: trip.id, userId })
        .returning();
    } catch {
      return res.status(200).json({ id: trip.id, tripId: trip.id, fallback: "trip-id" });
    }

    return res.status(201).json({ id: share.id, tripId: trip.id });
  } catch {
    return res.status(500).json({ error: "Failed to create trip share" });
  }
});

async function sendTripCardByTripId(res: Response, tripId: string, id: string) {
  try {
    const [trip] = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.id, tripId))
      .limit(1);

    if (!trip) {
      return res.status(200).json({ id, active: false });
    }

    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, trip.tournamentId))
      .limit(1);

    return res.json({
      id,
      active: true,
      trip: {
        id: trip.id,
        userName: trip.userName,
        userTeam: trip.userTeam,
        tournamentId: trip.tournamentId,
        airport: trip.airport,
        hotel: trip.hotel,
        hotelPlaceId: trip.hotelPlaceId,
        datetime: trip.datetime,
        mode: trip.mode,
        baggageCount: trip.baggageCount,
        partySize: trip.partySize,
      },
      tournament: tournament
        ? {
            id: tournament.id,
            name: tournament.name,
            location: tournament.location,
            dates: tournament.dates,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
          }
        : null,
    });
  } catch {
    return res.status(500).json({ error: "Failed to load trip card" });
  }
}

router.get("/trip-shares/:id", async (req, res) => {
  const shareId = req.params.id;
  if (!shareId) {
    return res.status(400).json({ error: "Share id is required" });
  }

  try {
    const [share] = await db
      .select()
      .from(tripSharesTable)
      .where(eq(tripSharesTable.id, shareId))
      .limit(1);

    if (!share) {
      if (isUuid(shareId)) return sendTripCardByTripId(res, shareId, shareId);
      return res.status(404).json({ error: "Trip card not found" });
    }

    return sendTripCardByTripId(res, share.tripId, share.id);
  } catch {
    if (isUuid(shareId)) return sendTripCardByTripId(res, shareId, shareId);
    return res.status(500).json({ error: "Failed to load trip card" });
  }
});

export default router;
