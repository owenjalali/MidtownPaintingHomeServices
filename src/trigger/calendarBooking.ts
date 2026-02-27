import nodemailer from "nodemailer";
import { logger, queue, task } from "@trigger.dev/sdk";
import { randomBytes } from "node:crypto";
import { google, type calendar_v3 } from "googleapis";
import { DateTime } from "luxon";
import twilio from "twilio";
import {
  isSlotWithinBookingWindow,
  normalizeBookingWindow,
  slotOverlapsBusyInterval,
} from "./calendarRules";
import {
  getManagePermissions,
  normalizeManageActor,
  normalizeManageReason,
  type ManageActor,
} from "./calendarManageRules";

type CalendarSlot = {
  startIso: string;
  endIso: string;
  label: string;
};

type AvailabilityResult = {
  month: string;
  timezone: string;
  durationMinutes: number;
  availabilityByDate: Record<string, CalendarSlot[]>;
  availableDates: string[];
};

type BookingPayload = {
  slotStartIso: string;
  fullName: string;
  phone: string;
  phoneCountryCode?: string;
  phoneNationalNumber?: string;
  email: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
  provinceState: string;
  projectType: string;
  projectDetails: string;
  budget?: string;
  callGoal?: string;
};

type BookingResult = {
  message: string;
  booking: {
    eventId: string | null;
    displayDate: string;
    displayTime: string;
    timezone: string;
    startIso: string;
    endIso: string;
    manageLinks?: {
      client: string | null;
      carter: string | null;
    };
  };
  reminders: Array<{
    reminderMinutesBefore: number;
    sendEmail: boolean;
    sendSms: boolean;
    reminderAtIso: string;
    reminderAtLabel: string;
    runId: string | null;
    delayApplied: boolean;
  }>;
};

type ReminderPayload = {
  bookingStartIso: string;
  timezone: string;
  reminderMinutesBefore?: number;
  sendEmail?: boolean;
  sendSms?: boolean;
  fullName: string;
  projectType?: string;
  projectDetails?: string;
  callGoal?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  provinceState?: string;
  clientEmail: string;
  clientPhone?: string;
  ownerEmail: string;
  ownerPhone?: string;
};

type BookingConfirmationPayload = {
  ownerEmail: string;
  clientEmail: string;
  replyTo?: string;
  ownerSubject: string;
  ownerText: string;
  clientSubject: string;
  clientText: string;
};

type ManageNotificationPayload = {
  action: "cancelled" | "rescheduled";
  actor: ManageActor;
  reason: string;
  summary: string;
  previousDisplay: BookingDisplayDetails;
  nextDisplay?: BookingDisplayDetails;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  ownerEmail: string;
  ownerPhone: string | null;
};

type BookingSettings = {
  durationMinutes: number;
  slotIntervalMinutes: number;
  minNoticeMinutes: number;
  timezone: string;
  dayStartMinutes: number;
  dayEndMinutes: number;
  workingDays: Set<number>;
};

type ManageContextPayload = {
  eventId: string;
  actor: string;
  token: string;
};

type ManageActionPayload = {
  eventId: string;
  actor: string;
  token: string;
  reason: string;
};

type ManageReschedulePayload = ManageActionPayload & {
  newSlotStartIso: string;
};

type BookingDisplayDetails = {
  displayDate: string;
  displayTime: string;
  timezone: string;
  startIso: string;
  endIso: string;
};

type ManageContextResult = {
  ok: true;
  message: string;
  actor: ManageActor;
  booking: {
    eventId: string;
    status: string;
    summary: string;
    clientName: string;
    displayDate: string;
    displayTime: string;
    timezone: string;
    startIso: string;
    endIso: string;
  };
  permissions: {
    canCancel: boolean;
    canReschedule: boolean;
    withinCutoff: boolean;
    cutoffHours: number;
    reason: string | null;
  };
};

type ManageActionResult = {
  ok: true;
  message: string;
  actor: ManageActor;
  action: "cancel" | "reschedule";
  booking: {
    eventId: string;
    status: string;
    summary: string;
    displayDate: string;
    displayTime: string;
    timezone: string;
    startIso: string;
    endIso: string;
  };
  notifications: {
    emailAttempted: boolean;
    emailSent: boolean;
    smsAttempted: boolean;
    smsSent: boolean;
  };
};

type ManageFailureResult = {
  ok: false;
  message: string;
  statusCode: number;
  actor: ManageActor | null;
  action: "context" | "cancel" | "reschedule";
};

type ManageEventContext = {
  actor: ManageActor;
  eventId: string;
  event: calendar_v3.Schema$Event;
  privateProps: Record<string, string>;
  summary: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  display: BookingDisplayDetails;
  permissions: ReturnType<typeof getManagePermissions>;
};

const MONTH_QUERY_PATTERN = /^\d{4}-\d{2}$/;
const CALENDAR_REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_CALENDAR_ID",
] as const;
const SMTP_REQUIRED_ENV_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "QUOTE_TO_EMAIL",
] as const;
const TWILIO_REQUIRED_ENV_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const REPEATING_DIGIT_PATTERN = /^(\d)\1{6,}$/;
const REPEATING_BLOCK_PATTERN = /^(\d{2,4})\1{2,}$/;
const MANAGE_CLIENT_TOKEN_KEY = "mp_client_token";
const MANAGE_CARTER_TOKEN_KEY = "mp_carter_token";
const MANAGE_CLIENT_NAME_KEY = "mp_client_name";
const MANAGE_CLIENT_EMAIL_KEY = "mp_client_email";
const MANAGE_CLIENT_PHONE_KEY = "mp_client_phone";
const MANAGE_REASON_MAX_LENGTH = 500;
const DEFAULT_SELF_SERVICE_CUTOFF_MINUTES = 12 * 60;

const parseBoolean = (value: string | undefined, fallback: boolean) => {
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

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
};

const calendarAvailabilityQueue = queue({
  name: "calendar-availability",
  concurrencyLimit: parsePositiveInteger(process.env.BOOKING_AVAILABILITY_QUEUE_CONCURRENCY, 20),
});
const calendarBookingQueue = queue({
  name: "calendar-booking",
  concurrencyLimit: parsePositiveInteger(process.env.BOOKING_QUEUE_CONCURRENCY, 10),
});
const bookingNotificationQueue = queue({
  name: "booking-notifications",
  concurrencyLimit: parsePositiveInteger(process.env.BOOKING_NOTIFICATION_QUEUE_CONCURRENCY, 20),
});

const getFirstName = (fullName: string) => {
  const token = String(fullName || "").trim().split(/\s+/)[0];
  return token || "there";
};

const summarizeProject = (details?: string) => {
  const normalized = String(details || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Painting consultation details not provided.";
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
};

const normalizeCountry = (value?: string) => String(value || "").trim().toUpperCase();

const normalizePostalCode = (postalCode?: string, country?: string) => {
  const compact = String(postalCode || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (normalizeCountry(country) === "CA") {
    const noSpaces = compact.replace(/\s+/g, "");
    if (noSpaces.length >= 6) {
      return `${noSpaces.slice(0, 3)} ${noSpaces.slice(3, 6)}`;
    }
  }

  return compact;
};

const isValidPostalCode = (postalCode: string, country: string) => {
  if (country === "CA") {
    return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(postalCode);
  }

  if (country === "US") {
    return /^\d{5}(-\d{4})?$/.test(postalCode);
  }

  if (country === "UK") {
    return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(postalCode);
  }

  return postalCode.trim().length >= 3;
};

const isValidEmailAddress = (email: string) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
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

const normalizePhoneForTwilio = (value?: string) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/[^\d]/g, "");
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

const formatAddressForDisplay = (addressLine1?: string, city?: string, provinceState?: string, postalCode?: string, country?: string) => {
  const line1 = String(addressLine1 || "").trim();
  const cityToken = String(city || "").trim();
  const provinceToken = String(provinceState || "").trim();
  const postalToken = String(postalCode || "").trim();
  const countryToken = String(country || "").trim();

  const locationLine = [cityToken, provinceToken, postalToken].filter(Boolean).join(", ");
  const lines = [line1, locationLine, countryToken].filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : "Not provided";
};

const formatAddressForSms = (city?: string, provinceState?: string, country?: string) => {
  const parts = [String(city || "").trim(), String(provinceState || "").trim(), String(country || "").trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location not provided";
};

const getRunIdFromHandle = (handle: unknown) => {
  if (typeof handle === "string" && handle.trim()) {
    return handle;
  }

  if (handle && typeof handle === "object" && "id" in handle) {
    const candidate = (handle as { id?: unknown }).id;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
};

const maskPhoneNumber = (value?: string | null) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  const suffix = digits.slice(-4);
  return `***${suffix}`;
};

const getMissingEnvVars = (keys: readonly string[]) =>
  keys.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

const getBookingSettings = (): BookingSettings => {
  const timezone = process.env.BOOKING_TIMEZONE || "America/Toronto";
  const durationMinutes = Number(process.env.BOOKING_DURATION_MINUTES || 15);
  const slotIntervalMinutes = Number(process.env.BOOKING_SLOT_INTERVAL_MINUTES || 15);
  const minNoticeMinutes = Number(process.env.BOOKING_MIN_NOTICE_MINUTES || 120);
  const { dayStartMinutes, dayEndMinutes, workingDays } = normalizeBookingWindow({
    dayStart: process.env.BOOKING_DAY_START,
    dayEnd: process.env.BOOKING_DAY_END,
    workingDays: process.env.BOOKING_WORKING_DAYS,
  });

  return {
    timezone,
    durationMinutes,
    slotIntervalMinutes,
    minNoticeMinutes,
    dayStartMinutes,
    dayEndMinutes,
    workingDays,
  };
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

const buildManageBookingLink = (eventId: string, actor: ManageActor, token: string) => {
  const url = new URL("/manage-booking", getManageBaseUrl());
  url.searchParams.set("eventId", eventId);
  url.searchParams.set("actor", actor);
  url.searchParams.set("token", token);
  return url.toString();
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

const getBusyIntervals = async (
  calendarClient: ReturnType<typeof getCalendarClient>,
  calendarId: string,
  timezone: string,
  timeMinIso: string,
  timeMaxIso: string
) => {
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
    .filter((period): period is { startMs: number; endMs: number } => Boolean(period));
};

const formatBudgetLabel = (budget?: string) => {
  const numericBudget = Number(budget);
  if (!budget || Number.isNaN(numericBudget) || numericBudget <= 0) {
    return "Not provided";
  }

  return `$${numericBudget.toLocaleString("en-CA")}+`;
};

const createSmtpTransporter = () => {
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const getEventDisplayDetails = (
  event: calendar_v3.Schema$Event,
  fallbackTimezone: string
): BookingDisplayDetails => {
  const timezone =
    String(event.start?.timeZone || event.end?.timeZone || "").trim() || fallbackTimezone;
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
    startIso: start.toUTC().toISO() as string,
    endIso: end.toUTC().toISO() as string,
  };
};

const isGoogleNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = Number((error as { code?: unknown }).code);
  const maybeStatus = Number((error as { status?: unknown }).status);
  if (maybeCode === 404 || maybeStatus === 404) {
    return true;
  }

  const message = String((error as { message?: unknown }).message || "").toLowerCase();
  return message.includes("not found");
};

const getCalendarEventById = async (
  calendarClient: ReturnType<typeof getCalendarClient>,
  calendarId: string,
  eventId: string
) => {
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

const normalizePrivateProps = (event: calendar_v3.Schema$Event) => {
  const source = event.extendedProperties?.private || {};
  return Object.entries(source).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = String(value || "").trim();
    return acc;
  }, {});
};

const requireManageReason = (value: string, actionName: "cancellation" | "reschedule") => {
  const normalized = normalizeManageReason(value);
  if (!normalized) {
    throw new Error(`Please provide a ${actionName} reason.`);
  }

  return normalized.slice(0, MANAGE_REASON_MAX_LENGTH);
};

const mapManageErrorStatusCode = (message: string) => {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("invalid or expired")) {
    return 403;
  }

  if (normalized.includes("could not be found")) {
    return 404;
  }

  if (normalized.includes("already been canceled")) {
    return 409;
  }

  if (
    normalized.includes("self-service cutoff") ||
    normalized.includes("cannot be updated right now") ||
    normalized.includes("already started")
  ) {
    return 403;
  }

  if (
    normalized.includes("missing") ||
    normalized.includes("please provide") ||
    normalized.includes("please choose") ||
    normalized.includes("please select") ||
    normalized.includes("outside carter's booking window") ||
    normalized.includes("selected time slot is invalid") ||
    normalized.includes("at least")
  ) {
    return 400;
  }

  if (normalized.includes("just booked")) {
    return 409;
  }

  return 500;
};

const handleManageTaskError = (
  action: "context" | "cancel" | "reschedule",
  actor: ManageActor | null,
  error: unknown
): ManageFailureResult => {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode = mapManageErrorStatusCode(message);
  return {
    ok: false,
    message:
      statusCode === 500
        ? "Unable to process your request right now. Please try again."
        : message,
    statusCode,
    actor,
    action,
  };
};

const appendAuditTrail = (description: string | null | undefined, lines: string[]) => {
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

const sendManageNotifications = async (options: ManageNotificationPayload) => {
  const actorLabel = options.actor === "client" ? "Client" : "Carter";
  const normalizedReason = options.reason.replace(/\s+/g, " ").trim();
  const shortReason =
    normalizedReason.length <= 120 ? normalizedReason : `${normalizedReason.slice(0, 117)}...`;

  let emailAttempted = false;
  let emailSent = false;
  let smsAttempted = false;
  let smsSent = false;

  const missingSmtpVars = getMissingEnvVars(SMTP_REQUIRED_ENV_VARS);
  if (missingSmtpVars.length === 0) {
    emailAttempted = true;
    try {
      const transporter = createSmtpTransporter();
      const customerSubject =
        options.action === "cancelled"
          ? "Your Midtown Painting consultation was canceled"
          : "Your Midtown Painting consultation was rescheduled";
      const ownerSubject =
        options.action === "cancelled"
          ? `Consultation canceled by ${actorLabel} - ${options.clientName}`
          : `Consultation rescheduled by ${actorLabel} - ${options.clientName}`;

      const ownerLines = [
        `${options.summary} was ${options.action} by ${actorLabel}.`,
        "",
        `Client: ${options.clientName}`,
        `Client email: ${options.clientEmail || "Unavailable"}`,
        `Reason: ${normalizedReason}`,
        `Previous time: ${options.previousDisplay.displayDate}, ${options.previousDisplay.displayTime}`,
        options.nextDisplay
          ? `New time: ${options.nextDisplay.displayDate}, ${options.nextDisplay.displayTime}`
          : "New time: N/A (booking canceled)",
      ].join("\n");

      const customerLines = [
        `Hi ${options.clientName},`,
        "",
        options.action === "cancelled"
          ? `Your Midtown Painting consultation has been canceled by ${actorLabel.toLowerCase()}.`
          : `Your Midtown Painting consultation has been rescheduled by ${actorLabel.toLowerCase()}.`,
        options.nextDisplay
          ? `New time: ${options.nextDisplay.displayDate}, ${options.nextDisplay.displayTime}`
          : "No further action is required right now.",
        `Reason: ${normalizedReason}`,
        "",
        "If you need help, reply to this email.",
        "",
        "Midtown Painting Home Services",
      ].join("\n");

      await Promise.all([
        transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: options.ownerEmail,
          replyTo: options.clientEmail || undefined,
          subject: ownerSubject,
          text: ownerLines,
        }),
        options.clientEmail
          ? transporter.sendMail({
              from: process.env.SMTP_FROM || process.env.SMTP_USER,
              to: options.clientEmail,
              subject: customerSubject,
              text: customerLines,
            })
          : Promise.resolve(),
      ]);

      emailSent = true;
    } catch (error) {
      logger.warn("Failed to send manage-booking email notifications", {
        action: options.action,
        actor: options.actor,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.warn("Skipping manage-booking emails because SMTP env vars are missing", {
      missingSmtpVars,
    });
  }

  const missingTwilioVars = getMissingEnvVars(TWILIO_REQUIRED_ENV_VARS);
  if (missingTwilioVars.length === 0) {
    smsAttempted = true;
    try {
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID as string,
        process.env.TWILIO_AUTH_TOKEN as string
      );
      const smsTargets = [
        {
          to: options.ownerPhone,
          target: "owner",
          body:
            options.action === "cancelled"
              ? `Midtown: ${options.clientName} canceled the consultation (${actorLabel}). Reason: ${shortReason}`
              : `Midtown: ${options.clientName} rescheduled (${actorLabel}). New time ${options.nextDisplay?.displayDate}, ${options.nextDisplay?.displayTime}. Reason: ${shortReason}`,
        },
        {
          to: options.clientPhone,
          target: "client",
          body:
            options.action === "cancelled"
              ? `Midtown: Your consultation was canceled by ${actorLabel.toLowerCase()}. Reason: ${shortReason}`
              : `Midtown: Your consultation was rescheduled by ${actorLabel.toLowerCase()} to ${options.nextDisplay?.displayDate}, ${options.nextDisplay?.displayTime}. Reason: ${shortReason}`,
        },
      ];

      const smsTargetsByPhone = new Map<string, { to: string; body: string; target: string }>();
      for (const sms of smsTargets) {
        if (!sms.to) {
          continue;
        }

        if (!smsTargetsByPhone.has(sms.to)) {
          smsTargetsByPhone.set(sms.to, {
            to: sms.to,
            body: sms.body,
            target: sms.target,
          });
        }
      }

      await Promise.all(
        Array.from(smsTargetsByPhone.values()).map((sms) =>
          twilioClient.messages.create({
            from: process.env.TWILIO_FROM_NUMBER as string,
            to: sms.to,
            body: sms.body,
          })
        )
      );

      smsSent = true;
    } catch (error) {
      logger.warn("Failed to send manage-booking SMS notifications", {
        action: options.action,
        actor: options.actor,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.warn("Skipping manage-booking SMS because Twilio env vars are missing", {
      missingTwilioVars,
    });
  }

  return {
    emailAttempted,
    emailSent,
    smsAttempted,
    smsSent,
  };
};

const getNotificationChannelAvailability = () => {
  const missingSmtpVars = getMissingEnvVars(SMTP_REQUIRED_ENV_VARS);
  const missingTwilioVars = getMissingEnvVars(TWILIO_REQUIRED_ENV_VARS);
  return {
    emailEnabled: missingSmtpVars.length === 0,
    smsEnabled: missingTwilioVars.length === 0,
  };
};

const getManageEventContext = async (
  payload: ManageContextPayload,
  options?: {
    requireCancelable?: boolean;
    requireReschedulable?: boolean;
  }
): Promise<ManageEventContext> => {
  const eventId = String(payload?.eventId || "").trim();
  const token = String(payload?.token || "").trim();
  const actor = normalizeManageActor(payload?.actor);

  if (!eventId || !token || !actor) {
    throw new Error("Booking management link is invalid or expired.");
  }

  const settings = getBookingSettings();
  const calendarClient = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID as string;
  const event = await getCalendarEventById(calendarClient, calendarId, eventId);
  const privateProps = normalizePrivateProps(event);
  const expectedToken =
    actor === "client" ? privateProps[MANAGE_CLIENT_TOKEN_KEY] : privateProps[MANAGE_CARTER_TOKEN_KEY];

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

  const requiresCancelable = Boolean(options?.requireCancelable);
  const requiresReschedulable = Boolean(options?.requireReschedulable);

  if (requiresCancelable && !permissions.canCancel) {
    if (permissions.reason) {
      throw new Error(permissions.reason);
    }
    throw new Error("This booking cannot be updated right now.");
  }

  if (requiresReschedulable && !permissions.canReschedule) {
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

const buildAvailabilityForMonth = async (
  month: string,
  settings: BookingSettings
): Promise<AvailabilityResult> => {
  const monthStart = DateTime.fromFormat(month, "yyyy-MM", { zone: settings.timezone }).startOf("month");
  if (!monthStart.isValid) {
    throw new Error("Unable to parse the requested month.");
  }

  const monthEnd = monthStart.endOf("month");
  const calendarClient = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID as string;

  const busyIntervals = await getBusyIntervals(
    calendarClient,
    calendarId,
    settings.timezone,
    monthStart.startOf("day").toUTC().toISO() as string,
    monthEnd.endOf("day").toUTC().toISO() as string
  );

  const nowWithNotice = DateTime.now().setZone(settings.timezone).plus({
    minutes: settings.minNoticeMinutes,
  });

  const availabilityByDate: Record<string, CalendarSlot[]> = {};
  const availableDates: string[] = [];

  for (
    let dayCursor = monthStart.startOf("day");
    dayCursor.toMillis() <= monthEnd.toMillis();
    dayCursor = dayCursor.plus({ days: 1 })
  ) {
    const dateKey = dayCursor.toISODate() as string;
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
        startIso: slotStart.toUTC().toISO() as string,
        endIso: slotEnd.toUTC().toISO() as string,
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

export const calendarGetAvailability = task({
  id: "calendar-get-availability",
  queue: calendarAvailabilityQueue,
  run: async (payload: { month: string }): Promise<AvailabilityResult> => {
    const missingCalendarEnvVars = getMissingEnvVars(CALENDAR_REQUIRED_ENV_VARS);
    if (missingCalendarEnvVars.length > 0) {
      throw new Error(
        `Missing required Google Calendar configuration: ${missingCalendarEnvVars.join(", ")}`
      );
    }

    const month = String(payload?.month || "").trim();
    if (!MONTH_QUERY_PATTERN.test(month)) {
      throw new Error("Month must be in YYYY-MM format.");
    }

    const settings = getBookingSettings();
    const result = await buildAvailabilityForMonth(month, settings);

    logger.info("Generated calendar availability", {
      month,
      timezone: settings.timezone,
      availableDates: result.availableDates.length,
    });

    return result;
  },
});

export const bookingSendReminder = task({
  id: "booking-send-reminder",
  run: async (payload: ReminderPayload) => {
    const {
      bookingStartIso = "",
      timezone = process.env.BOOKING_TIMEZONE || "America/Toronto",
      reminderMinutesBefore = Number(process.env.BOOKING_REMINDER_MINUTES_BEFORE || 60),
      sendEmail = parseBoolean(process.env.BOOKING_SEND_REMINDER_EMAIL, true),
      sendSms = parseBoolean(process.env.BOOKING_SEND_REMINDER_SMS, true),
      fullName = "",
      projectType = "",
      projectDetails = "",
      callGoal = "",
      addressLine1 = "",
      city = "",
      postalCode = "",
      country = "",
      provinceState = "",
      clientEmail = "",
      clientPhone = "",
      ownerEmail = process.env.BOOKING_OWNER_EMAIL || process.env.QUOTE_TO_EMAIL || "",
      ownerPhone = process.env.BOOKING_OWNER_PHONE || "",
    } = payload ?? {};

    if (!bookingStartIso || !fullName || !clientEmail || !ownerEmail) {
      throw new Error("Missing required reminder details.");
    }

    const bookingStart = DateTime.fromISO(bookingStartIso, { setZone: true }).setZone(timezone);
    if (!bookingStart.isValid) {
      throw new Error("Reminder booking time is invalid.");
    }

    const reminderLeadMinutes = Number(reminderMinutesBefore);
    if (!Number.isFinite(reminderLeadMinutes) || reminderLeadMinutes < 1) {
      throw new Error("Reminder timing is invalid.");
    }

    const reminderAt = bookingStart.minus({ minutes: reminderLeadMinutes });
    const now = DateTime.now().setZone(timezone);

    if (reminderAt > now) {
      logger.info("Reminder time is in the future — this task should have been scheduled with Trigger.dev delay option. Sending immediately as fallback.", {
        reminderAt: reminderAt.toUTC().toISO(),
        now: now.toUTC().toISO(),
      });
    }

    const projectSummary = summarizeProject(projectDetails);
    const projectAddress = formatAddressForDisplay(
      addressLine1,
      city,
      provinceState,
      postalCode,
      country
    );
    const projectAddressSms = formatAddressForSms(city, provinceState, country);
    const clientFirstName = getFirstName(fullName);
    const displayDate = bookingStart.toFormat("cccc, LLLL d");
    const displayTime = `${bookingStart.toFormat("h:mm a")} (${bookingStart.offsetNameShort || timezone})`;
    const emailSubject = `Reminder: Consultation with Carter in ${reminderLeadMinutes} minutes`;

    if (sendEmail) {
      const missingSmtpEnvVars = getMissingEnvVars(SMTP_REQUIRED_ENV_VARS);
      if (missingSmtpEnvVars.length > 0) {
        throw new Error(`Missing required SMTP configuration: ${missingSmtpEnvVars.join(", ")}`);
      }

      const transporter = createSmtpTransporter();
      const ownerReminderLines = [
        `Hey Carter, reminder from Midtown Painting Home Services: you have a consultation with ${fullName} in ${reminderLeadMinutes} minutes.`,
        "",
        `When: ${displayDate}, ${displayTime}`,
        `Client email: ${clientEmail}`,
        `Client phone: ${clientPhone || "Not provided"}`,
        `Project type: ${projectType || "Not provided"}`,
        `Project details: ${projectSummary}`,
        `Call goal: ${callGoal || "Not provided"}`,
        "",
        "Project address:",
        projectAddress,
      ].join("\n");

      const clientReminderLines = [
        `Hi ${clientFirstName},`,
        "",
        `Reminder from Midtown Painting Home Services: your consultation with Carter starts in ${reminderLeadMinutes} minutes.`,
        `When: ${displayDate}, ${displayTime}`,
        `Project details: ${projectSummary}`,
        `Project address: ${projectAddressSms}`,
        "",
        "If you need to reschedule, reply to this email.",
      ].join("\n");

      await Promise.all([
        transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: ownerEmail,
          subject: emailSubject,
          text: ownerReminderLines,
        }),
        transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: clientEmail,
          subject: emailSubject,
          text: clientReminderLines,
        }),
      ]);
    }

    const shouldSendSms = Boolean(sendSms);
    const missingTwilioVars = getMissingEnvVars(TWILIO_REQUIRED_ENV_VARS);
    const ownerSmsNumber = normalizePhoneForTwilio(ownerPhone);
    const clientSmsNumber = normalizePhoneForTwilio(clientPhone);

    if (shouldSendSms && missingTwilioVars.length === 0) {
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID as string,
        process.env.TWILIO_AUTH_TOKEN as string
      );

      const smsTargets = [
        {
          to: ownerSmsNumber,
          body: `Midtown Painting Home Services: Reminder - appointment with ${fullName} is ${displayDate} at ${displayTime}, in ${reminderLeadMinutes}m. ${projectType || "Painting"} | ${projectSummary}. Location: ${projectAddressSms}`,
          target: "owner",
        },
        {
          to: clientSmsNumber,
          body: `Midtown Painting Home Services: Reminder - your appointment with Carter Jenkins is ${displayDate} at ${displayTime}, in ${reminderLeadMinutes}m. ${projectSummary}. Location: ${projectAddressSms}`,
          target: "client",
        },
      ] as const;

      const smsTargetsByPhone = new Map<
        string,
        {
          to: string;
          body: string;
          target: string;
        }
      >();

      for (const sms of smsTargets) {
        if (!sms.to) {
          logger.warn("Skipping SMS reminder due to invalid or missing phone number", {
            target: sms.target,
          });
          continue;
        }

        if (!smsTargetsByPhone.has(sms.to)) {
          smsTargetsByPhone.set(sms.to, {
            to: sms.to,
            body: sms.body,
            target: sms.target,
          });
          continue;
        }

        smsTargetsByPhone.set(sms.to, {
          to: sms.to,
          target: "owner+client",
          body: `Midtown Painting Home Services: Reminder - appointment with Carter Jenkins and ${fullName} is ${displayDate} at ${displayTime}, in ${reminderLeadMinutes}m. ${projectType || "Painting"} | ${projectSummary}. Location: ${projectAddressSms}`,
        });

        logger.info("Deduplicated reminder SMS recipient because owner and client share a phone number", {
          phone: maskPhoneNumber(sms.to),
        });
      }

      await Promise.all(
        Array.from(smsTargetsByPhone.values()).map(async (sms) => {
          const twilioMessage = await twilioClient.messages.create({
            from: process.env.TWILIO_FROM_NUMBER as string,
            to: sms.to,
            body: sms.body,
          });

          logger.info("Twilio accepted reminder SMS", {
            target: sms.target,
            phone: maskPhoneNumber(sms.to),
            messageSid: twilioMessage.sid,
            twilioStatus: twilioMessage.status,
          });
        })
      );
    } else if (shouldSendSms) {
      logger.warn("Skipping SMS reminders because Twilio env vars are missing", {
        missingTwilioVars,
      });
    }

    logger.info("Booking reminders sent", {
      fullName,
      bookingStartIso,
      reminderLeadMinutes,
      sendEmail,
      sendSms,
      ownerEmail,
      clientEmail,
      smsAttempted: shouldSendSms && missingTwilioVars.length === 0,
    });

    return {
      reminded: true,
      reminderAtIso: reminderAt.toUTC().toISO(),
      bookingStartIso,
    };
  },
});

export const bookingSendConfirmationEmail = task({
  id: "booking-send-confirmation-email",
  queue: bookingNotificationQueue,
  run: async (payload: BookingConfirmationPayload) => {
    const missingSmtpEnvVars = getMissingEnvVars(SMTP_REQUIRED_ENV_VARS);
    if (missingSmtpEnvVars.length > 0) {
      throw new Error(`Missing required SMTP configuration: ${missingSmtpEnvVars.join(", ")}`);
    }

    const {
      ownerEmail = "",
      clientEmail = "",
      replyTo = "",
      ownerSubject = "",
      ownerText = "",
      clientSubject = "",
      clientText = "",
    } = payload ?? {};

    if (!ownerEmail || !ownerSubject || !ownerText || !clientSubject || !clientText) {
      throw new Error("Missing required booking confirmation email details.");
    }

    const transporter = createSmtpTransporter();
    await Promise.all([
      transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: ownerEmail,
        replyTo: replyTo || undefined,
        subject: ownerSubject,
        text: ownerText,
      }),
      clientEmail
        ? transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: clientEmail,
            subject: clientSubject,
            text: clientText,
          })
        : Promise.resolve(),
    ]);

    logger.info("Booking confirmation emails sent", {
      ownerEmail,
      clientEmail,
    });

    return {
      sent: true,
      ownerEmail,
      clientEmail,
    };
  },
});

export const bookingSendManageNotifications = task({
  id: "booking-send-manage-notifications",
  queue: bookingNotificationQueue,
  run: async (payload: ManageNotificationPayload) => sendManageNotifications(payload),
});

export const calendarWorkerKeepalive = task({
  id: "calendar-worker-keepalive",
  run: async () => ({
    ok: true,
    at: new Date().toISOString(),
  }),
});

export const calendarBookingKeepalive = task({
  id: "calendar-booking-keepalive",
  queue: calendarBookingQueue,
  run: async () => ({
    ok: true,
    at: new Date().toISOString(),
  }),
});

export const calendarBookSlot = task({
  id: "calendar-book-slot",
  queue: calendarBookingQueue,
  run: async (payload: BookingPayload): Promise<BookingResult> => {
    const missingCalendarEnvVars = getMissingEnvVars(CALENDAR_REQUIRED_ENV_VARS);
    if (missingCalendarEnvVars.length > 0) {
      throw new Error(
        `Missing required Google Calendar configuration: ${missingCalendarEnvVars.join(", ")}`
      );
    }

    const missingSmtpEnvVars = getMissingEnvVars(SMTP_REQUIRED_ENV_VARS);
    if (missingSmtpEnvVars.length > 0) {
      throw new Error(`Missing required SMTP configuration: ${missingSmtpEnvVars.join(", ")}`);
    }

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
    const calendarId = process.env.GOOGLE_CALENDAR_ID as string;
    const busyIntervals = await getBusyIntervals(
      calendarClient,
      calendarId,
      settings.timezone,
      slotStart.minus({ minutes: 1 }).toUTC().toISO() as string,
      slotEnd.plus({ minutes: 1 }).toUTC().toISO() as string
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
    const googleSendUpdatesMode = getGoogleSendUpdatesMode();

    const eventInsertResponse = await calendarClient.events.insert({
      calendarId,
      sendUpdates: googleSendUpdatesMode,
      requestBody: {
        summary: `Midtown Painting Home Services - 15-Min Consultation - ${normalizedFullName}`,
        description: bookingSummary,
        start: {
          dateTime: slotStart.toISO() as string,
          timeZone: settings.timezone,
        },
        end: {
          dateTime: slotEnd.toISO() as string,
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
    const clientManageLink = eventId
      ? buildManageBookingLink(eventId, "client", clientManageToken)
      : null;
    const carterManageLink = eventId
      ? buildManageBookingLink(eventId, "carter", carterManageToken)
      : null;
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

    try {
      const confirmationHandle = await bookingSendConfirmationEmail.trigger(
        {
          ownerEmail,
          clientEmail: normalizedEmail,
          replyTo: normalizedEmail,
          ownerSubject: `New Phone Consultation Booked - ${normalizedFullName}`,
          ownerText: ownerLines,
          clientSubject: "Your Midtown Painting Home Services Call Is Confirmed",
          clientText: customerLines,
        },
        {
          ttl: process.env.BOOKING_CONFIRMATION_EMAIL_TTL || "2h",
        }
      );
      logger.info("Queued booking confirmation email task", {
        runId: getRunIdFromHandle(confirmationHandle),
        eventId,
      });
    } catch (error) {
      logger.warn("Unable to queue booking confirmation email task", {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const reminderRunTtl = process.env.BOOKING_REMINDER_RUN_TTL || "24h";
    const bookingStartIsoUtc = slotStart.toUTC().toISO() as string;
    const ownerPhone = process.env.BOOKING_OWNER_PHONE || "";
    const nowInBookingTimezone = DateTime.now().setZone(settings.timezone);
    const reminderSchedules: BookingResult["reminders"] = [];
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
    ] as const;

    const reminderDispatches = await Promise.all(
      reminderConfigs.map(async (reminderConfig) => {
        if (!reminderConfig.sendEmail && !reminderConfig.sendSms) {
          return null;
        }

        if (
          !Number.isFinite(reminderConfig.reminderMinutesBefore) ||
          reminderConfig.reminderMinutesBefore < 1
        ) {
          logger.warn("Skipping reminder trigger because reminder offset is invalid", {
            reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
          });
          return null;
        }

        const reminderAt = slotStart.minus({ minutes: reminderConfig.reminderMinutesBefore });
        const triggerOptions: { delay?: Date; ttl: string } = {
          ttl: reminderRunTtl,
        };
        const delayApplied = reminderAt > nowInBookingTimezone;

        if (delayApplied) {
          triggerOptions.delay = reminderAt.toJSDate();
        }

        const reminderHandle = await bookingSendReminder.trigger(
          {
            bookingStartIso: bookingStartIsoUtc,
            timezone: settings.timezone,
            reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
            sendEmail: reminderConfig.sendEmail,
            sendSms: reminderConfig.sendSms,
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
            ownerPhone,
          },
          triggerOptions
        );

        const runId = getRunIdFromHandle(reminderHandle);
        const reminderAtIso = reminderAt.toUTC().toISO() as string;
        const reminderAtLabel = `${reminderAt.toFormat("cccc, LLLL d 'at' h:mm a")} (${reminderAt.offsetNameShort || settings.timezone})`;

        logger.info("Scheduled booking reminder run", {
          runId,
          reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
          reminderAtIso,
          delayApplied,
          ttl: reminderRunTtl,
          sendEmail: reminderConfig.sendEmail,
          sendSms: reminderConfig.sendSms,
        });

        return {
          reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
          sendEmail: reminderConfig.sendEmail,
          sendSms: reminderConfig.sendSms,
          reminderAtIso,
          reminderAtLabel,
          runId,
          delayApplied,
        };
      })
    );

    for (const reminderDispatch of reminderDispatches) {
      if (!reminderDispatch) {
        continue;
      }
      reminderSchedules.push(reminderDispatch);
    }

    logger.info("Calendar slot booked", {
      fullName: normalizedFullName,
      email: normalizedEmail,
      eventId,
      startIso: slotStart.toUTC().toISO(),
      reminderSchedules,
    });

    return {
      message: "Call booked successfully.",
      booking: {
        eventId,
        displayDate,
        displayTime,
        timezone: settings.timezone,
        startIso: slotStart.toUTC().toISO() as string,
        endIso: slotEnd.toUTC().toISO() as string,
        manageLinks: {
          client: clientManageLink,
          carter: carterManageLink,
        },
      },
      reminders: reminderSchedules,
    };
  },
});

export const calendarManageContext = task({
  id: "calendar-manage-context",
  run: async (
    payload: ManageContextPayload
  ): Promise<ManageContextResult | ManageFailureResult> => {
    try {
      const missingCalendarEnvVars = getMissingEnvVars(CALENDAR_REQUIRED_ENV_VARS);
      if (missingCalendarEnvVars.length > 0) {
        throw new Error(
          `Missing required Google Calendar configuration: ${missingCalendarEnvVars.join(", ")}`
        );
      }

      const context = await getManageEventContext(payload);
      const cutoffMinutes = getSelfServiceCutoffMinutes();

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
          cutoffHours: Math.floor(cutoffMinutes / 60),
          reason: context.permissions.reason,
        },
      };
    } catch (error) {
      return handleManageTaskError("context", normalizeManageActor(payload?.actor), error);
    }
  },
});

export const calendarManageCancel = task({
  id: "calendar-manage-cancel",
  run: async (
    payload: ManageActionPayload
  ): Promise<ManageActionResult | ManageFailureResult> => {
    try {
      const missingCalendarEnvVars = getMissingEnvVars(CALENDAR_REQUIRED_ENV_VARS);
      if (missingCalendarEnvVars.length > 0) {
        throw new Error(
          `Missing required Google Calendar configuration: ${missingCalendarEnvVars.join(", ")}`
        );
      }

      const reason = requireManageReason(payload.reason, "cancellation");
      const context = await getManageEventContext(payload, {
        requireCancelable: true,
      });
      const calendarClient = getCalendarClient();
      const calendarId = process.env.GOOGLE_CALENDAR_ID as string;
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

      const notificationPayload: ManageNotificationPayload = {
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
      };
      const channelAvailability = getNotificationChannelAvailability();
      let notifications = {
        emailAttempted: channelAvailability.emailEnabled,
        emailSent: false,
        smsAttempted: channelAvailability.smsEnabled,
        smsSent: false,
      };

      try {
        const notificationsHandle = await bookingSendManageNotifications.trigger(notificationPayload, {
          ttl: process.env.BOOKING_MANAGE_NOTIFICATIONS_TTL || "2h",
        });
        logger.info("Queued manage-booking notifications task", {
          runId: getRunIdFromHandle(notificationsHandle),
          eventId: context.eventId,
          action: "cancel",
          actor: context.actor,
        });
      } catch (error) {
        notifications = {
          emailAttempted: false,
          emailSent: false,
          smsAttempted: false,
          smsSent: false,
        };
        logger.warn("Unable to queue manage-booking notifications task", {
          eventId: context.eventId,
          action: "cancel",
          actor: context.actor,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.info("Booking canceled through manage flow", {
        eventId: context.eventId,
        actor: context.actor,
        reason,
        notifications,
      });

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
    } catch (error) {
      return handleManageTaskError("cancel", normalizeManageActor(payload?.actor), error);
    }
  },
});

export const calendarManageReschedule = task({
  id: "calendar-manage-reschedule",
  run: async (
    payload: ManageReschedulePayload
  ): Promise<ManageActionResult | ManageFailureResult> => {
    try {
      const missingCalendarEnvVars = getMissingEnvVars(CALENDAR_REQUIRED_ENV_VARS);
      if (missingCalendarEnvVars.length > 0) {
        throw new Error(
          `Missing required Google Calendar configuration: ${missingCalendarEnvVars.join(", ")}`
        );
      }

      const reason = requireManageReason(payload.reason, "reschedule");
      const context = await getManageEventContext(payload, {
        requireReschedulable: true,
      });
      const settings = getBookingSettings();
      const calendarClient = getCalendarClient();
      const calendarId = process.env.GOOGLE_CALENDAR_ID as string;
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
        newStart.minus({ minutes: 1 }).toUTC().toISO() as string,
        newEnd.plus({ minutes: 1 }).toUTC().toISO() as string
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
            dateTime: newStart.toISO() as string,
            timeZone: settings.timezone,
          },
          end: {
            dateTime: newEnd.toISO() as string,
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
      const notificationPayload: ManageNotificationPayload = {
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
      };
      const channelAvailability = getNotificationChannelAvailability();
      let notifications = {
        emailAttempted: channelAvailability.emailEnabled,
        emailSent: false,
        smsAttempted: channelAvailability.smsEnabled,
        smsSent: false,
      };

      try {
        const notificationsHandle = await bookingSendManageNotifications.trigger(notificationPayload, {
          ttl: process.env.BOOKING_MANAGE_NOTIFICATIONS_TTL || "2h",
        });
        logger.info("Queued manage-booking notifications task", {
          runId: getRunIdFromHandle(notificationsHandle),
          eventId: context.eventId,
          action: "reschedule",
          actor: context.actor,
        });
      } catch (error) {
        notifications = {
          emailAttempted: false,
          emailSent: false,
          smsAttempted: false,
          smsSent: false,
        };
        logger.warn("Unable to queue manage-booking notifications task", {
          eventId: context.eventId,
          action: "reschedule",
          actor: context.actor,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.info("Booking rescheduled through manage flow", {
        eventId: context.eventId,
        actor: context.actor,
        reason,
        newStartIso: updatedDisplay.startIso,
        notifications,
      });

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
    } catch (error) {
      return handleManageTaskError("reschedule", normalizeManageActor(payload?.actor), error);
    }
  },
});
