import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const FIELD_LEAD_COLUMNS = Object.freeze([
  "leadId",
  "createdAtIso",
  "status",
  "repId",
  "repName",
  "customerName",
  "customerPhoneE164",
  "customerAddress",
  "projectNotes",
  "bookingTokenHash",
  "bookingExpiresAtIso",
  "initialSmsTaskRunId",
  "initialSmsStatus",
  "initialSmsSentAtIso",
  "followupTaskRunId",
  "followupStatus",
  "followupScheduledForIso",
  "followupSentAtIso",
  "bookedAtIso",
  "bookedSlotStartIso",
  "bookedEventId",
  "appointmentStatus",
  "lastManagedAtIso",
  "lastManagedBy",
  "lastManagedReason",
  "clientManageLink",
  "carterManageLink",
  "closedAtIso",
  "closedReason",
  "lastError",
]);

export const FIELD_LEAD_STATUS_VALUES = Object.freeze([
  "new",
  "initial_sms_queued",
  "initial_sms_sent",
  "initial_sms_failed",
  "booked",
  "cancelled",
  "expired",
  "closed_no_booking",
]);

export const FIELD_LEAD_APPOINTMENT_STATUS_VALUES = Object.freeze([
  "",
  "scheduled",
  "rescheduled",
  "cancelled",
]);

export const FIELD_BOOKING_SOURCE_KEY = "mp_booking_source";
export const FIELD_BOOKING_SOURCE_VALUE = "fieldLead";
export const FIELD_LEAD_ID_KEY = "mp_field_lead_id";
export const DEFAULT_FIELD_LINK_EXPIRY_DAYS = 7;

const EMAIL_SAFE_SEGMENT = /[^a-z0-9]+/g;
const REPEATING_DIGIT_PATTERN = /^(\d)\1{6,}$/;
const REPEATING_BLOCK_PATTERN = /^(\d{2,4})\1{2,}$/;
const FIELD_LEAD_COLUMN_ALIASES = Object.freeze({
  leadId: ["leadId"],
  createdAtIso: ["createdAtIso"],
  status: ["status"],
  repId: ["repId"],
  repName: ["repName"],
  customerName: ["customerName"],
  customerPhoneE164: ["customerPhoneE164"],
  customerAddress: ["customerAddress", "address"],
  projectNotes: ["projectNotes"],
  bookingTokenHash: ["bookingTokenHash"],
  bookingExpiresAtIso: ["bookingExpiresAtIso"],
  initialSmsTaskRunId: ["initialSmsTaskRunId"],
  initialSmsStatus: ["initialSmsStatus"],
  initialSmsSentAtIso: ["initialSmsSentAtIso"],
  followupTaskRunId: ["followupTaskRunId", "followup1TaskRunId"],
  followupStatus: ["followupStatus", "followup1Status"],
  followupScheduledForIso: ["followupScheduledForIso", "followup1ScheduledForIso"],
  followupSentAtIso: ["followupSentAtIso", "followup1SentAtIso"],
  bookedAtIso: ["bookedAtIso"],
  bookedSlotStartIso: ["bookedSlotStartIso"],
  bookedEventId: ["bookedEventId"],
  appointmentStatus: ["appointmentStatus"],
  lastManagedAtIso: ["lastManagedAtIso"],
  lastManagedBy: ["lastManagedBy"],
  lastManagedReason: ["lastManagedReason"],
  clientManageLink: ["clientManageLink"],
  carterManageLink: ["carterManageLink"],
  closedAtIso: ["closedAtIso"],
  closedReason: ["closedReason"],
  lastError: ["lastError"],
});

export const normalizeText = (value) => String(value ?? "").trim();
export const normalizeDigits = (value) => normalizeText(value).replace(/\D/g, "");

const timingSafeStringEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const getAliasedInputValue = (input, aliases) => {
  const safeInput = input && typeof input === "object" ? input : {};
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(safeInput, alias)) {
      return safeInput[alias];
    }
  }
  return "";
};

const inferAppointmentStatus = (input, row) => {
  const explicitStatus = normalizeText(getAliasedInputValue(input, FIELD_LEAD_COLUMN_ALIASES.appointmentStatus));
  if (explicitStatus) {
    return explicitStatus;
  }

  if (row.status === "cancelled") {
    return "cancelled";
  }

  if (row.status === "booked" && row.bookedEventId) {
    return "scheduled";
  }

  return "";
};

export const getFieldLeadColumnAliases = (columnName) =>
  Array.isArray(FIELD_LEAD_COLUMN_ALIASES[columnName])
    ? FIELD_LEAD_COLUMN_ALIASES[columnName]
    : [normalizeText(columnName)];

export const createFieldLeadHttpError = (statusCode, message, details = undefined) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
};

export const isFieldLeadHttpError = (error) =>
  Boolean(error && typeof error === "object" && Number.isInteger(error.statusCode));

export const normalizePhoneForTwilio = (value) => {
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

const normalizeRepOption = (value) => {
  if (typeof value === "string") {
    const name = normalizeText(value);
    if (!name) {
      return null;
    }

    const id =
      name
        .toLowerCase()
        .replace(EMAIL_SAFE_SEGMENT, "-")
        .replace(/^-+|-+$/g, "") || `rep-${randomBytes(4).toString("hex")}`;
    return {
      id,
      name,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const id = normalizeText(value.id);
  const name = normalizeText(value.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
  };
};

export const parseFieldRepOptions = (rawValue) => {
  const normalizedRawValue = normalizeText(rawValue);
  if (!normalizedRawValue) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(normalizedRawValue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const deduped = new Map();
  for (const item of parsed) {
    const normalizedOption = normalizeRepOption(item);
    if (!normalizedOption || deduped.has(normalizedOption.id)) {
      continue;
    }

    deduped.set(normalizedOption.id, normalizedOption);
  }

  return [...deduped.values()];
};

export const normalizeFieldLinkExpiryDays = (value, fallback = DEFAULT_FIELD_LINK_EXPIRY_DAYS) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

export const validateFieldAccessKey = (providedAccessKey, expectedAccessKey) => {
  const provided = normalizeText(providedAccessKey);
  const expected = normalizeText(expectedAccessKey);
  if (!provided || !expected) {
    return false;
  }

  return timingSafeStringEquals(provided, expected);
};

export const createFieldLeadId = () => `fld_${randomBytes(12).toString("hex")}`;

export const createFieldBookingToken = () => randomBytes(24).toString("base64url");

export const hashFieldBookingToken = (token) =>
  createHash("sha256").update(normalizeText(token)).digest("hex");

export const verifyFieldBookingToken = (token, expectedHash) => {
  const normalizedExpectedHash = normalizeText(expectedHash);
  if (!normalizedExpectedHash) {
    return false;
  }

  return timingSafeStringEquals(hashFieldBookingToken(token), normalizedExpectedHash);
};

export const isFieldLeadExpired = (bookingExpiresAtIso, now = new Date()) => {
  const expiresAtMs = Date.parse(normalizeText(bookingExpiresAtIso));
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= now.getTime();
};

export const normalizePublicBaseUrl = (rawBaseUrl) => {
  const fallback = "http://localhost:5173";
  try {
    const parsed = new URL(normalizeText(rawBaseUrl) || fallback);
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
};

export const buildFieldBookingLink = (rawBaseUrl, leadId, token) => {
  const url = new URL(
    `/field-booking/${encodeURIComponent(normalizeText(leadId))}`,
    normalizePublicBaseUrl(rawBaseUrl)
  );
  url.searchParams.set("token", normalizeText(token));
  return url.toString();
};

export const createFieldLeadRow = (input = {}) => {
  const row = FIELD_LEAD_COLUMNS.reduce((nextRow, columnName) => {
    nextRow[columnName] = normalizeText(getAliasedInputValue(input, getFieldLeadColumnAliases(columnName)));
    return nextRow;
  }, {});

  row.appointmentStatus = inferAppointmentStatus(input, row);
  return row;
};

export const fieldLeadRowToValues = (row) =>
  FIELD_LEAD_COLUMNS.map((columnName) => normalizeText(row[columnName]));

export const mapFieldLeadRow = (values, rowNumber = null, columns = FIELD_LEAD_COLUMNS) => {
  const source =
    Array.isArray(values)
      ? columns.reduce((row, columnName, index) => {
          row[columnName] = normalizeText(values[index]);
          return row;
        }, {})
      : values;

  const row = createFieldLeadRow(source);
  row.rowNumber = rowNumber;
  return row;
};

export const isFieldLeadRowBooked = (row) =>
  normalizeText(row?.status) === "booked" && Boolean(normalizeText(row?.bookedEventId));

export const isFieldLeadRowCancelled = (row) =>
  normalizeText(row?.status) === "cancelled" || normalizeText(row?.appointmentStatus) === "cancelled";

export const isFieldLeadRowClosed = (row) =>
  normalizeText(row?.status) === "closed_no_booking";

export const isFieldLeadPrivateProps = (privateProps) =>
  normalizeText(privateProps?.[FIELD_BOOKING_SOURCE_KEY]) === FIELD_BOOKING_SOURCE_VALUE;
