import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { runs, tasks } from "@trigger.dev/sdk";
import { google } from "googleapis";
import { DateTime } from "luxon";

const app = express();

const PORT = Number(process.env.PORT || 8787);
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_FILES = Number(process.env.MAX_UPLOAD_FILES || 8);
const TRIGGER_SAFE_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MONTH_QUERY_PATTERN = /^\d{4}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const REPEATING_DIGIT_PATTERN = /^(\d)\1{6,}$/;
const REPEATING_BLOCK_PATTERN = /^(\d{2,4})\1{2,}$/;
const REQUIRED_TRIGGER_ENV_VARS = ["TRIGGER_SECRET_KEY"];
const REQUIRED_SMTP_ENV_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "QUOTE_TO_EMAIL"];
const REQUIRED_TWILIO_ENV_VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"];
const REQUIRED_GOOGLE_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_CALENDAR_ID",
];
const MANAGE_CLIENT_TOKEN_KEY = "mp_client_token";
const MANAGE_CARTER_TOKEN_KEY = "mp_carter_token";
const MANAGE_CLIENT_NAME_KEY = "mp_client_name";
const MANAGE_CLIENT_EMAIL_KEY = "mp_client_email";
const MANAGE_CLIENT_PHONE_KEY = "mp_client_phone";
const MANAGE_REASON_MAX_LENGTH = 500;
const DEFAULT_SELF_SERVICE_CUTOFF_MINUTES = 12 * 60;
const DEFAULT_BOOKING_TIMEZONE = "America/Toronto";
const DEFAULT_BOOKING_DURATION_MINUTES = 15;
const DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES = 15;
const DEFAULT_BOOKING_MIN_NOTICE_MINUTES = 120;
const DEFAULT_DAY_START_MINUTES = 9 * 60;
const DEFAULT_DAY_END_MINUTES = 21 * 60;
const DEFAULT_DAY_START_CLOCK = "09:00";
const DEFAULT_DAY_END_CLOCK = "21:00";
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6, 7];
const MISSING_TRIGGER_ENV_VARS = REQUIRED_TRIGGER_ENV_VARS.filter((key) => !process.env[key]);
const MISSING_SMTP_ENV_VARS = REQUIRED_SMTP_ENV_VARS.filter((key) => !process.env[key]);
const MISSING_GOOGLE_ENV_VARS = REQUIRED_GOOGLE_ENV_VARS.filter((key) => !process.env[key]);
const DEFAULT_CALENDAR_AVAILABILITY_CACHE_TTL_MS = 2 * 60 * 1000;
const parsedAvailabilityCacheTtlMs = Number(
  process.env.CALENDAR_AVAILABILITY_CACHE_TTL_MS || DEFAULT_CALENDAR_AVAILABILITY_CACHE_TTL_MS
);
const CALENDAR_AVAILABILITY_CACHE_TTL_MS =
  Number.isFinite(parsedAvailabilityCacheTtlMs) && parsedAvailabilityCacheTtlMs >= 0
    ? Math.floor(parsedAvailabilityCacheTtlMs)
    : DEFAULT_CALENDAR_AVAILABILITY_CACHE_TTL_MS;
const DEFAULT_MANAGE_CONTEXT_CACHE_TTL_MS = 45 * 1000;
const parsedManageContextCacheTtlMs = Number(
  process.env.MANAGE_CONTEXT_CACHE_TTL_MS || DEFAULT_MANAGE_CONTEXT_CACHE_TTL_MS
);
const MANAGE_CONTEXT_CACHE_TTL_MS =
  Number.isFinite(parsedManageContextCacheTtlMs) && parsedManageContextCacheTtlMs >= 0
    ? Math.floor(parsedManageContextCacheTtlMs)
    : DEFAULT_MANAGE_CONTEXT_CACHE_TTL_MS;
const DEFAULT_CALENDAR_WARM_INTERVAL_MS = 45 * 1000;
const parsedCalendarWarmIntervalMs = Number(
  process.env.CALENDAR_WARM_INTERVAL_MS || DEFAULT_CALENDAR_WARM_INTERVAL_MS
);
const CALENDAR_WARM_INTERVAL_MS =
  Number.isFinite(parsedCalendarWarmIntervalMs) && parsedCalendarWarmIntervalMs >= 0
    ? Math.floor(parsedCalendarWarmIntervalMs)
    : DEFAULT_CALENDAR_WARM_INTERVAL_MS;
const CALENDAR_WARM_MONTH_LOOKAHEAD = Math.max(
  0,
  Math.floor(Number(process.env.CALENDAR_WARM_MONTH_LOOKAHEAD || 1))
);
const DEFAULT_BOOKING_SLOT_LOCK_TTL_MS = 30 * 1000;
const parsedBookingSlotLockTtlMs = Number(
  process.env.BOOKING_SLOT_LOCK_TTL_MS || DEFAULT_BOOKING_SLOT_LOCK_TTL_MS
);
const BOOKING_SLOT_LOCK_TTL_MS =
  Number.isFinite(parsedBookingSlotLockTtlMs) && parsedBookingSlotLockTtlMs > 0
    ? Math.floor(parsedBookingSlotLockTtlMs)
    : DEFAULT_BOOKING_SLOT_LOCK_TTL_MS;
const calendarAvailabilityCache = new Map();
const calendarAvailabilityInFlight = new Map();
const manageContextCache = new Map();
const bookingSlotLocks = new Map();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: MAX_UPLOAD_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("ONLY_IMAGE_FILES"));
  },
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value) => String(value ?? "").trim();
const normalizeDigits = (value) => normalizeText(value).replace(/\D/g, "");
const normalizeCountry = (country) => normalizeText(country).toUpperCase();
const PROJECT_TYPE_LABELS = Object.freeze({
  interior: "Interior Painting",
  exterior: "Exterior Painting",
  both: "Both Interior & Exterior",
  "wood-staining": "Wood Staining",
  other: "Other / Not Sure",
});
const PROJECT_TYPE_ALIASES = Object.freeze({
  interior: "interior",
  "interior painting": "interior",
  exterior: "exterior",
  "exterior painting": "exterior",
  both: "both",
  "both interior & exterior": "both",
  "both interior/exterior": "both",
  "both interior and exterior": "both",
  "interior & exterior": "both",
  "interior/exterior": "both",
  "interior and exterior": "both",
  "wood-staining": "wood-staining",
  woodstaining: "wood-staining",
  "wood staining": "wood-staining",
  "wood stain": "wood-staining",
  wood: "wood-staining",
  other: "other",
  "not sure": "other",
  "other / not sure": "other",
});

const normalizeProjectType = (projectType) => {
  const normalized = normalizeText(projectType);
  if (!normalized) {
    return "";
  }

  const key = normalized.toLowerCase();
  if (PROJECT_TYPE_LABELS[key]) {
    return PROJECT_TYPE_LABELS[key];
  }

  const canonicalKey = PROJECT_TYPE_ALIASES[key];
  return canonicalKey ? PROJECT_TYPE_LABELS[canonicalKey] : normalized;
};

const normalizePostalCode = (postalCode, country) => {
  const compact = normalizeText(postalCode).toUpperCase().replace(/\s+/g, " ");
  if (normalizeCountry(country) === "CA") {
    const noSpaces = compact.replace(/\s+/g, "");
    if (noSpaces.length >= 6) {
      return `${noSpaces.slice(0, 3)} ${noSpaces.slice(3, 6)}`;
    }
  }

  return compact;
};

const isValidPostalCode = (postalCode, country) => {
  const normalizedCountry = normalizeCountry(country);
  if (normalizedCountry === "CA") {
    return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(postalCode);
  }

  if (normalizedCountry === "US") {
    return /^\d{5}(-\d{4})?$/.test(postalCode);
  }

  if (normalizedCountry === "UK") {
    return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(postalCode);
  }

  return postalCode.trim().length >= 3;
};

const isValidEmailAddress = (email) => {
  const normalizedEmail = normalizeText(email).toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return false;
  }

  if (normalizedEmail.includes("..")) {
    return false;
  }

  const [localPart = "", domainPart = ""] = normalizedEmail.split("@");
  if (!localPart || !domainPart) {
    return false;
  }

  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    domainPart.startsWith("-") ||
    domainPart.endsWith("-")
  ) {
    return false;
  }

  return true;
};

const normalizePhoneForTwilio = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const digits = normalizeDigits(raw);
  if (!digits) {
    return null;
  }

  if (REPEATING_DIGIT_PATTERN.test(digits) || REPEATING_BLOCK_PATTERN.test(digits)) {
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

const getMissingEnvVars = (keys) =>
  keys.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

const parseBoolean = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return fallback;
};

const formatBudgetLabel = (budget) => {
  const numericBudget = Number(budget);
  if (!budget || Number.isNaN(numericBudget) || numericBudget <= 0) {
    return "Not provided";
  }
  return `$${numericBudget.toLocaleString()}+`;
};

const normalizeManageReason = (value) => String(value || "").replace(/\s+/g, " ").trim();

const requireManageReason = (value, actionName) => {
  const normalized = normalizeManageReason(value);
  if (!normalized) {
    throw new Error(`Please provide a ${actionName} reason.`);
  }
  return normalized.slice(0, MANAGE_REASON_MAX_LENGTH);
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

const createManageToken = () => randomBytes(24).toString("base64url");

const buildManageBookingLink = (eventId, actor, token) => {
  const url = new URL("/manage-booking", getManageBaseUrl());
  url.searchParams.set("eventId", eventId);
  url.searchParams.set("actor", actor);
  url.searchParams.set("token", token);
  return url.toString();
};

const appendAuditTrail = (description, lines) => {
  const existing = String(description || "").trimEnd();
  const section = ["", "----", ...lines].join("\n");
  return existing ? `${existing}${section}` : lines.join("\n");
};

const getOwnerBookingEmail = () => process.env.BOOKING_OWNER_EMAIL || process.env.QUOTE_TO_EMAIL || "";

const getGoogleSendUpdatesMode = () => {
  const configured = String(process.env.BOOKING_GOOGLE_SEND_UPDATES || "none").trim();
  if (configured === "all" || configured === "externalOnly" || configured === "none") {
    return configured;
  }
  return "none";
};

const getNotificationChannelAvailability = () => {
  const missingSmtpVars = getMissingEnvVars(REQUIRED_SMTP_ENV_VARS);
  const missingTwilioVars = getMissingEnvVars(REQUIRED_TWILIO_ENV_VARS);
  return {
    emailEnabled: missingSmtpVars.length === 0,
    smsEnabled: missingTwilioVars.length === 0,
  };
};

const getRunIdFromHandle = (handle) => {
  if (!handle || typeof handle !== "object") {
    return null;
  }
  const maybeRunId = handle.id;
  return typeof maybeRunId === "string" && maybeRunId ? maybeRunId : null;
};

const normalizeLeadPayload = (input) => {
  const fullName = normalizeText(input.fullName);
  const email = normalizeText(input.email).toLowerCase();
  const addressLine1 = normalizeText(input.addressLine1);
  const city = normalizeText(input.city);
  const country = normalizeCountry(input.country);
  const provinceState = normalizeText(input.provinceState);
  const postalCode = normalizePostalCode(input.postalCode, country);
  const projectType = normalizeProjectType(input.projectType);
  const projectDetails = normalizeText(input.projectDetails);
  const callGoal = normalizeText(input.callGoal);
  const budget = normalizeText(input.budget);
  const phoneCountryCode = normalizeText(input.phoneCountryCode);
  const phoneNationalNumber = normalizeDigits(input.phoneNationalNumber);
  const fallbackPhone = `${phoneCountryCode} ${phoneNationalNumber}`.trim();
  const phone = normalizePhoneForTwilio(normalizeText(input.phone) || fallbackPhone);

  return {
    fullName,
    phone,
    phoneCountryCode,
    phoneNationalNumber,
    email,
    addressLine1,
    city,
    postalCode,
    country,
    provinceState,
    projectType,
    projectDetails,
    budget,
    callGoal,
  };
};

const parseClockToMinutes = (value, fallbackMinutes) => {
  const [hourToken, minuteToken] = String(value || "").split(":");
  const hour = Number(hourToken);
  const minute = Number(minuteToken);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return fallbackMinutes;
  }
  return hour * 60 + minute;
};

const parseWorkingDays = (value) => {
  const parsed = new Set(
    String(value || DEFAULT_WORKING_DAYS.join(","))
      .split(",")
      .map((token) => Number(String(token || "").trim()))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
  );
  if (parsed.size === 0) {
    return new Set(DEFAULT_WORKING_DAYS);
  }
  return parsed;
};

const normalizeBookingWindow = (options) => {
  let dayStartMinutes = parseClockToMinutes(
    options?.dayStart || DEFAULT_DAY_START_CLOCK,
    DEFAULT_DAY_START_MINUTES
  );
  let dayEndMinutes = parseClockToMinutes(
    options?.dayEnd || DEFAULT_DAY_END_CLOCK,
    DEFAULT_DAY_END_MINUTES
  );
  if (dayEndMinutes <= dayStartMinutes) {
    dayStartMinutes = DEFAULT_DAY_START_MINUTES;
    dayEndMinutes = DEFAULT_DAY_END_MINUTES;
  }
  return {
    dayStartMinutes,
    dayEndMinutes,
    workingDays: parseWorkingDays(options?.workingDays),
  };
};

const getBookingSettings = () => {
  const timezone = process.env.BOOKING_TIMEZONE || DEFAULT_BOOKING_TIMEZONE;
  const durationMinutes = Number(process.env.BOOKING_DURATION_MINUTES || DEFAULT_BOOKING_DURATION_MINUTES);
  const slotIntervalMinutes = Number(
    process.env.BOOKING_SLOT_INTERVAL_MINUTES || DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES
  );
  const minNoticeMinutes = Number(process.env.BOOKING_MIN_NOTICE_MINUTES || DEFAULT_BOOKING_MIN_NOTICE_MINUTES);
  const { dayStartMinutes, dayEndMinutes, workingDays } = normalizeBookingWindow({
    dayStart: process.env.BOOKING_DAY_START,
    dayEnd: process.env.BOOKING_DAY_END,
    workingDays: process.env.BOOKING_WORKING_DAYS,
  });

  return {
    timezone,
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : DEFAULT_BOOKING_DURATION_MINUTES,
    slotIntervalMinutes:
      Number.isFinite(slotIntervalMinutes) && slotIntervalMinutes > 0
        ? slotIntervalMinutes
        : DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES,
    minNoticeMinutes: Number.isFinite(minNoticeMinutes) && minNoticeMinutes >= 0 ? minNoticeMinutes : DEFAULT_BOOKING_MIN_NOTICE_MINUTES,
    dayStartMinutes,
    dayEndMinutes,
    workingDays,
  };
};

const getCalendarClient = () => {
  const authClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  authClient.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return google.calendar({
    version: "v3",
    auth: authClient,
  });
};

const getBusyIntervals = async (calendarClient, calendarId, timezone, timeMinIso, timeMaxIso) => {
  const response = await calendarClient.freebusy.query({
    requestBody: {
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      timeZone: timezone,
      items: [{ id: calendarId }],
    },
  });

  const busyPeriods = response.data.calendars?.[calendarId]?.busy ?? [];
  return busyPeriods
    .map((period) => {
      const start = DateTime.fromISO(period.start || "", { setZone: true });
      const end = DateTime.fromISO(period.end || "", { setZone: true });
      if (!start.isValid || !end.isValid || end <= start) {
        return null;
      }
      return {
        startMs: start.toMillis(),
        endMs: end.toMillis(),
      };
    })
    .filter((period) => Boolean(period));
};

const isSlotWithinBookingWindow = (options) =>
  options.workingDays.has(options.weekday) &&
  options.slotStartMinutes >= options.dayStartMinutes &&
  options.slotEndMinutes <= options.dayEndMinutes;

const slotOverlapsBusyInterval = (slotStartMs, slotEndMs, busyIntervals) =>
  busyIntervals.some((busy) => slotStartMs < busy.endMs && slotEndMs > busy.startMs);

const buildAvailabilityForMonthDirect = async (month) => {
  const settings = getBookingSettings();
  const monthStart = DateTime.fromFormat(month, "yyyy-MM", { zone: settings.timezone }).startOf("month");
  if (!monthStart.isValid) {
    throw new Error("Month must be in YYYY-MM format.");
  }

  const monthEnd = monthStart.endOf("month");
  const calendarClient = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const busyIntervals = await getBusyIntervals(
    calendarClient,
    calendarId,
    settings.timezone,
    monthStart.startOf("day").toUTC().toISO(),
    monthEnd.endOf("day").toUTC().toISO()
  );

  const nowWithNotice = DateTime.now().setZone(settings.timezone).plus({
    minutes: settings.minNoticeMinutes,
  });

  const availabilityByDate = {};
  const availableDates = [];

  for (
    let dayCursor = monthStart.startOf("day");
    dayCursor.toMillis() <= monthEnd.toMillis();
    dayCursor = dayCursor.plus({ days: 1 })
  ) {
    const dateKey = dayCursor.toISODate();
    availabilityByDate[dateKey] = [];
    if (!settings.workingDays.has(dayCursor.weekday)) {
      continue;
    }

    const dayStart = dayCursor.startOf("day").plus({ minutes: settings.dayStartMinutes });
    const dayEnd = dayCursor.startOf("day").plus({ minutes: settings.dayEndMinutes });
    for (
      let slotStart = dayStart;
      slotStart.plus({ minutes: settings.durationMinutes }) <= dayEnd;
      slotStart = slotStart.plus({ minutes: settings.slotIntervalMinutes })
    ) {
      if (slotStart <= nowWithNotice) {
        continue;
      }

      const slotEnd = slotStart.plus({ minutes: settings.durationMinutes });
      const slotStartMs = slotStart.toUTC().toMillis();
      const slotEndMs = slotEnd.toUTC().toMillis();
      if (slotOverlapsBusyInterval(slotStartMs, slotEndMs, busyIntervals)) {
        continue;
      }

      availabilityByDate[dateKey].push({
        startIso: slotStart.toUTC().toISO(),
        endIso: slotEnd.toUTC().toISO(),
        label: slotStart.toFormat("h:mm a"),
      });
    }

    if (availabilityByDate[dateKey].length > 0) {
      availableDates.push(dateKey);
    }
  }

  return {
    month,
    timezone: settings.timezone,
    durationMinutes: settings.durationMinutes,
    availabilityByDate,
    availableDates,
  };
};

const normalizeManageActor = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "client" || normalized === "carter") {
    return normalized;
  }
  return null;
};

const getSelfServiceCutoffMinutes = () => {
  const configuredMinutes = Number(
    process.env.BOOKING_SELF_SERVICE_CUTOFF_MINUTES || DEFAULT_SELF_SERVICE_CUTOFF_MINUTES
  );
  if (!Number.isFinite(configuredMinutes) || configuredMinutes < 0) {
    return DEFAULT_SELF_SERVICE_CUTOFF_MINUTES;
  }
  return Math.floor(configuredMinutes);
};

const getEventDisplayDetails = (event, fallbackTimezone) => {
  const timezone = String(event.start?.timeZone || event.end?.timeZone || "").trim() || fallbackTimezone;
  const startRaw = String(event.start?.dateTime || event.start?.date || "");
  const endRaw = String(event.end?.dateTime || event.end?.date || "");
  const start = DateTime.fromISO(startRaw, { setZone: true }).setZone(timezone);
  const end = DateTime.fromISO(endRaw, { setZone: true }).setZone(timezone);
  if (!start.isValid || !end.isValid || end <= start) {
    throw new Error("Booking details are invalid. Please contact Carter directly.");
  }
  return {
    displayDate: start.toFormat("cccc, LLLL d"),
    displayTime: `${start.toFormat("h:mm a")} (${start.offsetNameShort || timezone})`,
    timezone,
    startIso: start.toUTC().toISO(),
    endIso: end.toUTC().toISO(),
  };
};

const isGoogleNotFoundError = (error) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeCode = Number(error.code);
  const maybeStatus = Number(error.status);
  if (maybeCode === 404 || maybeStatus === 404) {
    return true;
  }
  const message = String(error.message || "").toLowerCase();
  return message.includes("not found");
};

const getCalendarEventById = async (calendarClient, calendarId, eventId) => {
  try {
    const response = await calendarClient.events.get({
      calendarId,
      eventId,
    });
    return response.data;
  } catch (error) {
    if (isGoogleNotFoundError(error)) {
      throw new Error("Booking could not be found.");
    }
    throw error;
  }
};

const normalizePrivateProps = (event) => {
  const source = event.extendedProperties?.private || {};
  return Object.entries(source).reduce((acc, [key, value]) => {
    acc[key] = String(value || "").trim();
    return acc;
  }, {});
};

const getManagePermissions = (options) => {
  const cutoffMinutes =
    Number.isFinite(options.cutoffMinutes) && options.cutoffMinutes >= 0
      ? Math.floor(options.cutoffMinutes)
      : DEFAULT_SELF_SERVICE_CUTOFF_MINUTES;
  const now = DateTime.now().setZone(options.timezone);
  const status = String(options.eventStatus || "").trim().toLowerCase();
  if (status === "cancelled") {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: false,
      reason: "This booking has already been canceled.",
    };
  }

  const start = DateTime.fromISO(String(options.startIso || ""), { setZone: true }).setZone(
    options.timezone
  );
  const end = DateTime.fromISO(String(options.endIso || ""), { setZone: true }).setZone(options.timezone);
  if (!start.isValid || !end.isValid || end <= start) {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: false,
      reason: "Booking details are invalid. Please contact Carter directly.",
    };
  }
  if (start <= now) {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: false,
      reason: "This booking has already started.",
    };
  }

  const withinCutoff = start <= now.plus({ minutes: cutoffMinutes });
  if (options.actor === "client" && withinCutoff) {
    return {
      canCancel: false,
      canReschedule: false,
      withinCutoff: true,
      reason:
        "Client updates are blocked inside the 12-hour self-service cutoff. Please contact Carter directly.",
    };
  }

  return {
    canCancel: true,
    canReschedule: true,
    withinCutoff,
    reason: null,
  };
};

const getManageEventContextDirect = async (
  payload,
  options = {
    requireCancelable: false,
    requireReschedulable: false,
  }
) => {
  const eventId = String(payload?.eventId || "").trim();
  const token = String(payload?.token || "").trim();
  const actor = normalizeManageActor(payload?.actor);
  if (!eventId || !token || !actor) {
    throw new Error("Booking management link is invalid or expired.");
  }

  const settings = getBookingSettings();
  const calendarClient = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const event = await getCalendarEventById(calendarClient, calendarId, eventId);
  const privateProps = normalizePrivateProps(event);
  const expectedToken = actor === "client" ? privateProps[MANAGE_CLIENT_TOKEN_KEY] : privateProps[MANAGE_CARTER_TOKEN_KEY];
  if (!expectedToken || token !== expectedToken) {
    throw new Error("Booking management link is invalid or expired.");
  }

  const display = getEventDisplayDetails(event, settings.timezone);
  const permissions = getManagePermissions({
    actor,
    eventStatus: event.status,
    startIso: display.startIso,
    endIso: display.endIso,
    timezone: display.timezone,
    cutoffMinutes: getSelfServiceCutoffMinutes(),
  });

  if (options.requireCancelable && !permissions.canCancel) {
    if (permissions.reason) {
      throw new Error(permissions.reason);
    }
    throw new Error("This booking cannot be updated right now.");
  }

  if (options.requireReschedulable && !permissions.canReschedule) {
    if (permissions.reason) {
      throw new Error(permissions.reason);
    }
    throw new Error("This booking cannot be updated right now.");
  }

  return {
    actor,
    eventId,
    event,
    privateProps,
    summary: String(event.summary || "Midtown Painting Home Services Consultation").trim(),
    clientName:
      String(privateProps[MANAGE_CLIENT_NAME_KEY] || "").trim() ||
      String(event.summary || "Client").trim(),
    clientEmail: String(privateProps[MANAGE_CLIENT_EMAIL_KEY] || "").trim().toLowerCase(),
    clientPhone: normalizePhoneForTwilio(privateProps[MANAGE_CLIENT_PHONE_KEY]),
    display,
    permissions,
  };
};

const queueBookingConfirmationEmail = async (payload, eventId) => {
  try {
    const handle = await tasks.trigger("booking-send-confirmation-email", payload, {
      ttl: process.env.BOOKING_CONFIRMATION_EMAIL_TTL || "2h",
    });
    console.log("[server] queued booking confirmation email task", {
      runId: getRunIdFromHandle(handle),
      eventId,
    });
  } catch (error) {
    console.warn("[server] unable to queue booking confirmation email task", {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const queueBookingReminders = async (options) => {
  const reminderRunTtl = process.env.BOOKING_REMINDER_RUN_TTL || "24h";
  const nowInBookingTimezone = DateTime.now().setZone(options.timezone);
  const reminderConfigs = [
    {
      reminderMinutesBefore: Number(process.env.BOOKING_REMINDER_1_MINUTES_BEFORE || 60),
      sendEmail: parseBoolean(process.env.BOOKING_REMINDER_1_SEND_EMAIL, true),
      sendSms: parseBoolean(process.env.BOOKING_REMINDER_1_SEND_SMS, true),
    },
    {
      reminderMinutesBefore: Number(process.env.BOOKING_REMINDER_2_MINUTES_BEFORE || 15),
      sendEmail: parseBoolean(process.env.BOOKING_REMINDER_2_SEND_EMAIL, false),
      sendSms: parseBoolean(process.env.BOOKING_REMINDER_2_SEND_SMS, true),
    },
    {
      reminderMinutesBefore: Number(process.env.BOOKING_REMINDER_3_MINUTES_BEFORE || 5),
      sendEmail: parseBoolean(process.env.BOOKING_REMINDER_3_SEND_EMAIL, false),
      sendSms: parseBoolean(process.env.BOOKING_REMINDER_3_SEND_SMS, false),
    },
  ];

  const reminderDispatches = await Promise.all(
    reminderConfigs.map(async (reminderConfig) => {
      if (!reminderConfig.sendEmail && !reminderConfig.sendSms) {
        return null;
      }
      if (
        !Number.isFinite(reminderConfig.reminderMinutesBefore) ||
        reminderConfig.reminderMinutesBefore < 1
      ) {
        console.warn("[server] skipping reminder trigger because reminder offset is invalid", {
          reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
        });
        return null;
      }

      const reminderAt = options.slotStart.minus({ minutes: reminderConfig.reminderMinutesBefore });
      const triggerOptions = {
        ttl: reminderRunTtl,
      };
      const delayApplied = reminderAt > nowInBookingTimezone;
      if (delayApplied) {
        triggerOptions.delay = reminderAt.toJSDate();
      }

      try {
        const reminderHandle = await tasks.trigger(
          "booking-send-reminder",
          {
            bookingStartIso: options.slotStart.toUTC().toISO(),
            timezone: options.timezone,
            reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
            sendEmail: reminderConfig.sendEmail,
            sendSms: reminderConfig.sendSms,
            fullName: options.fullName,
            projectType: options.projectType,
            projectDetails: options.projectDetails,
            callGoal: options.callGoal,
            addressLine1: options.addressLine1,
            city: options.city,
            postalCode: options.postalCode,
            country: options.country,
            provinceState: options.provinceState,
            clientEmail: options.clientEmail,
            clientPhone: options.clientPhone,
            ownerEmail: options.ownerEmail,
            ownerPhone: options.ownerPhone,
          },
          triggerOptions
        );
        const runId = getRunIdFromHandle(reminderHandle);
        const reminderAtIso = reminderAt.toUTC().toISO();
        return {
          reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
          sendEmail: reminderConfig.sendEmail,
          sendSms: reminderConfig.sendSms,
          reminderAtIso,
          reminderAtLabel: `${reminderAt.toFormat("cccc, LLLL d 'at' h:mm a")} (${reminderAt.offsetNameShort || options.timezone})`,
          runId,
          delayApplied,
        };
      } catch (error) {
        console.warn("[server] unable to queue booking reminder task", {
          reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })
  );

  return reminderDispatches.filter(Boolean);
};

const queueManageNotifications = async (payload, metadata) => {
  const channelAvailability = getNotificationChannelAvailability();
  let notifications = {
    emailAttempted: channelAvailability.emailEnabled,
    emailSent: false,
    smsAttempted: channelAvailability.smsEnabled,
    smsSent: false,
  };

  try {
    const handle = await tasks.trigger("booking-send-manage-notifications", payload, {
      ttl: process.env.BOOKING_MANAGE_NOTIFICATIONS_TTL || "2h",
    });
    console.log("[server] queued manage-booking notifications task", {
      runId: getRunIdFromHandle(handle),
      eventId: metadata.eventId,
      action: metadata.action,
      actor: metadata.actor,
    });
  } catch (error) {
    notifications = {
      emailAttempted: false,
      emailSent: false,
      smsAttempted: false,
      smsSent: false,
    };
    console.warn("[server] unable to queue manage-booking notifications task", {
      eventId: metadata.eventId,
      action: metadata.action,
      actor: metadata.actor,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return notifications;
};

const bookCalendarSlotDirect = async (payload) => {
  const {
    slotStartIso = "",
    fullName = "",
    phone = "",
    phoneCountryCode = "",
    phoneNationalNumber = "",
    email = "",
    addressLine1 = "",
    city = "",
    postalCode = "",
    country = "",
    provinceState = "",
    projectType = "",
    projectDetails = "",
    budget = "",
    callGoal = "",
  } = payload ?? {};

  const normalizedFullName = String(fullName || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedAddressLine1 = String(addressLine1 || "").trim();
  const normalizedCity = String(city || "").trim();
  const normalizedCountry = normalizeCountry(country);
  const normalizedProvinceState = String(provinceState || "").trim();
  const normalizedPostalCode = normalizePostalCode(postalCode, normalizedCountry);
  const normalizedProjectType = String(projectType || "").trim();
  const normalizedProjectDetails = String(projectDetails || "").trim();
  const normalizedCallGoal = String(callGoal || "").trim();
  const normalizedBudget = String(budget || "").trim();
  const normalizedPhone =
    normalizePhoneForTwilio(phone) ||
    normalizePhoneForTwilio(`${phoneCountryCode} ${phoneNationalNumber}`);

  if (
    !slotStartIso ||
    !normalizedFullName ||
    !normalizedEmail ||
    !normalizedAddressLine1 ||
    !normalizedCity ||
    !normalizedPostalCode ||
    !normalizedCountry ||
    !normalizedProvinceState ||
    !normalizedProjectType ||
    !normalizedProjectDetails
  ) {
    throw new Error("Missing required booking details.");
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    throw new Error("Please provide a valid email address.");
  }
  if (!normalizedPhone) {
    throw new Error("Please provide a valid phone number in international format.");
  }
  if (!isValidPostalCode(normalizedPostalCode, normalizedCountry)) {
    throw new Error("Please provide a valid postal code.");
  }

  const settings = getBookingSettings();
  const slotStartUtc = DateTime.fromISO(slotStartIso, { setZone: true }).toUTC();
  if (!slotStartUtc.isValid) {
    throw new Error("Selected time slot is invalid.");
  }

  const slotStart = slotStartUtc.setZone(settings.timezone);
  const slotEnd = slotStart.plus({ minutes: settings.durationMinutes });
  const slotStartMinutes = slotStart.hour * 60 + slotStart.minute;
  const slotEndMinutes = slotEnd.hour * 60 + slotEnd.minute;
  const nowWithNotice = DateTime.now().setZone(settings.timezone).plus({
    minutes: settings.minNoticeMinutes,
  });
  if (slotStart <= nowWithNotice) {
    throw new Error(`Please select a slot at least ${settings.minNoticeMinutes} minutes from now.`);
  }
  if (
    !isSlotWithinBookingWindow({
      weekday: slotStart.weekday,
      slotStartMinutes,
      slotEndMinutes,
      dayStartMinutes: settings.dayStartMinutes,
      dayEndMinutes: settings.dayEndMinutes,
      workingDays: settings.workingDays,
    })
  ) {
    throw new Error("Selected time is outside Carter's booking window.");
  }

  const calendarClient = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const busyIntervals = await getBusyIntervals(
    calendarClient,
    calendarId,
    settings.timezone,
    slotStart.minus({ minutes: 1 }).toUTC().toISO(),
    slotEnd.plus({ minutes: 1 }).toUTC().toISO()
  );
  if (
    slotOverlapsBusyInterval(
      slotStart.toUTC().toMillis(),
      slotEnd.toUTC().toMillis(),
      busyIntervals
    )
  ) {
    throw new Error("That slot was just booked. Please select another time.");
  }

  const bookingSummary = [
    "Midtown Painting Home Services Consultation",
    "",
    `Client: ${normalizedFullName}`,
    `Email: ${normalizedEmail}`,
    `Phone: ${normalizedPhone}`,
    `Address: ${normalizedAddressLine1}`,
    `City: ${normalizedCity}`,
    `Province/State: ${normalizedProvinceState}`,
    `Postal/ZIP: ${normalizedPostalCode}`,
    `Country: ${normalizedCountry}`,
    `Project type: ${normalizedProjectType}`,
    `Budget expectation: ${formatBudgetLabel(normalizedBudget)}`,
    `Call goal: ${normalizedCallGoal || "Not provided"}`,
    "",
    "Project details:",
    normalizedProjectDetails,
    "",
    `Scheduled start (${settings.timezone}): ${slotStart.toFormat("cccc, LLLL d, yyyy 'at' h:mm a")}`,
    `Scheduled end (${settings.timezone}): ${slotEnd.toFormat("cccc, LLLL d, yyyy 'at' h:mm a")}`,
  ].join("\n");

  const clientManageToken = createManageToken();
  const carterManageToken = createManageToken();
  const eventInsertResponse = await calendarClient.events.insert({
    calendarId,
    sendUpdates: getGoogleSendUpdatesMode(),
    requestBody: {
      summary: `Midtown Painting Home Services - 15-Min Consultation - ${normalizedFullName}`,
      description: bookingSummary,
      start: {
        dateTime: slotStart.toISO(),
        timeZone: settings.timezone,
      },
      end: {
        dateTime: slotEnd.toISO(),
        timeZone: settings.timezone,
      },
      attendees: [{ email: normalizedEmail }],
      reminders: {
        useDefault: true,
      },
      extendedProperties: {
        private: {
          [MANAGE_CLIENT_TOKEN_KEY]: clientManageToken,
          [MANAGE_CARTER_TOKEN_KEY]: carterManageToken,
          [MANAGE_CLIENT_NAME_KEY]: normalizedFullName,
          [MANAGE_CLIENT_EMAIL_KEY]: normalizedEmail,
          [MANAGE_CLIENT_PHONE_KEY]: normalizedPhone,
        },
      },
    },
  });

  const eventId = eventInsertResponse.data.id || null;
  const clientManageLink = eventId ? buildManageBookingLink(eventId, "client", clientManageToken) : null;
  const carterManageLink = eventId ? buildManageBookingLink(eventId, "carter", carterManageToken) : null;
  const displayDate = slotStart.toFormat("cccc, LLLL d");
  const displayTime = `${slotStart.toFormat("h:mm a")} (${slotStart.offsetNameShort || settings.timezone})`;
  const ownerEmail = getOwnerBookingEmail();

  const ownerLines = [
    `A 15-minute consultation was booked with ${normalizedFullName}.`,
    "",
    `When: ${displayDate}, ${displayTime}`,
    `Client email: ${normalizedEmail}`,
    `Client phone: ${normalizedPhone}`,
    `Address: ${normalizedAddressLine1}`,
    `City: ${normalizedCity}`,
    `Province/State: ${normalizedProvinceState}`,
    `Postal/ZIP: ${normalizedPostalCode}`,
    `Country: ${normalizedCountry}`,
    `Project type: ${normalizedProjectType}`,
    `Budget expectation: ${formatBudgetLabel(normalizedBudget)}`,
    `Call goal: ${normalizedCallGoal || "Not provided"}`,
    "",
    "Project details:",
    normalizedProjectDetails,
    "",
    `Calendar event id: ${eventId || "Unavailable"}`,
    "",
    "Manage booking (Carter):",
    carterManageLink || "Unavailable",
    "",
    "Manage booking (Client self-service):",
    clientManageLink || "Unavailable",
  ].join("\n");

  const customerLines = [
    `Hi ${normalizedFullName},`,
    "",
    "Your Midtown Painting Home Services consultation is confirmed.",
    `When: ${displayDate}, ${displayTime}`,
    `Project address: ${normalizedAddressLine1}, ${normalizedCity}, ${normalizedProvinceState} ${normalizedPostalCode}`,
    "",
    "Carter Jenkins will call you at the scheduled time.",
    "If you need to reschedule or cancel, use your manage booking link:",
    clientManageLink || "Manage link unavailable. Reply to this email for help.",
    "",
    "Thank you,",
    "Midtown Painting Home Services",
  ].join("\n");

  const [reminders] = await Promise.all([
    queueBookingReminders({
      slotStart,
      timezone: settings.timezone,
      fullName: normalizedFullName,
      projectType: normalizedProjectType,
      projectDetails: normalizedProjectDetails,
      callGoal: normalizedCallGoal,
      addressLine1: normalizedAddressLine1,
      city: normalizedCity,
      postalCode: normalizedPostalCode,
      country: normalizedCountry,
      provinceState: normalizedProvinceState,
      clientEmail: normalizedEmail,
      clientPhone: normalizedPhone,
      ownerEmail,
      ownerPhone: process.env.BOOKING_OWNER_PHONE || "",
    }),
    queueBookingConfirmationEmail(
      {
        ownerEmail,
        clientEmail: normalizedEmail,
        replyTo: normalizedEmail,
        ownerSubject: `New Phone Consultation Booked - ${normalizedFullName}`,
        ownerText: ownerLines,
        clientSubject: "Your Midtown Painting Home Services Call Is Confirmed",
        clientText: customerLines,
      },
      eventId
    ),
  ]);

  return {
    message: "Call booked successfully.",
    booking: {
      eventId,
      displayDate,
      displayTime,
      timezone: settings.timezone,
      startIso: slotStart.toUTC().toISO(),
      endIso: slotEnd.toUTC().toISO(),
      manageLinks: {
        client: clientManageLink,
        carter: carterManageLink,
      },
    },
    reminders,
  };
};

const cancelManageBookingDirect = async (payload) => {
  const reason = requireManageReason(payload.reason, "cancellation");
  const context = await getManageEventContextDirect(payload, {
    requireCancelable: true,
  });
  const calendarClient = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const actorLabel = context.actor === "client" ? "Client" : "Carter";

  await calendarClient.events.patch({
    calendarId,
    eventId: context.eventId,
    sendUpdates: getGoogleSendUpdatesMode(),
    requestBody: {
      status: "cancelled",
      description: appendAuditTrail(context.event.description, [
        `${DateTime.now()
          .setZone(context.display.timezone)
          .toFormat("yyyy-LL-dd HH:mm")} (${context.display.timezone}) - Booking canceled by ${actorLabel}.`,
        `Reason: ${reason}`,
      ]),
      extendedProperties: {
        private: context.privateProps,
      },
    },
  });

  const notifications = await queueManageNotifications(
    {
      action: "cancelled",
      actor: context.actor,
      reason,
      summary: context.summary,
      previousDisplay: context.display,
      clientName: context.clientName,
      clientEmail: context.clientEmail,
      clientPhone: context.clientPhone,
      ownerEmail: getOwnerBookingEmail(),
      ownerPhone: normalizePhoneForTwilio(process.env.BOOKING_OWNER_PHONE),
    },
    {
      eventId: context.eventId,
      action: "cancel",
      actor: context.actor,
    }
  );

  return {
    ok: true,
    message: "Booking canceled successfully.",
    actor: context.actor,
    action: "cancel",
    booking: {
      eventId: context.eventId,
      status: "cancelled",
      summary: context.summary,
      displayDate: context.display.displayDate,
      displayTime: context.display.displayTime,
      timezone: context.display.timezone,
      startIso: context.display.startIso,
      endIso: context.display.endIso,
    },
    notifications,
  };
};

const rescheduleManageBookingDirect = async (payload) => {
  const reason = requireManageReason(payload.reason, "reschedule");
  const context = await getManageEventContextDirect(payload, {
    requireReschedulable: true,
  });
  const settings = getBookingSettings();
  const calendarClient = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const newSlotStartIso = String(payload.newSlotStartIso || "").trim();
  if (!newSlotStartIso) {
    throw new Error("Please select a new time slot.");
  }

  const newStartUtc = DateTime.fromISO(newSlotStartIso, { setZone: true }).toUTC();
  if (!newStartUtc.isValid) {
    throw new Error("Selected time slot is invalid.");
  }
  const previousStartUtc = DateTime.fromISO(context.display.startIso, { setZone: true }).toUTC();
  if (!previousStartUtc.isValid) {
    throw new Error("Booking details are invalid. Please contact Carter directly.");
  }
  if (newStartUtc.toMillis() === previousStartUtc.toMillis()) {
    throw new Error("Please choose a different time from your current booking.");
  }

  const newStart = newStartUtc.setZone(settings.timezone);
  const newEnd = newStart.plus({ minutes: settings.durationMinutes });
  const newSlotStartMinutes = newStart.hour * 60 + newStart.minute;
  const newSlotEndMinutes = newEnd.hour * 60 + newEnd.minute;
  const nowInBookingTimezone = DateTime.now().setZone(settings.timezone);
  if (context.actor === "client") {
    const nowWithNotice = nowInBookingTimezone.plus({
      minutes: settings.minNoticeMinutes,
    });
    if (newStart <= nowWithNotice) {
      throw new Error(`Please select a slot at least ${settings.minNoticeMinutes} minutes from now.`);
    }
  } else if (newStart <= nowInBookingTimezone) {
    throw new Error("Please select a future slot.");
  }
  if (
    !isSlotWithinBookingWindow({
      weekday: newStart.weekday,
      slotStartMinutes: newSlotStartMinutes,
      slotEndMinutes: newSlotEndMinutes,
      dayStartMinutes: settings.dayStartMinutes,
      dayEndMinutes: settings.dayEndMinutes,
      workingDays: settings.workingDays,
    })
  ) {
    throw new Error("Selected time is outside Carter's booking window.");
  }

  const busyIntervals = await getBusyIntervals(
    calendarClient,
    calendarId,
    settings.timezone,
    newStart.minus({ minutes: 1 }).toUTC().toISO(),
    newEnd.plus({ minutes: 1 }).toUTC().toISO()
  );
  const previousEndUtc = DateTime.fromISO(context.display.endIso, { setZone: true }).toUTC();
  const previousStartMs = previousStartUtc.toMillis();
  const previousEndMs = previousEndUtc.toMillis();
  const filteredBusyIntervals = busyIntervals.filter(
    (busy) =>
      Math.abs(busy.startMs - previousStartMs) > 1000 ||
      Math.abs(busy.endMs - previousEndMs) > 1000
  );
  if (
    slotOverlapsBusyInterval(
      newStart.toUTC().toMillis(),
      newEnd.toUTC().toMillis(),
      filteredBusyIntervals
    )
  ) {
    throw new Error("That slot was just booked. Please select another time.");
  }

  const actorLabel = context.actor === "client" ? "Client" : "Carter";
  const patchResponse = await calendarClient.events.patch({
    calendarId,
    eventId: context.eventId,
    sendUpdates: getGoogleSendUpdatesMode(),
    requestBody: {
      status: "confirmed",
      start: {
        dateTime: newStart.toISO(),
        timeZone: settings.timezone,
      },
      end: {
        dateTime: newEnd.toISO(),
        timeZone: settings.timezone,
      },
      description: appendAuditTrail(context.event.description, [
        `${DateTime.now()
          .setZone(settings.timezone)
          .toFormat("yyyy-LL-dd HH:mm")} (${settings.timezone}) - Booking rescheduled by ${actorLabel}.`,
        `Previous: ${context.display.displayDate}, ${context.display.displayTime}`,
        `Updated: ${newStart.toFormat("cccc, LLLL d")}, ${newStart.toFormat("h:mm a")} (${newStart.offsetNameShort || settings.timezone})`,
        `Reason: ${reason}`,
      ]),
      extendedProperties: {
        private: context.privateProps,
      },
    },
  });

  const updatedEvent = patchResponse.data;
  const updatedDisplay = getEventDisplayDetails(updatedEvent, settings.timezone);
  const notifications = await queueManageNotifications(
    {
      action: "rescheduled",
      actor: context.actor,
      reason,
      summary: String(updatedEvent.summary || context.summary).trim(),
      previousDisplay: context.display,
      nextDisplay: updatedDisplay,
      clientName: context.clientName,
      clientEmail: context.clientEmail,
      clientPhone: context.clientPhone,
      ownerEmail: getOwnerBookingEmail(),
      ownerPhone: normalizePhoneForTwilio(process.env.BOOKING_OWNER_PHONE),
    },
    {
      eventId: context.eventId,
      action: "reschedule",
      actor: context.actor,
    }
  );

  return {
    ok: true,
    message: "Booking rescheduled successfully.",
    actor: context.actor,
    action: "reschedule",
    booking: {
      eventId: context.eventId,
      status: String(updatedEvent.status || "confirmed").toLowerCase(),
      summary: String(updatedEvent.summary || context.summary).trim(),
      displayDate: updatedDisplay.displayDate,
      displayTime: updatedDisplay.displayTime,
      timezone: updatedDisplay.timezone,
      startIso: updatedDisplay.startIso,
      endIso: updatedDisplay.endIso,
    },
    notifications,
  };
};

const getManageContextDirect = async ({ eventId, actor, token }) => {
  const context = await getManageEventContextDirect({ eventId, actor, token });
  return {
    ok: true,
    message: "Booking loaded.",
    actor: context.actor,
    booking: {
      eventId: context.eventId,
      status: String(context.event.status || "confirmed").toLowerCase(),
      summary: context.summary,
      clientName: context.clientName,
      displayDate: context.display.displayDate,
      displayTime: context.display.displayTime,
      timezone: context.display.timezone,
      startIso: context.display.startIso,
      endIso: context.display.endIso,
    },
    permissions: {
      canCancel: context.permissions.canCancel,
      canReschedule: context.permissions.canReschedule,
      withinCutoff: context.permissions.withinCutoff,
      cutoffHours: Math.floor(getSelfServiceCutoffMinutes() / 60),
      reason: context.permissions.reason,
    },
  };
};

const ensureTriggerConfigured = (res) => {
  if (MISSING_TRIGGER_ENV_VARS.length === 0) {
    return true;
  }

  res.status(500).json({
    message: `Server is missing required Trigger configuration: ${MISSING_TRIGGER_ENV_VARS.join(", ")}`,
  });
  return false;
};

const ensureGoogleCalendarConfigured = (res) => {
  if (MISSING_GOOGLE_ENV_VARS.length === 0) {
    return true;
  }

  res.status(500).json({
    message: `Server is missing required Google Calendar configuration: ${MISSING_GOOGLE_ENV_VARS.join(", ")}`,
  });
  return false;
};

const getCachedAvailability = (month) => {
  if (CALENDAR_AVAILABILITY_CACHE_TTL_MS <= 0) {
    return null;
  }

  const cached = calendarAvailabilityCache.get(month);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    calendarAvailabilityCache.delete(month);
    return null;
  }

  return cached.output;
};

const setCachedAvailability = (month, output) => {
  if (CALENDAR_AVAILABILITY_CACHE_TTL_MS <= 0) {
    return;
  }

  calendarAvailabilityCache.set(month, {
    output,
    expiresAt: Date.now() + CALENDAR_AVAILABILITY_CACHE_TTL_MS,
  });
};

const clearCalendarAvailabilityCache = () => {
  if (calendarAvailabilityCache.size === 0) {
    return;
  }

  calendarAvailabilityCache.clear();
};

const getCalendarAvailabilityForMonth = async (month) => {
  const cacheKey = String(month || "").trim();
  const cachedOutput = getCachedAvailability(cacheKey);
  if (cachedOutput) {
    return {
      output: cachedOutput,
      cacheStatus: "hit",
    };
  }

  const existingRequest = calendarAvailabilityInFlight.get(cacheKey);
  if (existingRequest) {
    return {
      output: await existingRequest,
      cacheStatus: "inflight",
    };
  }

  const request = (async () => {
    return buildAvailabilityForMonthDirect(cacheKey);
  })();

  calendarAvailabilityInFlight.set(cacheKey, request);

  try {
    const output = await request;
    setCachedAvailability(cacheKey, output);
    return {
      output,
      cacheStatus: CALENDAR_AVAILABILITY_CACHE_TTL_MS > 0 ? "miss" : "disabled",
    };
  } finally {
    calendarAvailabilityInFlight.delete(cacheKey);
  }
};

const getManageContextCacheKey = (eventId, actor, token) =>
  `${String(eventId || "").trim()}|${String(actor || "").trim().toLowerCase()}|${String(token || "").trim()}`;

const getCachedManageContext = (cacheKey) => {
  if (MANAGE_CONTEXT_CACHE_TTL_MS <= 0) {
    return null;
  }

  const cached = manageContextCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    manageContextCache.delete(cacheKey);
    return null;
  }

  return cached.output;
};

const setCachedManageContext = (cacheKey, output) => {
  if (MANAGE_CONTEXT_CACHE_TTL_MS <= 0) {
    return;
  }

  manageContextCache.set(cacheKey, {
    output,
    expiresAt: Date.now() + MANAGE_CONTEXT_CACHE_TTL_MS,
  });
};

const clearManageContextCacheForEvent = (eventId) => {
  if (!eventId || manageContextCache.size === 0) {
    return;
  }

  const eventKeyPrefix = `${String(eventId).trim()}|`;
  for (const key of manageContextCache.keys()) {
    if (String(key).startsWith(eventKeyPrefix)) {
      manageContextCache.delete(key);
    }
  }
};

const getWarmMonthParams = () => {
  const now = new Date();
  const months = [];
  for (let offset = 0; offset <= CALENDAR_WARM_MONTH_LOOKAHEAD; offset += 1) {
    const candidate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const month = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}`;
    months.push(month);
  }
  return months;
};

const warmCalendarAvailabilityCache = async () => {
  if (CALENDAR_AVAILABILITY_CACHE_TTL_MS <= 0) {
    return;
  }

  const months = getWarmMonthParams();
  await Promise.allSettled(
    months.map(async (month) => {
      const result = await getCalendarAvailabilityForMonth(month);
      return {
        month,
        cacheStatus: result.cacheStatus,
      };
    })
  );
};

const warmTriggerWorkers = async () => {
  if (MISSING_TRIGGER_ENV_VARS.length > 0) {
    return;
  }

  await Promise.allSettled([
    tasks.trigger("calendar-worker-keepalive", {}),
    tasks.trigger("calendar-booking-keepalive", {}),
  ]);
};

/**
 * In-memory slot lock — prevents duplicate booking attempts on the SAME
 * Vercel instance. This is a fast-path optimistic lock only.
 *
 * Distributed protection across multiple instances is guaranteed by the
 * Google Calendar freebusy check in bookCalendarSlotDirect(), which queries
 * real-time busy intervals immediately before the calendar insert. If two
 * instances race past the in-memory lock, the second will see the first's
 * event in the busy intervals and reject with "That slot was just booked."
 */
const acquireBookingSlotLock = (slotStartIso) => {
  const key = String(slotStartIso || "").trim();
  if (!key) {
    return null;
  }

  const now = Date.now();
  for (const [lockKey, lockValue] of bookingSlotLocks.entries()) {
    if (now >= lockValue.expiresAt) {
      bookingSlotLocks.delete(lockKey);
    }
  }

  if (bookingSlotLocks.has(key)) {
    return null;
  }

  const lockToken = Symbol("booking-slot-lock");
  bookingSlotLocks.set(key, {
    token: lockToken,
    expiresAt: now + BOOKING_SLOT_LOCK_TTL_MS,
  });

  return () => {
    const current = bookingSlotLocks.get(key);
    if (current && current.token === lockToken) {
      bookingSlotLocks.delete(key);
    }
  };
};

const waitForRunOutput = async (handle, timeoutMs = 30000, pollIntervalMs = 300) => {
  let run = await runs.retrieve(handle);
  const runId = run.id;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (run.isSuccess) {
      return run.output;
    }

    if (run.isFailed || run.isCanceled) {
      const taskMessage =
        run.error && typeof run.error === "object" && "message" in run.error
          ? String(run.error.message)
          : `Task run ended with status ${run.status}`;
      throw new Error(taskMessage);
    }

    if (Date.now() >= deadline) {
      const status = String(run.status || "").toUpperCase();
      if (status === "QUEUED" || status === "DEQUEUED" || status === "PENDING_VERSION") {
        throw new Error(
          "Trigger worker is not processing this environment. Start `npm run dev:trigger` for local testing, or deploy/enable the worker in Trigger Cloud."
        );
      }

      throw new Error(`Timed out waiting for task run ${runId} to complete.`);
    }

    await wait(pollIntervalMs);
    run = await runs.retrieve(runId);
  }
};

const mapTaskErrorToStatusCode = (message) => {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("invalid or expired")) {
    return 403;
  }

  if (normalized.includes("booking could not be found")) {
    return 404;
  }

  if (normalized.includes("already been canceled")) {
    return 409;
  }

  if (normalized.includes("self-service cutoff")) {
    return 403;
  }

  if (normalized.includes("cannot be updated right now")) {
    return 403;
  }

  if (
    normalized.includes("missing required booking details") ||
    normalized.includes("missing required manage details") ||
    normalized.includes("please provide a cancellation reason") ||
    normalized.includes("please provide a reschedule reason") ||
    normalized.includes("please choose a different time") ||
    normalized.includes("please select a new time slot") ||
    normalized.includes("valid email address") ||
    normalized.includes("outside carter's booking window") ||
    normalized.includes("already started") ||
    normalized.includes("future slot") ||
    normalized.includes("at least") ||
    normalized.includes("invalid") ||
    normalized.includes("phone number") ||
    normalized.includes("postal code") ||
    normalized.includes("address") ||
    normalized.includes("month must be in yyyy-mm format")
  ) {
    return 400;
  }

  if (normalized.includes("just booked")) {
    return 409;
  }

  if (normalized.includes("trigger worker is not processing this environment")) {
    return 503;
  }

  if (normalized.includes("timed out waiting for task run")) {
    return 504;
  }

  return 500;
};

if (process.env.CORS_ORIGIN) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
    })
  );
} else {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (isProduction) {
    console.error(
      "[server] CRITICAL: CORS_ORIGIN is not set in production. Set CORS_ORIGIN to your domain (e.g. https://midtownpaintinghomeservices.ca). Defaulting to restrictive localhost origins."
    );
  } else {
    console.warn("[server] CORS_ORIGIN not set — defaulting to localhost only");
  }
  app.use(cors({ origin: ["http://localhost:5173", "http://localhost:8787"] }));
}

app.set("trust proxy", 1);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
const availabilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
const manageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    triggerConfigured: MISSING_TRIGGER_ENV_VARS.length === 0,
    smtpConfigured: MISSING_SMTP_ENV_VARS.length === 0,
    googleCalendarConfigured: MISSING_GOOGLE_ENV_VARS.length === 0,
    availabilityCache: {
      enabled: CALENDAR_AVAILABILITY_CACHE_TTL_MS > 0,
      ttlMs: CALENDAR_AVAILABILITY_CACHE_TTL_MS,
      entries: calendarAvailabilityCache.size,
      inFlight: calendarAvailabilityInFlight.size,
    },
    manageContextCache: {
      enabled: MANAGE_CONTEXT_CACHE_TTL_MS > 0,
      ttlMs: MANAGE_CONTEXT_CACHE_TTL_MS,
      entries: manageContextCache.size,
    },
    calendarWarmup: {
      enabled: CALENDAR_WARM_INTERVAL_MS > 0 && CALENDAR_AVAILABILITY_CACHE_TTL_MS > 0,
      intervalMs: CALENDAR_WARM_INTERVAL_MS,
      monthLookahead: CALENDAR_WARM_MONTH_LOOKAHEAD,
    },
    bookingSlotLocks: {
      ttlMs: BOOKING_SLOT_LOCK_TTL_MS,
      active: bookingSlotLocks.size,
    },
  });
});

app.post(
  "/api/quote",
  quoteLimiter,
  (req, res, next) => {
    upload.array("images", MAX_UPLOAD_FILES)(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }

      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!ensureTriggerConfigured(res)) {
        return;
      }

      const normalizedLead = normalizeLeadPayload(req.body ?? {});
      const {
        fullName,
        phone,
        phoneCountryCode,
        phoneNationalNumber,
        email,
        addressLine1,
        city,
        postalCode,
        country,
        provinceState,
        projectType,
        projectDetails,
        budget,
        callGoal,
      } = normalizedLead;

      if (
        !fullName ||
        !email ||
        !addressLine1 ||
        !city ||
        !postalCode ||
        !country ||
        !provinceState ||
        !projectType ||
        !projectDetails
      ) {
        res.status(400).json({
          message: "Please complete all required fields before submitting.",
        });
        return;
      }

      if (!isValidEmailAddress(email)) {
        res.status(400).json({
          message: "Please provide a valid email address.",
        });
        return;
      }

      if (!phone) {
        res.status(400).json({
          message: "Please provide a valid phone number in international format.",
        });
        return;
      }

      if (!isValidPostalCode(postalCode, country)) {
        res.status(400).json({
          message: "Please provide a valid postal code.",
        });
        return;
      }

      const files = Array.isArray(req.files) ? req.files : [];
      const estimatedEncodedImageBytes = files.reduce(
        (total, file) => total + Math.ceil((file.size || 0) * 1.37),
        0
      );

      if (estimatedEncodedImageBytes > TRIGGER_SAFE_PAYLOAD_BYTES) {
        res.status(413).json({
          message:
            "Uploaded images are too large for processing. Please upload fewer or smaller images (about 6MB total).",
        });
        return;
      }

      const images = files.map((file, index) => ({
        filename: (file.originalname || `image-${index + 1}`).replace(/[^\w.\-() ]+/g, "_"),
        contentType: file.mimetype,
        contentBase64: file.buffer.toString("base64"),
      }));

      const handle = await tasks.trigger("send-quote-email", {
        fullName,
        phone,
        phoneCountryCode,
        phoneNationalNumber,
        email,
        addressLine1,
        city,
        postalCode,
        country,
        provinceState,
        projectType,
        projectDetails,
        budget,
        callGoal,
        images,
        submittedAtIso: new Date().toISOString(),
      });

      await waitForRunOutput(handle);

      res.status(200).json({
        message: "Quote request sent successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/calendar/availability", availabilityLimiter, async (req, res, next) => {
  try {
    if (!ensureGoogleCalendarConfigured(res)) {
      return;
    }

    const month = String(req.query.month || "").trim();
    if (!MONTH_QUERY_PATTERN.test(month)) {
      res.status(400).json({
        message: "Month must be in YYYY-MM format.",
      });
      return;
    }

    const { output, cacheStatus } = await getCalendarAvailabilityForMonth(month);

    res.setHeader("X-Calendar-Availability-Cache", cacheStatus);
    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.post("/api/calendar/booking", bookingLimiter, async (req, res, next) => {
  try {
    if (!ensureGoogleCalendarConfigured(res)) {
      return;
    }

    const slotStartIso = normalizeText(req.body?.slotStartIso);
    const normalizedLead = normalizeLeadPayload(req.body ?? {});
    const {
      fullName,
      phone,
      phoneCountryCode,
      phoneNationalNumber,
      email,
      addressLine1,
      city,
      postalCode,
      country,
      provinceState,
      projectType,
      projectDetails,
      budget,
      callGoal,
    } = normalizedLead;

    if (
      !slotStartIso ||
      !fullName ||
      !email ||
      !addressLine1 ||
      !city ||
      !postalCode ||
      !country ||
      !provinceState ||
      !projectType ||
      !projectDetails
    ) {
      res.status(400).json({
        message: "Missing required booking details.",
      });
      return;
    }

    if (!isValidEmailAddress(email)) {
      res.status(400).json({
        message: "Please provide a valid email address.",
      });
      return;
    }

    if (!phone) {
      res.status(400).json({
        message: "Please provide a valid phone number in international format.",
      });
      return;
    }

    if (!isValidPostalCode(postalCode, country)) {
      res.status(400).json({
        message: "Please provide a valid postal code.",
      });
      return;
    }

    const releaseSlotLock = acquireBookingSlotLock(slotStartIso);
    if (!releaseSlotLock) {
      res.status(409).json({
        message:
          "That slot is being booked right now. Please wait a moment and pick another time if needed.",
      });
      return;
    }

    try {
      clearCalendarAvailabilityCache();
      const output = await bookCalendarSlotDirect({
        slotStartIso,
        fullName,
        phone,
        phoneCountryCode,
        phoneNationalNumber,
        email,
        addressLine1,
        city,
        postalCode,
        country,
        provinceState,
        projectType,
        projectDetails,
        budget,
        callGoal,
      });
      clearCalendarAvailabilityCache();
      clearManageContextCacheForEvent(output?.booking?.eventId);
      res.status(200).json(output);
    } finally {
      releaseSlotLock();
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/calendar/manage/context", manageLimiter, async (req, res, next) => {
  try {
    if (!ensureGoogleCalendarConfigured(res)) {
      return;
    }

    const eventId = normalizeText(req.query.eventId);
    const actor = normalizeText(req.query.actor).toLowerCase();
    const token = normalizeText(req.query.token);

    if (!eventId || !actor || !token) {
      res.status(400).json({
        message: "Missing required manage details.",
      });
      return;
    }

    const contextCacheKey = getManageContextCacheKey(eventId, actor, token);
    const cachedContext = getCachedManageContext(contextCacheKey);
    if (cachedContext) {
      res.setHeader("X-Manage-Context-Cache", "hit");
      res.status(200).json(cachedContext);
      return;
    }

    const output = await getManageContextDirect({ eventId, actor, token });
    setCachedManageContext(contextCacheKey, output);
    res.setHeader("X-Manage-Context-Cache", "miss");
    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.post("/api/calendar/manage/cancel", manageLimiter, async (req, res, next) => {
  try {
    if (!ensureGoogleCalendarConfigured(res)) {
      return;
    }

    const eventId = normalizeText(req.body?.eventId);
    const actor = normalizeText(req.body?.actor).toLowerCase();
    const token = normalizeText(req.body?.token);
    const reason = normalizeText(req.body?.reason);

    if (!eventId || !actor || !token || !reason) {
      res.status(400).json({
        message: "Missing required manage details.",
      });
      return;
    }

    const output = await cancelManageBookingDirect({
      eventId,
      actor,
      token,
      reason,
    });

    clearCalendarAvailabilityCache();
    clearManageContextCacheForEvent(eventId);
    res.status(200).json(output);
  } catch (error) {
    next(error);
  }
});

app.post("/api/calendar/manage/reschedule", manageLimiter, async (req, res, next) => {
  try {
    if (!ensureGoogleCalendarConfigured(res)) {
      return;
    }

    const eventId = normalizeText(req.body?.eventId);
    const actor = normalizeText(req.body?.actor).toLowerCase();
    const token = normalizeText(req.body?.token);
    const reason = normalizeText(req.body?.reason);
    const newSlotStartIso = normalizeText(req.body?.newSlotStartIso);

    if (!eventId || !actor || !token || !reason || !newSlotStartIso) {
      res.status(400).json({
        message: "Missing required manage details.",
      });
      return;
    }

    const releaseSlotLock = acquireBookingSlotLock(newSlotStartIso);
    if (!releaseSlotLock) {
      res.status(409).json({
        message:
          "That slot is being booked right now. Please wait a moment and pick another time if needed.",
      });
      return;
    }

    try {
      clearCalendarAvailabilityCache();
      const output = await rescheduleManageBookingDirect({
        eventId,
        actor,
        token,
        reason,
        newSlotStartIso,
      });

      clearCalendarAvailabilityCache();
      clearManageContextCacheForEvent(eventId);
      res.status(200).json(output);
    } finally {
      releaseSlotLock();
    }
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        message: "Each uploaded image must be 10MB or smaller.",
      });
      return;
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        message: `You can upload up to ${MAX_UPLOAD_FILES} images.`,
      });
      return;
    }

    res.status(400).json({
      message: "There was an issue with the uploaded files.",
    });
    return;
  }

  if (error instanceof Error && error.message === "ONLY_IMAGE_FILES") {
    res.status(400).json({
      message: "Only image files are allowed.",
    });
    return;
  }

  if (error instanceof Error) {
    const statusCode = mapTaskErrorToStatusCode(error.message);
    if (statusCode !== 500) {
      res.status(statusCode).json({
        message: error.message,
      });
      return;
    }
  }

  console.error("[server] Unexpected server error", error);
  res.status(500).json({
    message: "Unable to process your request right now. Please try again.",
  });
});

const logStartupEnvironmentWarnings = () => {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const severity = isProduction ? "error" : "warn";

  if (MISSING_GOOGLE_ENV_VARS.length > 0) {
    console[severity](
      `[server] Missing Google Calendar env vars (calendar/booking routes will fail): ${MISSING_GOOGLE_ENV_VARS.join(", ")}`
    );
  }

  if (MISSING_SMTP_ENV_VARS.length > 0) {
    console[severity](
      `[server] Missing SMTP env vars (email notifications will fail): ${MISSING_SMTP_ENV_VARS.join(", ")}`
    );
  }

  const missingTwilioVars = REQUIRED_TWILIO_ENV_VARS.filter((key) => !process.env[key]);
  if (missingTwilioVars.length > 0) {
    console.warn(
      `[server] Missing Twilio env vars (SMS notifications disabled): ${missingTwilioVars.join(", ")}`
    );
  }
};

const startServer = () => {
  app.listen(PORT, async () => {
    console.log(`[server] Midtown backend listening on http://localhost:${PORT}`);
    logStartupEnvironmentWarnings();

    if (MISSING_TRIGGER_ENV_VARS.length > 0) {
      console.warn(
        `[server] Missing env vars for Trigger task orchestration: ${MISSING_TRIGGER_ENV_VARS.join(", ")}`
      );
      return;
    }

    try {
      await runs.list({ limit: 1 });
      console.log("[server] Trigger.dev connection verified.");
    } catch (error) {
      console.error("[server] Trigger.dev verification failed:", error);
      return;
    }

    if (CALENDAR_WARM_INTERVAL_MS <= 0 || CALENDAR_AVAILABILITY_CACHE_TTL_MS <= 0) {
      return;
    }

    const warm = async () => {
      try {
        await Promise.allSettled([warmCalendarAvailabilityCache(), warmTriggerWorkers()]);
      } catch (error) {
        console.warn("[server] Calendar availability warmup failed:", error);
      }
    };

    void warm();
    setInterval(() => {
      void warm();
    }, CALENDAR_WARM_INTERVAL_MS);
  });
};

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  startServer();
}

export default app;
