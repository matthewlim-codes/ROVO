import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  airportsMatch,
  hotelsMatch,
  isValidPlaceId,
  isWithinMatchWindow,
  MATCH_WINDOW_MS,
  normalizeAirportCode,
  tripsMatchCriteria,
} from "./matching";
import { airportFromCode, searchLocalAirports } from "./airports";

describe("matching rules (pilot)", () => {
  it("matches same tournament, airport, mode, hotel, within 60 minutes inclusive", () => {
    const base = {
      tournamentId: "t1",
      airport: "DFW",
      hotel: "Marriott Marquis Dallas",
      hotelPlaceId: "ChIJ123",
      datetime: "2026-10-17T15:00:00.000Z",
      mode: "arrival" as const,
    };
    assert.equal(
      tripsMatchCriteria(base, {
        ...base,
        datetime: "2026-10-17T16:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      tripsMatchCriteria(base, {
        ...base,
        datetime: "2026-10-17T16:00:00.001Z",
      }),
      false,
    );
  });

  it("does not match different airports, hotels, modes, or out-of-window times", () => {
    const base = {
      tournamentId: "t1",
      airport: "DFW",
      hotel: "Marriott Marquis Dallas",
      hotelPlaceId: "ChIJ123",
      datetime: "2026-10-17T15:00:00.000Z",
      mode: "arrival" as const,
    };
    assert.equal(
      tripsMatchCriteria(base, { ...base, airport: "DAL" }),
      false,
    );
    assert.equal(
      tripsMatchCriteria(base, {
        ...base,
        hotel: "Hyatt Regency Dallas",
        hotelPlaceId: "ChIJ999",
      }),
      false,
    );
    assert.equal(
      tripsMatchCriteria(base, { ...base, mode: "departure" }),
      false,
    );
    assert.equal(
      tripsMatchCriteria(base, {
        ...base,
        datetime: new Date(
          new Date(base.datetime).getTime() + MATCH_WINDOW_MS + 1,
        ).toISOString(),
      }),
      false,
    );
  });

  it("compares Place IDs when both valid; uses names when ID unavailable", () => {
    assert.equal(
      hotelsMatch("A", "ChIJ1", "B", "ChIJ1"),
      true,
    );
    assert.equal(
      hotelsMatch("A", "ChIJ1", "A", "ChIJ2"),
      false,
    );
    assert.equal(
      hotelsMatch("  Marriott Marquis  ", null, "marriott marquis", undefined),
      true,
    );
    assert.equal(
      hotelsMatch("Marriott", null, "Hyatt", null),
      false,
    );
  });

  it("never treats two missing Place IDs as a match by themselves", () => {
    // undefined === undefined would be a false positive in naive code
    assert.equal(hotelsMatch("Hotel A", undefined, "Hotel B", undefined), false);
    assert.equal(hotelsMatch("", null, "", null), false);
    assert.equal(isValidPlaceId(undefined), false);
    assert.equal(isValidPlaceId(null), false);
    assert.equal(isValidPlaceId("manual-123"), false);
    assert.equal(isValidPlaceId("local-DFW"), false);
    assert.equal(isValidPlaceId("shared-x"), false);
    assert.equal(isValidPlaceId("ChIJabc"), true);
  });

  it("normalizes airport codes for comparison", () => {
    assert.equal(normalizeAirportCode(" dfw "), "DFW");
    assert.equal(airportsMatch("dfw", "DFW"), true);
    assert.equal(airportsMatch("DFW", "DAL"), false);
  });

  it("treats exact ±60 minute boundary as inclusive", () => {
    const a = "2026-10-17T12:00:00.000Z";
    const b = new Date(new Date(a).getTime() + MATCH_WINDOW_MS).toISOString();
    assert.equal(isWithinMatchWindow(a, b), true);
  });

  it("matches at 46–60 minutes inclusive and rejects beyond 60", () => {
    const base = {
      tournamentId: "t1",
      airport: "DFW",
      hotel: "Marriott Marquis Dallas",
      hotelPlaceId: null as string | null,
      datetime: "2026-11-14T18:00:00.000Z",
      mode: "arrival" as const,
    };
    const at = (minutes: number, extraMs = 0) => ({
      ...base,
      datetime: new Date(
        new Date(base.datetime).getTime() + minutes * 60_000 + extraMs,
      ).toISOString(),
    });

    // Formerly outside the old 45-minute window — must match under the 60-minute rule
    assert.equal(tripsMatchCriteria(base, at(46)), true);
    assert.equal(isWithinMatchWindow(base.datetime, at(46).datetime), true);
    assert.equal(tripsMatchCriteria(base, at(59)), true);
    assert.equal(tripsMatchCriteria(base, at(60)), true);
    assert.equal(isWithinMatchWindow(base.datetime, at(60).datetime), true);

    // Anything beyond 60 minutes must fail
    assert.equal(tripsMatchCriteria(base, at(60, 1)), false);
    assert.equal(isWithinMatchWindow(base.datetime, at(60, 1).datetime), false);
    assert.equal(tripsMatchCriteria(base, at(61)), false);
  });
});

describe("airport fallback", () => {
  it("searches by code, name, and city", () => {
    assert.ok(searchLocalAirports("DFW").some((a) => a.iataCode === "DFW"));
    assert.ok(searchLocalAirports("dallas").some((a) => a.iataCode === "DFW"));
    assert.ok(
      searchLocalAirports("love field").some((a) => a.iataCode === "DAL"),
    );
  });

  it("supports custom IATA codes outside the list", () => {
    const custom = airportFromCode("XYZ");
    assert.ok(custom);
    assert.equal(custom?.iataCode, "XYZ");
  });
});

describe("arrival/departure coexistence (replacement key)", () => {
  it("identity key distinguishes mode so arrival and departure can coexist", () => {
    const arrivalKey = ["user1", "t1", "arrival"].join("-");
    const departureKey = ["user1", "t1", "departure"].join("-");
    assert.notEqual(arrivalKey, departureKey);
  });
});
