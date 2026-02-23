import "dotenv/config";
import assert from "node:assert/strict";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:8787";
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS || 20000);
const MAX_HEALTH_WAIT_MS = Number(process.env.SMOKE_MAX_HEALTH_WAIT_MS || 120000);
const HEALTH_POLL_MS = Number(process.env.SMOKE_HEALTH_POLL_MS || 1500);
const MAX_AVAILABILITY_WAIT_MS = Number(process.env.SMOKE_MAX_AVAILABILITY_WAIT_MS || 180000);

const monthParamFromDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const nowUtc = () => new Date();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs, message) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]);
};

const request = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const response = await withTimeout(
    fetch(url, options),
    REQUEST_TIMEOUT_MS,
    `Request timed out: ${path}`
  );

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    body,
  };
};

const expectStatus = (result, expectedStatuses, context) => {
  const accepted = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  assert.ok(
    accepted.includes(result.status),
    `${context} expected ${accepted.join(" or ")}, got ${result.status}. Body: ${JSON.stringify(
      result.body
    )}`
  );
};

const waitForHealth = async () => {
  const deadline = Date.now() + MAX_HEALTH_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const health = await request("/api/health");
      if (health.status === 200 && health.body?.ok) {
        return health.body;
      }
    } catch {
      // Keep polling.
    }

    await sleep(HEALTH_POLL_MS);
  }

  throw new Error(
    `Server health check did not pass within ${Math.round(MAX_HEALTH_WAIT_MS / 1000)} seconds.`
  );
};

const flattenSlots = (availabilityByDate) =>
  Object.entries(availabilityByDate || {})
    .flatMap(([dateKey, slots]) =>
      (slots || []).map((slot) => ({
        ...slot,
        dateKey,
      }))
    )
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

const findCandidateSlots = async () => {
  const deadline = Date.now() + MAX_AVAILABILITY_WAIT_MS;
  while (Date.now() < deadline) {
    let sawTransientFailure = false;

    for (let monthOffset = 0; monthOffset < 6; monthOffset += 1) {
      const candidateDate = new Date();
      candidateDate.setMonth(candidateDate.getMonth() + monthOffset);
      const month = monthParamFromDate(candidateDate);
      const availability = await request(`/api/calendar/availability?month=${month}`);

      if (availability.status !== 200) {
        sawTransientFailure = true;
        continue;
      }

      const slots = flattenSlots(availability.body?.availabilityByDate || {});
      if (slots.length >= 2) {
        return {
          month,
          timezone: availability.body?.timezone || "America/Toronto",
          slots,
        };
      }
    }

    await sleep(sawTransientFailure ? 3000 : 2000);
  }

  throw new Error(
    `Unable to find at least two available slots in the next 6 months within ${Math.round(
      MAX_AVAILABILITY_WAIT_MS / 1000
    )} seconds.`
  );
};

const parseManageLink = (link) => {
  const url = new URL(String(link || ""));
  return {
    eventId: String(url.searchParams.get("eventId") || "").trim(),
    actor: String(url.searchParams.get("actor") || "").trim().toLowerCase(),
    token: String(url.searchParams.get("token") || "").trim(),
  };
};

const loadContext = async ({ eventId, actor, token }) => {
  const params = new URLSearchParams({ eventId, actor, token });
  return request(`/api/calendar/manage/context?${params.toString()}`);
};

const main = async () => {
  const report = {
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    assertions: [],
    booking: null,
    finalStatus: "unknown",
  };

  const pushAssertion = (name) => {
    report.assertions.push({
      name,
      passed: true,
      at: new Date().toISOString(),
    });
  };

  const health = await waitForHealth();
  assert.equal(health.ok, true, "health.ok should be true");
  pushAssertion("health endpoint responded");

  const candidates = await findCandidateSlots();
  const primarySlot = candidates.slots[0];
  const alternateSlot = candidates.slots.find((slot) => slot.startIso !== primarySlot.startIso);
  assert.ok(primarySlot, "primary slot is required");
  assert.ok(alternateSlot, "alternate slot is required");
  pushAssertion("found two live availability slots");

  const smokeId = Date.now();
  const bookingPayload = {
    slotStartIso: primarySlot.startIso,
    fullName: `Smoke Test ${smokeId}`,
    phone: "+16475108718",
    phoneCountryCode: "+1",
    phoneNationalNumber: "6475108718",
    email: `owenjalali70+smoke${smokeId}@gmail.com`,
    addressLine1: "123 Smoke Test Ave",
    city: "Toronto",
    postalCode: "M5V2T6",
    country: "CA",
    provinceState: "ON",
    projectType: "Interior",
    projectDetails: "Live smoke test booking flow validation.",
    budget: "500",
    callGoal: "Validate cancellation and rescheduling flow.",
  };

  const booking = await request("/api/calendar/booking", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bookingPayload),
  });
  expectStatus(booking, 200, "booking create");
  assert.ok(booking.body?.booking?.eventId, "eventId should exist after booking");
  assert.ok(booking.body?.booking?.manageLinks?.client, "client manage link should exist");
  assert.ok(booking.body?.booking?.manageLinks?.carter, "carter manage link should exist");
  pushAssertion("booking created with event id and manage links");

  const eventId = booking.body.booking.eventId;
  const clientCreds = parseManageLink(booking.body.booking.manageLinks.client);
  const carterCreds = parseManageLink(booking.body.booking.manageLinks.carter);

  assert.equal(clientCreds.eventId, eventId, "client link should contain same eventId");
  assert.equal(carterCreds.eventId, eventId, "carter link should contain same eventId");
  assert.equal(clientCreds.actor, "client", "client link actor should be client");
  assert.equal(carterCreds.actor, "carter", "carter link actor should be carter");
  pushAssertion("manage links parsed and validated");

  const clientContext = await loadContext(clientCreds);
  expectStatus(clientContext, 200, "client context load");
  assert.equal(clientContext.body?.booking?.eventId, eventId, "client context event id mismatch");
  pushAssertion("client context loaded");

  const carterContext = await loadContext(carterCreds);
  expectStatus(carterContext, 200, "carter context load");
  assert.equal(carterContext.body?.booking?.eventId, eventId, "carter context event id mismatch");
  pushAssertion("carter context loaded");

  const invalidTokenContext = await loadContext({
    eventId,
    actor: "client",
    token: "invalid-token",
  });
  expectStatus(invalidTokenContext, [403], "invalid token context");
  pushAssertion("invalid token rejected");

  const actorTokenMismatchContext = await loadContext({
    eventId,
    actor: "carter",
    token: clientCreds.token,
  });
  expectStatus(actorTokenMismatchContext, [403], "actor/token mismatch context");
  pushAssertion("actor/token mismatch rejected");

  const notFoundContext = await loadContext({
    eventId: "missing-event-id-smoke",
    actor: "client",
    token: clientCreds.token,
  });
  expectStatus(notFoundContext, [404], "missing event context");
  pushAssertion("missing event returns 404");

  const missingReasonCancel = await request("/api/calendar/manage/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      actor: "client",
      token: clientCreds.token,
      reason: "",
    }),
  });
  expectStatus(missingReasonCancel, [400], "cancel missing reason");
  pushAssertion("cancel missing reason rejected");

  const sameSlotRescheduleAttempt = await request("/api/calendar/manage/reschedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      actor: "client",
      token: clientCreds.token,
      reason: "Same slot validation test",
      newSlotStartIso: booking.body.booking.startIso,
    }),
  });
  expectStatus(
    sameSlotRescheduleAttempt,
    clientContext.body?.permissions?.canReschedule ? [400] : [403],
    "reschedule to same slot"
  );
  pushAssertion("same-slot reschedule blocked");

  const canClientManage = Boolean(clientContext.body?.permissions?.canReschedule);
  if (!canClientManage) {
    const blockedClientCancel = await request("/api/calendar/manage/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId,
        actor: "client",
        token: clientCreds.token,
        reason: "Cutoff policy test",
      }),
    });
    expectStatus(blockedClientCancel, [403], "client cutoff cancellation block");
    pushAssertion("client cutoff block enforced");
  }

  const winningCreds = canClientManage ? clientCreds : carterCreds;
  const winningActor = canClientManage ? "client" : "carter";
  const reschedule = await request("/api/calendar/manage/reschedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      actor: winningActor,
      token: winningCreds.token,
      reason: "Live smoke test reschedule validation.",
      newSlotStartIso: alternateSlot.startIso,
    }),
  });
  expectStatus(reschedule, 200, "reschedule success");
  assert.equal(
    reschedule.body?.booking?.eventId,
    eventId,
    "event id should remain unchanged after reschedule"
  );
  assert.equal(
    reschedule.body?.booking?.startIso,
    alternateSlot.startIso,
    "rescheduled start should match requested slot"
  );
  pushAssertion("reschedule succeeded and kept same event id");

  const postRescheduleContext = await loadContext(winningCreds);
  expectStatus(postRescheduleContext, 200, "context after reschedule");
  assert.equal(
    postRescheduleContext.body?.booking?.startIso,
    alternateSlot.startIso,
    "context should reflect new start time"
  );
  pushAssertion("context reflects rescheduled time");

  const cancel = await request("/api/calendar/manage/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      actor: winningActor,
      token: winningCreds.token,
      reason: "Live smoke test cancellation validation.",
    }),
  });
  expectStatus(cancel, 200, "cancel success");
  assert.equal(cancel.body?.booking?.status, "cancelled", "status should be cancelled");
  pushAssertion("cancel succeeded");

  const secondCancel = await request("/api/calendar/manage/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      actor: winningActor,
      token: winningCreds.token,
      reason: "Second cancel should fail",
    }),
  });
  expectStatus(secondCancel, [409, 403], "double cancel blocked");
  pushAssertion("double cancel blocked");

  const postCancelReschedule = await request("/api/calendar/manage/reschedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId,
      actor: winningActor,
      token: winningCreds.token,
      reason: "Reschedule after cancellation should fail",
      newSlotStartIso: primarySlot.startIso,
    }),
  });
  expectStatus(postCancelReschedule, [409, 403], "reschedule after cancellation blocked");
  pushAssertion("reschedule after cancellation blocked");

  const finalClientContext = await loadContext(clientCreds);
  expectStatus(finalClientContext, 200, "final context load");
  assert.equal(
    finalClientContext.body?.booking?.status,
    "cancelled",
    "final context status should be cancelled"
  );
  assert.equal(finalClientContext.body?.permissions?.canCancel, false, "cancel should be disabled");
  assert.equal(
    finalClientContext.body?.permissions?.canReschedule,
    false,
    "reschedule should be disabled"
  );
  pushAssertion("final context shows cancelled + locked state");

  report.booking = {
    eventId,
    actorUsedForMutations: winningActor,
    originalStartIso: booking.body.booking.startIso,
    rescheduledStartIso: alternateSlot.startIso,
    cancelled: true,
  };
  report.finalStatus = "passed";
  report.completedAt = nowUtc().toISOString();

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        finalStatus: "failed",
        error: message,
        at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
