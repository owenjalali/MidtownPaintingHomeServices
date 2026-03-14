import { tasks } from "@trigger.dev/sdk";
import { google } from "googleapis";
import { DateTime } from "luxon";
import {
  DEFAULT_FIELD_LINK_EXPIRY_DAYS,
  FIELD_BOOKING_SOURCE_KEY,
  FIELD_BOOKING_SOURCE_VALUE,
  FIELD_LEAD_ID_KEY,
  buildFieldBookingLink,
  createFieldBookingToken,
  createFieldLeadHttpError,
  createFieldLeadId,
  hashFieldBookingToken,
  isFieldLeadExpired,
  isFieldLeadHttpError,
  isFieldLeadPrivateProps,
  isFieldLeadRowBooked,
  isFieldLeadRowCancelled,
  isFieldLeadRowClosed,
  normalizeFieldLinkExpiryDays,
  normalizePhoneForTwilio,
  normalizePublicBaseUrl,
  normalizeText,
  parseFieldRepOptions,
  validateFieldAccessKey,
  verifyFieldBookingToken,
} from "./fieldLeadCore.mjs";
import {
  getFieldLeadNotificationAvailability,
  sendFieldLeadBookingNotificationsDirect,
} from "./fieldLeadNotifications.mjs";
import {
  appendFieldLeadRow,
  getFieldLeadRow,
  getFieldLeadRowByBookedEventId,
  getMissingFieldLeadStoreEnvVars,
  updateFieldLeadRow,
  updateFieldLeadRowByNumber,
} from "./fieldLeadStore.mjs";
import { syncFieldLeadRowPatch } from "./fieldLeadCrmSync.mjs";
import {
  getFieldLeadAccessKey,
  getFieldLeadInitialSmsDelaySeconds,
  getFieldLeadFollowupDelaySeconds,
  getFieldLeadGoogleConfig,
  getFieldLeadLinkExpiryDaysRaw,
  getFieldLeadOwnerEmail,
  getFieldLeadOwnerPhone,
  getFieldLeadPublicBaseUrl,
  getFieldLeadRepOptionsRaw,
  getMissingFieldLeadGoogleEnvVars,
  isFieldLeadEnabled,
  isFieldLeadPreviewOutboundOverrideEnabled,
  isFieldLeadProductionLane,
} from "./fieldLeadEnv.mjs";

const FIELD_INITIAL_SMS_RUN_TTL = "2d";
const FIELD_INITIAL_SMS_RESPONSE_WAIT_MS = 5000;
const FIELD_FOLLOWUP_RUN_TTL = "7d";
const MANAGE_CLIENT_TOKEN_KEY = "mp_client_token";
const MANAGE_CARTER_TOKEN_KEY = "mp_carter_token";
const MANAGE_CLIENT_NAME_KEY = "mp_client_name";
const MANAGE_CLIENT_EMAIL_KEY = "mp_client_email";
const MANAGE_CLIENT_PHONE_KEY = "mp_client_phone";
const REMINDER_RUN_TTL_BUFFER_SECONDS = 24 * 60 * 60;
const MIN_REMINDER_RUN_TTL_SECONDS = 15 * 60;
const DEFAULT_BOOKING_TIMEZONE = "America/Toronto";
const DEFAULT_BOOKING_DURATION_MINUTES = 15;
const DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES = 15;
const DEFAULT_BOOKING_MIN_NOTICE_MINUTES = 120;
const DEFAULT_DAY_START_MINUTES = 9 * 60;
const DEFAULT_DAY_END_MINUTES = 21 * 60;
const DEFAULT_DAY_START_CLOCK = "09:00";
const DEFAULT_DAY_END_CLOCK = "21:00";
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6, 7];

const normalizeDigits = (value) => normalizeText(value).replace(/\D/g, "");

const getRunIdFromHandle = (handle) => {
  if (!handle || typeof handle !== "object") {
    return null;
  }

  const maybeRunId = handle.id;
  return typeof maybeRunId === "string" && maybeRunId ? maybeRunId : null;
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

const isSlotWithinBookingWindow = (options) =>
  options.workingDays.has(options.weekday) &&
  options.slotStartMinutes >= options.dayStartMinutes &&
  options.slotEndMinutes <= options.dayEndMinutes;

const slotOverlapsBusyInterval = (slotStartMs, slotEndMs, busyIntervals) =>
  busyIntervals.some((busy) => slotStartMs < busy.endMs && slotEndMs > busy.startMs);

const parseDurationToSeconds = (value) => {
  if (typeof value === "number") {
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }

  const unitToSeconds = {
    s: 1,
    m: 60,
    h: 60 * 60,
    hr: 60 * 60,
    d: 24 * 60 * 60,
    w: 7 * 24 * 60 * 60,
  };

  let totalSeconds = 0;
  const tokenPattern = /(\d+)\s*(w|d|h|hr|m|s)/g;
  let tokenMatch = tokenPattern.exec(normalized);
  while (tokenMatch) {
    const amount = Number(tokenMatch[1]);
    const unit = tokenMatch[2];
    const multiplier = unitToSeconds[unit];
    if (!Number.isFinite(amount) || amount < 0 || !multiplier) {
      return null;
    }
    totalSeconds += amount * multiplier;
    tokenMatch = tokenPattern.exec(normalized);
  }

  const remainder = normalized.replace(tokenPattern, "").replace(/\s+/g, "");
  if (remainder.length > 0) {
    return null;
  }

  return totalSeconds > 0 ? totalSeconds : null;
};

const getReminderRunTtl = (reminderAt, nowInBookingTimezone) => {
  const configuredTtl = normalizeText(process.env.BOOKING_REMINDER_RUN_TTL);
  const secondsUntilReminder = Math.max(
    0,
    Math.ceil(reminderAt.diff(nowInBookingTimezone, "seconds").seconds || 0)
  );
  const minimumSafeTtlSeconds = Math.max(
    MIN_REMINDER_RUN_TTL_SECONDS,
    secondsUntilReminder + REMINDER_RUN_TTL_BUFFER_SECONDS
  );

  if (!configuredTtl) {
    return `${minimumSafeTtlSeconds}s`;
  }

  const configuredTtlSeconds = parseDurationToSeconds(configuredTtl);
  if (configuredTtlSeconds && configuredTtlSeconds < minimumSafeTtlSeconds) {
    return `${minimumSafeTtlSeconds}s`;
  }

  return configuredTtl;
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
    durationMinutes:
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : DEFAULT_BOOKING_DURATION_MINUTES,
    slotIntervalMinutes:
      Number.isFinite(slotIntervalMinutes) && slotIntervalMinutes > 0
        ? slotIntervalMinutes
        : DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES,
    minNoticeMinutes:
      Number.isFinite(minNoticeMinutes) && minNoticeMinutes >= 0
        ? minNoticeMinutes
        : DEFAULT_BOOKING_MIN_NOTICE_MINUTES,
    dayStartMinutes,
    dayEndMinutes,
    workingDays,
  };
};

const getCalendarClient = () => {
  const googleConfig = getFieldLeadGoogleConfig();
  const authClient = new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret
  );
  authClient.setCredentials({
    refresh_token: googleConfig.refreshToken,
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

const getOwnerBookingEmail = () => getFieldLeadOwnerEmail();

const getPublicBaseUrl = () =>
  normalizePublicBaseUrl(getFieldLeadPublicBaseUrl());

const resolveFieldPublicBaseUrl = (rawOverrideBaseUrl) => {
  if (!isFieldLeadProductionLane()) {
    const overrideBaseUrl = normalizeText(rawOverrideBaseUrl);
    if (overrideBaseUrl) {
      return normalizePublicBaseUrl(overrideBaseUrl);
    }
  }

  return getPublicBaseUrl();
};

const createManageToken = () => createFieldBookingToken();

const buildManageBookingLink = (eventId, actor, token, rawBaseUrl) => {
  const url = new URL("/manage-booking", resolveFieldPublicBaseUrl(rawBaseUrl));
  url.searchParams.set("eventId", eventId);
  url.searchParams.set("actor", actor);
  url.searchParams.set("token", token);
  return url.toString();
};

const getFieldLeadConfigState = () => {
  const repOptions = parseFieldRepOptions(getFieldLeadRepOptionsRaw());
  const linkExpiryDays = normalizeFieldLinkExpiryDays(getFieldLeadLinkExpiryDaysRaw(), DEFAULT_FIELD_LINK_EXPIRY_DAYS);
  const notificationAvailability = getFieldLeadNotificationAvailability();
  const storeConfigured = getMissingFieldLeadStoreEnvVars().length === 0;
  const triggerConfigured = Boolean(normalizeText(process.env.TRIGGER_SECRET_KEY));
  const googleCalendarConfigured = getMissingFieldLeadGoogleEnvVars().length === 0;
  const ownerConfigured = Boolean(getFieldLeadOwnerEmail()) && Boolean(getFieldLeadOwnerPhone());
  const baseConfigured = Boolean(getFieldLeadAccessKey()) && repOptions.length > 0;
  const followupConfigured =
    triggerConfigured &&
    notificationAvailability.twilioConfigured &&
    notificationAvailability.smtpConfigured &&
    ownerConfigured &&
    getFieldLeadFollowupDelaySeconds() > 0;

  return {
    repOptions,
    linkExpiryDays,
    fieldLeadStoreConfigured: storeConfigured,
    fieldLeadTriggerConfigured: triggerConfigured,
    fieldLeadTwilioConfigured: notificationAvailability.twilioConfigured,
    fieldLeadFollowupConfigured: followupConfigured,
    fieldLeadLocalOnly: !isFieldLeadProductionLane(),
    fieldLeadPreviewOutboundOverrideEnabled: isFieldLeadPreviewOutboundOverrideEnabled(),
    fieldLeadConfigured:
      baseConfigured &&
      isFieldLeadEnabled() &&
      storeConfigured &&
      triggerConfigured &&
      notificationAvailability.twilioConfigured &&
      notificationAvailability.smtpConfigured &&
      googleCalendarConfigured &&
      ownerConfigured,
  };
};

const buildFieldLeadDisplayTime = (slotStart, timezone) => ({
  displayDate: slotStart.toFormat("cccc, LLLL d"),
  displayTime: `${slotStart.toFormat("h:mm a")} (${slotStart.offsetNameShort || timezone})`,
});

const normalizeFieldLeadRowForContext = (row) => ({
  leadId: row.leadId,
  customerName: row.customerName,
  customerPhoneE164: row.customerPhoneE164,
  customerAddress: row.customerAddress,
  repId: row.repId,
  repName: row.repName,
  projectNotes: row.projectNotes,
  bookingExpiresAtIso: row.bookingExpiresAtIso,
});

const createDefaultStore = () => ({
  appendFieldLeadRow,
  getFieldLeadRow,
  getFieldLeadRowByBookedEventId,
  updateFieldLeadRow,
  updateFieldLeadRowByNumber,
});

const createTaskClient = () => ({
  trigger: (...args) => tasks.trigger(...args),
});

const createDelay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const getFieldLeadRuntimeConfig = () => getFieldLeadConfigState();

export const createFieldLeadService = (options = {}) => {
  const store = options.store || createDefaultStore();
  const taskClient = options.taskClient || createTaskClient();
  const now = options.now || (() => DateTime.now());
  const sendBookingNotifications =
    options.sendBookingNotifications || sendFieldLeadBookingNotificationsDirect;
  const bookingSettingsResolver = options.getBookingSettings || getBookingSettings;
  const calendarClientFactory = options.getCalendarClient || getCalendarClient;
  const busyIntervalsFetcher = options.getBusyIntervals || getBusyIntervals;
  const ownerEmailResolver = options.getOwnerBookingEmail || getOwnerBookingEmail;
  const syncLeadRowPatch = (input) =>
    syncFieldLeadRowPatch({
      ...input,
      getFieldLeadRow: store.getFieldLeadRow,
      getFieldLeadRowByBookedEventId: store.getFieldLeadRowByBookedEventId,
      updateFieldLeadRowByNumber: store.updateFieldLeadRowByNumber,
    });

  const requireConfiguredRepOptions = () => {
    const repOptions = parseFieldRepOptions(getFieldLeadRepOptionsRaw());
    if (repOptions.length === 0) {
      throw createFieldLeadHttpError(
        500,
        "Field lead reps are not configured."
      );
    }

    return repOptions;
  };

  const requireValidAccessKey = (accessKey) => {
    if (!validateFieldAccessKey(accessKey, getFieldLeadAccessKey())) {
      throw createFieldLeadHttpError(403, "This field intake link is invalid.");
    }
  };

  const loadLeadForPublicToken = async (leadId, token) => {
    const normalizedLeadId = normalizeText(leadId);
    const normalizedToken = normalizeText(token);
    if (!normalizedLeadId || !normalizedToken) {
      throw createFieldLeadHttpError(400, "Missing required field lead details.");
    }

    const leadRow = await store.getFieldLeadRow(normalizedLeadId);
    if (!leadRow) {
      throw createFieldLeadHttpError(404, "Field lead could not be found.");
    }

    if (!verifyFieldBookingToken(normalizedToken, leadRow.bookingTokenHash)) {
      throw createFieldLeadHttpError(403, "This field booking link is invalid or expired.");
    }

    return leadRow;
  };

  const maybeMarkExpired = async (leadRow) => {
    if (
      isFieldLeadRowBooked(leadRow) ||
      isFieldLeadRowCancelled(leadRow) ||
      isFieldLeadRowClosed(leadRow) ||
      !isFieldLeadExpired(leadRow.bookingExpiresAtIso)
    ) {
      return leadRow;
    }

    if (leadRow.status === "expired") {
      return leadRow;
    }

    try {
      return await store.updateFieldLeadRowByNumber(leadRow.rowNumber, {
        status: "expired",
        lastError: "",
      });
    } catch {
      return {
        ...leadRow,
        status: "expired",
      };
    }
  };

  const scheduleFieldReminderRuns = async ({
    slotStart,
    timezone,
    customerName,
    customerPhone,
    customerAddress,
    repName,
    projectNotes,
    ownerEmail,
    ownerPhone,
  }) => {
    const nowInBookingTimezone = now().setZone(timezone);
    const reminderConfigs = [
      {
        reminderMinutesBefore: Number(process.env.BOOKING_REMINDER_1_MINUTES_BEFORE || 60),
        sendOwnerEmail: String(process.env.BOOKING_REMINDER_1_SEND_EMAIL || "true").trim() !== "false",
        sendSms: String(process.env.BOOKING_REMINDER_1_SEND_SMS || "true").trim() !== "false",
      },
      {
        reminderMinutesBefore: Number(process.env.BOOKING_REMINDER_2_MINUTES_BEFORE || 15),
        sendOwnerEmail: String(process.env.BOOKING_REMINDER_2_SEND_EMAIL || "false").trim() === "true",
        sendSms: String(process.env.BOOKING_REMINDER_2_SEND_SMS || "true").trim() !== "false",
      },
      {
        reminderMinutesBefore: Number(process.env.BOOKING_REMINDER_3_MINUTES_BEFORE || 5),
        sendOwnerEmail: String(process.env.BOOKING_REMINDER_3_SEND_EMAIL || "false").trim() === "true",
        sendSms: String(process.env.BOOKING_REMINDER_3_SEND_SMS || "false").trim() === "true",
      },
    ];

    const scheduledRuns = [];
    const errors = [];

    for (const reminderConfig of reminderConfigs) {
      if (!reminderConfig.sendOwnerEmail && !reminderConfig.sendSms) {
        continue;
      }

      if (
        !Number.isFinite(reminderConfig.reminderMinutesBefore) ||
        reminderConfig.reminderMinutesBefore < 1
      ) {
        continue;
      }

      const reminderAt = slotStart.minus({ minutes: reminderConfig.reminderMinutesBefore });
      const triggerOptions = {
        ttl: getReminderRunTtl(reminderAt, nowInBookingTimezone),
      };
      if (reminderAt > nowInBookingTimezone) {
        triggerOptions.delay = reminderAt.toJSDate();
      }

      try {
        const handle = await taskClient.trigger(
          "field-lead-send-reminder",
          {
            customerName,
            customerPhone,
            customerAddress,
            ownerEmail,
            ownerPhone,
            repName,
            projectNotes,
            bookingStartIso: slotStart.toUTC().toISO(),
            timezone,
            reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
            sendOwnerEmail: reminderConfig.sendOwnerEmail,
            sendSms: reminderConfig.sendSms,
          },
          triggerOptions
        );

        scheduledRuns.push({
          reminderMinutesBefore: reminderConfig.reminderMinutesBefore,
          sendEmail: reminderConfig.sendOwnerEmail,
          sendSms: reminderConfig.sendSms,
          reminderAtIso: reminderAt.toUTC().toISO(),
          reminderAtLabel: `${reminderAt.toFormat("cccc, LLLL d 'at' h:mm a")} (${
            reminderAt.offsetNameShort || timezone
          })`,
          runId: getRunIdFromHandle(handle),
          delayApplied: Boolean(triggerOptions.delay),
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      scheduledRuns,
      errors,
    };
  };

  const buildAvailabilityForMonth = async (month) => {
    const settings = bookingSettingsResolver();
    const monthStart = DateTime.fromFormat(normalizeText(month), "yyyy-MM", {
      zone: settings.timezone,
    }).startOf("month");
    if (!monthStart.isValid) {
      throw createFieldLeadHttpError(400, "Month must be in YYYY-MM format.");
    }

    const monthEnd = monthStart.endOf("month");
    const calendarClient = calendarClientFactory();
    const calendarId = getFieldLeadGoogleConfig().calendarId;
    const busyIntervals = await busyIntervalsFetcher(
      calendarClient,
      calendarId,
      settings.timezone,
      monthStart.startOf("day").toUTC().toISO(),
      monthEnd.endOf("day").toUTC().toISO()
    );

    const nowWithNotice = now().setZone(settings.timezone).plus({
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
      month: normalizeText(month),
      timezone: settings.timezone,
      durationMinutes: settings.durationMinutes,
      availabilityByDate,
      availableDates,
    };
  };

  return {
    getRuntimeConfig: () => getFieldLeadConfigState(),

    getConfig: ({ accessKey }) => {
      if (!isFieldLeadEnabled()) {
        throw createFieldLeadHttpError(404, "Field testing is not enabled in this environment.");
      }
      requireValidAccessKey(accessKey);
      const configState = requireConfiguredRepOptions();
      return {
        ok: true,
        repOptions: configState,
        linkExpiryDays: getFieldLeadConfigState().linkExpiryDays,
      };
    },

    createLead: async ({ accessKey, repId, fullName, phone, address, projectNotes, publicBaseUrl }) => {
      if (!isFieldLeadEnabled()) {
        throw createFieldLeadHttpError(404, "Field testing is not enabled in this environment.");
      }
      requireValidAccessKey(accessKey);
      const repOptions = requireConfiguredRepOptions();
      const rep = repOptions.find((option) => option.id === normalizeText(repId));
      if (!rep) {
        throw createFieldLeadHttpError(400, "Please choose a valid sales rep.");
      }

      const customerName = normalizeText(fullName);
      const customerPhoneE164 = normalizePhoneForTwilio(phone);
      const customerAddress = normalizeText(address);
      const normalizedProjectNotes = normalizeText(projectNotes);

      if (!customerName || !customerPhoneE164 || !normalizedProjectNotes) {
        throw createFieldLeadHttpError(
          400,
          "Rep, homeowner name, homeowner phone, and project notes are required."
        );
      }

      const createdAt = now().toUTC();
      const linkExpiryDays = getFieldLeadConfigState().linkExpiryDays;
      const bookingExpiresAt = createdAt.plus({ days: linkExpiryDays });
      const leadId = createFieldLeadId();
      const bookingToken = createFieldBookingToken();
      const bookingLink = buildFieldBookingLink(
        resolveFieldPublicBaseUrl(publicBaseUrl),
        leadId,
        bookingToken
      );

      let appendedRow;
      try {
        appendedRow = await store.appendFieldLeadRow({
          leadId,
          createdAtIso: createdAt.toISO(),
          status: "initial_sms_queued",
          repId: rep.id,
          repName: rep.name,
          customerName,
          customerPhoneE164,
          customerAddress,
          projectNotes: normalizedProjectNotes,
          bookingTokenHash: hashFieldBookingToken(bookingToken),
          bookingExpiresAtIso: bookingExpiresAt.toUTC().toISO(),
          initialSmsTaskRunId: "",
          initialSmsStatus: "queued",
          initialSmsSentAtIso: "",
          followupTaskRunId: "",
          followupStatus: "",
          followupScheduledForIso: "",
          followupSentAtIso: "",
          bookedAtIso: "",
          bookedSlotStartIso: "",
          bookedEventId: "",
          appointmentStatus: "",
          lastManagedAtIso: "",
          lastManagedBy: "",
          lastManagedReason: "",
          clientManageLink: "",
          carterManageLink: "",
          closedAtIso: "",
          closedReason: "",
          lastError: "",
        });
      } catch (error) {
        console.error("[field-lead] unable to append field lead row", error);
        throw createFieldLeadHttpError(
          502,
          "Unable to save the field lead right now. Please try again."
        );
      }

      const triggerPromise = taskClient.trigger(
        "field-lead-send-initial-sms",
        {
          leadId,
          bookingToken,
          bookingLink,
          customerName,
          customerPhone: customerPhoneE164,
          bookingExpiresAtIso: bookingExpiresAt.toUTC().toISO(),
          repName: rep.name,
          projectNotes: normalizedProjectNotes,
        },
        {
          delay: createdAt.plus({ seconds: getFieldLeadInitialSmsDelaySeconds() }).toJSDate(),
          ttl: FIELD_INITIAL_SMS_RUN_TTL,
        }
      );

      triggerPromise
        .then(async (handle) => {
          if (!appendedRow?.rowNumber) {
            return;
          }

          try {
            await store.updateFieldLeadRowByNumber(appendedRow.rowNumber, {
              status: "initial_sms_queued",
              initialSmsTaskRunId: getRunIdFromHandle(handle) || "",
              initialSmsStatus: "queued",
              lastError: "",
            });
          } catch (error) {
            console.warn("[field-lead] unable to persist initial sms queue status", error);
          }
        })
        .catch(async (error) => {
          if (!appendedRow?.rowNumber) {
            return;
          }

          try {
            await store.updateFieldLeadRowByNumber(appendedRow.rowNumber, {
              status: "initial_sms_failed",
              initialSmsStatus: "failed",
              lastError: error instanceof Error ? error.message : String(error),
            });
          } catch (storeError) {
            console.warn("[field-lead] unable to persist initial sms scheduling failure", storeError);
          }
        });

      const triggerOutcome = await Promise.race([
        triggerPromise
          .then((handle) => ({
            state: "resolved",
            runId: getRunIdFromHandle(handle),
          }))
          .catch((error) => ({
            state: "rejected",
            error,
          })),
        createDelay(FIELD_INITIAL_SMS_RESPONSE_WAIT_MS).then(() => ({
          state: "timeout",
        })),
      ]);

      if (triggerOutcome.state === "rejected") {
        throw createFieldLeadHttpError(
          502,
          "Unable to queue the first text right now. Please try again."
        );
      }

      const runId = triggerOutcome.state === "resolved" ? triggerOutcome.runId || null : null;

      return {
        ok: true,
        leadId,
        status: "initial_sms_queued",
        bookingExpiresAtIso: bookingExpiresAt.toUTC().toISO(),
        initialSmsTaskRunId: runId,
        initialSmsScheduledForIso: createdAt
          .plus({ seconds: getFieldLeadInitialSmsDelaySeconds() })
          .toUTC()
          .toISO(),
        manualTest: !isFieldLeadProductionLane()
          ? {
              bookingLink,
              outboundOverrideEnabled: isFieldLeadPreviewOutboundOverrideEnabled(),
            }
          : undefined,
      };
    },

    getLeadContext: async ({ leadId, token }) => {
      if (!isFieldLeadEnabled()) {
        throw createFieldLeadHttpError(404, "Field testing is not enabled in this environment.");
      }
      let leadRow = await loadLeadForPublicToken(leadId, token);
      leadRow = await maybeMarkExpired(leadRow);
      const bookingSettings = bookingSettingsResolver();

      if (isFieldLeadRowCancelled(leadRow)) {
        return {
          ok: true,
          message: "This consultation was cancelled and the original booking link is no longer active.",
          state: "closed",
          status: "cancelled",
          lead: normalizeFieldLeadRowForContext(leadRow),
        };
      }

      if (isFieldLeadRowClosed(leadRow)) {
        return {
          ok: true,
          message: "This booking link is no longer available.",
          state: "closed",
          status: "closed_no_booking",
          lead: normalizeFieldLeadRowForContext(leadRow),
        };
      }

      if (isFieldLeadRowBooked(leadRow)) {
        const display = buildFieldLeadDisplayTime(
          DateTime.fromISO(leadRow.bookedSlotStartIso, { setZone: true }).setZone(bookingSettings.timezone),
          bookingSettings.timezone
        );
        return {
          ok: true,
          state: "booked",
          status: leadRow.status,
          lead: normalizeFieldLeadRowForContext(leadRow),
          booking: {
            bookedAtIso: leadRow.bookedAtIso,
            slotStartIso: leadRow.bookedSlotStartIso,
            eventId: leadRow.bookedEventId,
            displayDate: display.displayDate,
            displayTime: display.displayTime,
            clientManageLink: leadRow.clientManageLink,
          },
        };
      }

      if (leadRow.status === "expired" || isFieldLeadExpired(leadRow.bookingExpiresAtIso)) {
        return {
          ok: true,
          state: "expired",
          status: "expired",
          lead: normalizeFieldLeadRowForContext(leadRow),
        };
      }

      return {
        ok: true,
        state: "open",
        status: leadRow.status,
        lead: normalizeFieldLeadRowForContext(leadRow),
      };
    },

    getAvailability: async ({ leadId, token, month }) => {
      if (!isFieldLeadEnabled()) {
        throw createFieldLeadHttpError(404, "Field testing is not enabled in this environment.");
      }

      const leadRow = await maybeMarkExpired(await loadLeadForPublicToken(leadId, token));
      if (isFieldLeadRowBooked(leadRow)) {
        throw createFieldLeadHttpError(409, "This field lead has already been booked.");
      }
      if (isFieldLeadRowCancelled(leadRow)) {
        throw createFieldLeadHttpError(
          410,
          "This consultation was cancelled and the original booking link is no longer active."
        );
      }
      if (isFieldLeadRowClosed(leadRow)) {
        throw createFieldLeadHttpError(410, "This booking link is no longer available.");
      }
      if (leadRow.status === "expired" || isFieldLeadExpired(leadRow.bookingExpiresAtIso)) {
        throw createFieldLeadHttpError(410, "This field booking link has expired.");
      }

      const missingCalendarEnvVars = getMissingFieldLeadGoogleEnvVars();
      if (missingCalendarEnvVars.length > 0) {
        throw createFieldLeadHttpError(
          500,
          `Missing required Google Calendar configuration: ${missingCalendarEnvVars.join(", ")}`
        );
      }

      return buildAvailabilityForMonth(month);
    },

    bookLead: async ({ leadId, token, slotStartIso, publicBaseUrl }) => {
      if (!isFieldLeadEnabled()) {
        throw createFieldLeadHttpError(404, "Field testing is not enabled in this environment.");
      }
      const leadRow = await maybeMarkExpired(await loadLeadForPublicToken(leadId, token));
      if (isFieldLeadRowBooked(leadRow)) {
        throw createFieldLeadHttpError(409, "This field lead has already been booked.");
      }
      if (isFieldLeadRowCancelled(leadRow)) {
        throw createFieldLeadHttpError(
          410,
          "This consultation was cancelled and the original booking link is no longer active."
        );
      }
      if (isFieldLeadRowClosed(leadRow)) {
        throw createFieldLeadHttpError(410, "This booking link is no longer available.");
      }
      if (leadRow.status === "expired" || isFieldLeadExpired(leadRow.bookingExpiresAtIso)) {
        throw createFieldLeadHttpError(410, "This field booking link has expired.");
      }

      const missingCalendarEnvVars = getMissingFieldLeadGoogleEnvVars();
      if (missingCalendarEnvVars.length > 0) {
        throw createFieldLeadHttpError(
          500,
          `Missing required Google Calendar configuration: ${missingCalendarEnvVars.join(", ")}`
        );
      }

      const settings = bookingSettingsResolver();
      const slotStartUtc = DateTime.fromISO(normalizeText(slotStartIso), { setZone: true }).toUTC();
      if (!slotStartUtc.isValid) {
        throw createFieldLeadHttpError(400, "Selected time slot is invalid.");
      }

      const slotStart = slotStartUtc.setZone(settings.timezone);
      const slotEnd = slotStart.plus({ minutes: settings.durationMinutes });
      const slotStartMinutes = slotStart.hour * 60 + slotStart.minute;
      const slotEndMinutes = slotEnd.hour * 60 + slotEnd.minute;
      const nowWithNotice = now().setZone(settings.timezone).plus({
        minutes: settings.minNoticeMinutes,
      });
      if (slotStart <= nowWithNotice) {
        throw createFieldLeadHttpError(
          400,
          `Please select a slot at least ${settings.minNoticeMinutes} minutes from now.`
        );
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
        throw createFieldLeadHttpError(400, "Selected time is outside Carter's booking window.");
      }

      const calendarClient = calendarClientFactory();
      const calendarId = getFieldLeadGoogleConfig().calendarId;
      const busyIntervals = await busyIntervalsFetcher(
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
        throw createFieldLeadHttpError(409, "That slot was just booked. Please select another time.");
      }

      const customerName = normalizeText(leadRow.customerName);
      const customerPhone = normalizePhoneForTwilio(leadRow.customerPhoneE164);
      const customerAddress = normalizeText(leadRow.customerAddress);
      const repName = normalizeText(leadRow.repName);
      const projectNotes = normalizeText(leadRow.projectNotes);
      if (!customerName || !customerPhone || !repName || !projectNotes) {
        throw createFieldLeadHttpError(400, "This field lead is missing required booking details.");
      }

      const clientManageToken = createManageToken();
      const carterManageToken = createManageToken();
      const eventInsertResponse = await calendarClient.events.insert({
        calendarId,
        sendUpdates: "none",
        requestBody: {
          summary: `Midtown Painting - Field Lead Consultation - ${customerName}`,
          description: [
            "Lead source: Door-to-door",
            `Captured by: ${repName}`,
            `Customer phone: ${customerPhone}`,
            `Address: ${customerAddress || "Not provided"}`,
            "Project notes:",
            projectNotes,
            "",
            `Scheduled start (${settings.timezone}): ${slotStart.toFormat("cccc, LLLL d, yyyy 'at' h:mm a")}`,
            `Scheduled end (${settings.timezone}): ${slotEnd.toFormat("cccc, LLLL d, yyyy 'at' h:mm a")}`,
          ].join("\n"),
          start: {
            dateTime: slotStart.toISO(),
            timeZone: settings.timezone,
          },
          end: {
            dateTime: slotEnd.toISO(),
            timeZone: settings.timezone,
          },
          reminders: {
            useDefault: true,
          },
          extendedProperties: {
            private: {
              [MANAGE_CLIENT_TOKEN_KEY]: clientManageToken,
              [MANAGE_CARTER_TOKEN_KEY]: carterManageToken,
              [MANAGE_CLIENT_NAME_KEY]: customerName,
              [MANAGE_CLIENT_EMAIL_KEY]: "",
              [MANAGE_CLIENT_PHONE_KEY]: customerPhone,
              [FIELD_BOOKING_SOURCE_KEY]: FIELD_BOOKING_SOURCE_VALUE,
              [FIELD_LEAD_ID_KEY]: leadRow.leadId,
            },
          },
        },
      });

      const eventId = eventInsertResponse.data.id || null;
      const clientManageLink = eventId
        ? buildManageBookingLink(eventId, "client", clientManageToken, publicBaseUrl)
        : null;
      const carterManageLink = eventId
        ? buildManageBookingLink(eventId, "carter", carterManageToken, publicBaseUrl)
        : null;
      const display = buildFieldLeadDisplayTime(slotStart, settings.timezone);
      let leadLogUpdated = true;

      try {
        const rowSync = await syncLeadRowPatch({
          leadId: leadRow.leadId,
          patch: {
            status: "booked",
            appointmentStatus: "scheduled",
            bookedAtIso: now().toUTC().toISO(),
            bookedSlotStartIso: slotStart.toUTC().toISO(),
            bookedEventId: eventId || "",
            lastManagedAtIso: "",
            lastManagedBy: "",
            lastManagedReason: "",
            clientManageLink: clientManageLink || "",
            carterManageLink: carterManageLink || "",
            lastError: "",
          },
        });
        leadLogUpdated = rowSync.ok;
        if (!rowSync.ok) {
          console.warn("[field-lead] unable to find row for booked field lead sync", {
            leadId: leadRow.leadId,
            eventId,
          });
        }
      } catch (error) {
        leadLogUpdated = false;
        console.warn("[field-lead] unable to update booked row in local store", error);
      }

      const ownerEmail = ownerEmailResolver();
      const ownerPhone = normalizePhoneForTwilio(getFieldLeadOwnerPhone());
      const bookingNotifications = await sendBookingNotifications({
        customerName,
        customerPhone,
        customerAddress,
        displayDate: display.displayDate,
        displayTime: display.displayTime,
        repName,
        projectNotes,
        ownerEmail,
        ownerPhone,
        clientManageLink,
        carterManageLink,
        eventId,
      });

      const reminderDispatches = await scheduleFieldReminderRuns({
        slotStart,
        timezone: settings.timezone,
        customerName,
        customerPhone,
        customerAddress,
        repName,
        projectNotes,
        ownerEmail,
        ownerPhone,
      });

      if (leadLogUpdated && reminderDispatches.errors.length > 0) {
        try {
          await store.updateFieldLeadRow(leadRow.leadId, {
            lastError: reminderDispatches.errors.join(" | ").slice(0, 500),
          });
        } catch {
          // Ignore best-effort logging failures.
        }
      }

      return {
        ok: true,
        message: "Field lead call booked successfully.",
        leadId: leadRow.leadId,
        booking: {
          eventId,
          displayDate: display.displayDate,
          displayTime: display.displayTime,
          timezone: settings.timezone,
          startIso: slotStart.toUTC().toISO(),
          endIso: slotEnd.toUTC().toISO(),
          manageLinks: {
            client: clientManageLink,
            carter: carterManageLink,
          },
        },
        notifications: bookingNotifications,
        reminders: reminderDispatches.scheduledRuns,
        leadLogUpdated,
      };
    },
  };
};

export {
  FIELD_BOOKING_SOURCE_KEY,
  FIELD_BOOKING_SOURCE_VALUE,
  FIELD_LEAD_ID_KEY,
  isFieldLeadHttpError,
  isFieldLeadPrivateProps,
};
