import assert from "node:assert/strict";
import test from "node:test";
import {
  createFieldLeadRow,
  createFieldBookingToken,
  hashFieldBookingToken,
  parseFieldRepOptions,
  validateFieldAccessKey,
  verifyFieldBookingToken,
} from "./fieldLeadCore.mjs";

test("access key validation uses exact matching", () => {
  assert.equal(validateFieldAccessKey("secret-value", "secret-value"), true);
  assert.equal(validateFieldAccessKey("secret-value", "secret-value-2"), false);
  assert.equal(validateFieldAccessKey("", "secret-value"), false);
});

test("field booking tokens are hashed and verified without storing the raw token", () => {
  const token = createFieldBookingToken();
  const tokenHash = hashFieldBookingToken(token);

  assert.equal(typeof tokenHash, "string");
  assert.equal(tokenHash.length > 10, true);
  assert.equal(verifyFieldBookingToken(token, tokenHash), true);
  assert.equal(verifyFieldBookingToken(`${token}-wrong`, tokenHash), false);
});

test("rep options parser accepts normalized objects and strings", () => {
  const repOptions = parseFieldRepOptions(
    JSON.stringify([
      { id: "carter", name: "Carter" },
      "Sam Fielding",
      { id: "carter", name: "Duplicate Carter" },
    ])
  );

  assert.deepEqual(repOptions, [
    { id: "carter", name: "Carter" },
    { id: "sam-fielding", name: "Sam Fielding" },
  ]);
});

test("legacy follow-up fields are normalized into the canonical row shape", () => {
  const row = createFieldLeadRow({
    status: "booked",
    bookedEventId: "evt_123",
    followup1Status: "sent",
    followup1ScheduledForIso: "2026-03-09T15:15:00.000Z",
    followup2Status: "queued",
  });

  assert.equal(row.followupStatus, "sent");
  assert.equal(row.followupScheduledForIso, "2026-03-09T15:15:00.000Z");
  assert.equal(row.appointmentStatus, "scheduled");
  assert.equal("followup2Status" in row, false);
});
