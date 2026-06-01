import { Router } from "express";
import { db } from "@workspace/db";
import {
  matchEventsTable,
  rideSurveysTable,
  tripsTable,
  userProfilesTable,
  rideSurveyRatingEnum,
} from "@workspace/db/schema";
import { and, eq, or, lt, notExists, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router = Router();

const submitBody = z.object({
  matchEventId: z.string().uuid(),
  rating: rideSurveyRatingEnum,
  moneySavedDollars: z.number().int().min(0).max(10000).nullable().optional(),
  notes: z.string().max(2000).optional(),
});

const dismissBody = z.object({
  matchEventId: z.string().uuid(),
});

router.get("/surveys/pending", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select({
        matchEventId: matchEventsTable.id,
        tournamentId: matchEventsTable.tournamentId,
        mode: matchEventsTable.mode,
        matchedAt: matchEventsTable.createdAt,
        tripDatetime: matchEventsTable.tripDatetime,
        tripId: matchEventsTable.tripId,
        matchedTripId: matchEventsTable.matchedTripId,
        otherUserId: sql<string>`case when ${matchEventsTable.userId} = ${userId} then ${matchEventsTable.matchedUserId} else ${matchEventsTable.userId} end`,
      })
      .from(matchEventsTable)
      .where(
        and(
          or(
            eq(matchEventsTable.userId, userId),
            eq(matchEventsTable.matchedUserId, userId),
          ),
          lt(matchEventsTable.tripDatetime, sql`now()`),
          notExists(
            db
              .select({ id: rideSurveysTable.id })
              .from(rideSurveysTable)
              .where(
                and(
                  eq(rideSurveysTable.userId, userId),
                  eq(rideSurveysTable.matchEventId, matchEventsTable.id),
                ),
              ),
          ),
        ),
      )
      .orderBy(matchEventsTable.tripDatetime)
      .limit(5);

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const [trip] = await db
          .select({
            airport: tripsTable.airport,
            hotel: tripsTable.hotel,
          })
          .from(tripsTable)
          .where(eq(tripsTable.id, row.tripId))
          .limit(1);
        const [otherProfile] = await db
          .select({ name: userProfilesTable.name, team: userProfilesTable.team })
          .from(userProfilesTable)
          .where(eq(userProfilesTable.userId, row.otherUserId))
          .limit(1);
        return {
          matchEventId: row.matchEventId,
          tournamentId: row.tournamentId,
          mode: row.mode,
          matchedAt: row.matchedAt.toISOString(),
          tripDatetime: row.tripDatetime.toISOString(),
          airport: trip?.airport ?? "",
          hotel: trip?.hotel ?? "",
          otherUserName: otherProfile?.name ?? "A family",
          otherUserTeam: otherProfile?.team ?? "",
        };
      }),
    );

    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to fetch pending surveys" });
  }
});

router.post("/surveys", requireAuth, async (req, res) => {
  const parsed = submitBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const userId = getUserId(req);
  try {
    const [event] = await db
      .select()
      .from(matchEventsTable)
      .where(eq(matchEventsTable.id, parsed.data.matchEventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Match not found" });
    }
    if (event.userId !== userId && event.matchedUserId !== userId) {
      return res.status(403).json({ error: "Not your match" });
    }

    const [row] = await db
      .insert(rideSurveysTable)
      .values({
        userId,
        matchEventId: parsed.data.matchEventId,
        rating: parsed.data.rating,
        moneySavedDollars: parsed.data.moneySavedDollars ?? null,
        notes: parsed.data.notes ?? null,
        dismissed: "false",
      })
      .onConflictDoUpdate({
        target: [rideSurveysTable.userId, rideSurveysTable.matchEventId],
        set: {
          rating: parsed.data.rating,
          moneySavedDollars: parsed.data.moneySavedDollars ?? null,
          notes: parsed.data.notes ?? null,
          dismissed: "false",
        },
      })
      .returning();

    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Failed to save survey" });
  }
});

router.post("/surveys/dismiss", requireAuth, async (req, res) => {
  const parsed = dismissBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const userId = getUserId(req);
  try {
    const [event] = await db
      .select()
      .from(matchEventsTable)
      .where(eq(matchEventsTable.id, parsed.data.matchEventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Match not found" });
    }
    if (event.userId !== userId && event.matchedUserId !== userId) {
      return res.status(403).json({ error: "Not your match" });
    }

    await db
      .insert(rideSurveysTable)
      .values({
        userId,
        matchEventId: parsed.data.matchEventId,
        dismissed: "true",
      })
      .onConflictDoUpdate({
        target: [rideSurveysTable.userId, rideSurveysTable.matchEventId],
        set: { dismissed: "true" },
      });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to dismiss survey" });
  }
});

export default router;
