import { z } from "zod/v4";

/** Normalized discovery candidate — never invent missing required fields. */
export const discoveredEventSchema = z.object({
  name: z.string().min(1),
  organizer: z.string().min(1).optional(),
  organizerEventId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).default("America/Los_Angeles"),
  venue: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  location: z.string().optional(),
  gender: z.enum(["boys", "girls", "coed"]).optional(),
  eventUrl: z.string().url().optional(),
  description: z.string().optional(),
  /** Multi-weekend series key — each weekend is a separate event identity. */
  seriesKey: z.string().optional(),
  weekendIndex: z.number().int().optional(),
  attendanceEvidence: z
    .array(
      z.object({
        sourceUrl: z.string().url(),
        evidenceType: z.enum([
          "planned_schedule",
          "registration_confirmed",
          "organizer_team_list",
          "admin_verified",
        ]),
        clubOrTeamName: z.string().min(1),
        californiaClubId: z.string().uuid().optional(),
        notes: z.string().optional(),
        verifiedAt: z.string().datetime().optional(),
      }),
    )
    .default([]),
});

export type DiscoveredEvent = z.infer<typeof discoveredEventSchema>;

export type AdapterResult =
  | { ok: true; events: DiscoveredEvent[] }
  | { ok: false; error: string };

export interface DiscoveryAdapter {
  key: string;
  /** Human label for admin docs. */
  label: string;
  /** true = implemented and safe to enable. */
  implemented: boolean;
  fetchEvents(config: Record<string, unknown>): Promise<AdapterResult>;
}

export function requiredFieldsMissing(e: DiscoveredEvent): string[] {
  const missing: string[] = [];
  if (!e.name?.trim()) missing.push("name");
  if (!e.startDate) missing.push("startDate");
  if (!e.endDate) missing.push("endDate");
  if (!e.timezone) missing.push("timezone");
  if (!(e.city || e.location)) missing.push("city/location");
  if (!e.gender) missing.push("gender");
  return missing;
}
