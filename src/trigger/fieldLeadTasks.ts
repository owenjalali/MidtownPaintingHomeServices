import { logger, queue, task, tasks } from "@trigger.dev/sdk";
import { DateTime } from "luxon";
import {
  isFieldLeadExpired,
  isFieldLeadRowBooked,
  isFieldLeadRowCancelled,
  isFieldLeadRowClosed,
  verifyFieldBookingToken,
} from "../../server/fieldLeadCore.mjs";
import {
  sendFieldLeadFollowupNotificationsDirect,
  sendFieldLeadInitialSmsDirect,
  sendFieldLeadReminderNotificationsDirect,
} from "../../server/fieldLeadNotifications.mjs";
import {
  getFieldLeadFollowupDelaySeconds,
  getFieldLeadOwnerEmail,
  getFieldLeadOwnerPhone,
} from "../../server/fieldLeadEnv.mjs";
import {
  getFieldLeadRow,
  updateFieldLeadRowByNumber,
} from "../../server/fieldLeadStore.mjs";

type InitialSmsPayload = {
  leadId: string;
  bookingToken: string;
  bookingLink: string;
  customerName: string;
  customerPhone: string;
  bookingExpiresAtIso: string;
  repName?: string;
  projectNotes?: string;
};

type FieldLeadReminderPayload = {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  ownerEmail: string;
  ownerPhone: string | null;
  repName: string;
  projectNotes: string;
  bookingStartIso: string;
  timezone: string;
  reminderMinutesBefore: number;
  sendOwnerEmail: boolean;
  sendSms: boolean;
};

type FieldLeadFollowupPayload = {
  leadId: string;
  bookingToken: string;
  bookingLink: string;
};

type TriggerTaskLike = (
  id: string,
  payload: object,
  options?: {
    delay?: Date;
    ttl?: string;
  }
) => Promise<{ id?: string | null }>;

const FIELD_FOLLOWUP_RUN_TTL = "7d";
const fieldLeadTaskTestOverrides: Partial<{
  triggerTask: TriggerTaskLike;
  getFieldLeadRow: typeof getFieldLeadRow;
  updateFieldLeadRowByNumber: typeof updateFieldLeadRowByNumber;
  sendFieldLeadInitialSmsDirect: typeof sendFieldLeadInitialSmsDirect;
  sendFieldLeadReminderNotificationsDirect: typeof sendFieldLeadReminderNotificationsDirect;
  sendFieldLeadFollowupNotificationsDirect: typeof sendFieldLeadFollowupNotificationsDirect;
  getFieldLeadFollowupDelaySeconds: typeof getFieldLeadFollowupDelaySeconds;
  getFieldLeadOwnerEmail: typeof getFieldLeadOwnerEmail;
  getFieldLeadOwnerPhone: typeof getFieldLeadOwnerPhone;
  nowIso: () => string;
}> = {};

const fieldLeadInitialSmsQueue = queue({
  name: "field-lead-initial-sms",
  concurrencyLimit: 2,
});

const fieldLeadReminderQueue = queue({
  name: "field-lead-reminders",
  concurrencyLimit: 2,
});

const fieldLeadFollowupQueue = queue({
  name: "field-lead-followups",
  concurrencyLimit: 2,
});

export const setFieldLeadTaskTestOverrides = (
  overrides: Partial<typeof fieldLeadTaskTestOverrides> = {}
) => {
  for (const key of Object.keys(fieldLeadTaskTestOverrides) as Array<keyof typeof fieldLeadTaskTestOverrides>) {
    delete fieldLeadTaskTestOverrides[key];
  }
  Object.assign(fieldLeadTaskTestOverrides, overrides);
};

const getTaskDeps = () => ({
  triggerTask:
    fieldLeadTaskTestOverrides.triggerTask ||
    ((id, payload, options) => tasks.trigger(id, payload, options)) as TriggerTaskLike,
  getFieldLeadRow: fieldLeadTaskTestOverrides.getFieldLeadRow || getFieldLeadRow,
  updateFieldLeadRowByNumber:
    fieldLeadTaskTestOverrides.updateFieldLeadRowByNumber || updateFieldLeadRowByNumber,
  sendFieldLeadInitialSmsDirect:
    fieldLeadTaskTestOverrides.sendFieldLeadInitialSmsDirect || sendFieldLeadInitialSmsDirect,
  sendFieldLeadReminderNotificationsDirect:
    fieldLeadTaskTestOverrides.sendFieldLeadReminderNotificationsDirect ||
    sendFieldLeadReminderNotificationsDirect,
  sendFieldLeadFollowupNotificationsDirect:
    fieldLeadTaskTestOverrides.sendFieldLeadFollowupNotificationsDirect ||
    sendFieldLeadFollowupNotificationsDirect,
  getFieldLeadFollowupDelaySeconds:
    fieldLeadTaskTestOverrides.getFieldLeadFollowupDelaySeconds || getFieldLeadFollowupDelaySeconds,
  getFieldLeadOwnerEmail:
    fieldLeadTaskTestOverrides.getFieldLeadOwnerEmail || getFieldLeadOwnerEmail,
  getFieldLeadOwnerPhone:
    fieldLeadTaskTestOverrides.getFieldLeadOwnerPhone || getFieldLeadOwnerPhone,
  nowIso: fieldLeadTaskTestOverrides.nowIso || (() => new Date().toISOString()),
});

export const getFollowupKeys = () => ({
  taskRunId: "followupTaskRunId",
  status: "followupStatus",
  scheduledForIso: "followupScheduledForIso",
  sentAtIso: "followupSentAtIso",
});

export const formatElapsedSince = (sentAtIso: string, nowIso: string) => {
  const sentAt = DateTime.fromISO(String(sentAtIso || "").trim(), { setZone: true });
  const current = DateTime.fromISO(String(nowIso || "").trim(), { setZone: true });
  if (!sentAt.isValid || !current.isValid || current < sentAt) {
    return "an unknown amount of time";
  }

  const totalMinutes = Math.max(0, Math.round(current.diff(sentAt, "minutes").minutes || 0));
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 48) {
    return `${totalHours} hour${totalHours === 1 ? "" : "s"}`;
  }

  const totalDays = Math.round(totalHours / 24);
  return `${totalDays} day${totalDays === 1 ? "" : "s"}`;
};

const markFollowupSkipped = async (rowNumber: number, lastError = "") => {
  const keys = getFollowupKeys();
  const deps = getTaskDeps();
  await deps.updateFieldLeadRowByNumber(rowNumber, {
    [keys.status]: "skipped",
    lastError,
  });
};

const scheduleFieldLeadFollowup = async ({
  leadId,
  bookingToken,
  bookingLink,
  rowNumber,
  initialSmsSentAtIso,
}: {
  leadId: string;
  bookingToken: string;
  bookingLink: string;
  rowNumber: number;
  initialSmsSentAtIso: string;
}) => {
  const deps = getTaskDeps();
  const sentAt = DateTime.fromISO(initialSmsSentAtIso, { setZone: true }).toUTC();
  if (!sentAt.isValid) {
    return;
  }

  const delaySeconds = deps.getFieldLeadFollowupDelaySeconds();
  if (!Number.isFinite(delaySeconds) || delaySeconds <= 0) {
    return;
  }

  const scheduledFor = sentAt.plus({ seconds: delaySeconds });
  const keys = getFollowupKeys();

  try {
    const handle = await deps.triggerTask(
      "field-lead-send-followup",
      {
        leadId,
        bookingToken,
        bookingLink,
      } satisfies FieldLeadFollowupPayload,
      {
        delay: scheduledFor.toJSDate(),
        ttl: FIELD_FOLLOWUP_RUN_TTL,
      }
    );

    await deps.updateFieldLeadRowByNumber(rowNumber, {
      [keys.taskRunId]: typeof handle?.id === "string" ? handle.id : "",
      [keys.status]: "queued",
      [keys.scheduledForIso]: scheduledFor.toISO() || "",
    });
  } catch (error) {
    await deps.updateFieldLeadRowByNumber(rowNumber, {
      [keys.status]: "failed",
      lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
    });
  }
};

export const runFieldLeadSendInitialSms = async (payload: InitialSmsPayload) => {
  const deps = getTaskDeps();
  const leadId = String(payload?.leadId || "").trim();
  const bookingToken = String(payload?.bookingToken || "").trim();
  const bookingLink = String(payload?.bookingLink || "").trim();
  const customerName = String(payload?.customerName || "").trim();
  const customerPhone = String(payload?.customerPhone || "").trim();

  if (!leadId || !bookingToken || !bookingLink || !customerName || !customerPhone) {
    throw new Error("Missing required initial SMS details.");
  }

  const row = await deps.getFieldLeadRow(leadId);
  if (!row?.rowNumber) {
    throw new Error("Field lead row could not be found.");
  }

  if (row.initialSmsStatus === "sent" || row.initialSmsSentAtIso) {
    logger.info("Skipping duplicate initial field lead SMS", { leadId });
    return {
      skipped: true,
      reason: "already_sent",
    };
  }

  if (isFieldLeadRowClosed(row)) {
    logger.info("Skipping initial field lead SMS because the lead is closed", { leadId });
    return {
      skipped: true,
      reason: "closed",
    };
  }

  if (isFieldLeadRowCancelled(row)) {
    logger.info("Skipping initial field lead SMS because the lead was cancelled", { leadId });
    return {
      skipped: true,
      reason: "cancelled",
    };
  }

  if (isFieldLeadRowBooked(row)) {
    logger.info("Skipping initial field lead SMS because the lead is already booked", { leadId });
    return {
      skipped: true,
      reason: "already_booked",
    };
  }

  if (!verifyFieldBookingToken(bookingToken, row.bookingTokenHash)) {
    await deps.updateFieldLeadRowByNumber(row.rowNumber, {
      status: "initial_sms_failed",
      initialSmsStatus: "failed",
      lastError: "Booking token verification failed before sending the initial SMS.",
    });
    throw new Error("Field lead booking token verification failed.");
  }

  if (row.status === "expired" || isFieldLeadExpired(row.bookingExpiresAtIso || payload.bookingExpiresAtIso)) {
    await deps.updateFieldLeadRowByNumber(row.rowNumber, {
      status: "expired",
      lastError: "",
    });
    logger.info("Skipping initial field lead SMS because the booking link is expired", { leadId });
    return {
      skipped: true,
      reason: "expired",
    };
  }

  const smsSent = await deps.sendFieldLeadInitialSmsDirect({
    customerName,
    customerPhone,
    bookingLink,
  });

  if (!smsSent) {
    await deps.updateFieldLeadRowByNumber(row.rowNumber, {
      status: "initial_sms_failed",
      initialSmsStatus: "failed",
      lastError: "The initial field lead SMS was not accepted for delivery.",
    });
    throw new Error("The initial field lead SMS was not accepted for delivery.");
  }

  const sentAtIso = deps.nowIso();
  await deps.updateFieldLeadRowByNumber(row.rowNumber, {
    status: "initial_sms_sent",
    initialSmsStatus: "sent",
    initialSmsSentAtIso: sentAtIso,
    lastError: "",
  });

  await scheduleFieldLeadFollowup({
    leadId,
    bookingToken,
    bookingLink,
    rowNumber: row.rowNumber,
    initialSmsSentAtIso: sentAtIso,
  });

  logger.info("Initial field lead SMS sent", {
    leadId,
    sentAtIso,
  });

  return {
    sent: true,
    leadId,
    sentAtIso,
  };
};

export const fieldLeadSendInitialSms = task({
  id: "field-lead-send-initial-sms",
  queue: fieldLeadInitialSmsQueue,
  run: runFieldLeadSendInitialSms,
});

export const runFieldLeadSendReminder = async (payload: FieldLeadReminderPayload) => {
  const deps = getTaskDeps();
  const bookingStartIso = String(payload?.bookingStartIso || "").trim();
  const timezone = String(payload?.timezone || "America/Toronto").trim();
  const bookingStart = DateTime.fromISO(bookingStartIso, { setZone: true }).setZone(timezone);
  if (!bookingStartIso || !bookingStart.isValid) {
    throw new Error("Field lead reminder booking time is invalid.");
  }

  const reminderMinutesBefore = Number(payload?.reminderMinutesBefore);
  if (!Number.isFinite(reminderMinutesBefore) || reminderMinutesBefore < 1) {
    throw new Error("Field lead reminder timing is invalid.");
  }

  const sendOwnerEmail = Boolean(payload?.sendOwnerEmail);
  const sendSms = Boolean(payload?.sendSms);
  if (!sendOwnerEmail && !sendSms) {
    logger.info("Skipping field lead reminder because all channels are disabled", {
      bookingStartIso,
      reminderMinutesBefore,
    });
    return {
      skipped: true,
      reason: "channels_disabled",
    };
  }

  const displayDate = bookingStart.toFormat("cccc, LLLL d");
  const displayTime = `${bookingStart.toFormat("h:mm a")} (${bookingStart.offsetNameShort || timezone})`;
  const notifications = await deps.sendFieldLeadReminderNotificationsDirect({
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerAddress: payload.customerAddress,
    ownerEmail: payload.ownerEmail,
    ownerPhone: payload.ownerPhone,
    displayDate,
    displayTime,
    reminderMinutesBefore,
    repName: payload.repName,
    projectNotes: payload.projectNotes,
    sendOwnerEmail,
    sendSms,
  });

  if (sendSms && !notifications.customerSmsSent) {
    throw new Error("Field lead customer reminder SMS was not accepted for delivery.");
  }

  logger.info("Field lead reminder processed", {
    bookingStartIso,
    reminderMinutesBefore,
    sendOwnerEmail,
    sendSms,
    notifications,
  });

  return {
    reminded: true,
    bookingStartIso,
    reminderMinutesBefore,
    notifications,
  };
};

export const fieldLeadSendReminder = task({
  id: "field-lead-send-reminder",
  queue: fieldLeadReminderQueue,
  run: runFieldLeadSendReminder,
});

export const runFieldLeadSendFollowup = async (payload: FieldLeadFollowupPayload) => {
  const deps = getTaskDeps();
  const leadId = String(payload?.leadId || "").trim();
  const bookingToken = String(payload?.bookingToken || "").trim();
  const bookingLink = String(payload?.bookingLink || "").trim();

  if (!leadId || !bookingToken || !bookingLink) {
    throw new Error("Missing required follow-up details.");
  }

  const row = await deps.getFieldLeadRow(leadId);
  if (!row?.rowNumber) {
    throw new Error("Field lead row could not be found.");
  }

  const keys = getFollowupKeys();
  if (row[keys.status] === "sent" || row[keys.sentAtIso]) {
    logger.info("Skipping duplicate field lead follow-up", { leadId });
    return {
      skipped: true,
      reason: "already_sent",
    };
  }

  if (isFieldLeadRowBooked(row)) {
    await markFollowupSkipped(row.rowNumber);
    return {
      skipped: true,
      reason: "already_booked",
    };
  }

  if (isFieldLeadRowClosed(row)) {
    await markFollowupSkipped(row.rowNumber);
    return {
      skipped: true,
      reason: "closed",
    };
  }

  if (isFieldLeadRowCancelled(row)) {
    await markFollowupSkipped(row.rowNumber);
    return {
      skipped: true,
      reason: "cancelled",
    };
  }

  if (row.status === "expired" || isFieldLeadExpired(row.bookingExpiresAtIso)) {
    await deps.updateFieldLeadRowByNumber(row.rowNumber, {
      status: "expired",
      [keys.status]: "skipped",
      lastError: "",
    });
    return {
      skipped: true,
      reason: "expired",
    };
  }

  if (!verifyFieldBookingToken(bookingToken, row.bookingTokenHash)) {
    await markFollowupSkipped(row.rowNumber);
    return {
      skipped: true,
      reason: "invalid_token",
    };
  }

  const nowIso = deps.nowIso();
  const elapsedLabel = formatElapsedSince(row.initialSmsSentAtIso, nowIso);
  const ownerEmail = deps.getFieldLeadOwnerEmail();
  const ownerPhone = deps.getFieldLeadOwnerPhone();

  const notifications = await deps.sendFieldLeadFollowupNotificationsDirect({
    customerName: row.customerName,
    customerPhone: row.customerPhoneE164,
    customerAddress: row.customerAddress,
    ownerEmail,
    ownerPhone,
    repName: row.repName,
    projectNotes: row.projectNotes,
    bookingLink,
    elapsedLabel,
    currentStatus: row.status,
  });

  if (!notifications.customerSmsSent) {
    await deps.updateFieldLeadRowByNumber(row.rowNumber, {
      [keys.status]: "failed",
      lastError: "The field lead follow-up SMS was not accepted for delivery.",
    });
    throw new Error("The field lead follow-up SMS was not accepted for delivery.");
  }

  const partialFailures: string[] = [];
  if (ownerEmail && !notifications.ownerEmailSent) {
    partialFailures.push("Owner follow-up email was not accepted for delivery.");
  }
  if (ownerPhone && !notifications.ownerSmsSent) {
    partialFailures.push("Owner follow-up SMS was not accepted for delivery.");
  }

  await deps.updateFieldLeadRowByNumber(row.rowNumber, {
    [keys.status]: "sent",
    [keys.sentAtIso]: nowIso,
    lastError: partialFailures.join(" | ").slice(0, 500),
  });

  logger.info("Field lead follow-up sent", {
    leadId,
    nowIso,
    notifications,
  });

  return {
    sent: true,
    leadId,
    sentAtIso: nowIso,
    notifications,
  };
};

export const fieldLeadSendFollowup = task({
  id: "field-lead-send-followup",
  queue: fieldLeadFollowupQueue,
  run: runFieldLeadSendFollowup,
});
