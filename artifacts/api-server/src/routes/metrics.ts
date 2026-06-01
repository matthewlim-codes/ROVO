import { Router } from "express";
import { db } from "@workspace/db";
import {
  userProfilesTable,
  tripsTable,
  matchEventsTable,
  rideSurveysTable,
} from "@workspace/db/schema";
import { eq, sql, and, isNotNull, desc } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";

const router = Router();

router.get("/metrics", requireAdminAuth, async (_req, res) => {
  try {
    const [signedUpRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clubCodeEntered, "true"));

    const [seekingRow] = await db
      .select({ count: sql<number>`count(distinct ${tripsTable.userId})::int` })
      .from(tripsTable);

    const matchUserRows = await db
      .select({ userId: matchEventsTable.userId })
      .from(matchEventsTable);
    const matchOtherRows = await db
      .select({ userId: matchEventsTable.matchedUserId })
      .from(matchEventsTable);
    const familiesMatched = new Set([
      ...matchUserRows.map((r) => r.userId),
      ...matchOtherRows.map((r) => r.userId),
    ]).size;

    const [matchEventsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matchEventsTable);

    const [surveyStatsRow] = await db
      .select({
        totalResponses: sql<number>`count(*) filter (where ${rideSurveysTable.dismissed} = 'false' and ${rideSurveysTable.rating} is not null)::int`,
        totalDismissed: sql<number>`count(*) filter (where ${rideSurveysTable.dismissed} = 'true')::int`,
        avgMoneySaved: sql<number>`coalesce(avg(${rideSurveysTable.moneySavedDollars}) filter (where ${rideSurveysTable.moneySavedDollars} is not null), 0)::int`,
        totalMoneySaved: sql<number>`coalesce(sum(${rideSurveysTable.moneySavedDollars}) filter (where ${rideSurveysTable.moneySavedDollars} is not null), 0)::int`,
        great: sql<number>`count(*) filter (where ${rideSurveysTable.rating} = 'great')::int`,
        good: sql<number>`count(*) filter (where ${rideSurveysTable.rating} = 'good')::int`,
        okay: sql<number>`count(*) filter (where ${rideSurveysTable.rating} = 'okay')::int`,
        didntRide: sql<number>`count(*) filter (where ${rideSurveysTable.rating} = 'didnt_ride')::int`,
      })
      .from(rideSurveysTable);

    const recentSurveys = await db
      .select({
        id: rideSurveysTable.id,
        userId: rideSurveysTable.userId,
        rating: rideSurveysTable.rating,
        moneySavedDollars: rideSurveysTable.moneySavedDollars,
        notes: rideSurveysTable.notes,
        dismissed: rideSurveysTable.dismissed,
        createdAt: rideSurveysTable.createdAt,
        userName: userProfilesTable.name,
        userEmail: userProfilesTable.email,
      })
      .from(rideSurveysTable)
      .leftJoin(userProfilesTable, eq(rideSurveysTable.userId, userProfilesTable.userId))
      .where(
        and(
          eq(rideSurveysTable.dismissed, "false"),
          isNotNull(rideSurveysTable.rating),
        ),
      )
      .orderBy(desc(rideSurveysTable.createdAt))
      .limit(50);

    const familiesSignedUp = signedUpRow?.count ?? 0;
    const familiesSeekingMatch = seekingRow?.count ?? 0;
    const totalMatchEvents = matchEventsRow?.count ?? 0;

    res.json({
      familiesSignedUp,
      familiesSeekingMatch,
      familiesMatched,
      totalMatchEvents,
      conversionRates: {
        signupToSeeking:
          familiesSignedUp > 0 ? familiesSeekingMatch / familiesSignedUp : 0,
        seekingToMatched:
          familiesSeekingMatch > 0 ? familiesMatched / familiesSeekingMatch : 0,
        signupToMatched:
          familiesSignedUp > 0 ? familiesMatched / familiesSignedUp : 0,
      },
      surveys: {
        totalResponses: surveyStatsRow?.totalResponses ?? 0,
        totalDismissed: surveyStatsRow?.totalDismissed ?? 0,
        averageMoneySaved: surveyStatsRow?.avgMoneySaved ?? 0,
        totalMoneySaved: surveyStatsRow?.totalMoneySaved ?? 0,
        byRating: {
          great: surveyStatsRow?.great ?? 0,
          good: surveyStatsRow?.good ?? 0,
          okay: surveyStatsRow?.okay ?? 0,
          didnt_ride: surveyStatsRow?.didntRide ?? 0,
        },
      },
      recentSurveys,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

export default router;
