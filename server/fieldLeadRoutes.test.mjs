import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import { createFieldLeadHttpError } from "./fieldLeadCore.mjs";
import { registerFieldLeadRoutes } from "./fieldLeadRoutes.mjs";

const withServer = async ({ service, hooks = {} }, run) => {
  const app = express();
  app.use(express.json());
  registerFieldLeadRoutes({
    app,
    service,
    hooks,
  });

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
};

const fetchJson = async (baseUrl, path, init = undefined) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  return {
    status: response.status,
    body,
  };
};

test("create field lead api returns success payload", async () => {
  await withServer(
    {
      service: {
        getConfig: async () => ({ ok: true, repOptions: [], linkExpiryDays: 7 }),
        createLead: async (payload) => ({
          ok: true,
          leadId: "fld_123",
          status: "initial_sms_queued",
          bookingExpiresAtIso: "2026-03-16T16:00:00.000Z",
          initialSmsTaskRunId: "run_123",
          initialSmsScheduledForIso: "2026-03-09T16:05:00.000Z",
          manualTest: {
            bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
            outboundOverrideEnabled: true,
          },
          received: payload,
        }),
        getLeadContext: async () => ({ ok: true, state: "open", status: "initial_sms_sent", lead: {} }),
        getAvailability: async ({ leadId, month }) => ({
          month,
          timezone: "America/Toronto",
          availabilityByDate: {
            "2026-03-10": [
              {
                startIso: "2026-03-10T18:00:00.000Z",
                endIso: "2026-03-10T18:15:00.000Z",
                label: "2:00 PM",
              },
            ],
          },
          availableDates: ["2026-03-10"],
          received: { leadId, month },
        }),
        bookLead: async () => ({ ok: true, booking: { eventId: "evt_1" } }),
      },
    },
    async (baseUrl) => {
      const result = await fetchJson(baseUrl, "/api/field/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessKey: "secret",
          repId: "sam",
          fullName: "Jane Smith",
          phone: "+16475551234",
          address: "123 Example Street",
          projectNotes: "Exterior repaint",
        }),
      });

      assert.equal(result.status, 200);
      assert.equal(result.body.leadId, "fld_123");
      assert.equal(result.body.received.repId, "sam");
      assert.equal(result.body.received.address, "123 Example Street");
      assert.equal(result.body.received.publicBaseUrl, baseUrl);
      assert.equal(result.body.manualTest.bookingLink.includes("/field-booking/"), true);
    }
  );
});

test("field lead api prefers forwarded host headers for public preview links", async () => {
  await withServer(
    {
      service: {
        getConfig: async () => ({ ok: true, repOptions: [], linkExpiryDays: 7 }),
        createLead: async (payload) => ({
          ok: true,
          leadId: "fld_123",
          received: payload,
        }),
        getLeadContext: async () => ({ ok: true, state: "open", status: "initial_sms_sent", lead: {} }),
        getAvailability: async () => ({
          month: "2026-03",
          timezone: "America/Toronto",
          availabilityByDate: {},
          availableDates: [],
        }),
        bookLead: async (payload) => ({
          ok: true,
          booking: { eventId: "evt_1" },
          received: payload,
        }),
      },
    },
    async (baseUrl) => {
      const leadCreate = await fetchJson(baseUrl, "/api/field/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Host": "preview.midtown.test",
        },
        body: JSON.stringify({
          accessKey: "secret",
          repId: "sam",
          fullName: "Jane Smith",
          phone: "+16475551234",
          address: "123 Example Street",
          projectNotes: "Exterior repaint",
        }),
      });

      const booking = await fetchJson(baseUrl, "/api/field/leads/fld_123/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Host": "preview.midtown.test",
        },
        body: JSON.stringify({
          token: "abc",
          slotStartIso: "2026-03-10T18:00:00.000Z",
        }),
      });

      assert.equal(leadCreate.status, 200);
      assert.equal(leadCreate.body.received.publicBaseUrl, "https://preview.midtown.test");
      assert.equal(booking.status, 200);
      assert.equal(booking.body.received.publicBaseUrl, "https://preview.midtown.test");
    }
  );
});

for (const scenario of [
  {
    name: "invalid secret",
    error: createFieldLeadHttpError(403, "This field intake link is invalid."),
    expectedStatus: 403,
  },
  {
    name: "invalid phone",
    error: createFieldLeadHttpError(400, "Please provide a valid homeowner phone number."),
    expectedStatus: 400,
  },
  {
    name: "invalid rep",
    error: createFieldLeadHttpError(400, "Please choose a valid sales rep."),
    expectedStatus: 400,
  },
  {
    name: "store failure",
    error: createFieldLeadHttpError(502, "Unable to save the field lead right now. Please try again."),
    expectedStatus: 502,
  },
  {
    name: "delayed-task scheduling failure",
    error: createFieldLeadHttpError(502, "Unable to queue the first text right now. Please try again."),
    expectedStatus: 502,
  },
]) {
  test(`create field lead api surfaces ${scenario.name}`, async () => {
    await withServer(
      {
        service: {
          getConfig: async () => ({ ok: true, repOptions: [], linkExpiryDays: 7 }),
          createLead: async () => {
            throw scenario.error;
          },
          getLeadContext: async () => ({ ok: true, state: "open", status: "initial_sms_sent", lead: {} }),
          getAvailability: async () => ({
            month: "2026-03",
            timezone: "America/Toronto",
            availabilityByDate: {},
            availableDates: [],
          }),
          bookLead: async () => ({ ok: true, booking: { eventId: "evt_1" } }),
        },
      },
      async (baseUrl) => {
        const result = await fetchJson(baseUrl, "/api/field/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessKey: "secret",
            repId: "sam",
            fullName: "Jane Smith",
            phone: "+16475551234",
            address: "123 Example Street",
            projectNotes: "Exterior repaint",
          }),
        });

        assert.equal(result.status, scenario.expectedStatus);
      }
    );
  });
}

test("field lead context api returns open, expired, and closed states and rejects invalid tokens", async () => {
  const service = {
    getConfig: async () => ({ ok: true, repOptions: [], linkExpiryDays: 7 }),
    createLead: async () => ({ ok: true }),
    getLeadContext: async ({ leadId }) => {
      if (leadId === "fld_invalid") {
        throw createFieldLeadHttpError(403, "This field booking link is invalid or expired.");
      }

      if (leadId === "fld_expired") {
        return {
          ok: true,
          state: "expired",
          status: "expired",
          lead: { leadId },
        };
      }

      if (leadId === "fld_closed") {
        return {
          ok: true,
          state: "closed",
          status: "closed_no_booking",
          lead: { leadId },
        };
      }

      return {
        ok: true,
        state: "open",
        status: "initial_sms_sent",
        lead: { leadId },
      };
    },
    getAvailability: async () => ({
      month: "2026-03",
      timezone: "America/Toronto",
      availabilityByDate: {},
      availableDates: [],
    }),
    bookLead: async () => ({ ok: true, booking: { eventId: "evt_1" } }),
  };

  await withServer({ service }, async (baseUrl) => {
    const valid = await fetchJson(baseUrl, "/api/field/leads/fld_valid/context?token=abc");
    const invalid = await fetchJson(baseUrl, "/api/field/leads/fld_invalid/context?token=abc");
    const expired = await fetchJson(baseUrl, "/api/field/leads/fld_expired/context?token=abc");
    const closed = await fetchJson(baseUrl, "/api/field/leads/fld_closed/context?token=abc");

    assert.equal(valid.status, 200);
    assert.equal(valid.body.state, "open");
    assert.equal(invalid.status, 403);
    assert.equal(expired.status, 200);
    assert.equal(expired.body.state, "expired");
    assert.equal(closed.status, 200);
    assert.equal(closed.body.state, "closed");
  });
});

test("field lead availability api returns token-scoped field availability", async () => {
  const service = {
    getConfig: async () => ({ ok: true, repOptions: [], linkExpiryDays: 7 }),
    createLead: async () => ({ ok: true }),
    getLeadContext: async () => ({ ok: true, state: "open", status: "initial_sms_sent", lead: {} }),
    getAvailability: async ({ leadId, token, month }) => ({
      month,
      timezone: "America/Toronto",
      availabilityByDate: {
        "2026-03-10": [
          {
            startIso: "2026-03-10T18:00:00.000Z",
            endIso: "2026-03-10T18:15:00.000Z",
            label: "2:00 PM",
          },
        ],
      },
      availableDates: ["2026-03-10"],
      received: { leadId, token, month },
    }),
    bookLead: async () => ({ ok: true, booking: { eventId: "evt_1" } }),
  };

  await withServer({ service }, async (baseUrl) => {
    const result = await fetchJson(
      baseUrl,
      "/api/field/leads/fld_123/availability?token=abc&month=2026-03"
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.received.leadId, "fld_123");
    assert.equal(result.body.received.token, "abc");
    assert.equal(result.body.received.month, "2026-03");
    assert.equal(result.body.availableDates[0], "2026-03-10");
  });
});

test("field lead booking api returns success and booking conflict responses", async () => {
  const hookCalls = {
    clearCalendarAvailabilityCache: 0,
    clearManageContextCacheForEvent: 0,
  };

  await withServer(
    {
      service: {
        getConfig: async () => ({ ok: true, repOptions: [], linkExpiryDays: 7 }),
        createLead: async () => ({ ok: true }),
        getLeadContext: async () => ({ ok: true, state: "open", status: "initial_sms_sent", lead: {} }),
        getAvailability: async () => ({
          month: "2026-03",
          timezone: "America/Toronto",
          availabilityByDate: {},
          availableDates: [],
        }),
        bookLead: async ({ leadId }) => {
          if (leadId === "fld_booked") {
            throw createFieldLeadHttpError(409, "This field lead has already been booked.");
          }
          if (leadId === "fld_conflict") {
            throw createFieldLeadHttpError(409, "That slot was just booked. Please select another time.");
          }
          return {
            ok: true,
            booking: {
              eventId: "evt_123",
            },
          };
        },
      },
      hooks: {
        acquireSlotLock: () => () => undefined,
        clearCalendarAvailabilityCache: () => {
          hookCalls.clearCalendarAvailabilityCache += 1;
        },
        clearManageContextCacheForEvent: () => {
          hookCalls.clearManageContextCacheForEvent += 1;
        },
      },
    },
    async (baseUrl) => {
      const success = await fetchJson(baseUrl, "/api/field/leads/fld_success/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "abc",
          slotStartIso: "2026-03-10T18:00:00.000Z",
        }),
      });
      const duplicate = await fetchJson(baseUrl, "/api/field/leads/fld_booked/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "abc",
          slotStartIso: "2026-03-10T18:00:00.000Z",
        }),
      });
      const conflict = await fetchJson(baseUrl, "/api/field/leads/fld_conflict/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "abc",
          slotStartIso: "2026-03-10T18:00:00.000Z",
        }),
      });

      assert.equal(success.status, 200);
      assert.equal(duplicate.status, 409);
      assert.equal(conflict.status, 409);
      assert.equal(hookCalls.clearCalendarAvailabilityCache >= 2, true);
      assert.equal(hookCalls.clearManageContextCacheForEvent >= 1, true);
    }
  );
});

test("field lead booking api fast-fails when the slot lock is already held", async () => {
  let bookLeadCalled = false;

  await withServer(
    {
      service: {
        getConfig: async () => ({ ok: true, repOptions: [], linkExpiryDays: 7 }),
        createLead: async () => ({ ok: true }),
        getLeadContext: async () => ({ ok: true, state: "open", status: "initial_sms_sent", lead: {} }),
        getAvailability: async () => ({
          month: "2026-03",
          timezone: "America/Toronto",
          availabilityByDate: {},
          availableDates: [],
        }),
        bookLead: async () => {
          bookLeadCalled = true;
          return { ok: true, booking: { eventId: "evt_1" } };
        },
      },
      hooks: {
        acquireSlotLock: () => null,
      },
    },
    async (baseUrl) => {
      const result = await fetchJson(baseUrl, "/api/field/leads/fld_success/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "abc",
          slotStartIso: "2026-03-10T18:00:00.000Z",
        }),
      });

      assert.equal(result.status, 409);
      assert.match(String(result.body?.message || ""), /being booked right now/i);
      assert.equal(bookLeadCalled, false);
    }
  );
});
