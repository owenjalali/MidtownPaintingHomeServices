import "dotenv/config";
import { randomBytes } from "node:crypto";
import { google } from "googleapis";
import { DateTime } from "luxon";

const MANAGE_CLIENT_TOKEN_KEY = "mp_client_token";
const MANAGE_CARTER_TOKEN_KEY = "mp_carter_token";
const MANAGE_CLIENT_NAME_KEY = "mp_client_name";
const MANAGE_CLIENT_EMAIL_KEY = "mp_client_email";
const MANAGE_CLIENT_PHONE_KEY = "mp_client_phone";

const EVENT_SUMMARY_PREFIX = "Midtown Painting Home Services - 15-Min Consultation";
const REQUIRED_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_CALENDAR_ID",
];

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const LOOKAHEAD_DAYS = Number(process.env.BACKFILL_LOOKAHEAD_DAYS || 120);

const missingEnv = REQUIRED_ENV.filter((key) => !String(process.env[key] || "").trim());
if (missingEnv.length > 0) {
  throw new Error(`Missing required env vars for calendar backfill: ${missingEnv.join(", ")}`);
}

const normalizePhoneForTwilio = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  if (raw.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) {
      return null;
    }
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
};

const extractPhoneFromDescription = (description) => {
  const text = String(description || "");
  const phoneLine = text
    .split("\n")
    .find((line) => String(line).toLowerCase().startsWith("phone:"));
  if (!phoneLine) {
    return null;
  }

  return normalizePhoneForTwilio(phoneLine.slice("phone:".length));
};

const getManageBaseUrl = () => {
  const rawBaseUrl =
    process.env.BOOKING_MANAGE_BASE_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
  try {
    const parsed = new URL(rawBaseUrl);
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:5173";
  }
};

const createManageLink = (eventId, actor, token) => {
  const url = new URL("/manage-booking", getManageBaseUrl());
  url.searchParams.set("eventId", eventId);
  url.searchParams.set("actor", actor);
  url.searchParams.set("token", token);
  return url.toString();
};

const authClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
authClient.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({
  version: "v3",
  auth: authClient,
});

const calendarId = process.env.GOOGLE_CALENDAR_ID;
const timeMin = DateTime.now().toUTC().toISO();
const timeMax = DateTime.now().plus({ days: LOOKAHEAD_DAYS }).toUTC().toISO();

const response = await calendar.events.list({
  calendarId,
  timeMin,
  timeMax,
  singleEvents: true,
  orderBy: "startTime",
  maxResults: 2500,
});

const events = response.data.items || [];
const candidates = [];

for (const event of events) {
  const eventId = String(event.id || "").trim();
  const summary = String(event.summary || "").trim();
  if (!eventId || !summary.startsWith(EVENT_SUMMARY_PREFIX)) {
    continue;
  }

  if (String(event.status || "").toLowerCase() === "cancelled") {
    continue;
  }

  const privateProps = {
    ...(event.extendedProperties?.private || {}),
  };

  const hasClientToken = Boolean(String(privateProps[MANAGE_CLIENT_TOKEN_KEY] || "").trim());
  const hasCarterToken = Boolean(String(privateProps[MANAGE_CARTER_TOKEN_KEY] || "").trim());
  if (hasClientToken && hasCarterToken) {
    continue;
  }

  const attendeeEmail =
    event.attendees?.find((attendee) => attendee.email)?.email ||
    event.organizer?.email ||
    "";
  const clientName =
    String(privateProps[MANAGE_CLIENT_NAME_KEY] || "").trim() ||
    summary.replace(EVENT_SUMMARY_PREFIX, "").replace(/^[\s-]+/, "").trim() ||
    "Client";
  const clientEmail =
    String(privateProps[MANAGE_CLIENT_EMAIL_KEY] || "").trim().toLowerCase() ||
    String(attendeeEmail || "").trim().toLowerCase();
  const clientPhone =
    normalizePhoneForTwilio(privateProps[MANAGE_CLIENT_PHONE_KEY]) ||
    extractPhoneFromDescription(event.description);

  const clientToken = hasClientToken
    ? String(privateProps[MANAGE_CLIENT_TOKEN_KEY]).trim()
    : randomBytes(24).toString("base64url");
  const carterToken = hasCarterToken
    ? String(privateProps[MANAGE_CARTER_TOKEN_KEY]).trim()
    : randomBytes(24).toString("base64url");

  privateProps[MANAGE_CLIENT_TOKEN_KEY] = clientToken;
  privateProps[MANAGE_CARTER_TOKEN_KEY] = carterToken;
  privateProps[MANAGE_CLIENT_NAME_KEY] = clientName;
  privateProps[MANAGE_CLIENT_EMAIL_KEY] = clientEmail;
  if (clientPhone) {
    privateProps[MANAGE_CLIENT_PHONE_KEY] = clientPhone;
  }

  candidates.push({
    eventId,
    summary,
    startIso: String(event.start?.dateTime || event.start?.date || ""),
    hasClientToken,
    hasCarterToken,
    privateProps,
    manageLinks: {
      client: createManageLink(eventId, "client", clientToken),
      carter: createManageLink(eventId, "carter", carterToken),
    },
  });
}

let appliedCount = 0;
if (APPLY) {
  for (const candidate of candidates) {
    await calendar.events.patch({
      calendarId,
      eventId: candidate.eventId,
      sendUpdates: "none",
      requestBody: {
        extendedProperties: {
          private: candidate.privateProps,
        },
      },
    });
    appliedCount += 1;
  }
}

const summary = {
  mode: APPLY ? "apply" : "dry-run",
  scannedEvents: events.length,
  candidateEvents: candidates.length,
  appliedEvents: appliedCount,
  lookaheadDays: LOOKAHEAD_DAYS,
  sample: candidates.slice(0, 5).map((candidate) => ({
    eventId: candidate.eventId,
    startIso: candidate.startIso,
    summary: candidate.summary,
    hadClientToken: candidate.hasClientToken,
    hadCarterToken: candidate.hasCarterToken,
  })),
};

console.log(JSON.stringify(summary, null, 2));
