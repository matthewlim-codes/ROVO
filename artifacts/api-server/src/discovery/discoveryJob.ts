import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  discoverySourcesTable,
  californiaClubsTable,
  attendanceEvidenceTable,
  appSettingsTable,
  AUTO_APPROVE_POLICY_KEY,
  type AutoApprovePolicy,
  type Tournament,
} from "@workspace/db/schema";
import { getAdapter } from "./adapters";
import {
  requiredFieldsMissing,
  type DiscoveredEvent,
} from "./types";
import {
  crossSourceDedupeKey,
  normalizeEventIdentity,
} from "../lib/tournamentLifecycle";

export type DiscoveryChange =
  | {
      action: "create";
      identity: string;
      event: DiscoveredEvent;
      missingFields: string[];
      evidenceCount: number;
      autoApprove: boolean;
      reason: string;
    }
  | {
      action: "update";
      tournamentId: string;
      identity: string;
      name: string;
      fieldChanges: Array<{ field: string; from: unknown; to: unknown; manual: boolean }>;
      evidenceAdds: number;
      hasDiscrepancy: boolean;
    }
  | {
      action: "skip";
      identity: string;
      reason: string;
    };

export type DiscoverySummary = {
  dryRun: boolean;
  setupRequired: boolean;
  setupMessage?: string;
  sourcesChecked: number;
  sourceFailures: Array<{ sourceId: string; name: string; error: string }>;
  changes: DiscoveryChange[];
  created: number;
  updated: number;
  pendingReview: number;
  autoApproved: number;
  discrepancies: number;
};

const DEFAULT_POLICY: AutoApprovePolicy = {
  minCaliforniaClubs: 1,
  acceptedEvidenceTypes: [
    "planned_schedule",
    "registration_confirmed",
    "organizer_team_list",
    "admin_verified",
  ],
  requireRegistrationConfirmed: false,
  enabled: true,
};

async function loadPolicy(): Promise<AutoApprovePolicy> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, AUTO_APPROVE_POLICY_KEY))
    .limit(1);
  if (!row?.value) return DEFAULT_POLICY;
  return { ...DEFAULT_POLICY, ...(row.value as Partial<AutoApprovePolicy>) };
}

function buildLocation(e: DiscoveredEvent): string {
  if (e.location?.trim()) return e.location.trim();
  const parts = [e.venue, e.city, e.state].filter(Boolean);
  return parts.join(", ") || "Location TBD";
}

function formatDates(startDate: string, endDate: string): string {
  return `${startDate} → ${endDate}`;
}

function identityFor(e: DiscoveredEvent): string {
  if (e.organizerEventId) {
    return `org:${e.organizer ?? ""}:${e.organizerEventId}:w${e.weekendIndex ?? 0}`;
  }
  return normalizeEventIdentity({
    name: e.name,
    startDate: e.startDate,
    city: e.city,
    state: e.state,
    organizer: e.organizer,
  }) + `:w${e.weekendIndex ?? 0}`;
}

const TRACKED_FIELDS = [
  "name",
  "startDate",
  "endDate",
  "timezone",
  "venue",
  "city",
  "state",
  "gender",
  "eventUrl",
  "organizer",
] as const;

function fieldValue(t: Tournament, field: (typeof TRACKED_FIELDS)[number]): unknown {
  return t[field];
}

function discoveredValue(
  e: DiscoveredEvent,
  field: (typeof TRACKED_FIELDS)[number],
): unknown {
  if (field === "venue") return e.venue ?? null;
  if (field === "city") return e.city ?? null;
  if (field === "state") return e.state ?? null;
  if (field === "eventUrl") return e.eventUrl ?? null;
  if (field === "organizer") return e.organizer ?? null;
  if (field === "gender") return e.gender ?? null;
  if (field === "name") return e.name;
  if (field === "startDate") return e.startDate;
  if (field === "endDate") return e.endDate;
  if (field === "timezone") return e.timezone;
  return null;
}

function evaluateAutoApprove(
  evidence: DiscoveredEvent["attendanceEvidence"],
  policy: AutoApprovePolicy,
  _clubCountConfigured: number,
): { ok: boolean; reason: string } {
  if (!policy.enabled) {
    return { ok: false, reason: "Auto-approve disabled — pending review" };
  }
  const accepted = evidence.filter((ev) =>
    policy.acceptedEvidenceTypes.includes(ev.evidenceType),
  );
  const distinctClubs = new Set(
    accepted.map((ev) => ev.californiaClubId ?? ev.clubOrTeamName.toLowerCase()),
  );
  if (distinctClubs.size < policy.minCaliforniaClubs) {
    return {
      ok: false,
      reason: `Need evidence for at least ${policy.minCaliforniaClubs} CA club(s); found ${distinctClubs.size}`,
    };
  }
  if (
    policy.requireRegistrationConfirmed &&
    !accepted.some((ev) => ev.evidenceType === "registration_confirmed")
  ) {
    return {
      ok: false,
      reason: "Policy requires registration_confirmed evidence",
    };
  }
  if (accepted.length === 0) {
    return { ok: false, reason: "Missing attendance evidence" };
  }
  return { ok: true, reason: "Meets auto-approve policy" };
}

export async function runDiscoveryJob(opts: {
  dryRun?: boolean;
}): Promise<DiscoverySummary> {
  const dryRun = !!opts.dryRun;
  const policy = await loadPolicy();

  const caClubs = await db
    .select()
    .from(californiaClubsTable)
    .where(eq(californiaClubsTable.active, true));
  const sources = await db
    .select()
    .from(discoverySourcesTable)
    .where(eq(discoverySourcesTable.enabled, true));

  const summary: DiscoverySummary = {
    dryRun,
    // Discovery only needs enabled sources. Auto-approve still requires
    // attendance evidence (+ optional CA club records); lack of evidence → pending.
    setupRequired: sources.length === 0,
    sourcesChecked: 0,
    sourceFailures: [],
    changes: [],
    created: 0,
    updated: 0,
    pendingReview: 0,
    autoApproved: 0,
    discrepancies: 0,
  };

  if (sources.length === 0) {
    summary.setupMessage =
      "Setup required: enable at least one discovery source (NCVA and/or SCVA).";
    return summary;
  }

  const existing = await db.select().from(tournamentsTable);
  const byOrgId = new Map<string, Tournament>();
  const byIdentity = new Map<string, Tournament>();
  const byCrossKey = new Map<string, Tournament>();
  for (const t of existing) {
    if (t.organizerEventId) {
      byOrgId.set(`${t.organizer ?? ""}:${t.organizerEventId}`, t);
    }
    if (t.normalizedIdentity) byIdentity.set(t.normalizedIdentity, t);
    if (t.name && t.startDate) {
      byCrossKey.set(
        crossSourceDedupeKey({ name: t.name, startDate: t.startDate }),
        t,
      );
    }
  }

  for (const source of sources) {
    summary.sourcesChecked += 1;
    const adapter = getAdapter(source.adapterKey);
    if (!adapter || !adapter.implemented) {
      summary.sourceFailures.push({
        sourceId: source.id,
        name: source.name,
        error: adapter
          ? `Adapter ${source.adapterKey} is not implemented`
          : `Unknown adapter ${source.adapterKey}`,
      });
      if (!dryRun) {
        await db
          .update(discoverySourcesTable)
          .set({
            healthStatus: "error",
            lastFailureAt: new Date(),
            lastError: summary.sourceFailures.at(-1)!.error,
            updatedAt: new Date(),
          })
          .where(eq(discoverySourcesTable.id, source.id));
      }
      // Failed source must not archive/erase events — continue.
      continue;
    }

    const result = await adapter.fetchEvents(
      (source.config ?? {}) as Record<string, unknown>,
    );
    if (!result.ok) {
      summary.sourceFailures.push({
        sourceId: source.id,
        name: source.name,
        error: result.error,
      });
      if (!dryRun) {
        await db
          .update(discoverySourcesTable)
          .set({
            healthStatus: "error",
            lastFailureAt: new Date(),
            lastError: result.error,
            updatedAt: new Date(),
          })
          .where(eq(discoverySourcesTable.id, source.id));
      }
      continue;
    }

    if (!dryRun) {
      await db
        .update(discoverySourcesTable)
        .set({
          healthStatus: "ok",
          lastSuccessAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(discoverySourcesTable.id, source.id));
    }

    for (const event of result.events) {
      const identity = identityFor(event);
      const missing = requiredFieldsMissing(event);
      const auto = evaluateAutoApprove(
        event.attendanceEvidence,
        policy,
        caClubs.length,
      );

      const crossKey = crossSourceDedupeKey({
        name: event.name,
        startDate: event.startDate,
      });
      const match =
        (event.organizerEventId &&
          byOrgId.get(`${event.organizer ?? ""}:${event.organizerEventId}`)) ||
        byIdentity.get(identity) ||
        byCrossKey.get(crossKey);

      if (!match) {
        const status =
          missing.length || !auto.ok ? "pending_review" : "approved";
        summary.changes.push({
          action: "create",
          identity,
          event,
          missingFields: missing,
          evidenceCount: event.attendanceEvidence.length,
          autoApprove: status === "approved",
          reason: missing.length
            ? `Missing required fields: ${missing.join(", ")}`
            : auto.reason,
        });
        if (status === "approved") summary.autoApproved += 1;
        else summary.pendingReview += 1;
        summary.created += 1;

        // Placeholder so a later source in this same run cannot create a duplicate.
        const placeholder = {
          id: `dry-${identity}`,
          name: event.name,
          startDate: event.startDate,
          organizer: event.organizer ?? null,
          organizerEventId: event.organizerEventId ?? null,
          normalizedIdentity: identity,
          manualFields: [] as string[],
        } as Tournament;
        byIdentity.set(identity, placeholder);
        byCrossKey.set(crossKey, placeholder);
        if (event.organizerEventId) {
          byOrgId.set(
            `${event.organizer ?? ""}:${event.organizerEventId}`,
            placeholder,
          );
        }

        if (!dryRun) {
          const now = new Date();
          const [created] = await db
            .insert(tournamentsTable)
            .values({
              name: event.name,
              location: buildLocation(event),
              dates: formatDates(event.startDate, event.endDate),
              startDate: event.startDate,
              endDate: event.endDate,
              gender: event.gender ?? "coed",
              description: event.description ?? null,
              status,
              timezone: event.timezone,
              organizer: event.organizer ?? null,
              organizerEventId: event.organizerEventId ?? null,
              eventUrl: event.eventUrl ?? null,
              venue: event.venue ?? null,
              city: event.city ?? null,
              state: event.state ?? null,
              normalizedIdentity: identity,
              approvedAt: status === "approved" ? now : null,
              lastSourceCheckAt: now,
              sourcePayload: event,
              hidden: false,
              manualFields: [],
            })
            .returning();
          byIdentity.set(identity, created);
          byCrossKey.set(crossKey, created);
          if (created.organizerEventId) {
            byOrgId.set(
              `${created.organizer ?? ""}:${created.organizerEventId}`,
              created,
            );
          }
          for (const ev of event.attendanceEvidence) {
            await db.insert(attendanceEvidenceTable).values({
              tournamentId: created.id,
              sourceId: source.id,
              californiaClubId: ev.californiaClubId ?? null,
              sourceUrl: ev.sourceUrl,
              evidenceType: ev.evidenceType,
              clubOrTeamName: ev.clubOrTeamName,
              notes: ev.notes ?? null,
              verifiedAt: ev.verifiedAt ? new Date(ev.verifiedAt) : now,
            });
          }
        }
        continue;
      }

      // Existing tournament — preserve manual fields; flag discrepancies.
      const manual = new Set(match.manualFields ?? []);
      const fieldChanges: Array<{
        field: string;
        from: unknown;
        to: unknown;
        manual: boolean;
      }> = [];
      let hasDiscrepancy = false;
      for (const field of TRACKED_FIELDS) {
        const from = fieldValue(match, field);
        const to = discoveredValue(event, field);
        if (to == null || to === "") continue;
        if (String(from ?? "") === String(to ?? "")) continue;
        const isManual = manual.has(field);
        fieldChanges.push({ field, from, to, manual: isManual });
        if (isManual) hasDiscrepancy = true;
      }

      summary.changes.push({
        action: "update",
        tournamentId: match.id,
        identity,
        name: match.name,
        fieldChanges,
        evidenceAdds: event.attendanceEvidence.length,
        hasDiscrepancy,
      });
      if (fieldChanges.length) summary.updated += 1;
      if (hasDiscrepancy) summary.discrepancies += 1;

      if (!dryRun) {
        const now = new Date();
        const patch: Record<string, unknown> = {
          lastSourceCheckAt: now,
          updatedAt: now,
          sourcePayload: event,
        };
        if (hasDiscrepancy) {
          patch.hasDiscrepancy = true;
          patch.discrepancyNotes = fieldChanges
            .filter((c) => c.manual)
            .map((c) => `${c.field}: source=${c.to} manual=${c.from}`)
            .join("; ");
        }
        for (const change of fieldChanges) {
          if (!change.manual) {
            patch[change.field] = change.to;
          }
        }
        if (patch.startDate || patch.endDate) {
          patch.dates = formatDates(
            String(patch.startDate ?? match.startDate),
            String(patch.endDate ?? match.endDate),
          );
        }
        if (patch.city || patch.venue || patch.state) {
          patch.location = buildLocation({
            ...event,
            city: String(patch.city ?? match.city ?? event.city ?? ""),
            venue: String(patch.venue ?? match.venue ?? event.venue ?? ""),
            state: String(patch.state ?? match.state ?? event.state ?? ""),
          } as DiscoveredEvent);
        }
        await db
          .update(tournamentsTable)
          .set(patch)
          .where(eq(tournamentsTable.id, match.id));

        for (const ev of event.attendanceEvidence) {
          await db.insert(attendanceEvidenceTable).values({
            tournamentId: match.id,
            sourceId: source.id,
            californiaClubId: ev.californiaClubId ?? null,
            sourceUrl: ev.sourceUrl,
            evidenceType: ev.evidenceType,
            clubOrTeamName: ev.clubOrTeamName,
            notes: ev.notes ?? null,
            verifiedAt: ev.verifiedAt ? new Date(ev.verifiedAt) : now,
          });
        }
      }
    }
  }

  return summary;
}
