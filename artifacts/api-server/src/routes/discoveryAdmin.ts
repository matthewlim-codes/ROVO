import { Router } from "express";
import { db } from "@workspace/db";
import {
  californiaClubsTable,
  discoverySourcesTable,
  appSettingsTable,
  AUTO_APPROVE_POLICY_KEY,
  adminAuditLogTable,
  insertCaliforniaClubSchema,
  insertDiscoverySourceSchema,
} from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";
import { routeParam } from "../lib/matching";
import { writeAudit } from "../lib/jobRunner";
import { listAdapters } from "../discovery/adapters";
import { z } from "zod/v4";

const router = Router();

router.get("/discovery/adapters", requireAdminAuth, async (_req, res) => {
  return res.json(listAdapters());
});

router.get("/discovery/setup-status", requireAdminAuth, async (_req, res) => {
  try {
    const clubs = await db.select().from(californiaClubsTable);
    const sources = await db.select().from(discoverySourcesTable);
    const activeClubs = clubs.filter((c) => c.active);
    const enabledSources = sources.filter((s) => s.enabled);
    const setupRequired = enabledSources.length === 0;
    return res.json({
      setupRequired,
      californiaClubCount: activeClubs.length,
      enabledSourceCount: enabledSources.length,
      message: setupRequired
        ? "Enable at least one discovery source (NCVA and/or SCVA)."
        : "Setup complete",
      adapters: listAdapters(),
    });
  } catch {
    return res.status(500).json({ error: "Failed to load setup status" });
  }
});

router.get("/california-clubs", requireAdminAuth, async (_req, res) => {
  try {
    return res.json(await db.select().from(californiaClubsTable));
  } catch {
    return res.status(500).json({ error: "Failed to load California clubs" });
  }
});

router.post("/california-clubs", requireAdminAuth, async (req, res) => {
  const parsed = insertCaliforniaClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  try {
    const [row] = await db
      .insert(californiaClubsTable)
      .values(parsed.data)
      .returning();
    await writeAudit({
      action: "california_club.create",
      entityType: "california_club",
      entityId: row.id,
      after: row,
    });
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "Failed to create club" });
  }
});

router.put("/california-clubs/:id", requireAdminAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  const parsed = insertCaliforniaClubSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  try {
    const [row] = await db
      .update(californiaClubsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(californiaClubsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      action: "california_club.update",
      entityType: "california_club",
      entityId: id,
      after: row,
    });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "Failed to update club" });
  }
});

router.get("/discovery-sources", requireAdminAuth, async (_req, res) => {
  try {
    return res.json(await db.select().from(discoverySourcesTable));
  } catch {
    return res.status(500).json({ error: "Failed to load sources" });
  }
});

function rejectTestOnlyAdapter(adapterKey: string | undefined): string | null {
  if (adapterKey === "static_fixture" && process.env.ALLOW_TEST_ADAPTERS !== "true") {
    return "static_fixture is test-only and cannot be enabled in production";
  }
  return null;
}

router.post("/discovery-sources", requireAdminAuth, async (req, res) => {
  const parsed = insertDiscoverySourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const blocked = rejectTestOnlyAdapter(parsed.data.adapterKey);
  if (blocked) return res.status(400).json({ error: blocked });
  try {
    const [row] = await db
      .insert(discoverySourcesTable)
      .values(parsed.data)
      .returning();
    await writeAudit({
      action: "discovery_source.create",
      entityType: "discovery_source",
      entityId: row.id,
      after: row,
    });
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "Failed to create source" });
  }
});

/** Idempotently enable the two production calendar sources (NCVA + SCVA). */
router.post("/discovery-sources/ensure-defaults", requireAdminAuth, async (_req, res) => {
  const defaults = [
    {
      name: "NCVA events",
      kind: "structured_calendar" as const,
      adapterKey: "ncva_calendar",
      config: {
        baseUrl: "https://ncva.com",
        calendarPageSlug: "events",
        genders: ["boys"],
        includePast: false,
      },
    },
    {
      name: "SCVA tournaments",
      kind: "structured_calendar" as const,
      adapterKey: "scva_tournaments",
      config: {
        url: "https://www.scvavolleyball.org/tournaments",
        includePast: false,
      },
    },
  ];
  try {
    const existing = await db.select().from(discoverySourcesTable);
    const upserted = [];
    for (const def of defaults) {
      const found = existing.find((s) => s.adapterKey === def.adapterKey);
      if (found) {
        const [row] = await db
          .update(discoverySourcesTable)
          .set({
            name: def.name,
            kind: def.kind,
            config: def.config,
            enabled: true,
            updatedAt: new Date(),
          })
          .where(eq(discoverySourcesTable.id, found.id))
          .returning();
        upserted.push(row);
      } else {
        const [row] = await db
          .insert(discoverySourcesTable)
          .values({ ...def, enabled: true })
          .returning();
        upserted.push(row);
      }
    }
    // Disable test fixtures / unrelated stubs so production pulls only NCVA+SCVA
    for (const s of existing) {
      if (
        s.adapterKey === "ncva_calendar" ||
        s.adapterKey === "scva_tournaments"
      ) {
        continue;
      }
      if (s.enabled) {
        await db
          .update(discoverySourcesTable)
          .set({ enabled: false, updatedAt: new Date() })
          .where(eq(discoverySourcesTable.id, s.id));
      }
    }
    await writeAudit({
      action: "discovery_source.ensure_defaults",
      entityType: "discovery_source",
      after: { adapters: upserted.map((s) => s.adapterKey) },
    });
    return res.json({ sources: upserted });
  } catch {
    return res.status(500).json({ error: "Failed to ensure default sources" });
  }
});

router.put("/discovery-sources/:id", requireAdminAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  const parsed = insertDiscoverySourceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const blocked = rejectTestOnlyAdapter(parsed.data.adapterKey);
  if (blocked) return res.status(400).json({ error: blocked });
  try {
    const [row] = await db
      .update(discoverySourcesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(discoverySourcesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      action: "discovery_source.update",
      entityType: "discovery_source",
      entityId: id,
      after: row,
    });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "Failed to update source" });
  }
});

router.get("/discovery/policy", requireAdminAuth, async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, AUTO_APPROVE_POLICY_KEY))
      .limit(1);
    return res.json(
      row?.value ?? {
        minCaliforniaClubs: 1,
        acceptedEvidenceTypes: [
          "planned_schedule",
          "registration_confirmed",
          "organizer_team_list",
          "admin_verified",
        ],
        requireRegistrationConfirmed: false,
        enabled: true,
      },
    );
  } catch {
    return res.status(500).json({ error: "Failed to load policy" });
  }
});

router.put("/discovery/policy", requireAdminAuth, async (req, res) => {
  const parsed = z
    .object({
      minCaliforniaClubs: z.number().int().min(1).max(50),
      acceptedEvidenceTypes: z.array(z.string()).min(1),
      requireRegistrationConfirmed: z.boolean(),
      enabled: z.boolean(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  try {
    await db
      .insert(appSettingsTable)
      .values({
        key: AUTO_APPROVE_POLICY_KEY,
        value: parsed.data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: parsed.data, updatedAt: new Date() },
      });
    await writeAudit({
      action: "discovery.policy.update",
      entityType: "app_settings",
      entityId: AUTO_APPROVE_POLICY_KEY,
      after: parsed.data,
    });
    return res.json(parsed.data);
  } catch {
    return res.status(500).json({ error: "Failed to save policy" });
  }
});

router.get("/admin/audit-log", requireAdminAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await db
      .select()
      .from(adminAuditLogTable)
      .orderBy(desc(adminAuditLogTable.createdAt))
      .limit(limit);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Failed to load audit log" });
  }
});

export default router;
