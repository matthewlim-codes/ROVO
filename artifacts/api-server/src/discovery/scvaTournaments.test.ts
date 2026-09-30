import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseScvaDateRange,
  parseScvaTournamentListing,
} from "./scvaTournaments";
import { crossSourceDedupeKey } from "../lib/tournamentLifecycle";

describe("scvaTournaments parser", () => {
  it("parses month-day ranges and rolls past dates forward a year", () => {
    const range = parseScvaDateRange("February 26-28", 2026);
    assert.ok(range);
    // From "today" (agent clock may vary); ensure shape YYYY-MM-DD
    assert.match(range!.startDate, /^\d{4}-02-26$/);
    assert.match(range!.endDate, /^\d{4}-02-28$/);
    assert.equal(range!.startDate.slice(5), "02-26");
  });

  it("extracts tournaments from SCVA listing HTML", () => {
    const html = `
      <a href="https://www.scvavolleyball.org/tournaments/40th-annual-scva-las-vegas-classic">Las Vegas Classic</a>
      <a href="https://www.scvavolleyball.org/tournaments/2026-red-rock-rave-1">Red Rock Rave 1</a>
      <div data-testid="richTextElement">
        <p>Las Vegas Classic</p>
        <p>Location: Las Vegas Convention Center</p>
        <p>Tournament Dates: February 26-28</p>
        <p>Registration opens on SportWrench on October 1, 2026.</p>
        <p>USAV Sanctioned</p>
        <p>Red Rock Rave Junior National Qualifier #1</p>
        <p>Location: Las Vegas Convention Center</p>
        <p>Tournament Dates: March 5-7</p>
        <p>Registration opens on SportWrench on September 1, 2026.</p>
        <p>Summer Soiree</p>
        <p>Location: Anaheim, CA</p>
        <p>Tournament Dates: June 24-27</p>
        <p>Registration Opens: December 1, 2026</p>
      </div>
    `;
    const events = parseScvaTournamentListing(html);
    assert.ok(events.length >= 3, `expected >=3 events, got ${events.length}`);
    const lvc = events.find((e) => /las vegas classic/i.test(e.name));
    assert.ok(lvc);
    assert.equal(lvc!.organizer, "SCVA");
    assert.equal(lvc!.city, "Las Vegas");
    assert.equal(lvc!.state, "NV");
    assert.equal(lvc!.startDate.slice(5), "02-26");
    assert.ok(lvc!.eventUrl?.includes("las-vegas-classic"));

    const soiree = events.find((e) => /summer soiree/i.test(e.name));
    assert.ok(soiree);
    assert.equal(soiree!.city, "Anaheim");
    assert.equal(soiree!.state, "CA");
  });

  it("cross-source keys match across organizer naming variants", () => {
    const a = crossSourceDedupeKey({
      name: "Red Rock Rave Junior National Qualifier #1",
      startDate: "2027-03-05",
    });
    const b = crossSourceDedupeKey({
      name: "Red Rock Rave 1",
      startDate: "2027-03-05",
    });
    assert.equal(a, b);
  });
});
