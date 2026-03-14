import { normalizeText } from "./fieldLeadCore.mjs";

export const parseBoolean = (value, fallback = false) => {
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

const getMissingEnvVars = (entries) =>
  entries
    .filter((entry) => !normalizeText(process.env[entry.key]))
    .map((entry) => entry.key);

export const getFieldLeadRuntimeEnvironment = () => {
  const vercelEnv = normalizeText(process.env.VERCEL_ENV).toLowerCase();
  if (vercelEnv === "production") {
    return "production";
  }
  if (vercelEnv === "preview") {
    return "preview";
  }
  if (vercelEnv === "development") {
    return "development";
  }
  return process.env.NODE_ENV === "production" ? "production" : "development";
};

export const isProductionRuntime = () => getFieldLeadRuntimeEnvironment() === "production";

export const isFieldLeadPreviewRuntime = () => getFieldLeadRuntimeEnvironment() === "preview";

export const isFieldLeadProductionLane = () => isProductionRuntime();

const getScopedFieldEnvValue = (suffix, options = {}) => {
  const normalizedSuffix = normalizeText(suffix);
  if (!normalizedSuffix) {
    return "";
  }

  const isProductionLane = isFieldLeadProductionLane();
  const keys = isProductionLane
    ? [`FIELD_${normalizedSuffix}`]
    : [
        `FIELD_TEST_${normalizedSuffix}`,
        ...(Array.isArray(options.nonProductionFallbackKeys) ? options.nonProductionFallbackKeys : []),
      ];

  for (const key of keys) {
    const value = normalizeText(process.env[key]);
    if (value) {
      return value;
    }
  }

  return "";
};

export const isFieldLeadEnabled = () => {
  if (!isFieldLeadProductionLane()) {
    return parseBoolean(process.env.FIELD_TEST_ENABLED, false);
  }

  return (
    parseBoolean(process.env.FIELD_ENABLED, false) &&
    parseBoolean(process.env.FIELD_ALLOW_PRODUCTION, false)
  );
};

export const getFieldLeadAccessKey = () =>
  getScopedFieldEnvValue("INTAKE_SECRET", {
    nonProductionFallbackKeys: ["FIELD_INTAKE_SECRET"],
  });

export const getFieldLeadRepOptionsRaw = () =>
  getScopedFieldEnvValue("REP_OPTIONS_JSON", {
    nonProductionFallbackKeys: ["FIELD_REP_OPTIONS_JSON"],
  });

export const getFieldLeadLinkExpiryDaysRaw = () =>
  getScopedFieldEnvValue("LINK_EXPIRY_DAYS", {
    nonProductionFallbackKeys: ["FIELD_LINK_EXPIRY_DAYS"],
  });

export const getFieldLeadStorePath = () =>
  getScopedFieldEnvValue("STORE_PATH") || "server/data/field-leads.local.json";

export const getFieldLeadStoreMode = () => {
  const normalized = getScopedFieldEnvValue("STORE_MODE").toLowerCase();
  return normalized === "google-sheets" ? "google-sheets" : "local-file";
};

const getScopedFieldEnvKeys = (suffixEntries) =>
  suffixEntries.map(([suffix, targetKey]) => ({
    key: isFieldLeadProductionLane() ? `FIELD_${suffix}` : `FIELD_TEST_${suffix}`,
    targetKey,
  }));

const getFieldSmtpEnvKeys = () =>
  getScopedFieldEnvKeys([
    ["SMTP_HOST", "host"],
    ["SMTP_PORT", "port"],
    ["SMTP_USER", "user"],
    ["SMTP_PASS", "pass"],
  ]);

const getFieldTwilioEnvKeys = () =>
  getScopedFieldEnvKeys([
    ["TWILIO_ACCOUNT_SID", "accountSid"],
    ["TWILIO_AUTH_TOKEN", "authToken"],
    ["TWILIO_FROM_NUMBER", "fromNumber"],
  ]);

const getFieldGoogleEnvKeys = () =>
  getScopedFieldEnvKeys([
    ["GOOGLE_CLIENT_ID", "clientId"],
    ["GOOGLE_CLIENT_SECRET", "clientSecret"],
    ["GOOGLE_REFRESH_TOKEN", "refreshToken"],
    ["GOOGLE_CALENDAR_ID", "calendarId"],
  ]);

const getFieldSheetsEnvKeys = () =>
  getScopedFieldEnvKeys([
    ["SHEETS_SPREADSHEET_ID", "spreadsheetId"],
    ["SHEETS_TAB_NAME", "tabName"],
    ["SHEETS_CLIENT_EMAIL", "clientEmail"],
    ["SHEETS_PRIVATE_KEY", "privateKey"],
  ]);

export const getMissingFieldLeadSmtpEnvVars = () => getMissingEnvVars(getFieldSmtpEnvKeys());
export const getMissingFieldLeadTwilioEnvVars = () => getMissingEnvVars(getFieldTwilioEnvKeys());
export const getMissingFieldLeadGoogleEnvVars = () => getMissingEnvVars(getFieldGoogleEnvKeys());
export const getMissingFieldLeadSheetsEnvVars = () => getMissingEnvVars(getFieldSheetsEnvKeys());

export const getFieldLeadOwnerEmail = () =>
  getScopedFieldEnvValue("OWNER_EMAIL");

export const getFieldLeadOwnerPhone = () =>
  getScopedFieldEnvValue("OWNER_PHONE");

export const getFieldLeadSmtpConfig = () => ({
  host: getScopedFieldEnvValue("SMTP_HOST"),
  port: Number(getScopedFieldEnvValue("SMTP_PORT") || 587),
  secure:
    parseBoolean(getScopedFieldEnvValue("SMTP_SECURE"), false) ||
    Number(getScopedFieldEnvValue("SMTP_PORT") || 587) === 465,
  user: getScopedFieldEnvValue("SMTP_USER"),
  pass: getScopedFieldEnvValue("SMTP_PASS"),
  from: getScopedFieldEnvValue("SMTP_FROM") || getScopedFieldEnvValue("SMTP_USER"),
});

export const getFieldLeadTwilioConfig = () => ({
  accountSid: getScopedFieldEnvValue("TWILIO_ACCOUNT_SID"),
  authToken: getScopedFieldEnvValue("TWILIO_AUTH_TOKEN"),
  fromNumber: getScopedFieldEnvValue("TWILIO_FROM_NUMBER"),
});

export const getFieldLeadGoogleConfig = () => ({
  clientId: getScopedFieldEnvValue("GOOGLE_CLIENT_ID"),
  clientSecret: getScopedFieldEnvValue("GOOGLE_CLIENT_SECRET"),
  refreshToken: getScopedFieldEnvValue("GOOGLE_REFRESH_TOKEN"),
  calendarId: getScopedFieldEnvValue("GOOGLE_CALENDAR_ID"),
});

export const getFieldLeadSheetsConfig = () => ({
  spreadsheetId: getScopedFieldEnvValue("SHEETS_SPREADSHEET_ID"),
  tabName: getScopedFieldEnvValue("SHEETS_TAB_NAME"),
  clientEmail: getScopedFieldEnvValue("SHEETS_CLIENT_EMAIL"),
  privateKey: getScopedFieldEnvValue("SHEETS_PRIVATE_KEY").replace(/\\n/g, "\n"),
});

export const getFieldLeadPublicBaseUrl = () =>
  getScopedFieldEnvValue("PUBLIC_BASE_URL") ||
  normalizeText(process.env.BOOKING_MANAGE_BASE_URL) ||
  normalizeText(process.env.CORS_ORIGIN);

const getFieldLeadFollowupDelayRaw = () => {
  const candidateKeys = isFieldLeadProductionLane()
    ? ["FIELD_FOLLOWUP_DELAY_MINUTES", "FIELD_FOLLOWUP_1_DELAY_MINUTES"]
    : ["FIELD_TEST_FOLLOWUP_DELAY_MINUTES", "FIELD_TEST_FOLLOWUP_1_DELAY_MINUTES"];

  for (const key of candidateKeys) {
    const value = normalizeText(process.env[key]);
    if (value) {
      return value;
    }
  }

  return "";
};

const getFieldLeadInitialSmsDelayRaw = () => {
  const candidateKeys = isFieldLeadProductionLane()
    ? ["FIELD_INITIAL_SMS_DELAY_SECONDS"]
    : ["FIELD_TEST_INITIAL_SMS_DELAY_SECONDS", "FIELD_INITIAL_SMS_DELAY_SECONDS"];

  for (const key of candidateKeys) {
    const value = normalizeText(process.env[key]);
    if (value) {
      return value;
    }
  }

  return "";
};

const getFieldLeadFollowupDelaySecondsRaw = () => {
  const candidateKeys = isFieldLeadProductionLane()
    ? ["FIELD_FOLLOWUP_DELAY_SECONDS"]
    : ["FIELD_TEST_FOLLOWUP_DELAY_SECONDS", "FIELD_FOLLOWUP_DELAY_SECONDS"];

  for (const key of candidateKeys) {
    const value = normalizeText(process.env[key]);
    if (value) {
      return value;
    }
  }

  return "";
};

const normalizeNonNegativeInteger = (value, fallback) => {
  if (!normalizeText(value)) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

export const getFieldLeadInitialSmsDelaySeconds = () =>
  normalizeNonNegativeInteger(getFieldLeadInitialSmsDelayRaw(), 5 * 60);

export const getFieldLeadFollowupDelaySeconds = () => {
  const explicitSeconds = getFieldLeadFollowupDelaySecondsRaw();
  if (explicitSeconds) {
    return normalizeNonNegativeInteger(
      explicitSeconds,
      isFieldLeadProductionLane() ? 24 * 60 * 60 : 10 * 60
    );
  }

  return getFieldLeadFollowupDelayMinutes() * 60;
};

export const getFieldLeadFollowupDelayMinutes = () => {
  const fallback = isFieldLeadProductionLane() ? 1440 : 10;
  return normalizeNonNegativeInteger(getFieldLeadFollowupDelayRaw(), fallback);
};

export const isFieldLeadPreviewOutboundOverrideEnabled = () =>
  !isFieldLeadProductionLane() &&
  parseBoolean(process.env.FIELD_TEST_FORCE_OUTBOUND_ENABLED, false);

export const getFieldLeadPreviewOutboundTargets = () => ({
  enabled: isFieldLeadPreviewOutboundOverrideEnabled(),
  phone: normalizeText(process.env.FIELD_TEST_FORCE_OUTBOUND_PHONE),
  email: normalizeText(process.env.FIELD_TEST_FORCE_OUTBOUND_EMAIL),
});
