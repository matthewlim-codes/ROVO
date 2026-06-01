import { db } from "@workspace/db";
import { matchEventsTable } from "@workspace/db/schema";
import type { Trip } from "@workspace/db/schema";

export async function recordMatchEvents(
  trip: Pick<Trip, "id" | "tournamentId" | "userId" | "mode" | "datetime">,
  matchedTrips: Pick<Trip, "id" | "userId">[],
): Promise<void> {
  if (!matchedTrips.length) return;
  await db.insert(matchEventsTable).values(
    matchedTrips.map((t) => ({
      tournamentId: trip.tournamentId,
      tripId: trip.id,
      matchedTripId: t.id,
      userId: trip.userId,
      matchedUserId: t.userId,
      mode: trip.mode,
      tripDatetime: trip.datetime,
    })),
  );
}

export async function recordWatchMatchEvent(
  watch: {
    userId: string;
    tournamentId: string;
    mode: "arrival" | "departure";
    datetime: Date;
  },
  matchedTrip: Pick<Trip, "id" | "userId" | "datetime">,
): Promise<void> {
  await db.insert(matchEventsTable).values({
    tournamentId: watch.tournamentId,
    tripId: matchedTrip.id,
    matchedTripId: matchedTrip.id,
    userId: watch.userId,
    matchedUserId: matchedTrip.userId,
    mode: watch.mode,
    tripDatetime: matchedTrip.datetime,
  });
}
