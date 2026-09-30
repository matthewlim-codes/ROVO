import {
  discoveredEventSchema,
  type AdapterResult,
  type DiscoveryAdapter,
  type DiscoveredEvent,
} from "./types";
import { fetchNcvaCalendarEvents } from "./ncvaCalendar";
import { fetchScvaTournaments } from "./scvaTournaments";

/**
 * Implemented adapter: fetch a JSON array from a trusted HTTPS URL or use
 * inline `events` in source config. Not a web scraper.
 *
 * Required shape for each event object:
 *   name (string), startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 * Optional: organizer, organizerEventId, timezone (default America/Los_Angeles),
 *   venue, city, state, location, gender (boys|girls|coed), eventUrl,
 *   seriesKey, weekendIndex, description,
 *   attendanceEvidence: [{ sourceUrl, evidenceType, clubOrTeamName, californiaClubId?, notes?, verifiedAt? }]
 *
 * evidenceType must be one of:
 *   planned_schedule | registration_confirmed | organizer_team_list | admin_verified
 *
 * Config:
 *   { "url": "https://…" }  — HTTPS JSON array endpoint
 *   OR { "events": [ … ] }  — inline array (useful for one-off imports)
 *
 * Invalid rows are skipped; missing required fields are never invented.
 */
export const manualJsonAdapter: DiscoveryAdapter = {
  key: "manual_json",
  label: "Manual / structured JSON feed",
  implemented: true,
  async fetchEvents(config): Promise<AdapterResult> {
    try {
      let raw: unknown = config.events;
      if (typeof config.url === "string" && config.url.trim()) {
        const url = config.url.trim();
        if (!/^https:\/\//i.test(url)) {
          return { ok: false, error: "manual_json url must be https" };
        }
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!resp.ok) {
          return { ok: false, error: `HTTP ${resp.status} from feed` };
        }
        raw = await resp.json();
      }
      if (!Array.isArray(raw)) {
        return { ok: false, error: "Expected a JSON array of events" };
      }
      const events: DiscoveredEvent[] = [];
      for (const row of raw) {
        const parsed = discoveredEventSchema.safeParse(row);
        if (!parsed.success) {
          // Skip invalid rows rather than inventing fields
          continue;
        }
        events.push(parsed.data);
      }
      return { ok: true, events };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "manual_json fetch failed",
      };
    }
  },
};

/**
 * Official NCVA calendar via WordPress REST (structured calendar, not a scrapey free-for-all).
 * Config: { genders?: ["boys","girls","coed"], calendarPageSlug?: "events", includePast?: false }
 * Page: https://ncva.com/events/
 */
export const ncvaCalendarAdapter: DiscoveryAdapter = {
  key: "ncva_calendar",
  label: "NCVA events (ncva.com/events)",
  implemented: true,
  fetchEvents: fetchNcvaCalendarEvents,
};

/**
 * SCVA tournaments listing (Wix HTML).
 * Config: { url?: "https://www.scvavolleyball.org/tournaments", includePast?: false }
 */
export const scvaTournamentsAdapter: DiscoveryAdapter = {
  key: "scva_tournaments",
  label: "SCVA tournaments (scvavolleyball.org/tournaments)",
  implemented: true,
  fetchEvents: fetchScvaTournaments,
};

/**
 * Test-only adapter: returns events from config.events without network I/O.
 * Disabled unless ALLOW_TEST_ADAPTERS=true — keep out of production.
 */
export const staticFixtureAdapter: DiscoveryAdapter = {
  key: "static_fixture",
  label: "Static fixture (tests only)",
  implemented: process.env.ALLOW_TEST_ADAPTERS === "true",
  async fetchEvents(config): Promise<AdapterResult> {
    if (process.env.ALLOW_TEST_ADAPTERS !== "true") {
      return {
        ok: false,
        error:
          "static_fixture is test-only. Set ALLOW_TEST_ADAPTERS=true for local tests, never in production.",
      };
    }
    if (!Array.isArray(config.events)) {
      return { ok: false, error: "static_fixture requires config.events array" };
    }
    const events: DiscoveredEvent[] = [];
    for (const row of config.events) {
      const parsed = discoveredEventSchema.safeParse(row);
      if (parsed.success) events.push(parsed.data);
    }
    return { ok: true, events };
  },
};

/** Proposed future adapters — not implemented (no invented tournament facts). */
export const proposedAdapters: DiscoveryAdapter[] = [
  {
    key: "aes_official",
    label: "Advanced Event Systems / SportsEngine official feed (proposed)",
    implemented: false,
    async fetchEvents() {
      return {
        ok: false,
        error:
          "Blocked: AES/SportsEngine results host does not expose a public searchable event catalog API (SPA shell only). Needs official API access or partner feed.",
      };
    },
  },
  {
    key: "jva_calendar",
    label: "JVA structured calendar (proposed)",
    implemented: false,
    async fetchEvents() {
      return {
        ok: false,
        error:
          "Adapter not implemented. Requires an official structured JVA calendar endpoint.",
      };
    },
  },
  {
    key: "usav_events",
    label: "USA Volleyball events listing (proposed)",
    implemented: false,
    async fetchEvents() {
      return {
        ok: false,
        error:
          "USAV /events/ is HTML-rendered without a public events REST collection. Cross-check only; use NCVA/manual_json for ingestion until an official API exists.",
      };
    },
  },
];

const all = [
  ncvaCalendarAdapter,
  scvaTournamentsAdapter,
  manualJsonAdapter,
  staticFixtureAdapter,
  ...proposedAdapters,
];

export function getAdapter(key: string): DiscoveryAdapter | undefined {
  return all.find((a) => a.key === key);
}

export function listAdapters(opts?: { includeTest?: boolean }) {
  const includeTest =
    opts?.includeTest || process.env.ALLOW_TEST_ADAPTERS === "true";
  return all
    .filter((a) => includeTest || a.key !== "static_fixture")
    .map((a) => ({
      key: a.key,
      label: a.label,
      implemented: a.implemented,
    }));
}
