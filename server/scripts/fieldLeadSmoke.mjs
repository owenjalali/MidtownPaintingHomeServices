import "dotenv/config";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const readEnvFile = (relativePath) => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    return {};
  }

  return readFileSync(absolutePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        return accumulator;
      }

      const [rawKey, ...rest] = trimmed.split("=");
      const key = String(rawKey || "").trim();
      let value = rest.join("=").trim();
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      if (key) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
};

const fieldTestRuntimeEnv = readEnvFile("logs/field-test.runtime.env");
const runtimeEnv =
  Object.keys(fieldTestRuntimeEnv).length > 0 ? fieldTestRuntimeEnv : readEnvFile("test.env");

const getEnvValue = (key) => String(process.env[key] || runtimeEnv[key] || "").trim();

const BASE_URL = process.env.FIELD_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8787";
const AUTH_SHARE_URL =
  process.env.FIELD_SMOKE_VERCEL_SHARE_URL ||
  process.env.SMOKE_VERCEL_SHARE_URL ||
  "";
const VERCEL_BYPASS_SECRET =
  process.env.FIELD_SMOKE_VERCEL_BYPASS_SECRET ||
  process.env.SMOKE_VERCEL_BYPASS_SECRET ||
  "";
const REQUEST_TIMEOUT_MS = Number(
  process.env.FIELD_SMOKE_REQUEST_TIMEOUT_MS || process.env.SMOKE_REQUEST_TIMEOUT_MS || 20000
);
const MAX_HEALTH_WAIT_MS = Number(
  process.env.FIELD_SMOKE_MAX_HEALTH_WAIT_MS || process.env.SMOKE_MAX_HEALTH_WAIT_MS || 120000
);
const HEALTH_POLL_MS = Number(
  process.env.FIELD_SMOKE_HEALTH_POLL_MS || process.env.SMOKE_HEALTH_POLL_MS || 1500
);
const MAX_AVAILABILITY_WAIT_MS = Number(
  process.env.FIELD_SMOKE_MAX_AVAILABILITY_WAIT_MS ||
    process.env.SMOKE_MAX_AVAILABILITY_WAIT_MS ||
    180000
);
const MAX_MONTH_LOOKAHEAD = Number(process.env.FIELD_SMOKE_MAX_MONTH_LOOKAHEAD || 6);
const ACCESS_KEY =
  getEnvValue("FIELD_SMOKE_ACCESS_KEY") ||
  getEnvValue("FIELD_TEST_INTAKE_SECRET") ||
  getEnvValue("FIELD_INTAKE_SECRET");
const CUSTOMER_PHONE =
  getEnvValue("FIELD_SMOKE_CUSTOMER_PHONE") ||
  getEnvValue("FIELD_TEST_FORCE_OUTBOUND_PHONE") ||
  getEnvValue("FIELD_TEST_OWNER_PHONE") ||
  getEnvValue("FIELD_OWNER_PHONE");
let authCookieHeader = String(
  process.env.FIELD_SMOKE_COOKIE_HEADER || process.env.SMOKE_COOKIE_HEADER || ""
).trim();

const monthParamFromDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs, message) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]);
};

const extractCookiePair = (setCookieValue) => String(setCookieValue || "").split(";")[0].trim();

const mergeCookieHeaders = (currentHeader, setCookieValues) => {
  const cookieMap = new Map();

  for (const cookieEntry of String(currentHeader || "")
    .split(/;\s*/)
    .map((token) => token.trim())
    .filter(Boolean)) {
    const [name] = cookieEntry.split("=");
    if (name) {
      cookieMap.set(name, cookieEntry);
    }
  }

  for (const setCookieValue of setCookieValues) {
    const cookiePair = extractCookiePair(setCookieValue);
    if (!cookiePair) {
      continue;
    }
    const [name] = cookiePair.split("=");
    if (name) {
      cookieMap.set(name, cookiePair);
    }
  }

  return Array.from(cookieMap.values()).join("; ");
};

const getSetCookieValues = (response) => {
  if (!response?.headers) {
    return [];
  }

  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie().filter(Boolean);
  }

  const combinedHeader = response.headers.get("set-cookie");
  return combinedHeader ? [combinedHeader] : [];
};

const bootstrapAuthCookies = async () => {
  if (!AUTH_SHARE_URL || authCookieHeader) {
    return;
  }

  let currentUrl = AUTH_SHARE_URL;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await withTimeout(
      fetch(currentUrl, {
        redirect: "manual",
        headers: authCookieHeader
          ? {
              Cookie: authCookieHeader,
            }
          : undefined,
      }),
      REQUEST_TIMEOUT_MS,
      `Auth bootstrap timed out: ${currentUrl}`
    );

    authCookieHeader = mergeCookieHeaders(authCookieHeader, getSetCookieValues(response));

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    break;
  }

  if (!authCookieHeader) {
    throw new Error("Field smoke auth bootstrap did not return any cookies.");
  }
};

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (authCookieHeader) {
    headers.set("Cookie", authCookieHeader);
  }
  if (VERCEL_BYPASS_SECRET) {
    headers.set("x-vercel-protection-bypass", VERCEL_BYPASS_SECRET);
  }

  const response = await withTimeout(
    fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    }),
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

const requestJson = (path, method, payload) =>
  request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

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
      // Keep polling until the server is reachable.
    }

    await sleep(HEALTH_POLL_MS);
  }

  throw new Error(
    `Field smoke health check did not pass within ${Math.round(MAX_HEALTH_WAIT_MS / 1000)} seconds.`
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

const parseFieldBookingLink = (link) => {
  const url = new URL(String(link || ""));
  const pathnameParts = url.pathname.split("/").filter(Boolean);
  return {
    leadId: String(pathnameParts[pathnameParts.length - 1] || "").trim(),
    token: String(url.searchParams.get("token") || "").trim(),
    rawUrl: url.toString(),
  };
};

const parseManageLink = (link) => {
  const url = new URL(String(link || ""));
  return {
    eventId: String(url.searchParams.get("eventId") || "").trim(),
    actor: String(url.searchParams.get("actor") || "").trim().toLowerCase(),
    token: String(url.searchParams.get("token") || "").trim(),
    rawUrl: url.toString(),
  };
};

const loadFieldContext = ({ leadId, token }) => {
  const params = new URLSearchParams({ token });
  return request(`/api/field/leads/${encodeURIComponent(leadId)}/context?${params.toString()}`);
};

const loadFieldAvailability = ({ leadId, token, month }) => {
  const params = new URLSearchParams({ token, month });
  return request(
    `/api/field/leads/${encodeURIComponent(leadId)}/availability?${params.toString()}`
  );
};

const findFieldSlots = async ({ leadId, token, requiredSlots = 2 }) => {
  const deadline = Date.now() + MAX_AVAILABILITY_WAIT_MS;
  while (Date.now() < deadline) {
    for (let monthOffset = 0; monthOffset < MAX_MONTH_LOOKAHEAD; monthOffset += 1) {
      const candidateDate = new Date();
      candidateDate.setMonth(candidateDate.getMonth() + monthOffset);
      const month = monthParamFromDate(candidateDate);
      const availability = await loadFieldAvailability({
        leadId,
        token,
        month,
      });

      if (availability.status !== 200) {
        continue;
      }

      const slots = flattenSlots(availability.body?.availabilityByDate || {});
      if (slots.length >= requiredSlots) {
        return {
          month,
          timezone: availability.body?.timezone || "America/Toronto",
          slots,
        };
      }
    }

    await sleep(2000);
  }

  throw new Error(
    `Unable to find at least ${requiredSlots} field slots in the next ${MAX_MONTH_LOOKAHEAD} months.`
  );
};

const loadManageContext = ({ eventId, actor, token }) => {
  const params = new URLSearchParams({ eventId, actor, token });
  return request(`/api/calendar/manage/context?${params.toString()}`);
};

const createLeadPayload = ({ repId, label }) => {
  const timestamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return {
    accessKey: ACCESS_KEY,
    repId,
    fullName: `${label} ${timestamp}`,
    phone: CUSTOMER_PHONE,
    address: `${Math.floor(Math.random() * 900) + 100} Demo Street`,
    projectNotes: `Automated field smoke validation for ${label.toLowerCase()}.`,
  };
};

const main = async () => {
  if (!ACCESS_KEY) {
    throw new Error(
      "Field smoke test needs FIELD_SMOKE_ACCESS_KEY or FIELD_TEST_INTAKE_SECRET in the environment."
    );
  }

  if (!CUSTOMER_PHONE) {
    throw new Error(
      "Field smoke test needs FIELD_SMOKE_CUSTOMER_PHONE or a field test owner/override phone in the environment."
    );
  }

  const report = {
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    assertions: [],
    warnings: [],
    leads: [],
    bookings: [],
    finalStatus: "unknown",
  };

  const cleanupTargets = [];
  const pushAssertion = (name) => {
    report.assertions.push({
      name,
      passed: true,
      at: new Date().toISOString(),
    });
  };

  const registerCleanupTarget = (bookingBody) => {
    const carterLink = bookingBody?.booking?.manageLinks?.carter;
    if (!carterLink) {
      return;
    }

    const creds = parseManageLink(carterLink);
    if (!creds.eventId || !creds.token) {
      return;
    }

    cleanupTargets.push(creds);
  };

  const clearCleanupTarget = (eventId) => {
    const index = cleanupTargets.findIndex((target) => target.eventId === eventId);
    if (index >= 0) {
      cleanupTargets.splice(index, 1);
    }
  };

  try {
    await bootstrapAuthCookies();

    const health = await waitForHealth();
    assert.equal(health.ok, true, "field health.ok should be true");
    assert.equal(health.fieldLeadConfigured, true, "field lane should be configured for smoke test");
    assert.equal(health.fieldLeadLocalOnly, true, "field smoke should run only against the non-production lane");
    pushAssertion("health endpoint reports configured preview/local field lane");

    if (!health.fieldLeadPreviewOutboundOverrideEnabled) {
      report.warnings.push(
        "Preview outbound override is disabled. Smoke notifications will use the configured field test phone/email values."
      );
    } else {
      pushAssertion("preview outbound override is enabled");
    }

    const config = await request(
      `/api/field/config?${new URLSearchParams({ accessKey: ACCESS_KEY }).toString()}`
    );
    expectStatus(config, 200, "field config load");
    assert.equal(Array.isArray(config.body?.repOptions), true, "rep options must be an array");
    assert.equal(config.body.repOptions.length > 0, true, "at least one rep option is required");
    pushAssertion("field config loads with at least one rep");

    const repId = String(config.body.repOptions[0].id || "").trim();
    assert.ok(repId, "first rep option must include an id");

    const leadCreateA = await requestJson("/api/field/leads", "POST", createLeadPayload({
      repId,
      label: "Field Smoke Alpha",
    }));
    const leadCreateB = await requestJson("/api/field/leads", "POST", createLeadPayload({
      repId,
      label: "Field Smoke Bravo",
    }));

    expectStatus(leadCreateA, 200, "field lead A create");
    expectStatus(leadCreateB, 200, "field lead B create");
    assert.ok(leadCreateA.body?.manualTest?.bookingLink, "lead A should expose preview manual test link");
    assert.ok(leadCreateB.body?.manualTest?.bookingLink, "lead B should expose preview manual test link");
    pushAssertion("preview create responses expose manual test booking links");

    const leadA = parseFieldBookingLink(leadCreateA.body.manualTest.bookingLink);
    const leadB = parseFieldBookingLink(leadCreateB.body.manualTest.bookingLink);
    assert.ok(leadA.leadId && leadA.token, "lead A booking link must contain leadId and token");
    assert.ok(leadB.leadId && leadB.token, "lead B booking link must contain leadId and token");

    report.leads.push(
      {
        leadId: leadA.leadId,
        outboundOverrideEnabled: Boolean(leadCreateA.body.manualTest.outboundOverrideEnabled),
      },
      {
        leadId: leadB.leadId,
        outboundOverrideEnabled: Boolean(leadCreateB.body.manualTest.outboundOverrideEnabled),
      }
    );

    const leadAContext = await loadFieldContext(leadA);
    expectStatus(leadAContext, 200, "field lead A context");
    assert.equal(leadAContext.body?.state, "open", "lead A should start open");
    assert.ok(leadAContext.body?.lead?.customerAddress, "lead A should retain the captured address");
    pushAssertion("field booking link loads before booking");

    const invalidLeadAContext = await loadFieldContext({
      leadId: leadA.leadId,
      token: "invalid-token",
    });
    expectStatus(invalidLeadAContext, 403, "field context invalid token");
    pushAssertion("field booking token validation rejects invalid token");

    const slotDiscovery = await findFieldSlots(leadA);
    const primarySlot = slotDiscovery.slots[0];
    const alternateSlot = slotDiscovery.slots.find((slot) => slot.startIso !== primarySlot.startIso);
    assert.ok(primarySlot, "primary field slot is required");
    assert.ok(alternateSlot, "alternate field slot is required");
    pushAssertion("found two field availability slots");

    const [bookingA, bookingB] = await Promise.all([
      requestJson(`/api/field/leads/${encodeURIComponent(leadA.leadId)}/booking`, "POST", {
        token: leadA.token,
        slotStartIso: primarySlot.startIso,
      }),
      requestJson(`/api/field/leads/${encodeURIComponent(leadB.leadId)}/booking`, "POST", {
        token: leadB.token,
        slotStartIso: primarySlot.startIso,
      }),
    ]);

    const bookingResults = [
      { id: "A", lead: leadA, response: bookingA },
      { id: "B", lead: leadB, response: bookingB },
    ];
    const successes = bookingResults.filter(
      (item) => item.response.status === 200 && item.response.body?.booking?.eventId
    );
    const failures = bookingResults.filter((item) => item.response.status !== 200);
    assert.equal(successes.length, 1, `expected exactly one successful same-slot field booking, got ${successes.length}`);
    assert.equal(failures.length, 1, `expected exactly one failed same-slot field booking, got ${failures.length}`);
    assert.equal(failures[0].response.status, 409, "losing same-slot field booking should return 409");
    pushAssertion("same-slot field concurrency allows one winner and blocks the duplicate");

    const winner = successes[0];
    const loser = failures[0];
    registerCleanupTarget(winner.response.body);
    report.bookings.push({
      scenario: "same-slot concurrency",
      winnerLeadId: winner.lead.leadId,
      loserLeadId: loser.lead.leadId,
      winnerEventId: winner.response.body.booking.eventId,
      loserStatus: loser.response.status,
    });

    const loserContextAfterConflict = await loadFieldContext(loser.lead);
    expectStatus(loserContextAfterConflict, 200, "loser field context after conflict");
    assert.equal(loserContextAfterConflict.body?.state, "open", "losing field lead should remain open after conflict");
    pushAssertion("losing field lead remains bookable after a same-slot conflict");

    const winnerClientManage = parseManageLink(winner.response.body.booking.manageLinks.client);
    const winnerCarterManage = parseManageLink(winner.response.body.booking.manageLinks.carter);
    const winnerClientContext = await loadManageContext(winnerClientManage);
    const winnerCarterContext = await loadManageContext(winnerCarterManage);
    expectStatus(winnerClientContext, 200, "winner client manage context");
    expectStatus(winnerCarterContext, 200, "winner carter manage context");
    pushAssertion("field booking wires both shared manage links");

    const mutationCreds = winnerClientContext.body?.permissions?.canReschedule
      ? winnerClientManage
      : winnerCarterManage;
    const mutationActor = winnerClientContext.body?.permissions?.canReschedule ? "client" : "carter";

    const rescheduleWinner = await requestJson("/api/calendar/manage/reschedule", "POST", {
      eventId: winner.response.body.booking.eventId,
      actor: mutationActor,
      token: mutationCreds.token,
      reason: "Automated field smoke reschedule validation.",
      newSlotStartIso: alternateSlot.startIso,
    });
    expectStatus(rescheduleWinner, 200, "winner field booking reschedule");
    assert.equal(
      rescheduleWinner.body?.booking?.startIso,
      alternateSlot.startIso,
      "winner field booking should reschedule to the requested alternate slot"
    );
    pushAssertion("field booking can be rescheduled through the shared manage route");

    const cancelWinner = await requestJson("/api/calendar/manage/cancel", "POST", {
      eventId: winner.response.body.booking.eventId,
      actor: mutationActor,
      token: mutationCreds.token,
      reason: "Automated field smoke cancellation cleanup.",
    });
    expectStatus(cancelWinner, 200, "winner field booking cancel");
    clearCleanupTarget(winner.response.body.booking.eventId);
    pushAssertion("field booking can be cancelled through the shared manage route");

    const finalWinnerFieldContext = await loadFieldContext(winner.lead);
    expectStatus(finalWinnerFieldContext, 200, "winner field context after cancel");
    assert.equal(finalWinnerFieldContext.body?.state, "closed", "winner field context should close after cancellation");
    assert.equal(finalWinnerFieldContext.body?.status, "cancelled", "winner field context should show cancelled status");
    pushAssertion("field booking page reflects cancelled shared-manage updates");

    const loserAvailabilityAfterRelease = await findFieldSlots({
      ...loser.lead,
      requiredSlots: 1,
    });
    const loserRebookSlot =
      loserAvailabilityAfterRelease.slots.find((slot) => slot.startIso === primarySlot.startIso) ||
      loserAvailabilityAfterRelease.slots[0];
    assert.ok(loserRebookSlot, "losing field lead should have an available rebook slot after winner cleanup");

    const loserBook = await requestJson(
      `/api/field/leads/${encodeURIComponent(loser.lead.leadId)}/booking`,
      "POST",
      {
        token: loser.lead.token,
        slotStartIso: loserRebookSlot.startIso,
      }
    );
    expectStatus(loserBook, 200, "loser field lead rebook after released slot");
    registerCleanupTarget(loserBook.body);
    pushAssertion("losing field lead can still book after the conflicting slot is released");

    const loserCarterManage = parseManageLink(loserBook.body.booking.manageLinks.carter);
    const cancelLoser = await requestJson("/api/calendar/manage/cancel", "POST", {
      eventId: loserBook.body.booking.eventId,
      actor: "carter",
      token: loserCarterManage.token,
      reason: "Automated field smoke secondary cleanup.",
    });
    expectStatus(cancelLoser, 200, "loser field booking cancel");
    clearCleanupTarget(loserBook.body.booking.eventId);
    pushAssertion("secondary field booking cleanup succeeded");

    const finalLoserFieldContext = await loadFieldContext(loser.lead);
    expectStatus(finalLoserFieldContext, 200, "loser field context after cleanup cancel");
    assert.equal(finalLoserFieldContext.body?.state, "closed", "loser field context should close after cancellation");
    assert.equal(finalLoserFieldContext.body?.status, "cancelled", "loser field context should show cancelled status");
    pushAssertion("field booking page closes correctly after follow-up cleanup booking");

    report.finalStatus = "passed";
    report.completedAt = new Date().toISOString();
    if (AUTH_SHARE_URL) {
      report.authenticatedPreview = Boolean(authCookieHeader);
    }
    if (VERCEL_BYPASS_SECRET) {
      report.usedVercelProtectionBypass = true;
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    for (const target of cleanupTargets) {
      try {
        await requestJson("/api/calendar/manage/cancel", "POST", {
          eventId: target.eventId,
          actor: "carter",
          token: target.token,
          reason: "Automated field smoke cleanup.",
        });
      } catch {
        // Ignore best-effort cleanup failures.
      }
    }
  }
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
