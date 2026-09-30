import { Router } from "express";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  insertTournamentSchema,
  attendanceEvidenceTable,
} from "@workspace/db/schema";
import { and, eq, gte, sql, desc, or, ilike } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";
import { routeParam } from "../lib/matching";
import { writeAudit } from "../lib/jobRunner";
import {
  expectedPublishDate,
  shouldPublishApproved,
} from "../lib/tournamentLifecycle";
import { z } from "zod/v4";

const router = Router();

/** Public list — published, not hidden, not past end date. */
router.get("/tournaments", async (req, res) => {
  try {
    const gender =
      typeof req.query.gender === "string" ? req.query.gender : undefined;
    const includePast = req.query.includePast === "true";
    const includeHidden = req.query.includeHidden === "true";
    const includeAllStatuses = req.query.includeAllStatuses === "true";

    const conditions = [];
    if (!includeAllStatuses) {
      conditions.push(eq(tournamentsTable.status, "published"));
    }
    if (!includePast) {
      conditions.push(gte(tournamentsTable.endDate, sql`CURRENT_DATE`));
    }
    if (!includeHidden) {
      conditions.push(eq(tournamentsTable.hidden, false));
    }
    if (gender === "boys" || gender === "girls" || gender === "coed") {
      conditions.push(eq(tournamentsTable.gender, gender));
    }

    const tournaments = await db
      .select()
      .from(tournamentsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(tournamentsTable.startDate);
    return res.json(
      tournaments.map((t) => ({
        ...t,
        expectedPublishDate: expectedPublishDate(t.startDate),
      })),
    );
  } catch {
    return res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

/** Admin list with status filter + search. */
router.get("/tournaments/admin", requireAdminAuth, async (req, res) => {
  try {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const conditions = [];
    if (
      status &&
      ["pending_review", "approved", "published", "archived", "rejected"].includes(
        status,
      )
    ) {
      conditions.push(eq(tournamentsTable.status, status as "published"));
    }
    if (q) {
      conditions.push(
        or(
          ilike(tournamentsTable.name, `%${q}%`),
          ilike(tournamentsTable.location, `%${q}%`),
          ilike(tournamentsTable.city, `%${q}%`),
        ),
      );
    }
    const rows = await db
      .select()
      .from(tournamentsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tournamentsTable.updatedAt));
    return res.json(
      rows.map((t) => ({
        ...t,
        expectedPublishDate: expectedPublishDate(t.startDate),
      })),
    );
  } catch {
    return res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

router.get("/tournaments/:id/evidence", requireAdminAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const rows = await db
      .select()
      .from(attendanceEvidenceTable)
      .where(eq(attendanceEvidenceTable.tournamentId, id))
      .orderBy(desc(attendanceEvidenceTable.verifiedAt));
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to load evidence" });
  }
});

router.post("/tournaments", requireAdminAuth, async (req, res) => {
  const parsed = insertTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodErrorMessage(parsed.error.issues) });
  }
  try {
    const [tournament] = await db
      .insert(tournamentsTable)
      .values({
        ...parsed.data,
        status: parsed.data.status ?? "approved",
        updatedAt: new Date(),
      })
      .returning();
    await writeAudit({
      action: "tournament.create",
      entityType: "tournament",
      entityId: tournament.id,
      after: tournament,
    });
    return res.status(201).json(tournament);
  } catch {
    return res.status(500).json({ error: "Failed to create tournament" });
  }
});

function zodErrorMessage(issues: { path: PropertyKey[]; message: string }[]) {
  return issues
    .map((i) =>
      i.path.length ? `${i.path.map(String).join(".")}: ${i.message}` : i.message,
    )
    .join("; ");
}

router.put("/tournaments/:id", requireAdminAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  const parsed = insertTournamentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: zodErrorMessage(parsed.error.issues) });
  }
  try {
    const [before] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, id))
      .limit(1);
    if (!before) return res.status(404).json({ error: "Tournament not found" });

    const manualFields = new Set(before.manualFields ?? []);
    for (const key of Object.keys(parsed.data)) {
      if (
        [
          "name",
          "startDate",
          "endDate",
          "timezone",
          "venue",
          "city",
          "state",
          "gender",
          "eventUrl",
          "imageUrl",
          "organizer",
          "location",
          "dates",
        ].includes(key)
      ) {
        manualFields.add(key);
      }
    }

    const [tournament] = await db
      .update(tournamentsTable)
      .set({
        ...parsed.data,
        manualFields: [...manualFields],
        updatedAt: new Date(),
        // Clearing discrepancy when admin edits after review is optional —
        // only clear if they set hasDiscrepancy explicitly false.
      })
      .where(eq(tournamentsTable.id, id))
      .returning();
    await writeAudit({
      action: "tournament.update",
      entityType: "tournament",
      entityId: id,
      before,
      after: tournament,
    });
    return res.json(tournament);
  } catch {
    return res.status(500).json({ error: "Failed to update tournament" });
  }
});

const statusBody = z.object({
  status: z.enum([
    "pending_review",
    "approved",
    "published",
    "archived",
    "rejected",
  ]),
  reason: z.string().optional(),
});

router.post("/tournaments/:id/status", requireAdminAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  const parsed = statusBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  try {
    const [before] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, id))
      .limit(1);
    if (!before) return res.status(404).json({ error: "Tournament not found" });

    const now = new Date();
    const patch: Record<string, unknown> = {
      status: parsed.data.status,
      updatedAt: now,
    };
    if (parsed.data.status === "approved") {
      patch.approvedAt = now;
      // Publish immediately if already within the 30-day window.
      if (
        shouldPublishApproved({
          startDate: before.startDate,
          endDate: before.endDate,
          timezone: before.timezone,
          now,
        })
      ) {
        patch.status = "published";
        patch.publishedAt = now;
      }
    }
    if (parsed.data.status === "published") patch.publishedAt = now;
    if (parsed.data.status === "archived") patch.archivedAt = now;
    if (parsed.data.status === "rejected") {
      patch.rejectedAt = now;
      patch.rejectionReason = parsed.data.reason ?? null;
    }

    const [tournament] = await db
      .update(tournamentsTable)
      .set(patch)
      .where(eq(tournamentsTable.id, id))
      .returning();
    await writeAudit({
      action: `tournament.status.${parsed.data.status}`,
      entityType: "tournament",
      entityId: id,
      before,
      after: tournament,
    });
    return res.json(tournament);
  } catch {
    return res.status(500).json({ error: "Failed to update status" });
  }
});

/** Soft-hide only — never hard-delete tournaments (preserves trips/messages). */
router.post("/tournaments/:id/hide", requireAdminAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  const hidden = req.body?.hidden !== false;
  try {
    const [tournament] = await db
      .update(tournamentsTable)
      .set({ hidden, updatedAt: new Date() })
      .where(eq(tournamentsTable.id, id))
      .returning();
    if (!tournament) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      action: hidden ? "tournament.hide" : "tournament.unhide",
      entityType: "tournament",
      entityId: id,
      after: { hidden },
    });
    return res.json(tournament);
  } catch {
    return res.status(500).json({ error: "Failed to update visibility" });
  }
});

/** Deprecated hard delete — reject to protect related records. */
router.delete("/tournaments/:id", requireAdminAuth, async (_req, res) => {
  return res.status(405).json({
    error:
      "Hard delete is disabled. Archive, reject, or hide the tournament instead.",
  });
});

export default router;
