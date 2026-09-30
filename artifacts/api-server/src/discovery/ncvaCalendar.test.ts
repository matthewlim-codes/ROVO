import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferGender,
  parseNcvaDateRanges,
  fetchNcvaCalendarEvents,
} from "./ncvaCalendar";

describe("ncva calendar parsing", () => {
  it("parses December 12-13, 2026", () => {
    assert.deepEqual(parseNcvaDateRanges("December 12-13, 2026"), [
      { startDate: "2026-12-12", endDate: "2026-12-13" },
    ]);
  });

  it("parses multi-day January 16-17-18, 2027", () => {
    assert.deepEqual(parseNcvaDateRanges("January 16-17-18, 2027"), [
      { startDate: "2027-01-16", endDate: "2027-01-18" },
    ]);
  });

  it("splits multi-weekend Far Western date cells", () => {
    const ranges = parseNcvaDateRanges(
      "April 9 - 11, 2027 April 16 - 18 , 2027 April 23 - 25, 2027",
    );
    assert.equal(ranges.length, 3);
    assert.deepEqual(ranges[0], {
      startDate: "2027-04-09",
      endDate: "2027-04-11",
    });
    assert.deepEqual(ranges[2], {
      startDate: "2027-04-23",
      endDate: "2027-04-25",
    });
  });

  it("returns empty for TBA rather than inventing dates", () => {
    assert.deepEqual(parseNcvaDateRanges("TBA"), []);
  });

  it("infers boys gender from divisions column", () => {
    assert.equal(
      inferGender("Boys", "Boys' Far Western National Qualifier"),
      "boys",
    );
    assert.equal(
      inferGender(undefined, "2026 Bay View Classic (Boys and Girls)"),
      "coed",
    );
    assert.equal(inferGender("Girls", "Sunset Cup"), "girls");
  });
});

describe("ncva_calendar live fetch", () => {
  it("fetches upcoming boys events from official NCVA WordPress calendar", async () => {
    const result = await fetchNcvaCalendarEvents({
      genders: ["boys"],
      includePast: false,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.events.length >= 1, "expected at least one upcoming boys event");
    const fw = result.events.find((e) =>
      /far western/i.test(e.name),
    );
    assert.ok(fw, "expected Boys Far Western on NCVA calendar");
    assert.equal(fw!.startDate, "2026-12-12");
    assert.equal(fw!.endDate, "2026-12-13");
    assert.equal(fw!.gender, "boys");
    assert.equal(fw!.organizer, "NCVA");
    assert.equal(fw!.eventUrl, "https://ncva.com/boysbid/");
    assert.equal(fw!.city, "McClellan Park");
    assert.equal(fw!.state, "CA");
    assert.equal(fw!.attendanceEvidence.length, 0);
  });

  it("defaults to boys+girls and includes January Golden State Challenge", async () => {
    const result = await fetchNcvaCalendarEvents({ includePast: false });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.events.length >= 8, `expected full calendar, got ${result.events.length}`);
    const gsc = result.events.find((e) => /golden state challenge/i.test(e.name));
    assert.ok(gsc, "expected Golden State Challenge");
    assert.equal(gsc!.startDate, "2027-01-16");
    assert.equal(gsc!.gender, "girls");
    // Season-table duplicate of Girls Far Western should not inflate count
    const girlsFw = result.events.filter((e) =>
      /girls'? far western/i.test(e.name),
    );
    assert.equal(girlsFw.length, 3, "three Far Western weekends, no season-table dupes");
  });
});
