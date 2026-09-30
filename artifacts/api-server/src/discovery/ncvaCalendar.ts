/**
 * NCVA (Northern California Volleyball Association) official calendar adapter.
 *
 * Source: WordPress REST API for https://ncva.com/events/
 *   GET https://ncva.com/wp-json/wp/v2/pages?slug=events
 *
 * This is an official regional organizer calendar used by California clubs.
 * AES/SportsEngine does not expose a public event-list API suitable for discovery
 * (SPA shell only; OData service roots do not return searchable event catalogs).
 *
 * Attendance evidence is never invented — club schedules / registration lists must
 * be supplied separately or added by admins.
 */

import {
  discoveredEventSchema,
  type AdapterResult,
  type DiscoveredEvent,
} from "./types";

const DEFAULT_BASE = "https://ncva.com";
const USER_AGENT = "RovoDiscoveryBot/1.0 (+https://rovousa.com; tournament discovery)";

type GenderFilter = "boys" | "girls" | "coed";

type ParsedDateRange = {
  startDate: string;
  endDate: string;
};

type VenueHint = {
  venue?: string;
  city?: string;
  state?: string;
};

const VENUE_HINTS: Array<{ match: RegExp; hint: VenueHint }> = [
  {
    match: /capital sports center|csc|mcclellan/i,
    hint: {
      venue: "Capital Sports Center",
      city: "McClellan Park",
      state: "CA",
    },
  },
  {
    match: /san mateo event center|smec/i,
    hint: {
      venue: "San Mateo Event Center",
      city: "San Mateo",
      state: "CA",
    },
  },
  {
    match: /@\s*the\s*grounds|the grounds|roseville/i,
    hint: { venue: "The Grounds", city: "Roseville", state: "CA" },
  },
  {
    match: /safe credit union|sacramento/i,
    hint: {
      venue: "SAFE Credit Union Convention Center",
      city: "Sacramento",
      state: "CA",
    },
  },
  {
    match: /reno[- ]?sparks|reno/i,
    hint: {
      venue: "Reno-Sparks Convention Center",
      city: "Reno",
      state: "NV",
    },
  },
];

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#038;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHref(cellHtml: string): string | undefined {
  const m = /href=["']([^"']+)["']/i.exec(cellHtml);
  return m?.[1];
}

function parseTables(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html))) {
    const rows: string[][] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(tm[1]))) {
      const cells: string[] = [];
      const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1]))) {
        cells.push(cm[2]);
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

/** Split a date cell that may contain multiple weekend ranges. */
export function parseNcvaDateRanges(raw: string): ParsedDateRange[] {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || /^tba$/i.test(text)) return [];

  // Multi-weekend: "April 9 - 11, 2027 April 16 - 18 , 2027 April 23 - 25, 2027"
  const multi =
    text.match(
      /([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s*,?\s*(\d{4})/g,
    ) ?? [];
  if (multi.length >= 2) {
    const ranges: ParsedDateRange[] = [];
    for (const part of multi) {
      const m =
        /([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s*,?\s*(\d{4})/.exec(part);
      if (!m) continue;
      const month = MONTHS[m[1].toLowerCase()];
      if (!month) continue;
      const y = Number(m[4]);
      ranges.push({
        startDate: ymd(y, month, Number(m[2])),
        endDate: ymd(y, month, Number(m[3])),
      });
    }
    if (ranges.length) return ranges;
  }

  // "December 12-13, 2026" / "January 16-17-18, 2027" / "Feb 26-27-28, 2027"
  let m =
    /^([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–/]\s*(\d{1,2}))?(?:\s*[-–/]\s*(\d{1,2}))?\s*,?\s*(\d{4})$/i.exec(
      text,
    );
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (!month) return [];
    const y = Number(m[5]);
    const d1 = Number(m[2]);
    const d2 = m[4] ? Number(m[4]) : m[3] ? Number(m[3]) : d1;
    return [{ startDate: ymd(y, month, d1), endDate: ymd(y, month, d2) }];
  }

  // "March 6 & 7 2027 (one day of play)" — treat as range 6–7
  m =
    /^([A-Za-z]+)\s+(\d{1,2})\s*(?:&|and)\s*(\d{1,2})\s*,?\s*(\d{4})/i.exec(
      text,
    );
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (!month) return [];
    const y = Number(m[4]);
    return [
      {
        startDate: ymd(y, month, Number(m[2])),
        endDate: ymd(y, month, Number(m[3])),
      },
    ];
  }

  // "Feb 27-28-Mar 1, 2026" cross-month
  m =
    /^([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})$/i.exec(
      text,
    );
  if (m) {
    const m1 = MONTHS[m[1].toLowerCase()];
    const m2 = MONTHS[m[4].toLowerCase()];
    if (!m1 || !m2) return [];
    const y = Number(m[6]);
    return [
      {
        startDate: ymd(y, m1, Number(m[2])),
        endDate: ymd(y, m2, Number(m[5])),
      },
    ];
  }

  return [];
}

export function inferGender(
  divisionsCell: string | undefined,
  name: string,
): GenderFilter | undefined {
  const div = (divisionsCell ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (/\bboys\b/.test(div) && /\bgirls\b/.test(div)) return "coed";
  if (/\bboys\b/.test(div)) return "boys";
  if (/\bgirls\b/.test(div)) return "girls";
  if (/\bboys and girls\b/.test(n) || /\(boys and girls\)/.test(n)) return "coed";
  if (/\bboys\b/.test(n)) return "boys";
  if (/\bgirls\b/.test(n)) return "girls";
  return undefined;
}

function resolveVenue(locationRaw: string): VenueHint & { location?: string } {
  const location = stripTags(locationRaw);
  if (!location || /^tba$/i.test(location)) {
    return {};
  }
  for (const { match, hint } of VENUE_HINTS) {
    if (match.test(location)) {
      return { ...hint, location };
    }
  }
  // "City, ST" fallback
  const m = /([A-Za-z .'-]+),\s*([A-Z]{2})\b/.exec(location);
  if (m) {
    return { city: m[1].trim(), state: m[2], location, venue: location };
  }
  return { location, venue: location };
}

function todayYmd(now = new Date()): string {
  return ymd(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

function slugFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.at(-1);
  } catch {
    return undefined;
  }
}

async function fetchWpPageBySlug(
  baseUrl: string,
  slug: string,
): Promise<{ link: string; content: string; modified?: string } | null> {
  const api = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`;
  const resp = await fetch(api, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!resp.ok) {
    throw new Error(`NCVA WordPress API HTTP ${resp.status} for slug=${slug}`);
  }
  const data = (await resp.json()) as Array<{
    link?: string;
    content?: { rendered?: string };
    modified?: string;
  }>;
  if (!Array.isArray(data) || !data[0]?.content?.rendered) return null;
  return {
    link: data[0].link ?? `${baseUrl}/${slug}/`,
    content: data[0].content.rendered,
    modified: data[0].modified,
  };
}

function headerIndex(headerCells: string[], ...names: string[]): number {
  const norms = headerCells.map((c) => stripTags(c).toLowerCase());
  for (const name of names) {
    const i = norms.findIndex((h) => h.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

function rowLooksLikeHeader(cells: string[]): boolean {
  const joined = cells.map(stripTags).join(" ").toLowerCase();
  return (
    joined.includes("tournament") &&
    (joined.includes("date") || joined.includes("event page"))
  );
}

export async function fetchNcvaCalendarEvents(
  config: Record<string, unknown>,
): Promise<AdapterResult> {
  try {
    const baseUrl =
      typeof config.baseUrl === "string" && config.baseUrl.trim()
        ? config.baseUrl.trim().replace(/\/$/, "")
        : DEFAULT_BASE;
    if (!/^https:\/\//i.test(baseUrl)) {
      return { ok: false, error: "ncva_calendar baseUrl must be https" };
    }

    const slug =
      typeof config.calendarPageSlug === "string" && config.calendarPageSlug.trim()
        ? config.calendarPageSlug.trim()
        : "events";

    // Default: ingest boys + girls (+ coed). Earlier boys-only default hid
    // most of the official NCVA calendar (Jan+ events are largely girls).
    const gendersRaw = Array.isArray(config.genders)
      ? (config.genders as unknown[]).map(String)
      : ["boys", "girls", "coed"];
    const genders = new Set(
      gendersRaw.filter((g): g is GenderFilter =>
        g === "boys" || g === "girls" || g === "coed",
      ),
    );
    if (!genders.size) {
      genders.add("boys");
      genders.add("girls");
      genders.add("coed");
    }

    const includePast = config.includePast === true;
    const now = new Date();
    const today = todayYmd(now);

    const page = await fetchWpPageBySlug(baseUrl, slug);
    if (!page) {
      return {
        ok: false,
        error: `NCVA calendar page slug "${slug}" not found via WordPress REST API`,
      };
    }

    const tables = parseTables(page.content);
    const events: DiscoveredEvent[] = [];
    const seen = new Set<string>();
    const seenDedupe = new Set<string>();

    // Prefer the primary "Divisions | Tournament | Date | …" table; season
    // archive tables often repeat the same qualifiers with different titles.
    const rankedTables = [...tables].sort((a, b) => {
      const aDiv = a[0] && headerIndex(a[0], "division") >= 0 ? 0 : 1;
      const bDiv = b[0] && headerIndex(b[0], "division") >= 0 ? 0 : 1;
      return aDiv - bDiv;
    });

    for (const table of rankedTables) {
      if (!table.length) continue;
      const header = table[0];
      if (!rowLooksLikeHeader(header)) continue;

      const iDiv = headerIndex(header, "division");
      const iName = headerIndex(header, "tournament");
      const iDate = headerIndex(header, "date");
      const iLoc = headerIndex(header, "location");
      const iPage = headerIndex(header, "event page", "event");

      if (iName < 0 || iDate < 0) continue;

      for (const row of table.slice(1)) {
        const name = stripTags(row[iName] ?? "");
        if (!name) continue;

        const divisions = iDiv >= 0 ? stripTags(row[iDiv] ?? "") : "";
        const gender = inferGender(divisions, name) ?? "coed";
        if (!genders.has(gender)) continue;

        const dateRaw = stripTags(row[iDate] ?? "");
        const ranges = parseNcvaDateRanges(dateRaw);
        if (!ranges.length) {
          // Missing/unparseable dates (e.g. TBA) — do not invent; skip.
          continue;
        }

        const locRaw = iLoc >= 0 ? row[iLoc] ?? "" : "";
        const venueInfo = resolveVenue(locRaw);
        // TBA location → leave city empty so requiredFieldsMissing catches it.
        const locationText = stripTags(locRaw);
        const locationMissing = !locationText || /^tba$/i.test(locationText);

        let eventUrl: string | undefined;
        if (iPage >= 0) {
          const href = extractHref(row[iPage] ?? "");
          if (href) {
            eventUrl = href.startsWith("http")
              ? href
              : new URL(href, baseUrl).toString();
          }
        }

        const organizerEventIdBase =
          slugFromUrl(eventUrl ?? "") ??
          name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        for (let wi = 0; wi < ranges.length; wi++) {
          const range = ranges[wi]!;
          if (!includePast && range.endDate < today) continue;

          const payload = {
            name:
              ranges.length > 1
                ? `${name} (Weekend ${wi + 1})`
                : name,
            organizer: "NCVA",
            organizerEventId:
              ranges.length > 1
                ? `${organizerEventIdBase}-w${wi + 1}`
                : organizerEventIdBase,
            startDate: range.startDate,
            endDate: range.endDate,
            timezone: "America/Los_Angeles",
            venue: locationMissing ? undefined : venueInfo.venue,
            city: locationMissing ? undefined : venueInfo.city,
            state: locationMissing ? undefined : venueInfo.state,
            location: locationMissing ? undefined : venueInfo.location,
            gender,
            eventUrl,
            seriesKey: ranges.length > 1 ? organizerEventIdBase : undefined,
            weekendIndex: ranges.length > 1 ? wi : undefined,
            description: `Discovered from NCVA official calendar (${page.link}).`,
            attendanceEvidence: [],
          };

          const parsed = discoveredEventSchema.safeParse(payload);
          if (!parsed.success) continue;
          const key = `${parsed.data.organizerEventId}|${parsed.data.startDate}`;
          if (seen.has(key)) continue;
          const dedupe = `${parsed.data.name
            .toLowerCase()
            .replace(/\b20\d{2}\b/g, " ")
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
            .replace(/\s+/g, " ")}|${parsed.data.startDate}|${parsed.data.weekendIndex ?? 0}`;
          if (seenDedupe.has(dedupe)) continue;
          seen.add(key);
          seenDedupe.add(dedupe);
          events.push(parsed.data);
        }
      }
    }

    return { ok: true, events };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ncva_calendar fetch failed",
    };
  }
}
