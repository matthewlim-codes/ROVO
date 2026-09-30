/**
 * SCVA (Southern California Volleyball Association) tournaments page adapter.
 *
 * Source: https://www.scvavolleyball.org/tournaments (Wix HTML listing).
 * Parses published tournament name / location / date blocks from the page.
 * Does not invent attendance evidence.
 */

import {
  discoveredEventSchema,
  type AdapterResult,
  type DiscoveredEvent,
} from "./types";

const DEFAULT_URL = "https://www.scvavolleyball.org/tournaments";
const USER_AGENT =
  "RovoDiscoveryBot/1.0 (+https://rovousa.com; tournament discovery)";

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
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function resolveYear(month: number, day: number, hintYear?: number): number {
  const now = new Date();
  const y = hintYear ?? now.getUTCFullYear();
  const candidate = Date.UTC(y, month - 1, day);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  if (candidate < today) return y + 1;
  return y;
}

/** Parse "February 26-28" / "June 24-27" / "March 5-7, 2027". */
export function parseScvaDateRange(
  raw: string,
  hintYear?: number,
): { startDate: string; endDate: string } | null {
  const text = raw.replace(/\s+/g, " ").trim();
  const m =
    /^([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?(?:\s*,?\s*(\d{4}))?$/i.exec(
      text,
    );
  if (!m) return null;
  const month = MONTHS[m[1]!.toLowerCase()];
  if (!month) return null;
  const d1 = Number(m[2]);
  const d2 = m[3] ? Number(m[3]) : d1;
  const y = resolveYear(month, d1, m[4] ? Number(m[4]) : hintYear);
  return { startDate: ymd(y, month, d1), endDate: ymd(y, month, d2) };
}

function parseLocation(raw: string): {
  venue?: string;
  city?: string;
  state?: string;
} {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return {};
  if (/las vegas convention center/i.test(text)) {
    return {
      venue: "Las Vegas Convention Center",
      city: "Las Vegas",
      state: "NV",
    };
  }
  if (/mandalay bay/i.test(text)) {
    return {
      venue: "Mandalay Bay Convention Center",
      city: "Las Vegas",
      state: "NV",
    };
  }
  if (/broward county convention center/i.test(text)) {
    return {
      venue: "Broward County Convention Center",
      city: "Fort Lauderdale",
      state: "FL",
    };
  }
  if (/anaheim/i.test(text)) {
    return { city: "Anaheim", state: "CA" };
  }
  const cityState = /^(.+?),\s*([A-Z]{2})$/.exec(text);
  if (cityState) {
    return { city: cityState[1]!.trim(), state: cityState[2] };
  }
  return { venue: text };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractDetailLinks(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const re =
    /href="(https:\/\/www\.scvavolleyball\.org\/tournaments\/[^"#]+)"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1]!;
    const label = m[2]!.replace(/\s+/g, " ").trim().toLowerCase();
    if (!label || href.endsWith("/tournaments")) continue;
    map.set(label, href);
    // Also key by shortened labels ("red rock rave 1")
    const short = label.replace(/junior national qualifier\s*/i, "").trim();
    if (short) map.set(short, href);
  }
  return map;
}

function findEventUrl(
  name: string,
  links: Map<string, string>,
): string | undefined {
  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (links.has(key)) return links.get(key);
  for (const [label, href] of links) {
    if (key.includes(label) || label.includes(key)) return href;
    // "Red Rock Rave Junior National Qualifier #1" ↔ "red rock rave 1"
    const compact = key
      .replace(/junior national qualifier/g, "")
      .replace(/#/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (compact === label || compact.includes(label) || label.includes(compact)) {
      return href;
    }
  }
  return undefined;
}

/**
 * Split the listing page into event blocks headed by a tournament title line.
 */
export function parseScvaTournamentListing(html: string): DiscoveredEvent[] {
  const links = extractDetailLinks(html);
  const richBlocks = [
    ...html.matchAll(
      /data-testid="richTextElement"[^>]*>([\s\S]*?)<\/div>/gi,
    ),
  ].map((m) => stripTags(m[1]!));
  const blob =
    richBlocks.find((t) => /Tournament Dates:/i.test(t)) ?? stripTags(html);

  // Prefer the rich-text tournament list; ignore nav chrome.
  const start = blob.search(
    /Las Vegas Classic|Red Rock Rave|Summer Soiree|South Florida Rave/i,
  );
  const body = start >= 0 ? blob.slice(start) : blob;

  const chunks = body
    .split(/\n(?=[^\n]*?(?:Classic|Rave|Soiree|Grand Prix)[^\n]*$)/im)
    .map((c) => c.trim())
    .filter(Boolean);

  // Fallback: split on blank lines if heading split failed
  const blocks =
    chunks.length > 1
      ? chunks
      : body
          .split(/\n{2,}/)
          .map((c) => c.trim())
          .filter((c) => /Tournament Dates:/i.test(c));

  const events: DiscoveredEvent[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!lines.length) continue;

    let name = lines[0]!.replace(/^\u200b/, "").trim();
    // Skip non-title lines
    if (/^Location:/i.test(name) || /^Tournament Dates:/i.test(name)) continue;
    if (/^Registration/i.test(name) || /^USAV|^AAU|^NOT A USAV/i.test(name)) {
      continue;
    }
    if (/SCVA in Sponsorship|South Florida Volleyball Association/i.test(name)) {
      continue;
    }

    const locLine = lines.find((l) => /^Location:/i.test(l));
    const dateLine = lines.find((l) => /^Tournament Dates:/i.test(l));
    if (!dateLine) continue;

    const yearHint = (() => {
      const years = block.match(/\b(20\d{2})\b/g)?.map(Number) ?? [];
      return years.length ? Math.max(...years) : undefined;
    })();

    const dateRaw = dateLine.replace(/^Tournament Dates:\s*/i, "").trim();
    // Sometimes "Tournament Dates: April 16-18 Registration Opens: ..."
    const dateOnly = dateRaw.split(/Registration/i)[0]!.trim();
    const range = parseScvaDateRange(dateOnly, yearHint);
    if (!range) continue;

    const locRaw = locLine?.replace(/^Location:\s*/i, "").trim() ?? "";
    const loc = parseLocation(locRaw);
    const eventUrl =
      findEventUrl(name, links) ?? `${DEFAULT_URL}#${slugify(name)}`;
    const organizerEventId = `scva-${slugify(name)}-${range.startDate}`;
    if (seen.has(organizerEventId)) continue;
    seen.add(organizerEventId);

    const row: DiscoveredEvent = {
      name,
      organizer: "SCVA",
      organizerEventId,
      startDate: range.startDate,
      endDate: range.endDate,
      timezone: "America/Los_Angeles",
      venue: loc.venue,
      city: loc.city,
      state: loc.state,
      location: [loc.venue, loc.city, loc.state].filter(Boolean).join(", ") || undefined,
      gender: "coed",
      eventUrl,
      attendanceEvidence: [],
    };
    const parsed = discoveredEventSchema.safeParse(row);
    if (parsed.success) events.push(parsed.data);
  }

  return events;
}

export async function fetchScvaTournaments(
  config: Record<string, unknown>,
): Promise<AdapterResult> {
  const pageUrl =
    typeof config.url === "string" && config.url.trim()
      ? config.url.trim()
      : DEFAULT_URL;
  if (!/^https:\/\//i.test(pageUrl)) {
    return { ok: false, error: "scva_tournaments url must be https" };
  }
  if (!/scvavolleyball\.org/i.test(pageUrl)) {
    return {
      ok: false,
      error: "scva_tournaments url must be an scvavolleyball.org page",
    };
  }

  try {
    const resp = await fetch(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status} from SCVA page` };
    }
    const html = await resp.text();
    let events = parseScvaTournamentListing(html);

    const includePast = config.includePast === true;
    if (!includePast) {
      const today = new Date();
      const todayStr = ymd(
        today.getUTCFullYear(),
        today.getUTCMonth() + 1,
        today.getUTCDate(),
      );
      events = events.filter((e) => e.endDate >= todayStr);
    }

    return { ok: true, events };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "scva_tournaments fetch failed",
    };
  }
}
