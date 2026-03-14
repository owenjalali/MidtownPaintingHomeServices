import assert from "node:assert/strict";
import test from "node:test";
import { hashFieldBookingToken } from "../../server/fieldLeadCore.mjs";
import {
  runFieldLeadSendFollowup,
  runFieldLeadSendInitialSms,
  setFieldLeadTaskTestOverrides,
} from "./fieldLeadTasks.ts";

const withTaskOverrides = async (
  overrides: Parameters<typeof setFieldLeadTaskTestOverrides>[0],
  run: () => Promise<void>
) => {
  setFieldLeadTaskTestOverrides(overrides);
  try {
    await run();
  } finally {
    setFieldLeadTaskTestOverrides();
  }
};

const createBaseRow = (token: string) => ({
  rowNumber: 7,
  leadId: "fld_123",
  status: "initial_sms_sent",
  repId: "sam",
  repName: "Sam",
  customerName: "Jane Smith",
  customerPhoneE164: "+16475551234",
  projectNotes: "Exterior repaint",
  bookingTokenHash: hashFieldBookingToken(token),
  bookingExpiresAtIso: "2026-03-16T15:00:00.000Z",
  initialSmsStatus: "queued",
  initialSmsSentAtIso: "",
  followupStatus: "",
  followupSentAtIso: "",
  bookedEventId: "",
});

test("follow-up scheduling is anchored to initialSmsSentAtIso", async () => {
  const token = "booking-token";
  const triggerCalls: Array<{ id: string; payload: object; options: { delay: Date; ttl: string } }> = [];
  const patches: Record<string, string>[] = [];
  let row = createBaseRow(token);

  await withTaskOverrides(
    {
      getFieldLeadRow: async () => row,
      updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
        patches.push(patch);
        row = {
          ...row,
          ...patch,
        };
        return row;
      },
      sendFieldLeadInitialSmsDirect: async () => true,
      triggerTask: async (id, payload, options) => {
        triggerCalls.push({
          id,
          payload,
          options: {
            delay: options.delay as Date,
            ttl: String(options.ttl || ""),
          },
        });
        return { id: "run_followup" };
      },
      getFieldLeadFollowupDelaySeconds: () => 30,
      nowIso: () => "2026-03-09T15:05:00.000Z",
    },
    async () => {
      const result = await runFieldLeadSendInitialSms({
        leadId: "fld_123",
        bookingToken: token,
        bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
        customerName: "Jane Smith",
        customerPhone: "+16475551234",
        bookingExpiresAtIso: "2026-03-16T15:00:00.000Z",
      });

      assert.equal(result.sent, true);
      assert.equal(triggerCalls.length, 1);
      assert.equal(triggerCalls[0].id, "field-lead-send-followup");
      assert.equal(triggerCalls[0].options.delay.toISOString(), "2026-03-09T15:05:30.000Z");
      assert.equal(patches[1].followupStatus, "queued");
      assert.equal(patches[1].followupScheduledForIso, "2026-03-09T15:05:30.000Z");
    }
  );
});

test("initial sms skips cancelled leads", async () => {
  const token = "booking-token";

  await withTaskOverrides(
    {
      getFieldLeadRow: async () => ({
        ...createBaseRow(token),
        status: "cancelled",
        appointmentStatus: "cancelled",
      }),
      updateFieldLeadRowByNumber: async () => {
        throw new Error("cancelled leads should not be updated before skip");
      },
      sendFieldLeadInitialSmsDirect: async () => {
        throw new Error("cancelled leads should not send initial sms");
      },
    },
    async () => {
      const result = await runFieldLeadSendInitialSms({
        leadId: "fld_123",
        bookingToken: token,
        bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
        customerName: "Jane Smith",
        customerPhone: "+16475551234",
        bookingExpiresAtIso: "2026-03-16T15:00:00.000Z",
      });

      assert.equal(result.skipped, true);
      assert.equal(result.reason, "cancelled");
    }
  );
});

test("follow-up skips booked leads", async () => {
  const token = "booking-token";
  let skippedPatch: Record<string, string> | null = null;

  await withTaskOverrides(
    {
      getFieldLeadRow: async () => ({
        ...createBaseRow(token),
        status: "booked",
        bookedEventId: "evt_123",
      }),
      updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
        skippedPatch = patch;
        return patch;
      },
    },
    async () => {
      const result = await runFieldLeadSendFollowup({
        leadId: "fld_123",
        bookingToken: token,
        bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
      });

      assert.equal(result.skipped, true);
      assert.equal(result.reason, "already_booked");
      assert.equal(skippedPatch?.followupStatus, "skipped");
    }
  );
});

test("follow-up skips cancelled leads", async () => {
  const token = "booking-token";
  let skippedPatch: Record<string, string> | null = null;

  await withTaskOverrides(
    {
      getFieldLeadRow: async () => ({
        ...createBaseRow(token),
        status: "cancelled",
        appointmentStatus: "cancelled",
      }),
      updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
        skippedPatch = patch;
        return patch;
      },
    },
    async () => {
      const result = await runFieldLeadSendFollowup({
        leadId: "fld_123",
        bookingToken: token,
        bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
      });

      assert.equal(result.skipped, true);
      assert.equal(result.reason, "cancelled");
      assert.equal(skippedPatch?.followupStatus, "skipped");
    }
  );
});

test("follow-up skips expired leads", async () => {
  const token = "booking-token";
  let skippedPatch: Record<string, string> | null = null;

  await withTaskOverrides(
    {
      getFieldLeadRow: async () => ({
        ...createBaseRow(token),
        bookingExpiresAtIso: "2026-03-01T15:00:00.000Z",
      }),
      updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
        skippedPatch = patch;
        return patch;
      },
    },
    async () => {
      const result = await runFieldLeadSendFollowup({
        leadId: "fld_123",
        bookingToken: token,
        bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
      });

      assert.equal(result.skipped, true);
      assert.equal(result.reason, "expired");
      assert.equal(skippedPatch?.status, "expired");
      assert.equal(skippedPatch?.followupStatus, "skipped");
    }
  );
});

test("follow-up skips closed_no_booking leads", async () => {
  const token = "booking-token";
  let skippedPatch: Record<string, string> | null = null;

  await withTaskOverrides(
    {
      getFieldLeadRow: async () => ({
        ...createBaseRow(token),
        status: "closed_no_booking",
      }),
      updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
        skippedPatch = patch;
        return patch;
      },
    },
    async () => {
      const result = await runFieldLeadSendFollowup({
        leadId: "fld_123",
        bookingToken: token,
        bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
      });

      assert.equal(result.skipped, true);
      assert.equal(result.reason, "closed");
      assert.equal(skippedPatch?.followupStatus, "skipped");
    }
  );
});
