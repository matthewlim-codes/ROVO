import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateInTimeZone,
  compareCalendarDates,
  expectedPublishDate,
  PUBLISH_LEAD_MONTHS,
  shouldArchivePublished,
  shouldPublishApproved,
  normalizeEventIdentity,
} from "./tournamentLifecycle";

describe("tournament lifecycle calendar rules", () => {
  it("publishes exactly 6 calendar months before start", () => {
    assert.equal(PUBLISH_LEAD_MONTHS, 6);
    assert.equal(expectedPublishDate("2026-12-15"), "2026-06-15");
    assert.equal(addCalendarMonths("2027-03-01", -6), "2026-09-01");
    // Clamp end-of-month (Aug 31 → Feb 28 in non-leap year)
    assert.equal(addCalendarMonths("2026-08-31", -6), "2026-02-28");
  });

  it("publishes on the publish date and within the window", () => {
    // start 2026-12-15 → publish on 2026-06-15
    const startDate = "2026-12-15";
    const endDate = "2026-12-17";
    const tz = "America/Los_Angeles";
    const onPublishDay = new Date("2026-06-15T18:00:00.000Z");
    assert.equal(
      shouldPublishApproved({ startDate, endDate, timezone: tz, now: onPublishDay }),
      true,
    );
    const before = new Date("2026-06-14T12:00:00.000Z");
    assert.equal(
      shouldPublishApproved({ startDate, endDate, timezone: tz, now: before }),
      false,
    );
  });

  it("archives after the final local calendar day ends", () => {
    const endDate = "2026-11-16";
    const tz = "America/Los_Angeles";
    assert.equal(
      shouldArchivePublished({
        endDate,
        timezone: tz,
        now: new Date("2026-11-17T10:00:00.000Z"),
      }),
      true,
    );
    assert.equal(
      shouldArchivePublished({
        endDate,
        timezone: tz,
        now: new Date("2026-11-16T20:00:00.000Z"),
      }),
      false,
    );
  });

  it("formats calendar dates in a timezone", () => {
    const d = calendarDateInTimeZone(
      new Date("2026-11-16T07:30:00.000Z"),
      "America/Los_Angeles",
    );
    assert.equal(d, "2026-11-15"); // still previous evening in LA
  });

  it("builds stable normalized identities", () => {
    const a = normalizeEventIdentity({
      name: "SoCal Cup!",
      startDate: "2026-12-01",
      city: "Los Angeles",
      state: "CA",
      organizer: "AES",
    });
    const b = normalizeEventIdentity({
      name: "socal cup",
      startDate: "2026-12-01",
      city: "Los Angeles",
      state: "CA",
      organizer: "aes",
    });
    assert.equal(a, b);
    assert.equal(compareCalendarDates("2026-01-01", "2026-01-02"), -1);
    assert.equal(addCalendarDays("2026-03-01", -1), "2026-02-28");
  });
});
