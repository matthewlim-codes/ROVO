import { randomBytes } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { tournamentsTable, tripsTable, tripSharesTable } from "@workspace/db/schema";
import { getUserId, requireAuth } from "../middlewares/requireAuth";

const router = Router();

const createTripShareBody = z.object({
  tripId: z.string().min(1),
});

function stripServerPrefix(id: string): string {
  return id.replace(/^srv-/, "");
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

    const [existing] = await db
      .select()
      .from(tripSharesTable)
      .where(and(eq(tripSharesTable.tripId, trip.id), eq(tripSharesTable.userId, userId)))
      .limit(1);

    if (existing) {
      return res.status(200).json({ id: existing.id, tripId: trip.id });
    }

    const shareId = await createUniqueShareId();
    const [share] = await db
      .insert(tripSharesTable)
      .values({ id: shareId, tripId: trip.id, userId })
      .returning();

    return res.status(201).json({ id: share.id, tripId: trip.id });
  } catch {
    return res.status(500).json({ error: "Failed to create trip share" });
  }
});

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
      return res.status(404).json({ error: "Trip card not found" });
    }

    const [trip] = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.id, share.tripId))
      .limit(1);

    if (!trip) {
      return res.status(200).json({ id: share.id, active: false });
    }

    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, trip.tournamentId))
      .limit(1);

    return res.json({
      id: share.id,
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
});

export default router;
