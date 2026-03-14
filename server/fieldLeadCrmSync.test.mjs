import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFieldLeadCrmValues,
  sortFieldLeadCrmRows,
  syncFieldLeadRowPatch,
} from "./fieldLeadCrmSync.mjs";

test("crm values render manage links as Open hyperlinks", () => {
  const values = buildFieldLeadCrmValues({
    leadId: "fld_123",
    createdAtIso: "2026-03-09T15:00:00.000Z",
    repName: "Sam",
    customerName: "Jane Smith",
    customerPhoneE164: "+16475551234",
    customerAddress: "123 Example Street",
    projectNotes: "Exterior repaint",
    status: "booked",
    initialSmsStatus: "sent",
    followupStatus: "queued",
    appointmentStatus: "scheduled",
    bookedSlotStartIso: "2026-03-10T18:00:00.000Z",
    clientManageLink: "https://midtown.test/manage-booking?eventId=evt_123&actor=client",
    carterManageLink: "https://midtown.test/manage-booking?eventId=evt_123&actor=carter",
  });

  assert.equal(values[0], "fld_123");
  assert.equal(values[5], "123 Example Street");
  assert.equal(values[7], "Booked");
  assert.equal(values[16], '=HYPERLINK("https://midtown.test/manage-booking?eventId=evt_123&actor=client","Open")');
  assert.equal(values[17], '=HYPERLINK("https://midtown.test/manage-booking?eventId=evt_123&actor=carter","Open")');
});

test("crm rows sort newest leads first", () => {
  const sorted = sortFieldLeadCrmRows([
    {
      leadId: "fld_old",
      createdAtIso: "2026-03-09T15:00:00.000Z",
      rowNumber: 2,
    },
    {
      leadId: "fld_new",
      createdAtIso: "2026-03-10T15:00:00.000Z",
      rowNumber: 3,
    },
    {
      leadId: "fld_same_time_higher_row",
      createdAtIso: "2026-03-10T15:00:00.000Z",
      rowNumber: 5,
    },
  ]);

  assert.deepEqual(
    sorted.map((row) => row.leadId),
    ["fld_same_time_higher_row", "fld_new", "fld_old"]
  );
});

test("field lead row sync prefers the private field lead id before falling back to the booked event id", async () => {
  const calls = [];

  const result = await syncFieldLeadRowPatch({
    privateProps: {
      mp_field_lead_id: "fld_123",
    },
    eventId: "evt_123",
    patch: {
      appointmentStatus: "rescheduled",
    },
    getFieldLeadRow: async (leadId) => {
      calls.push(["leadId", leadId]);
      return {
        rowNumber: 9,
        leadId,
      };
    },
    getFieldLeadRowByBookedEventId: async (eventId) => {
      calls.push(["eventId", eventId]);
      return null;
    },
    updateFieldLeadRowByNumber: async (rowNumber, patch) => ({
      rowNumber,
      ...patch,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.matchedBy, "privateProps");
  assert.deepEqual(calls, [["leadId", "fld_123"]]);
  assert.equal(result.row.appointmentStatus, "rescheduled");
});

test("field lead row sync falls back to bookedEventId for legacy rows", async () => {
  const calls = [];

  const result = await syncFieldLeadRowPatch({
    privateProps: {
      mp_field_lead_id: "fld_missing",
    },
    eventId: "evt_legacy",
    patch: {
      status: "cancelled",
    },
    getFieldLeadRow: async (leadId) => {
      calls.push(["leadId", leadId]);
      return null;
    },
    getFieldLeadRowByBookedEventId: async (eventId) => {
      calls.push(["eventId", eventId]);
      return {
        rowNumber: 11,
        leadId: "fld_legacy",
      };
    },
    updateFieldLeadRowByNumber: async (rowNumber, patch) => ({
      rowNumber,
      ...patch,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.matchedBy, "bookedEventId");
  assert.deepEqual(calls, [
    ["leadId", "fld_missing"],
    ["eventId", "evt_legacy"],
  ]);
  assert.equal(result.row.status, "cancelled");
});
