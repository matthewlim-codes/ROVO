import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hotelsMatch,
  isValidPlaceId,
  isWithinMatchWindow,
  MATCH_WINDOW_MS,
  airportsMatch,
} from "./matching";
import {
  customAirportFromCode,
  searchLocalAirports,
} from "./airports";

describe("mobile matching utils", () => {
  it("uses 60-minute inclusive window including 46–60 minutes", () => {
    const a = "2026-10-17T12:00:00.000Z";
    const at = (minutes: number, extraMs = 0) =>
      new Date(new Date(a).getTime() + minutes * 60_000 + extraMs).toISOString();

    assert.equal(isWithinMatchWindow(a, at(46)), true);
    assert.equal(isWithinMatchWindow(a, at(60)), true);
    assert.equal(isWithinMatchWindow(a, at(60, 1)), false);
    assert.equal(isWithinMatchWindow(a, at(61)), false);
    assert.equal(MATCH_WINDOW_MS, 60 * 60 * 1000);
  });

  it("does not match hotels solely because both Place IDs are missing", () => {
    assert.equal(hotelsMatch("One", undefined, "Two", undefined), false);
    assert.equal(isValidPlaceId(""), false);
  });

  it("matches hotels by normalized name when Place IDs are absent", () => {
    assert.equal(
      hotelsMatch("  Hyatt Regency  ", null, "hyatt regency", null),
      true,
    );
  });

  it("matches airports by canonical code", () => {
    assert.equal(airportsMatch("lax", "LAX"), true);
  });
});

describe("mobile airport fallback", () => {
  it("finds common airports without Google", () => {
    const hits = searchLocalAirports("ORD");
    assert.ok(hits.some((h) => h.iataCode === "ORD"));
  });

  it("allows custom codes outside the list", () => {
    const custom = customAirportFromCode("abc");
    assert.equal(custom?.iataCode, "ABC");
  });
});
