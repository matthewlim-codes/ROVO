/**
 * Calendar-day helpers for tournament lifecycle.
 * Uses Intl time-zone formatting — no paid timezone DB dependency.
 */

/** How far ahead approved tournaments appear on the public site. */
export const PUBLISH_LEAD_MONTHS = 6;

/** @deprecated Use PUBLISH_LEAD_MONTHS — kept only for older imports. */
export const PUBLISH_LEAD_DAYS = PUBLISH_LEAD_MONTHS * 30;

export function calendarDateInTimeZone(
  instant: Date,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) throw new Error(`Unable to format date in ${timeZone}`);
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a plain calendar date (no TZ shift). */
export function parseCalendarDate(ymd: string): {
  y: number;
  m: number;
  d: number;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw new Error(`Invalid calendar date: ${ymd}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function addCalendarDays(ymd: string, days: number): string {
  const { y, m, d } = parseCalendarDate(ymd);
  // Use UTC noon to avoid DST edge issues when constructing Date
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Add whole calendar months; clamps day when the target month is shorter. */
export function addCalendarMonths(ymd: string, months: number): string {
  const { y, m, d } = parseCalendarDate(ymd);
  const idx = y * 12 + (m - 1) + months;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  const lastDay = new Date(Date.UTC(yy, mm, 0, 12, 0, 0)).getUTCDate();
  const dd = Math.min(d, lastDay);
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function compareCalendarDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** First calendar day the event should be published (start − 6 months). */
export function expectedPublishDate(startDate: string): string {
  return addCalendarMonths(startDate, -PUBLISH_LEAD_MONTHS);
}

/**
 * True when local "today" in the event timezone is on/after the publish date
 * and on/before the event end date (still relevant to publish).
 */
export function shouldPublishApproved(opts: {
  startDate: string;
  endDate: string;
  timezone: string;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  const today = calendarDateInTimeZone(now, opts.timezone);
  const publishOn = expectedPublishDate(opts.startDate);
  return (
    compareCalendarDates(today, publishOn) >= 0 &&
    compareCalendarDates(today, opts.endDate) <= 0
  );
}

/** Archive after the final local calendar day has ended (today > endDate). */
export function shouldArchivePublished(opts: {
  endDate: string;
  timezone: string;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  const today = calendarDateInTimeZone(now, opts.timezone);
  return compareCalendarDates(today, opts.endDate) > 0;
}

export function normalizeEventIdentity(parts: {
  name: string;
  startDate: string;
  city?: string | null;
  state?: string | null;
  organizer?: string | null;
}): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  return [
    norm(parts.organizer ?? ""),
    norm(parts.name),
    parts.startDate,
    norm(parts.city ?? ""),
    norm(parts.state ?? ""),
  ].join("|");
}
