import {
  discoveredEventSchema,
  type AdapterResult,
  type DiscoveryAdapter,
  type DiscoveredEvent,
} from "./types";

/**
 * Implemented adapter: fetch a JSON array from a trusted HTTPS URL or use
 * inline `events` in source config. Not a web scraper.
 *
 * Config:
 *   { "url": "https://…" }  OR  { "events": [ … ] }
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
 * Test-only adapter: returns events from config.events without network I/O.
 */
export const staticFixtureAdapter: DiscoveryAdapter = {
  key: "static_fixture",
  label: "Static fixture (tests)",
  implemented: true,
  async fetchEvents(config): Promise<AdapterResult> {
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
    label: "Advanced Event Systems official feed (proposed)",
    implemented: false,
    async fetchEvents() {
      return {
        ok: false,
        error:
          "Adapter not implemented. Configure when an official AES API/feed and credentials are available.",
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
    label: "USA Volleyball events API (proposed)",
    implemented: false,
    async fetchEvents() {
      return {
        ok: false,
        error:
          "Adapter not implemented. Requires official USAV API access.",
      };
    },
  },
];

const all = [
  manualJsonAdapter,
  staticFixtureAdapter,
  ...proposedAdapters,
];

export function getAdapter(key: string): DiscoveryAdapter | undefined {
  return all.find((a) => a.key === key);
}

export function listAdapters() {
  return all.map((a) => ({
    key: a.key,
    label: a.label,
    implemented: a.implemented,
  }));
}
