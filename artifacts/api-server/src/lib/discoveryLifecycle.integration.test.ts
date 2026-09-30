import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  californiaClubsTable,
  discoverySourcesTable,
  attendanceEvidenceTable,
  jobLocksTable,
  jobRunsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { runDiscoveryJob } from "../discovery/discoveryJob";
import { runLifecycleJob, acquireJobLock, releaseJobLock } from "./lifecycleJob";
import { runJobs } from "./jobRunner";
import { requireJobSecret } from "../middlewares/jobAuth";
import { requireAdminAuth } from "../middlewares/adminAuth";
import type { Request, Response } from "express";

const hasIsolatedDb =
  !!process.env.DATABASE_URL &&
  /rovo_pilot_dev|127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL) &&
  !/rovousa|neon\.tech/i.test(process.env.DATABASE_URL);

// static_fixture is gated out of production; enable only for these tests.
process.env.ALLOW_TEST_ADAPTERS = "true";

describe("discovery + lifecycle integration (isolated DB)", { skip: !hasIsolatedDb }, () => {
  before(async () => {
    // Clean discovery tables for deterministic tests — not production.
    await db.delete(attendanceEvidenceTable);
    await db.delete(jobRunsTable);
    await db.delete(jobLocksTable);
    await db.delete(discoverySourcesTable);
    await db.delete(californiaClubsTable);
    await db.delete(tournamentsTable);
  });

  it("shows setup-required when no clubs/sources configured", async () => {
    const summary = await runDiscoveryJob({ dryRun: true });
    assert.equal(summary.setupRequired, true);
    assert.ok(summary.setupMessage?.includes("Setup required"));
  });

  it("deduplicates discovery and preserves manual corrections", async () => {
    const [club] = await db
      .insert(californiaClubsTable)
      .values({ name: "[TEST] CA Club One", active: true })
      .returning();
    await db.insert(discoverySourcesTable).values({
      name: "Fixture source",
      kind: "manual_json",
      adapterKey: "static_fixture",
      enabled: true,
      config: {
        events: [
          {
            name: "[TEST DEV ONLY] Discovery Cup",
            organizer: "TestOrg",
            organizerEventId: "org-disc-1",
            startDate: "2026-12-20",
            endDate: "2026-12-22",
            timezone: "America/Los_Angeles",
            city: "Anaheim",
            state: "CA",
            gender: "girls",
            eventUrl: "https://example.com/event",
            attendanceEvidence: [
              {
                sourceUrl: "https://example.com/schedule",
                evidenceType: "planned_schedule",
                clubOrTeamName: "[TEST] CA Club One",
                californiaClubId: club.id,
              },
            ],
          },
        ],
      },
    });

    const first = await runDiscoveryJob({ dryRun: false });
    assert.equal(first.setupRequired, false);
    assert.equal(first.created, 1);
    assert.equal(first.autoApproved, 1);

    const [row] = await db.select().from(tournamentsTable);
    assert.equal(row.status, "approved");

    // Manual correction
    await db
      .update(tournamentsTable)
      .set({
        venue: "Manual Venue Hall",
        manualFields: ["venue"],
        updatedAt: new Date(),
      })
      .where(eq(tournamentsTable.id, row.id));

    // Source changes venue — should flag discrepancy, not overwrite
    await db
      .update(discoverySourcesTable)
      .set({
        config: {
          events: [
            {
              name: "[TEST DEV ONLY] Discovery Cup",
              organizer: "TestOrg",
              organizerEventId: "org-disc-1",
              startDate: "2026-12-20",
              endDate: "2026-12-22",
              timezone: "America/Los_Angeles",
              city: "Anaheim",
              state: "CA",
              venue: "Source Changed Arena",
              gender: "girls",
              eventUrl: "https://example.com/event",
              attendanceEvidence: [
                {
                  sourceUrl: "https://example.com/schedule",
                  evidenceType: "planned_schedule",
                  clubOrTeamName: "[TEST] CA Club One",
                  californiaClubId: club.id,
                },
              ],
            },
          ],
        },
      });

    const second = await runDiscoveryJob({ dryRun: false });
    assert.ok(second.discrepancies >= 1);
    const [after] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, row.id));
    assert.equal(after.venue, "Manual Venue Hall");
    assert.equal(after.hasDiscrepancy, true);

    // Repeated job is idempotent on create count
    const third = await runDiscoveryJob({ dryRun: false });
    assert.equal(third.created, 0);
  });

  it("sends events without attendance evidence to pending review", async () => {
    await db.insert(discoverySourcesTable).values({
      name: "No-evidence fixture",
      kind: "manual_json",
      adapterKey: "static_fixture",
      enabled: true,
      config: {
        events: [
          {
            name: "[TEST DEV ONLY] No Evidence Open",
            organizer: "TestOrg",
            organizerEventId: "org-no-ev",
            startDate: "2027-01-10",
            endDate: "2027-01-12",
            timezone: "America/Los_Angeles",
            city: "San Diego",
            state: "CA",
            gender: "boys",
            attendanceEvidence: [],
          },
        ],
      },
    });
    // Ensure a CA club exists from prior test; if not, create
    const clubs = await db.select().from(californiaClubsTable);
    if (!clubs.length) {
      await db
        .insert(californiaClubsTable)
        .values({ name: "[TEST] CA Club One", active: true });
    }
    const summary = await runDiscoveryJob({ dryRun: false });
    const pending = summary.changes.filter(
      (c) => c.action === "create" && !c.autoApprove,
    );
    assert.ok(pending.length >= 1);
  });

  it("records source failures without erasing tournaments", async () => {
    const beforeCount = (await db.select().from(tournamentsTable)).length;
    await db.insert(discoverySourcesTable).values({
      name: "Broken proposed adapter",
      kind: "official_feed",
      adapterKey: "aes_official",
      enabled: true,
      config: {},
    });
    const summary = await runDiscoveryJob({ dryRun: false });
    assert.ok(summary.sourceFailures.length >= 1);
    const afterCount = (await db.select().from(tournamentsTable)).length;
    assert.equal(afterCount, beforeCount);
  });

  it("lifecycle publishes within 30 days and archives after end", async () => {
    const [t] = await db
      .insert(tournamentsTable)
      .values({
        name: "[TEST DEV ONLY] Lifecycle Publish",
        location: "Los Angeles, CA",
        dates: "future",
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        gender: "girls",
        status: "approved",
        timezone: "America/Los_Angeles",
        approvedAt: new Date(),
      })
      .returning();

    const published = await runLifecycleJob({
      dryRun: false,
      now: new Date("2026-11-01T17:00:00.000Z"), // publish day for 2026-12-01 - 30d
    });
    assert.ok(published.published >= 1);

    const [afterPub] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, t.id));
    assert.equal(afterPub.status, "published");

    const archived = await runLifecycleJob({
      dryRun: false,
      now: new Date("2026-12-04T18:00:00.000Z"),
    });
    assert.ok(archived.archived >= 1);
    const [afterArch] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, t.id));
    assert.equal(afterArch.status, "archived");
  });

  it("prevents overlapping job runs via lock", async () => {
    const token = await acquireJobLock("combined", "test-owner");
    assert.ok(token);
    const skipped = await runJobs({
      jobType: "combined",
      dryRun: true,
      triggeredBy: "test",
    });
    assert.equal(skipped.status, "skipped_locked");
    await releaseJobLock("combined", token!);
  });
});

describe("job auth middleware", () => {
  it("rejects missing JOB_SECRET configuration", () => {
    const prev = process.env.JOB_SECRET;
    delete process.env.JOB_SECRET;
    let status = 0;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;
    requireJobSecret({ headers: {} } as Request, res, () => {
      throw new Error("should not call next");
    });
    assert.equal(status, 503);
    if (prev) process.env.JOB_SECRET = prev;
  });

  it("rejects unauthorized callers", () => {
    process.env.JOB_SECRET = "test-secret-value";
    let status = 0;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;
    let nextCalled = false;
    requireJobSecret(
      { headers: { authorization: "Bearer wrong" } } as Request,
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(status, 401);
    assert.equal(nextCalled, false);

    requireJobSecret(
      { headers: { authorization: "Bearer test-secret-value" } } as Request,
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);
  });
});

describe("admin auth middleware", () => {
  it("rejects unauthorized admin callers", () => {
    const prevUser = process.env.ADMIN_USERNAME;
    const prevPass = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "secret";
    let status = 0;
    const res = {
      setHeader() {
        return this;
      },
      status(code: number) {
        status = code;
        return this;
      },
      type() {
        return this;
      },
      send() {
        return this;
      },
    } as unknown as Response;
    let nextCalled = false;
    requireAdminAuth({ headers: {} } as Request, res, () => {
      nextCalled = true;
    });
    assert.equal(status, 401);
    assert.equal(nextCalled, false);

    const bad = Buffer.from("admin:wrong").toString("base64");
    requireAdminAuth(
      { headers: { authorization: `Basic ${bad}` } } as Request,
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(status, 401);
    assert.equal(nextCalled, false);

    const good = Buffer.from("admin:secret").toString("base64");
    requireAdminAuth(
      { headers: { authorization: `Basic ${good}` } } as Request,
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);

    if (prevUser) process.env.ADMIN_USERNAME = prevUser;
    else delete process.env.ADMIN_USERNAME;
    if (prevPass) process.env.ADMIN_PASSWORD = prevPass;
    else delete process.env.ADMIN_PASSWORD;
  });
});
