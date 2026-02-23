import assert from "node:assert/strict";
import test from "node:test";
import { DateTime } from "luxon";
import {
  getManagePermissions,
  normalizeManageActor,
  normalizeManageReason,
} from "./calendarManageRules.ts";

const FIXED_NOW = DateTime.fromISO("2026-02-23T12:00:00", { zone: "America/Toronto" });

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

test("normalizeManageActor accepts only client and carter", () => {
  assert.equal(normalizeManageActor("client"), "client");
  assert.equal(normalizeManageActor(" CARTER "), "carter");
  assert.equal(normalizeManageActor("owner"), null);
  assert.equal(normalizeManageActor(""), null);
});

test("normalizeManageReason trims and compacts whitespace", () => {
  assert.equal(normalizeManageReason("  Needs   to   move  "), "Needs to move");
  assert.equal(normalizeManageReason(" \n\t "), "");
});

test("client updates are blocked inside the 12-hour cutoff", () => {
  const start = FIXED_NOW.plus({ hours: 6 });
  const end = start.plus({ minutes: 15 });

  const permissions = getManagePermissions({
    actor: "client",
    eventStatus: "confirmed",
    startIso: start.toISO(),
    endIso: end.toISO(),
    timezone: "America/Toronto",
    cutoffMinutes: 12 * 60,
    now: FIXED_NOW,
  });

  assert.equal(permissions.canCancel, false);
  assert.equal(permissions.canReschedule, false);
  assert.equal(permissions.withinCutoff, true);
  assert.match(String(permissions.reason), /self-service cutoff/i);
});

test("carter can override cutoff for active future bookings", () => {
  const start = FIXED_NOW.plus({ hours: 2 });
  const end = start.plus({ minutes: 15 });

  const permissions = getManagePermissions({
    actor: "carter",
    eventStatus: "confirmed",
    startIso: start.toISO(),
    endIso: end.toISO(),
    timezone: "America/Toronto",
    cutoffMinutes: 12 * 60,
    now: FIXED_NOW,
  });

  assert.equal(permissions.canCancel, true);
  assert.equal(permissions.canReschedule, true);
  assert.equal(permissions.withinCutoff, true);
  assert.equal(permissions.reason, null);
});

test("bookings already started cannot be managed", () => {
  const start = FIXED_NOW.minus({ minutes: 1 });
  const end = start.plus({ minutes: 15 });

  const permissions = getManagePermissions({
    actor: "carter",
    eventStatus: "confirmed",
    startIso: start.toISO(),
    endIso: end.toISO(),
    timezone: "America/Toronto",
    cutoffMinutes: 12 * 60,
    now: FIXED_NOW,
  });

  assert.equal(permissions.canCancel, false);
  assert.equal(permissions.canReschedule, false);
  assert.match(String(permissions.reason), /already started/i);
});

test("stress test: 15,000 randomized permission checks match expected policy", () => {
  const random = createSeededRandom(24680);

  for (let i = 0; i < 15_000; i += 1) {
    const startsInMinutes = Math.floor(random() * 48 * 60) - 60;
    const durationMinutes = 15;
    const start = FIXED_NOW.plus({ minutes: startsInMinutes });
    const end = start.plus({ minutes: durationMinutes });
    const status = random() < 0.04 ? "cancelled" : "confirmed";
    const cutoffMinutes = 12 * 60;

    const clientPermissions = getManagePermissions({
      actor: "client",
      eventStatus: status,
      startIso: start.toISO(),
      endIso: end.toISO(),
      timezone: "America/Toronto",
      cutoffMinutes,
      now: FIXED_NOW,
    });

    const carterPermissions = getManagePermissions({
      actor: "carter",
      eventStatus: status,
      startIso: start.toISO(),
      endIso: end.toISO(),
      timezone: "America/Toronto",
      cutoffMinutes,
      now: FIXED_NOW,
    });

    const isFuture = start > FIXED_NOW;
    const withinCutoff = start <= FIXED_NOW.plus({ minutes: cutoffMinutes });

    const expectedCarterCanManage = status !== "cancelled" && isFuture;
    const expectedClientCanManage = expectedCarterCanManage && !withinCutoff;

    assert.equal(
      carterPermissions.canCancel && carterPermissions.canReschedule,
      expectedCarterCanManage,
      `Carter mismatch at iteration ${i}`
    );
    assert.equal(
      clientPermissions.canCancel && clientPermissions.canReschedule,
      expectedClientCanManage,
      `Client mismatch at iteration ${i}`
    );
  }
});
