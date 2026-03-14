import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFieldBookingConfirmationSmsBody,
  buildFieldCustomerFollowupSmsBody,
  buildFieldInitialSmsBody,
  buildFieldManageNotifications,
  buildFieldOwnerBookingEmail,
  buildFieldOwnerBookingSmsBody,
  buildFieldOwnerFollowupEmail,
  buildFieldOwnerFollowupSmsBody,
  buildFieldReminderNotifications,
  resolveFieldLeadEmailRecipient,
  resolveFieldLeadSmsRecipient,
} from "./fieldLeadNotifications.mjs";

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

test("customer SMS payloads stay SMS-first and include the booking or manage link", () => {
  const initialSms = buildFieldInitialSmsBody({
    customerName: "Jane Smith",
    bookingLink: "https://midtown.test/field-booking/fld_123?token=abc",
  });
  const confirmationSms = buildFieldBookingConfirmationSmsBody({
    customerName: "Jane Smith",
    displayDate: "Tuesday, March 10",
    displayTime: "3:15 PM (EDT)",
    manageLink: "https://midtown.test/manage-booking?eventId=abc",
  });

  assert.match(initialSms, /speaking with Carter's team/i);
  assert.match(initialSms, /field-booking\/fld_123/i);
  assert.match(confirmationSms, /manage your booking here/i);
  assert.match(confirmationSms, /manage-booking/i);
});

test("owner booking email and sms payloads include rep context and project notes", () => {
  const ownerEmail = buildFieldOwnerBookingEmail({
    customerName: "Jane Smith",
    customerPhone: "+16475551234",
    customerAddress: "123 Example Street",
    displayDate: "Tuesday, March 10",
    displayTime: "3:15 PM (EDT)",
    repName: "Sam",
    projectNotes: "Exterior trim and porch railings need a repaint.",
    clientManageLink: "https://midtown.test/manage-booking?client",
    carterManageLink: "https://midtown.test/manage-booking?carter",
    eventId: "evt_123",
  });
  const ownerSms = buildFieldOwnerBookingSmsBody({
    customerName: "Jane Smith",
    customerAddress: "123 Example Street",
    displayDate: "Tuesday, March 10",
    displayTime: "3:15 PM (EDT)",
    repName: "Sam",
    projectNotes: "Exterior trim and porch railings need a repaint.",
  });

  assert.match(ownerEmail.subject, /field lead consultation booked/i);
  assert.match(ownerEmail.text, /Captured by: Sam/);
  assert.match(ownerEmail.text, /123 Example Street/);
  assert.match(ownerEmail.text, /porch railings/i);
  assert.match(ownerSms, /123 Example Street/);
  assert.match(ownerSms, /Rep: Sam/);
  assert.match(ownerSms, /Exterior trim/i);
});

test("follow-up builders include booking link, elapsed time, and current lead status", () => {
  const customerFollowup = buildFieldCustomerFollowupSmsBody({
    customerName: "Jane Smith",
    bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
  });
  const ownerEmail = buildFieldOwnerFollowupEmail({
    customerName: "Jane Smith",
    customerPhone: "+16475551234",
    customerAddress: "123 Example Street",
    repName: "Sam",
    projectNotes: "Porch railings",
    bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
    elapsedLabel: "24 hours",
    currentStatus: "initial_sms_sent",
  });
  const ownerSms = buildFieldOwnerFollowupSmsBody({
    customerName: "Jane Smith",
    customerPhone: "+16475551234",
    customerAddress: "123 Example Street",
    repName: "Sam",
    projectNotes: "Porch railings",
    elapsedLabel: "24 hours",
    currentStatus: "initial_sms_sent",
    bookingLink: "https://preview.midtown.test/field-booking/fld_123?token=abc",
  });

  assert.match(customerFollowup, /still book your 15-minute call/i);
  assert.match(customerFollowup, /field-booking\/fld_123/i);
  assert.match(ownerEmail.text, /Elapsed since first SMS: 24 hours/);
  assert.match(ownerEmail.text, /123 Example Street/);
  assert.match(ownerEmail.text, /Current sheet status: initial_sms_sent/);
  assert.match(ownerSms, /123 Example Street/i);
  assert.match(ownerSms, /Status: initial_sms_sent/i);
});

test("preview outbound override rewrites sms and email recipients", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      FIELD_TEST_FORCE_OUTBOUND_ENABLED: "true",
      FIELD_TEST_FORCE_OUTBOUND_PHONE: "+16475550000",
      FIELD_TEST_FORCE_OUTBOUND_EMAIL: "test-owner@example.com",
    },
    async () => {
      assert.equal(resolveFieldLeadSmsRecipient("+14165551212"), "+16475550000");
      assert.equal(resolveFieldLeadEmailRecipient("carter@example.com"), "test-owner@example.com");
    }
  );
});

test("reminder and manage notification builders do not depend on customer email", () => {
  const reminder = buildFieldReminderNotifications({
    customerName: "Jane Smith",
    customerAddress: "123 Example Street",
    displayDate: "Tuesday, March 10",
    displayTime: "3:15 PM (EDT)",
    reminderMinutesBefore: 15,
    repName: "Sam",
    projectNotes: "Porch railings",
  });
  const manage = buildFieldManageNotifications({
    action: "rescheduled",
    actor: "carter",
    customerName: "Jane Smith",
    reason: "Running ahead of schedule",
    previousDisplay: {
      displayDate: "Tuesday, March 10",
      displayTime: "3:15 PM (EDT)",
      timezone: "America/Toronto",
      startIso: "2026-03-10T19:15:00.000Z",
      endIso: "2026-03-10T19:30:00.000Z",
    },
    nextDisplay: {
      displayDate: "Tuesday, March 10",
      displayTime: "4:00 PM (EDT)",
      timezone: "America/Toronto",
      startIso: "2026-03-10T20:00:00.000Z",
      endIso: "2026-03-10T20:15:00.000Z",
    },
  });

  assert.match(reminder.customerSmsBody, /starts in 15 minutes/i);
  assert.match(reminder.ownerText, /123 Example Street/);
  assert.match(reminder.ownerText, /Captured by: Sam/);
  assert.match(manage.customerSmsBody, /rescheduled by carter/i);
  assert.match(manage.ownerText, /Running ahead of schedule/);
});
