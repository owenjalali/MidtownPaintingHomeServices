import assert from "node:assert/strict";
import test from "node:test";
import { DateTime } from "luxon";
import { hashFieldBookingToken } from "./fieldLeadCore.mjs";
import { createFieldLeadService } from "./fieldLeadService.mjs";

const withEnv = async (overrides, run) => {
  const snapshot = { ...process.env };
  process.env = {
    ...snapshot,
    ...overrides,
  };

  try {
    await run();
  } finally {
    process.env = snapshot;
  }
};

test("service rejects invalid field access keys and invalid reps", async () => {
  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
    },
    async () => {
      const service = createFieldLeadService({
        store: {
          appendFieldLeadRow: async () => {
            throw new Error("should not append");
          },
          getFieldLeadRow: async () => null,
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async () => null,
        },
      });

      assert.throws(
        () => service.getConfig({ accessKey: "wrong" }),
        (error) => error.statusCode === 403
      );

      await assert.rejects(
        () =>
          service.createLead({
            accessKey: "secret-field-link",
            repId: "unknown",
            fullName: "Jane Smith",
            phone: "+16475551234",
            projectNotes: "Exterior repaint",
          }),
        (error) => error.statusCode === 400
      );
    }
  );
});

test("field flow stays disabled in production unless explicitly allowed", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      FIELD_ENABLED: "true",
      FIELD_INTAKE_SECRET: "secret-field-link",
      FIELD_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
    },
    async () => {
      const service = createFieldLeadService({
        store: {
          appendFieldLeadRow: async () => null,
          getFieldLeadRow: async () => null,
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async () => null,
        },
      });

      assert.throws(
        () => service.getConfig({ accessKey: "secret-field-link" }),
        (error) => error.statusCode === 404
      );
    }
  );
});

test("createLead uses the field-specific public base url and initializes follow-up fields", async () => {
  const now = DateTime.fromISO("2026-03-09T12:00:00", { zone: "America/Toronto" });
  const taskCalls = [];
  let appendedRow = null;
  let updatedRowPatch = null;

  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      FIELD_TEST_PUBLIC_BASE_URL: "https://preview-field.midtown.test/nested/path",
      FIELD_TEST_INITIAL_SMS_DELAY_SECONDS: "10",
      BOOKING_MANAGE_BASE_URL: "https://shared-manage.midtown.test",
    },
    async () => {
      const service = createFieldLeadService({
        now: () => now,
        taskClient: {
          trigger: async (id, payload, options) => {
            taskCalls.push({ id, payload, options });
            return { id: "run_initial_sms" };
          },
        },
        store: {
          appendFieldLeadRow: async (row) => {
            appendedRow = row;
            return {
              ...row,
              rowNumber: 12,
            };
          },
          getFieldLeadRow: async () => null,
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
            updatedRowPatch = patch;
            return patch;
          },
        },
      });

      const created = await service.createLead({
        accessKey: "secret-field-link",
        repId: "sam",
        fullName: "Jane Smith",
        phone: "+16475551234",
        address: "123 Example Street",
        projectNotes: "Exterior repaint",
      });

      assert.equal(created.ok, true);
      assert.equal(taskCalls[0].id, "field-lead-send-initial-sms");
      assert.match(taskCalls[0].payload.bookingLink, /^https:\/\/preview-field\.midtown\.test\/field-booking\//);
      assert.equal(appendedRow.followupStatus, "");
      assert.equal(appendedRow.appointmentStatus, "");
      assert.equal(appendedRow.lastManagedAtIso, "");
      assert.equal(appendedRow.closedReason, "");
      assert.equal(updatedRowPatch.initialSmsStatus, "queued");
      assert.equal(appendedRow.customerAddress, "123 Example Street");
      assert.equal(created.initialSmsScheduledForIso, "2026-03-09T16:00:10.000Z");
      assert.match(String(created.manualTest?.bookingLink), /^https:\/\/preview-field\.midtown\.test\/field-booking\//);
      assert.equal(created.manualTest?.outboundOverrideEnabled, false);
    }
  );
});

test("createLead does not expose the manual test booking link in production lane", async () => {
  const now = DateTime.fromISO("2026-03-09T12:00:00", { zone: "America/Toronto" });

  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      FIELD_ENABLED: "true",
      FIELD_ALLOW_PRODUCTION: "true",
      FIELD_INTAKE_SECRET: "secret-field-link",
      FIELD_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      FIELD_PUBLIC_BASE_URL: "https://field.midtownpainting.ca",
    },
    async () => {
      const service = createFieldLeadService({
        now: () => now,
        taskClient: {
          trigger: async () => ({ id: "run_initial_sms" }),
        },
        store: {
          appendFieldLeadRow: async (row) => ({
            ...row,
            rowNumber: 12,
          }),
          getFieldLeadRow: async () => null,
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async (_rowNumber, patch) => patch,
        },
      });

      const created = await service.createLead({
        accessKey: "secret-field-link",
        repId: "sam",
        fullName: "Jane Smith",
        phone: "+16475551234",
        address: "123 Example Street",
        projectNotes: "Exterior repaint",
      });

      assert.equal(created.ok, true);
      assert.equal(created.manualTest, undefined);
    }
  );
});

test("createLead prefers the request public base url in the non-production lane", async () => {
  const now = DateTime.fromISO("2026-03-09T12:00:00", { zone: "America/Toronto" });

  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      FIELD_TEST_PUBLIC_BASE_URL: "http://localhost:5173",
    },
    async () => {
      const service = createFieldLeadService({
        now: () => now,
        taskClient: {
          trigger: async () => ({ id: "run_initial_sms" }),
        },
        store: {
          appendFieldLeadRow: async (row) => ({
            ...row,
            rowNumber: 12,
          }),
          getFieldLeadRow: async () => null,
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async (_rowNumber, patch) => patch,
        },
      });

      const created = await service.createLead({
        accessKey: "secret-field-link",
        repId: "sam",
        fullName: "Jane Smith",
        phone: "+16475551234",
        address: "123 Example Street",
        projectNotes: "Exterior repaint",
        publicBaseUrl: "https://midtown-preview-123.vercel.app/nested/path?ignored=true",
      });

      assert.match(
        String(created.manualTest?.bookingLink),
        /^https:\/\/midtown-preview-123\.vercel\.app\/field-booking\//
      );
    }
  );
});

test("expired field leads resolve to expired state and mark the row", async () => {
  const now = DateTime.fromISO("2026-03-09T12:00:00", { zone: "America/Toronto" });
  const token = "booking-token";
  let updatedPatch = null;

  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      BOOKING_TIMEZONE: "America/Toronto",
    },
    async () => {
      const service = createFieldLeadService({
        now: () => now,
        store: {
          appendFieldLeadRow: async () => null,
          getFieldLeadRow: async () => ({
            rowNumber: 8,
            leadId: "fld_123",
            status: "initial_sms_sent",
            repId: "sam",
            repName: "Sam",
            customerName: "Jane Smith",
            customerPhoneE164: "+16475551234",
            projectNotes: "Exterior repaint",
            bookingTokenHash: hashFieldBookingToken(token),
            bookingExpiresAtIso: now.minus({ days: 1 }).toUTC().toISO(),
            bookedAtIso: "",
            bookedSlotStartIso: "",
            bookedEventId: "",
            clientManageLink: "",
            carterManageLink: "",
            lastError: "",
          }),
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
            updatedPatch = patch;
            return {
              rowNumber: 8,
              leadId: "fld_123",
              status: "expired",
              repId: "sam",
              repName: "Sam",
              customerName: "Jane Smith",
              customerPhoneE164: "+16475551234",
              projectNotes: "Exterior repaint",
              bookingTokenHash: hashFieldBookingToken(token),
              bookingExpiresAtIso: now.minus({ days: 1 }).toUTC().toISO(),
              bookedAtIso: "",
              bookedSlotStartIso: "",
              bookedEventId: "",
              clientManageLink: "",
              carterManageLink: "",
              lastError: "",
            };
          },
        },
      });

      const context = await service.getLeadContext({
        leadId: "fld_123",
        token,
      });

      assert.equal(context.state, "expired");
      assert.equal(updatedPatch.status, "expired");
    }
  );
});

test("closed field leads resolve to the closed context state", async () => {
  const token = "booking-token";

  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      BOOKING_TIMEZONE: "America/Toronto",
    },
    async () => {
      const service = createFieldLeadService({
        store: {
          appendFieldLeadRow: async () => null,
          getFieldLeadRow: async () => ({
            rowNumber: 8,
            leadId: "fld_123",
            status: "closed_no_booking",
            repId: "sam",
            repName: "Sam",
            customerName: "Jane Smith",
            customerPhoneE164: "+16475551234",
            projectNotes: "Exterior repaint",
            bookingTokenHash: hashFieldBookingToken(token),
            bookingExpiresAtIso: DateTime.now().plus({ days: 1 }).toUTC().toISO(),
          }),
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async () => {
            throw new Error("closed leads should not be re-marked");
          },
        },
      });

      const context = await service.getLeadContext({
        leadId: "fld_123",
        token,
      });

      assert.equal(context.state, "closed");
      assert.equal(context.status, "closed_no_booking");
    }
  );
});

test("cancelled field leads resolve to the closed context state with a cancellation message", async () => {
  const token = "booking-token";

  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      BOOKING_TIMEZONE: "America/Toronto",
    },
    async () => {
      const service = createFieldLeadService({
        store: {
          appendFieldLeadRow: async () => null,
          getFieldLeadRow: async () => ({
            rowNumber: 8,
            leadId: "fld_123",
            status: "cancelled",
            appointmentStatus: "cancelled",
            repId: "sam",
            repName: "Sam",
            customerName: "Jane Smith",
            customerPhoneE164: "+16475551234",
            projectNotes: "Exterior repaint",
            bookingTokenHash: hashFieldBookingToken(token),
            bookingExpiresAtIso: DateTime.now().plus({ days: 1 }).toUTC().toISO(),
            bookedAtIso: "2026-03-09T15:00:00.000Z",
            bookedSlotStartIso: "2026-03-10T18:00:00.000Z",
            bookedEventId: "evt_123",
          }),
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async () => {
            throw new Error("cancelled leads should not be re-marked");
          },
        },
      });

      const context = await service.getLeadContext({
        leadId: "fld_123",
        token,
      });

      assert.equal(context.state, "closed");
      assert.equal(context.status, "cancelled");
      assert.match(context.message || "", /cancelled/i);
    }
  );
});

test("field availability uses the field calendar configuration instead of the website calendar envs", async () => {
  const now = DateTime.fromISO("2026-03-09T12:00:00", { zone: "America/Toronto" });
  const token = "booking-token";
  let busyIntervalsRequest = null;

  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      BOOKING_TIMEZONE: "America/Toronto",
      BOOKING_DAY_START: "09:00",
      BOOKING_DAY_END: "17:00",
      BOOKING_WORKING_DAYS: "1,2,3,4,5,6,7",
      BOOKING_DURATION_MINUTES: "15",
      BOOKING_SLOT_INTERVAL_MINUTES: "15",
      BOOKING_MIN_NOTICE_MINUTES: "120",
      FIELD_TEST_GOOGLE_CLIENT_ID: "field-client-id",
      FIELD_TEST_GOOGLE_CLIENT_SECRET: "field-client-secret",
      FIELD_TEST_GOOGLE_REFRESH_TOKEN: "field-refresh-token",
      FIELD_TEST_GOOGLE_CALENDAR_ID: "field-calendar@example.com",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REFRESH_TOKEN: "",
      GOOGLE_CALENDAR_ID: "",
    },
    async () => {
      const service = createFieldLeadService({
        now: () => now,
        store: {
          appendFieldLeadRow: async () => null,
          getFieldLeadRow: async () => ({
            rowNumber: 8,
            leadId: "fld_123",
            status: "initial_sms_sent",
            repId: "sam",
            repName: "Sam",
            customerName: "Jane Smith",
            customerPhoneE164: "+16475551234",
            projectNotes: "Exterior repaint",
            bookingTokenHash: hashFieldBookingToken(token),
            bookingExpiresAtIso: now.plus({ days: 7 }).toUTC().toISO(),
            bookedAtIso: "",
            bookedSlotStartIso: "",
            bookedEventId: "",
            clientManageLink: "",
            carterManageLink: "",
            lastError: "",
          }),
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async () => null,
        },
        getCalendarClient: () => ({ fake: true }),
        getBusyIntervals: async (calendarClient, calendarId, timezone, timeMinIso, timeMaxIso) => {
          busyIntervalsRequest = {
            calendarClient,
            calendarId,
            timezone,
            timeMinIso,
            timeMaxIso,
          };
          return [];
        },
      });

      const availability = await service.getAvailability({
        leadId: "fld_123",
        token,
        month: "2026-03",
      });

      assert.equal(availability.month, "2026-03");
      assert.equal(availability.timezone, "America/Toronto");
      assert.equal(busyIntervalsRequest.calendarId, "field-calendar@example.com");
      assert.equal(availability.availableDates.length > 0, true);
    }
  );
});

test("field booking mode books without customer email and still generates manage links", async () => {
  const now = DateTime.fromISO("2026-03-09T12:00:00", { zone: "America/Toronto" });
  const token = "booking-token";
  const taskCalls = [];
  let insertedEventRequest = null;
  let updatedRowPatch = null;
  let bookingNotificationPayload = null;

  await withEnv(
    {
      FIELD_TEST_ENABLED: "true",
      FIELD_TEST_INTAKE_SECRET: "secret-field-link",
      FIELD_TEST_REP_OPTIONS_JSON: JSON.stringify([{ id: "sam", name: "Sam" }]),
      FIELD_TEST_OWNER_EMAIL: "owner@example.com",
      FIELD_TEST_OWNER_PHONE: "+16475550000",
      FIELD_TEST_SMTP_HOST: "smtp.test",
      FIELD_TEST_SMTP_PORT: "587",
      FIELD_TEST_SMTP_USER: "owner@example.com",
      FIELD_TEST_SMTP_PASS: "password",
      FIELD_TEST_TWILIO_ACCOUNT_SID: "AC123",
      FIELD_TEST_TWILIO_AUTH_TOKEN: "token",
      FIELD_TEST_TWILIO_FROM_NUMBER: "+16475559999",
      BOOKING_TIMEZONE: "America/Toronto",
      FIELD_TEST_GOOGLE_CLIENT_ID: "client-id",
      FIELD_TEST_GOOGLE_CLIENT_SECRET: "client-secret",
      FIELD_TEST_GOOGLE_REFRESH_TOKEN: "refresh-token",
      FIELD_TEST_GOOGLE_CALENDAR_ID: "carter@example.com",
      FIELD_TEST_PUBLIC_BASE_URL: "https://midtown.test",
    },
    async () => {
      const service = createFieldLeadService({
        now: () => now,
        taskClient: {
          trigger: async (id, payload) => {
            taskCalls.push({ id, payload });
            return { id: `run_${taskCalls.length}` };
          },
        },
        store: {
          appendFieldLeadRow: async () => null,
          getFieldLeadRow: async () => ({
            rowNumber: 8,
            leadId: "fld_123",
            status: "initial_sms_sent",
            repId: "sam",
            repName: "Sam",
            customerName: "Jane Smith",
            customerPhoneE164: "+16475551234",
            customerAddress: "123 Example Street",
            projectNotes: "Exterior repaint",
            bookingTokenHash: hashFieldBookingToken(token),
            bookingExpiresAtIso: now.plus({ days: 7 }).toUTC().toISO(),
            bookedAtIso: "",
            bookedSlotStartIso: "",
            bookedEventId: "",
            clientManageLink: "",
            carterManageLink: "",
            lastError: "",
          }),
          updateFieldLeadRow: async () => null,
          updateFieldLeadRowByNumber: async (_rowNumber, patch) => {
            updatedRowPatch = patch;
            return patch;
          },
        },
        getCalendarClient: () => ({
          freebusy: {
            query: async () => ({
              data: {
                calendars: {
                  "carter@example.com": {
                    busy: [],
                  },
                },
              },
            }),
          },
          events: {
            insert: async (request) => {
              insertedEventRequest = request;
              return {
                data: {
                  id: "evt_123",
                },
              };
            },
          },
        }),
        getBusyIntervals: async () => [],
        sendBookingNotifications: async (payload) => {
          bookingNotificationPayload = payload;
          return {
            ownerEmailAttempted: true,
            ownerEmailSent: true,
            ownerSmsAttempted: true,
            ownerSmsSent: true,
            customerSmsAttempted: true,
            customerSmsSent: true,
          };
        },
      });

      const booking = await service.bookLead({
        leadId: "fld_123",
        token,
        slotStartIso: "2026-03-10T18:00:00.000Z",
        publicBaseUrl: "https://midtown-preview-123.vercel.app/build/abc",
      });

      assert.equal(booking.ok, true);
      assert.equal(insertedEventRequest.requestBody.attendees, undefined);
      assert.equal(insertedEventRequest.requestBody.extendedProperties.private.mp_client_email, "");
      assert.match(insertedEventRequest.requestBody.description, /123 Example Street/);
      assert.equal(updatedRowPatch.status, "booked");
      assert.equal(updatedRowPatch.appointmentStatus, "scheduled");
      assert.equal(updatedRowPatch.lastManagedReason, "");
      assert.match(
        String(booking.booking.manageLinks.client),
        /^https:\/\/midtown-preview-123\.vercel\.app\/manage-booking\?/
      );
      assert.equal(taskCalls.every((call) => call.id === "field-lead-send-reminder"), true);
      assert.equal(bookingNotificationPayload.customerName, "Jane Smith");
      assert.equal(bookingNotificationPayload.customerPhone, "+16475551234");
    }
  );
});
