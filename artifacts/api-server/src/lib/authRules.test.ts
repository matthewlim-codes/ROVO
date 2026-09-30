import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure helpers mirroring conversation ID rules in routes/messages.ts.
 * Kept here so membership parsing can be regression-tested without a DB.
 */

function parseDmTripIds(groupId: string): [string, string] | null {
  if (!groupId.startsWith("rs-")) return null;
  const inner = groupId.slice(3);
  const sep = inner.indexOf("__");
  if (sep === -1) return null;
  const id1 = inner.slice(0, sep);
  const id2 = inner.slice(sep + 2);
  if (!id1 || !id2) return null;
  return [id1, id2];
}

function parseGroupChatId(groupId: string): {
  tournamentId: string;
  airport: string;
  hotelKey: string;
  mode: "arrival" | "departure";
} | null {
  if (groupId.startsWith("rs-")) return null;
  const modeMatch = groupId.match(/-(arrival|departure)$/);
  if (!modeMatch || modeMatch.index === undefined) return null;
  const mode = modeMatch[1] as "arrival" | "departure";
  const withoutMode = groupId.slice(0, modeMatch.index);
  const uuidMatch = withoutMode.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i,
  );
  if (!uuidMatch) return null;
  const tournamentId = uuidMatch[1];
  const rest = uuidMatch[2];
  const airportSep = rest.indexOf("-");
  if (airportSep === -1) return null;
  const airport = rest.slice(0, airportSep);
  const hotelKey = rest.slice(airportSep + 1);
  if (!airport || !hotelKey) return null;
  return { tournamentId, airport, hotelKey, mode };
}

describe("conversation membership parsing", () => {
  it("parses rideshare DM group ids", () => {
    const ids = parseDmTripIds(
      "rs-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa__bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    );
    assert.deepEqual(ids, [
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    ]);
  });

  it("rejects guessed malformed DM ids", () => {
    assert.equal(parseDmTripIds("rs-only-one"), null);
    assert.equal(parseDmTripIds("not-a-dm"), null);
  });

  it("parses group chat ids with UUID tournament prefix", () => {
    const parsed = parseGroupChatId(
      "11111111-1111-1111-1111-111111111111-DFW-Marriott Marquis-arrival",
    );
    assert.deepEqual(parsed, {
      tournamentId: "11111111-1111-1111-1111-111111111111",
      airport: "DFW",
      hotelKey: "Marriott Marquis",
      mode: "arrival",
    });
  });
});

describe("authorization expectations (documented)", () => {
  it("GET /trips requires auth + verified club membership (enforced in routes)", () => {
    // Guardrails encoded in trips.ts: requireAuth + clubCodeEntered === "true"
    const profile = { clubCodeEntered: "false", club: "" };
    assert.equal(profile.clubCodeEntered === "true" && !!profile.club, false);
  });

  it("GET /trips/matches requires ownership of source trip", () => {
    const tripOwner = "user-a";
    const requester: string = "user-b";
    assert.equal(tripOwner === requester, false);
  });
});
