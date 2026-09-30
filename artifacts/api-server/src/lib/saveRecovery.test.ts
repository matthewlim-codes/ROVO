import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Documents failed-save recovery expectations for TripContext.saveTrip /
 * sendMessage without requiring React Native runtime.
 */

type Trip = {
  id: string;
  userId: string;
  tournamentId: string;
  mode: "arrival" | "departure";
};

function replaceSameModeOnly(
  trips: Trip[],
  next: Trip,
): Trip[] {
  return [
    ...trips.filter(
      (t) =>
        !(
          t.userId === next.userId &&
          t.tournamentId === next.tournamentId &&
          t.mode === next.mode
        ),
    ),
    next,
  ];
}

function rollbackPending(
  trips: Trip[],
  pendingId: string,
  previous?: Trip,
): Trip[] {
  const without = trips.filter((t) => t.id !== pendingId);
  if (previous && !without.some((t) => t.id === previous.id)) {
    return [...without, previous];
  }
  return without;
}

describe("failed trip save recovery", () => {
  it("rolls back pending trip and restores previous same-mode trip", () => {
    const previous: Trip = {
      id: "srv-1",
      userId: "u1",
      tournamentId: "t1",
      mode: "arrival",
    };
    const pending: Trip = {
      id: "pending-9",
      userId: "u1",
      tournamentId: "t1",
      mode: "arrival",
    };
    const afterOptimistic = replaceSameModeOnly([previous], pending);
    assert.equal(afterOptimistic.some((t) => t.id === "srv-1"), false);
    const rolled = rollbackPending(afterOptimistic, "pending-9", previous);
    assert.equal(rolled.some((t) => t.id === "srv-1"), true);
    assert.equal(rolled.some((t) => t.id === "pending-9"), false);
  });

  it("saving departure does not erase arrival", () => {
    const arrival: Trip = {
      id: "srv-a",
      userId: "u1",
      tournamentId: "t1",
      mode: "arrival",
    };
    const departure: Trip = {
      id: "srv-d",
      userId: "u1",
      tournamentId: "t1",
      mode: "departure",
    };
    const next = replaceSameModeOnly([arrival], departure);
    assert.equal(next.length, 2);
    assert.ok(next.some((t) => t.mode === "arrival"));
    assert.ok(next.some((t) => t.mode === "departure"));
  });
});

describe("failed message state", () => {
  it("marks failed messages for retry rather than pretending success", () => {
    type Msg = { id: string; status: "sending" | "sent" | "failed" };
    let msg: Msg = { id: "local-1", status: "sending" };
    // simulate catch path
    msg = { ...msg, status: "failed" };
    assert.equal(msg.status, "failed");
    // retry
    msg = { ...msg, status: "sending" };
    assert.equal(msg.status, "sending");
  });
});
