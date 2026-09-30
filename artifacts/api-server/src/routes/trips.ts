import { Router } from "express";
import { db } from "@workspace/db";
import {
  tripsTable,
  rideWatchesTable,
  notificationsTable,
  userProfilesTable,
} from "@workspace/db/schema";
import { and, eq, ne, sql, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { sendPushToUsers } from "../lib/push";
import { recordMatchEvents } from "../lib/matchEvents";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { getOrCreateProfile } from "../lib/profile";
import {
  hotelsMatch,
  isWithinMatchWindow,
  normalizeAirportCode,
  routeParam,
  tripsMatchCriteria,
} from "../lib/matching";

const router = Router();

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

async function requireClubMembership(userId: string) {
  const profile = await getOrCreateProfile(userId);
  if (!profile || profile.clubCodeEntered !== "true" || !profile.club) {
    return null;
  }
  return profile;
}

router.get("/trips", requireAuth, async (req, res) => {
  const tournamentId =
    typeof req.query.tournamentId === "string" ? req.query.tournamentId : undefined;
  try {
    const userId = getUserId(req);
    const profile = await requireClubMembership(userId);
    if (!profile) {
      return res.status(403).json({ error: "Club membership required" });
    }

    // Scope to travelers in the same verified club (trusted server profile).
    const clubMembers = await db
      .select({ userId: userProfilesTable.userId })
      .from(userProfilesTable)
      .where(
        and(
          eq(userProfilesTable.club, profile.club),
          eq(userProfilesTable.clubCodeEntered, "true"),
        ),
      );
    const memberIds = clubMembers.map((m) => m.userId);
    if (!memberIds.length) {
      return res.json([]);
    }

    const conditions = [inArray(tripsTable.userId, memberIds)];
    if (tournamentId) {
      conditions.push(eq(tripsTable.tournamentId, tournamentId));
    }

    const rows = await db
      .select()
      .from(tripsTable)
      .where(and(...conditions));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to fetch trips" });
  }
});

router.get("/trips/matches", requireAuth, async (req, res) => {
  const tripId = typeof req.query.tripId === "string" ? req.query.tripId : undefined;
  if (!tripId) {
    return res.status(400).json({ error: "tripId is required" });
  }
  try {
    const userId = getUserId(req);
    const [trip] = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.id, tripId));

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }
    if (trip.userId !== userId) {
      return res.status(403).json({ error: "Not your trip" });
    }

    const candidates = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.tournamentId, trip.tournamentId),
          eq(tripsTable.mode, trip.mode),
          ne(tripsTable.userId, trip.userId),
        ),
      );

    const matches = candidates.filter((t) =>
      tripsMatchCriteria(
        {
          tournamentId: trip.tournamentId,
          airport: trip.airport,
          hotel: trip.hotel,
          hotelPlaceId: trip.hotelPlaceId,
          datetime: trip.datetime,
          mode: trip.mode,
        },
        {
          tournamentId: t.tournamentId,
          airport: t.airport,
          hotel: t.hotel,
          hotelPlaceId: t.hotelPlaceId,
          datetime: t.datetime,
          mode: t.mode,
        },
      ),
    );

    const sorted = matches.sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
    );

    return res.json(sorted);
  } catch {
    return res.status(500).json({ error: "Failed to fetch rideshare matches" });
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
    const airport = normalizeAirportCode(parsed.data.airport);
    const hotel = parsed.data.hotel.trim();
    const hotelPlaceId = sanitizeHotelPlaceId(parsed.data.hotelPlaceId);

    if (!hotel) {
      return res.status(400).json({ error: "Hotel name is required" });
    }

    // Replace only the same mode; keep arrival and departure independent.
    // Atomic: delete+insert in one transaction so a failed insert cannot
    // leave the user with no trip.
    const trip = await db.transaction(async (tx) => {
      await tx
        .delete(tripsTable)
        .where(
          and(
            eq(tripsTable.userId, userId),
            eq(tripsTable.tournamentId, parsed.data.tournamentId),
            eq(tripsTable.mode, parsed.data.mode),
          ),
        );
      const [inserted] = await tx
        .insert(tripsTable)
        .values({
          userId,
          userName,
          userTeam,
          tournamentId: parsed.data.tournamentId,
          airport,
          hotel,
          hotelPlaceId,
          datetime: parsed.data.datetime,
          mode: parsed.data.mode,
          baggageCount: parsed.data.baggageCount ?? null,
          partySize: parsed.data.partySize ?? null,
        })
        .returning();
      return inserted;
    });

    const existingTrips = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.tournamentId, trip.tournamentId),
          eq(tripsTable.mode, trip.mode),
          ne(tripsTable.userId, trip.userId),
        ),
      );

    const matchedTrips = existingTrips.filter((t) =>
      tripsMatchCriteria(trip, t),
    );

    if (matchedTrips.length) {
      await recordMatchEvents(trip, matchedTrips);

      const title = "Someone matched your ride!";
      const body = `${trip.userName} is going ${trip.mode === "arrival" ? "to" : "from"} ${trip.hotel} via ${trip.airport}.`;
      await db.insert(notificationsTable).values(
        matchedTrips.map((t) => ({
          userId: t.userId,
          kind: "ride_match",
          title,
          body,
          data: { tournamentId: trip.tournamentId, tripId: trip.id, mode: trip.mode },
        })),
      );
      await sendPushToUsers(
        matchedTrips.map((t) => t.userId),
        title,
        body,
        { tournamentId: trip.tournamentId, tripId: trip.id },
      );
    }

    const watches = await db
      .select()
      .from(rideWatchesTable)
      .where(
        and(
          eq(rideWatchesTable.tournamentId, trip.tournamentId),
          eq(rideWatchesTable.mode, trip.mode),
          eq(rideWatchesTable.active, "true"),
        ),
      );

    const matchedWatches = watches.filter(
      (w) =>
        w.userId !== trip.userId &&
        hotelsMatch(w.hotel, w.hotelPlaceId, trip.hotel, trip.hotelPlaceId) &&
        normalizeAirportCode(w.airport) === trip.airport &&
        isWithinMatchWindow(w.datetime, trip.datetime),
    );

    if (matchedWatches.length) {
      const title = "Someone matched your ride!";
      const body = `${trip.userName} is going ${trip.mode === "arrival" ? "to" : "from"} ${trip.hotel} via ${trip.airport}.`;
      await db.insert(notificationsTable).values(
        matchedWatches.map((w) => ({
          userId: w.userId,
          kind: "ride_match",
          title,
          body,
          data: { tournamentId: trip.tournamentId, tripId: trip.id, mode: trip.mode },
        })),
      );
      await Promise.all(
        matchedWatches.map((w) =>
          db
            .update(rideWatchesTable)
            .set({ active: "false" })
            .where(eq(rideWatchesTable.id, w.id)),
        ),
      );
      await sendPushToUsers(
        matchedWatches.map((w) => w.userId),
        title,
        body,
        { tournamentId: trip.tournamentId, tripId: trip.id },
      );
    }

    return res.status(201).json(trip);
  } catch {
    return res.status(500).json({ error: "Failed to save trip" });
  }
});

router.delete("/trips/:id", requireAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Trip id is required" });
  }
  const userId = getUserId(req);
  try {
    const [trip] = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.id, id));
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }
    if (trip.userId !== userId) {
      return res.status(403).json({ error: "Not your trip" });
    }

    const candidateTrips = await db
      .select()
      .from(tripsTable)
      .where(
        and(
          eq(tripsTable.tournamentId, trip.tournamentId),
          eq(tripsTable.mode, trip.mode),
          ne(tripsTable.userId, trip.userId),
        ),
      );

    const cancelledMatches = candidateTrips.filter((t) =>
      tripsMatchCriteria(trip, t),
    );

    await db.delete(tripsTable).where(eq(tripsTable.id, id));

    if (cancelledMatches.length) {
      const title = "A rideshare match was cancelled";
      const body = `${trip.userName} removed their ${trip.mode} trip via ${trip.airport}.`;
      await db.insert(notificationsTable).values(
        cancelledMatches.map((t) => ({
          userId: t.userId,
          kind: "ride_cancelled",
          title,
          body,
          data: { tournamentId: trip.tournamentId, mode: trip.mode },
        })),
      );
      await sendPushToUsers(
        cancelledMatches.map((t) => t.userId),
        title,
        body,
        { tournamentId: trip.tournamentId },
      );
    }

    return res.status(204).end();
  } catch {
    return res.status(500).json({ error: "Failed to delete trip" });
  }
});

export default router;
