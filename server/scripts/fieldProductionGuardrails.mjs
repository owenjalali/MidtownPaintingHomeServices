import { fileExists, normalizeText, readEnvFile } from "./vercelFieldEnvSync.mjs";

const PRODUCTION_TEST_MIRROR_ALLOW_KEY = "FIELD_PRODUCTION_ALLOW_TEST_MIRROR";

const COMPARED_FIELD_KEYS = [
  ["FIELD_INTAKE_SECRET", "FIELD_TEST_INTAKE_SECRET", "intake secret"],
  ["FIELD_SHEETS_SPREADSHEET_ID", "FIELD_TEST_SHEETS_SPREADSHEET_ID", "Google Sheet"],
  ["FIELD_SHEETS_CLIENT_EMAIL", "FIELD_TEST_SHEETS_CLIENT_EMAIL", "Sheets service account"],
  ["FIELD_OWNER_EMAIL", "FIELD_TEST_OWNER_EMAIL", "owner email"],
  ["FIELD_OWNER_PHONE", "FIELD_TEST_OWNER_PHONE", "owner phone"],
  ["FIELD_SMTP_USER", "FIELD_TEST_SMTP_USER", "field SMTP user"],
  ["FIELD_TWILIO_ACCOUNT_SID", "FIELD_TEST_TWILIO_ACCOUNT_SID", "field Twilio account"],
  ["FIELD_TWILIO_FROM_NUMBER", "FIELD_TEST_TWILIO_FROM_NUMBER", "field Twilio number"],
  ["FIELD_GOOGLE_CALENDAR_ID", "FIELD_TEST_GOOGLE_CALENDAR_ID", "field Google Calendar"],
];

const getMergedTestEnv = () => ({
  ...readEnvFile("test.env"),
  ...readEnvFile("logs/field-test.runtime.env"),
});

export const getFieldProductionGuardrailState = (prodEnvFile = "prod.env") => {
  const prodEnv = readEnvFile(prodEnvFile);
  const testEnv = getMergedTestEnv();
  const allowTestMirror =
    normalizeText(process.env[PRODUCTION_TEST_MIRROR_ALLOW_KEY] || prodEnv[PRODUCTION_TEST_MIRROR_ALLOW_KEY]).toLowerCase() ===
    "true";

  const mirroredPairs = COMPARED_FIELD_KEYS.flatMap(([productionKey, testKey, label]) => {
    const productionValue = normalizeText(prodEnv[productionKey]);
    const testValue = normalizeText(testEnv[testKey]);

    if (!productionValue || !testValue || productionValue !== testValue) {
      return [];
    }

    return [
      {
        productionKey,
        testKey,
        label,
      },
    ];
  });

  return {
    prodEnvFile,
    prodEnvExists: fileExists(prodEnvFile),
    testEnvExists: fileExists("test.env") || fileExists("logs/field-test.runtime.env"),
    allowTestMirror,
    mirroredPairs,
  };
};

export const assertFieldProductionGuardrails = (prodEnvFile = "prod.env") => {
  const state = getFieldProductionGuardrailState(prodEnvFile);

  if (state.allowTestMirror || state.mirroredPairs.length === 0) {
    return state;
  }

  const mirroredSummary = state.mirroredPairs
    .map(({ productionKey, testKey, label }) => `${label} (${productionKey} matches ${testKey})`)
    .join(", ");

  throw new Error(
    `Production field activation is blocked because prod.env still mirrors test lane credentials for: ${mirroredSummary}. Replace those values with client/live credentials or set ${PRODUCTION_TEST_MIRROR_ALLOW_KEY}=true for an intentional one-time production smoke.`
  );
};

export { PRODUCTION_TEST_MIRROR_ALLOW_KEY };
