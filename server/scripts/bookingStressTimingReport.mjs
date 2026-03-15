import "dotenv/config";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const API_BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:8787";
const WEB_BASE_URL = process.env.SMOKE_WEB_BASE_URL || "http://localhost:5173";
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS || 60000);
const MAX_HEALTH_WAIT_MS = Number(process.env.SMOKE_MAX_HEALTH_WAIT_MS || 120000);
const HEALTH_POLL_MS = Number(process.env.SMOKE_HEALTH_POLL_MS || 1500);
const MAX_AVAILABILITY_WAIT_MS = Number(process.env.SMOKE_MAX_AVAILABILITY_WAIT_MS || 180000);
const MAX_MONTH_LOOKAHEAD = 6;
const STRESS_CUSTOMER_PHONE = String(
  process.env.STRESS_CUSTOMER_PHONE ||
    process.env.SMOKE_CUSTOMER_PHONE ||
    process.env.BOOKING_OWNER_PHONE ||
    ""
).trim();
const STRESS_CUSTOMER_EMAIL = String(
  process.env.STRESS_CUSTOMER_EMAIL ||
    process.env.SMOKE_CUSTOMER_EMAIL ||
    process.env.BOOKING_OWNER_EMAIL ||
    process.env.QUOTE_TO_EMAIL ||
    ""
).trim();

const monthParamFromDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const round = (value, decimals = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(decimals)) : value;

const summarizeDurations = (durationsMs) => {
  const values = durationsMs.filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return {
      count: 0,
      minMs: null,
      avgMs: null,
      maxMs: null,
      p95Ms: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, current) => sum + current, 0);
  const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

  return {
    count: sorted.length,
    minMs: round(sorted[0]),
    avgMs: round(total / sorted.length),
    maxMs: round(sorted[sorted.length - 1]),
    p95Ms: round(sorted[p95Index]),
  };
};

const timedFetch = async (url, options = {}) => {
  const startedAtIso = new Date().toISOString();
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    let body = null;
    const raw = await response.text();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }

    const durationMs = performance.now() - startedAt;
    return {
      ok: response.ok,
      status: response.status,
      body,
      startedAtIso,
      completedAtIso: new Date().toISOString(),
      durationMs: round(durationMs),
      durationRawMs: durationMs,
      url,
    };
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: null,
      body: {
        error: message,
      },
      startedAtIso,
      completedAtIso: new Date().toISOString(),
      durationMs: round(durationMs),
      durationRawMs: durationMs,
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const requestApi = async (path, options = {}) => timedFetch(`${API_BASE_URL}${path}`, options);

const requestJsonApi = async (path, method, payload) =>
  requestApi(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

const requestWeb = async (absoluteUrl) => timedFetch(absoluteUrl);

const flattenSlots = (availabilityByDate) =>
  Object.entries(availabilityByDate || {})
    .flatMap(([dateKey, slots]) =>
      (slots || []).map((slot) => ({
        ...slot,
        dateKey,
      }))
    )
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

const waitForHealthySystem = async () => {
  const deadline = Date.now() + MAX_HEALTH_WAIT_MS;
  while (Date.now() < deadline) {
    const health = await requestApi("/api/health");
    if (health.status === 200 && health.body?.ok) {
      return health;
    }
    await sleep(HEALTH_POLL_MS);
  }

  throw new Error(
    `Server did not report healthy within ${Math.round(MAX_HEALTH_WAIT_MS / 1000)} seconds.`
  );
};

const getAvailabilityCandidates = async (requiredSlots = 4) => {
  const deadline = Date.now() + MAX_AVAILABILITY_WAIT_MS;
  while (Date.now() < deadline) {
    for (let monthOffset = 0; monthOffset < MAX_MONTH_LOOKAHEAD; monthOffset += 1) {
      const candidateDate = new Date();
      candidateDate.setMonth(candidateDate.getMonth() + monthOffset);
      const month = monthParamFromDate(candidateDate);
      const availability = await requestApi(`/api/calendar/availability?month=${month}`);

      if (availability.status !== 200) {
        continue;
      }

      const slots = flattenSlots(availability.body?.availabilityByDate || {});
      if (slots.length >= requiredSlots) {
        return {
          month,
          timezone: availability.body?.timezone || "America/Toronto",
          slots,
          availabilityRequest: availability,
        };
      }
    }

    await sleep(2000);
  }

  throw new Error(
    `Unable to find at least ${requiredSlots} available slots in the next ${MAX_MONTH_LOOKAHEAD} months.`
  );
};

const parseManageLink = (link) => {
  const url = new URL(String(link || ""));
  return {
    rawUrl: url.toString(),
    eventId: String(url.searchParams.get("eventId") || "").trim(),
    actor: String(url.searchParams.get("actor") || "").trim().toLowerCase(),
    token: String(url.searchParams.get("token") || "").trim(),
  };
};

const createAliasedEmail = ({ baseEmail, alias }) => {
  const normalized = String(baseEmail || "").trim();
  const separatorIndex = normalized.lastIndexOf("@");
  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
    return normalized;
  }

  const localPart = normalized.slice(0, separatorIndex).replace(/\+.*/, "");
  const domainPart = normalized.slice(separatorIndex + 1);
  return `${localPart}+${alias}@${domainPart}`;
};

const loadContext = async ({ eventId, actor, token }) => {
  const params = new URLSearchParams({ eventId, actor, token });
  return requestApi(`/api/calendar/manage/context?${params.toString()}`);
};

const createBookingPayload = ({ slotStartIso, prefix }) => {
  const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const emailAlias = `${prefix.toLowerCase().replace(/\s+/g, "")}${id}`;
  return {
    slotStartIso,
    fullName: `${prefix} ${id}`,
    phone: STRESS_CUSTOMER_PHONE,
    phoneCountryCode: "+1",
    phoneNationalNumber: STRESS_CUSTOMER_PHONE.replace(/\D/g, "").replace(/^1/, ""),
    email: createAliasedEmail({
      baseEmail: STRESS_CUSTOMER_EMAIL,
      alias: emailAlias,
    }),
    addressLine1: "123 Stress Test Ave",
    city: "Toronto",
    postalCode: "M5V2T6",
    country: "CA",
    provinceState: "ON",
    projectType: "wood-staining",
    projectDetails: "Automated stress + timing validation for booking, rescheduling, and cancellation.",
    budget: "900",
    callGoal: "Validate booking and manage flow reliability under concurrent requests.",
  };
};

const ensureStatus = (result, expectedStatuses, context) => {
  const accepted = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  assert.ok(
    accepted.includes(result.status),
    `${context} expected ${accepted.join(" or ")}, got ${result.status}. Body: ${JSON.stringify(
      result.body
    )}`
  );
};

const runCollisionScenario = async (slots, timing) => {
  const slot = slots[0];
  const alternateSlot = slots.find((candidate) => candidate.startIso !== slot.startIso);
  assert.ok(slot, "Collision scenario requires a primary slot");
  assert.ok(alternateSlot, "Collision scenario requires an alternate slot");

  const bookingA = createBookingPayload({
    slotStartIso: slot.startIso,
    prefix: "Concurrent A",
  });
  const bookingB = createBookingPayload({
    slotStartIso: slot.startIso,
    prefix: "Concurrent B",
  });

  const collisionStarted = performance.now();
  const [resultA, resultB] = await Promise.all([
    requestJsonApi("/api/calendar/booking", "POST", bookingA),
    requestJsonApi("/api/calendar/booking", "POST", bookingB),
  ]);
  const collisionDurationMs = performance.now() - collisionStarted;

  const bookingResults = [
    { requestId: "A", payloadEmail: bookingA.email, ...resultA },
    { requestId: "B", payloadEmail: bookingB.email, ...resultB },
  ];
  timing.concurrentBookingDurationsMs.push(resultA.durationRawMs, resultB.durationRawMs);

  const successResults = bookingResults.filter((item) => item.status === 200 && item.body?.booking);
  const failureResults = bookingResults.filter((item) => item.status !== 200);
  const hasExpectedConflictCode = failureResults.some((item) => item.status === 409);
  const overbookingDetected = successResults.length > 1;
  const duplicateBlocked = successResults.length === 1 && failureResults.length >= 1;

  assert.ok(successResults.length >= 1, "At least one concurrent same-slot booking should succeed");

  const winner = successResults[0];
  const eventId = winner.body.booking.eventId;
  const clientLink = winner.body.booking.manageLinks?.client;
  const carterLink = winner.body.booking.manageLinks?.carter;

  assert.ok(eventId, "Winner booking must include eventId");
  assert.ok(clientLink, "Winner booking must include client manage link");
  assert.ok(carterLink, "Winner booking must include carter manage link");

  const clientCreds = parseManageLink(clientLink);
  const carterCreds = parseManageLink(carterLink);

  const clientPageLoad = await requestWeb(clientCreds.rawUrl.replace(API_BASE_URL, WEB_BASE_URL));
  const carterPageLoad = await requestWeb(carterCreds.rawUrl.replace(API_BASE_URL, WEB_BASE_URL));
  timing.managePageLoadDurationsMs.push(clientPageLoad.durationRawMs, carterPageLoad.durationRawMs);

  const clientContextSamples = [];
  const carterContextSamples = [];
  for (let i = 0; i < 3; i += 1) {
    const clientContext = await loadContext(clientCreds);
    const carterContext = await loadContext(carterCreds);
    ensureStatus(clientContext, 200, "client context load");
    ensureStatus(carterContext, 200, "carter context load");
    clientContextSamples.push(clientContext);
    carterContextSamples.push(carterContext);
    timing.manageContextLoadDurationsMs.push(clientContext.durationRawMs, carterContext.durationRawMs);
  }

  const clientContext = clientContextSamples[0];
  const canClientReschedule = Boolean(clientContext.body?.permissions?.canReschedule);
  const mutationActor = canClientReschedule ? "client" : "carter";
  const mutationCreds = canClientReschedule ? clientCreds : carterCreds;

  const monthOfAlternate = monthParamFromDate(new Date(alternateSlot.startIso));
  const availabilityFirst = await requestApi(`/api/calendar/availability?month=${monthOfAlternate}`);
  const availabilitySecond = await requestApi(`/api/calendar/availability?month=${monthOfAlternate}`);
  ensureStatus(availabilityFirst, 200, "reschedule availability first load");
  ensureStatus(availabilitySecond, 200, "reschedule availability second load");
  timing.rescheduleAvailabilityDurationsMs.push(
    availabilityFirst.durationRawMs,
    availabilitySecond.durationRawMs
  );

  const reschedule = await requestJsonApi("/api/calendar/manage/reschedule", "POST", {
    eventId,
    actor: mutationActor,
    token: mutationCreds.token,
    reason: "Automated collision scenario reschedule test.",
    newSlotStartIso: alternateSlot.startIso,
  });
  ensureStatus(reschedule, 200, "reschedule after concurrent booking");
  assert.equal(
    reschedule.body?.booking?.startIso,
    alternateSlot.startIso,
    "Rescheduled start time should match requested slot"
  );
  timing.rescheduleDurationsMs.push(reschedule.durationRawMs);

  const postRescheduleClientContext = await loadContext(clientCreds);
  const postRescheduleCarterContext = await loadContext(carterCreds);
  ensureStatus(postRescheduleClientContext, 200, "post-reschedule client context");
  ensureStatus(postRescheduleCarterContext, 200, "post-reschedule carter context");
  timing.manageContextLoadDurationsMs.push(
    postRescheduleClientContext.durationRawMs,
    postRescheduleCarterContext.durationRawMs
  );

  const cancel = await requestJsonApi("/api/calendar/manage/cancel", "POST", {
    eventId,
    actor: mutationActor,
    token: mutationCreds.token,
    reason: "Automated collision scenario cancellation cleanup.",
  });
  ensureStatus(cancel, 200, "collision scenario cancel");
  assert.equal(cancel.body?.booking?.status, "cancelled", "Booking status should be cancelled");
  timing.cancelDurationsMs.push(cancel.durationRawMs);

  const finalClientContext = await loadContext(clientCreds);
  ensureStatus(finalClientContext, 200, "final client context after cancel");
  assert.equal(
    finalClientContext.body?.booking?.status,
    "cancelled",
    "Final context should reflect cancelled status"
  );
  timing.manageContextLoadDurationsMs.push(finalClientContext.durationRawMs);

  const extraSuccessResults = successResults.slice(1);
  const overbookingCleanup = [];
  for (const extraResult of extraSuccessResults) {
    const extraEventId = extraResult.body?.booking?.eventId;
    const extraCarterLink = extraResult.body?.booking?.manageLinks?.carter;
    if (!extraEventId || !extraCarterLink) {
      continue;
    }

    const extraCarterCreds = parseManageLink(extraCarterLink);
    const cleanupCancel = await requestJsonApi("/api/calendar/manage/cancel", "POST", {
      eventId: extraEventId,
      actor: "carter",
      token: extraCarterCreds.token,
      reason: "Automated overbooking cleanup cancellation.",
    });
    ensureStatus(cleanupCancel, 200, "overbooking cleanup cancel");
    timing.cancelDurationsMs.push(cleanupCancel.durationRawMs);
    overbookingCleanup.push({
      eventId: extraEventId,
      status: cleanupCancel.status,
      durationMs: cleanupCancel.durationMs,
    });
  }

  return {
    scenario: "same_slot_concurrency_then_reschedule_cancel",
    collisionWindowDurationMs: round(collisionDurationMs),
    slotAttempted: slot.startIso,
    alternateSlot: alternateSlot.startIso,
    mutationActorUsed: mutationActor,
    requests: bookingResults.map((result) => ({
      requestId: result.requestId,
      status: result.status,
      durationMs: result.durationMs,
      email: result.payloadEmail,
      message: result.body?.message || null,
      eventId: result.body?.booking?.eventId || null,
    })),
    pageLoads: {
      clientManagePageStatus: clientPageLoad.status,
      clientManagePageDurationMs: clientPageLoad.durationMs,
      carterManagePageStatus: carterPageLoad.status,
      carterManagePageDurationMs: carterPageLoad.durationMs,
      clientContextDurationsMs: clientContextSamples.map((sample) => sample.durationMs),
      carterContextDurationsMs: carterContextSamples.map((sample) => sample.durationMs),
      rescheduleAvailabilityFirstDurationMs: availabilityFirst.durationMs,
      rescheduleAvailabilitySecondDurationMs: availabilitySecond.durationMs,
    },
    concurrencyProtection: {
      blockedDuplicateBooking: duplicateBlocked,
      failureStatuses: failureResults.map((item) => item.status),
      receivedExpected409: hasExpectedConflictCode,
      overbookingDetected,
      overbookingCleanup,
    },
    eventId,
    status: overbookingDetected ? "warning" : "passed",
  };
};

const runParallelDistinctScenario = async (slots, timing) => {
  const distinctSlots = [];
  for (const slot of slots) {
    if (distinctSlots.every((entry) => entry.startIso !== slot.startIso)) {
      distinctSlots.push(slot);
    }
    if (distinctSlots.length === 2) {
      break;
    }
  }

  assert.equal(distinctSlots.length, 2, "Distinct concurrency scenario requires 2 unique slots");

  const payloadC = createBookingPayload({
    slotStartIso: distinctSlots[0].startIso,
    prefix: "Parallel C",
  });
  const payloadD = createBookingPayload({
    slotStartIso: distinctSlots[1].startIso,
    prefix: "Parallel D",
  });

  const [bookingC, bookingD] = await Promise.all([
    requestJsonApi("/api/calendar/booking", "POST", payloadC),
    requestJsonApi("/api/calendar/booking", "POST", payloadD),
  ]);
  timing.concurrentBookingDurationsMs.push(bookingC.durationRawMs, bookingD.durationRawMs);

  ensureStatus(bookingC, 200, "parallel booking C");
  ensureStatus(bookingD, 200, "parallel booking D");

  const created = [bookingC, bookingD].map((result, index) => ({
    requestId: index === 0 ? "C" : "D",
    eventId: result.body?.booking?.eventId,
    clientLink: result.body?.booking?.manageLinks?.client,
    carterLink: result.body?.booking?.manageLinks?.carter,
    startIso: result.body?.booking?.startIso,
    durationMs: result.durationMs,
  }));

  for (const item of created) {
    assert.ok(item.eventId, `Parallel booking ${item.requestId} missing eventId`);
    assert.ok(item.carterLink, `Parallel booking ${item.requestId} missing carter manage link`);
  }

  const cleanupResults = [];
  for (const item of created) {
    const carterCreds = parseManageLink(item.carterLink);
    const cancel = await requestJsonApi("/api/calendar/manage/cancel", "POST", {
      eventId: item.eventId,
      actor: "carter",
      token: carterCreds.token,
      reason: "Automated parallel booking cleanup cancellation.",
    });
    ensureStatus(cancel, 200, `parallel booking ${item.requestId} cancel`);
    timing.cancelDurationsMs.push(cancel.durationRawMs);
    cleanupResults.push({
      requestId: item.requestId,
      eventId: item.eventId,
      cancelStatus: cancel.status,
      cancelDurationMs: cancel.durationMs,
    });
  }

  return {
    scenario: "distinct_slot_concurrency_then_cleanup",
    createdBookings: created,
    cleanupResults,
    status: "passed",
  };
};

const main = async () => {
  const startedAt = performance.now();
  const report = {
    run: {
      startedAt: new Date().toISOString(),
      completedAt: null,
      totalDurationMs: null,
    },
    environment: {
      apiBaseUrl: API_BASE_URL,
      webBaseUrl: WEB_BASE_URL,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
    },
    evidence: {
      healthCheck: null,
      initialAvailabilityDiscovery: null,
      scenarios: [],
      timingSummary: null,
    },
    status: "unknown",
  };

  const timing = {
    concurrentBookingDurationsMs: [],
    managePageLoadDurationsMs: [],
    manageContextLoadDurationsMs: [],
    rescheduleAvailabilityDurationsMs: [],
    rescheduleDurationsMs: [],
    cancelDurationsMs: [],
  };

  const health = await waitForHealthySystem();
  report.evidence.healthCheck = {
    status: health.status,
    durationMs: health.durationMs,
    body: health.body,
  };

  assert.ok(
    STRESS_CUSTOMER_PHONE,
    "Set STRESS_CUSTOMER_PHONE, SMOKE_CUSTOMER_PHONE, or BOOKING_OWNER_PHONE before running the booking stress report."
  );
  assert.ok(
    STRESS_CUSTOMER_EMAIL,
    "Set STRESS_CUSTOMER_EMAIL, SMOKE_CUSTOMER_EMAIL, BOOKING_OWNER_EMAIL, or QUOTE_TO_EMAIL before running the booking stress report."
  );

  const candidates = await getAvailabilityCandidates(6);
  report.evidence.initialAvailabilityDiscovery = {
    month: candidates.month,
    timezone: candidates.timezone,
    availableSlotCount: candidates.slots.length,
    requestStatus: candidates.availabilityRequest.status,
    requestDurationMs: candidates.availabilityRequest.durationMs,
  };

  const collisionScenario = await runCollisionScenario(candidates.slots, timing);
  report.evidence.scenarios.push(collisionScenario);

  const refreshedCandidates = await getAvailabilityCandidates(6);
  const parallelScenario = await runParallelDistinctScenario(refreshedCandidates.slots, timing);
  report.evidence.scenarios.push(parallelScenario);

  report.evidence.timingSummary = {
    concurrentBooking: summarizeDurations(timing.concurrentBookingDurationsMs),
    managePageLoads: summarizeDurations(timing.managePageLoadDurationsMs),
    manageContextLoads: summarizeDurations(timing.manageContextLoadDurationsMs),
    rescheduleAvailabilityLoads: summarizeDurations(timing.rescheduleAvailabilityDurationsMs),
    rescheduleActions: summarizeDurations(timing.rescheduleDurationsMs),
    cancelActions: summarizeDurations(timing.cancelDurationsMs),
  };

  report.status = report.evidence.scenarios.some((scenario) => scenario.status === "warning")
    ? "warning"
    : "passed";
  report.run.completedAt = new Date().toISOString();
  report.run.totalDurationMs = round(performance.now() - startedAt);

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: message,
        at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
