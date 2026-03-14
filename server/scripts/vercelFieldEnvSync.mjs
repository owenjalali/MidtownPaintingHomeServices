import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const PREVIEW_ENV_REQUIRED_KEYS = [
  "FIELD_TEST_ENABLED",
  "FIELD_TEST_STORE_MODE",
  "FIELD_TEST_INTAKE_SECRET",
  "FIELD_TEST_REP_OPTIONS_JSON",
  "FIELD_TEST_LINK_EXPIRY_DAYS",
  "FIELD_TEST_FOLLOWUP_DELAY_MINUTES",
  "FIELD_TEST_SHEETS_SPREADSHEET_ID",
  "FIELD_TEST_SHEETS_TAB_NAME",
  "FIELD_TEST_SHEETS_CLIENT_EMAIL",
  "FIELD_TEST_SHEETS_PRIVATE_KEY",
  "FIELD_TEST_OWNER_EMAIL",
  "FIELD_TEST_OWNER_PHONE",
  "FIELD_TEST_SMTP_HOST",
  "FIELD_TEST_SMTP_PORT",
  "FIELD_TEST_SMTP_SECURE",
  "FIELD_TEST_SMTP_USER",
  "FIELD_TEST_SMTP_PASS",
  "FIELD_TEST_SMTP_FROM",
  "FIELD_TEST_TWILIO_ACCOUNT_SID",
  "FIELD_TEST_TWILIO_AUTH_TOKEN",
  "FIELD_TEST_TWILIO_FROM_NUMBER",
  "FIELD_TEST_GOOGLE_CLIENT_ID",
  "FIELD_TEST_GOOGLE_CLIENT_SECRET",
  "FIELD_TEST_GOOGLE_REFRESH_TOKEN",
  "FIELD_TEST_GOOGLE_CALENDAR_ID",
  "FIELD_TEST_FORCE_OUTBOUND_ENABLED",
  "FIELD_TEST_FORCE_OUTBOUND_PHONE",
  "FIELD_TEST_FORCE_OUTBOUND_EMAIL",
  "TRIGGER_SECRET_KEY",
  "TRIGGER_PROJECT_REF",
];

export const PREVIEW_ENV_OPTIONAL_KEYS = [
  "FIELD_TEST_INITIAL_SMS_DELAY_SECONDS",
  "FIELD_TEST_FOLLOWUP_DELAY_SECONDS",
  "FIELD_TEST_PUBLIC_BASE_URL",
  "FIELD_TEST_STORE_PATH",
  "FIELD_TEST_FOLLOWUP_1_DELAY_MINUTES",
];

export const PRODUCTION_FIELD_ENV_REQUIRED_KEYS = [
  "FIELD_INTAKE_SECRET",
  "FIELD_REP_OPTIONS_JSON",
  "FIELD_LINK_EXPIRY_DAYS",
  "FIELD_PUBLIC_BASE_URL",
  "FIELD_STORE_MODE",
  "FIELD_SHEETS_SPREADSHEET_ID",
  "FIELD_SHEETS_TAB_NAME",
  "FIELD_SHEETS_CLIENT_EMAIL",
  "FIELD_SHEETS_PRIVATE_KEY",
  "FIELD_OWNER_EMAIL",
  "FIELD_OWNER_PHONE",
  "FIELD_SMTP_HOST",
  "FIELD_SMTP_PORT",
  "FIELD_SMTP_SECURE",
  "FIELD_SMTP_USER",
  "FIELD_SMTP_PASS",
  "FIELD_SMTP_FROM",
  "FIELD_TWILIO_ACCOUNT_SID",
  "FIELD_TWILIO_AUTH_TOKEN",
  "FIELD_TWILIO_FROM_NUMBER",
  "FIELD_GOOGLE_CLIENT_ID",
  "FIELD_GOOGLE_CLIENT_SECRET",
  "FIELD_GOOGLE_REFRESH_TOKEN",
  "FIELD_GOOGLE_CALENDAR_ID",
  "FIELD_INITIAL_SMS_DELAY_SECONDS",
  "FIELD_FOLLOWUP_DELAY_MINUTES",
];

export const PRODUCTION_FIELD_ENV_OPTIONAL_KEYS = [
  "FIELD_STORE_PATH",
  "FIELD_FOLLOWUP_DELAY_SECONDS",
  "FIELD_FOLLOWUP_1_DELAY_MINUTES",
];

export const FIELD_PRODUCTION_ACTIVATION_VALUES = Object.freeze({
  FIELD_ENABLED: "true",
  FIELD_ALLOW_PRODUCTION: "true",
});

export const normalizeText = (value) => String(value || "").trim();

const readJsonFile = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

export const fileExists = (relativePath) => existsSync(path.resolve(process.cwd(), relativePath));

export const readEnvFile = (relativePath) => {
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

      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1);
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      if (key) {
        accumulator[key] = value;
      }

      return accumulator;
    }, {});
};

export const readMergedEnvFiles = (relativePaths = []) =>
  relativePaths.reduce(
    (accumulator, relativePath) => ({
      ...accumulator,
      ...readEnvFile(relativePath),
    }),
    {}
  );

export const resolveEnvValue = ({ key, envValues = {} }) =>
  normalizeText(process.env[key] || envValues[key]);

export const createEncryptedVercelEnvEntry = ({ key, value, target }) => {
  const normalizedKey = normalizeText(key);
  const normalizedValue = normalizeText(value);
  const normalizedTarget = normalizeText(target);

  if (!normalizedKey || !normalizedValue || !normalizedTarget) {
    throw new Error("Vercel env entries require non-empty key, value, and target.");
  }

  return {
    key: normalizedKey,
    value: normalizedValue,
    type: "encrypted",
    target: [normalizedTarget],
  };
};

export const buildVercelEnvEntries = ({
  requiredKeys = [],
  optionalKeys = [],
  envValues = {},
  target,
}) => {
  const requiredEntries = requiredKeys.map((key) => {
    const value = resolveEnvValue({ key, envValues });
    if (!value) {
      throw new Error(`Missing required env value for ${key}.`);
    }

    return createEncryptedVercelEnvEntry({
      key,
      value,
      target,
    });
  });

  const optionalEntries = optionalKeys
    .map((key) => {
      const value = resolveEnvValue({ key, envValues });
      if (!value) {
        return null;
      }

      return createEncryptedVercelEnvEntry({
        key,
        value,
        target,
      });
    })
    .filter(Boolean);

  return [...requiredEntries, ...optionalEntries];
};

export const buildStaticVercelEnvEntries = ({ valuesByKey = {}, target }) =>
  Object.entries(valuesByKey).map(([key, value]) =>
    createEncryptedVercelEnvEntry({
      key,
      value,
      target,
    })
  );

const refreshVercelCliAuth = () => {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(npxCommand, ["vercel", "whoami"], {
    stdio: "ignore",
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Unable to refresh Vercel CLI auth (exit ${result.status ?? "unknown"}).`);
  }
};

const resolveAuthToken = () => {
  const directToken = normalizeText(process.env.VERCEL_TOKEN);
  if (directToken) {
    return {
      token: directToken,
      source: "env",
    };
  }

  const authFileCandidates = [
    path.join(process.env.APPDATA || "", "com.vercel.cli", "Data", "auth.json"),
    path.join(os.homedir(), ".vercel", "auth.json"),
  ];

  for (const candidate of authFileCandidates) {
    if (!candidate || !existsSync(candidate)) {
      continue;
    }

    const parsed = readJsonFile(candidate);
    const token = normalizeText(parsed?.token);
    if (token) {
      return {
        token,
        source: "auth-file",
      };
    }
  }

  throw new Error("Unable to find a Vercel auth token. Set VERCEL_TOKEN or log in with the Vercel CLI.");
};

const resolveProjectConfig = () => {
  const projectConfigPath = path.resolve(process.cwd(), ".vercel", "project.json");
  if (!existsSync(projectConfigPath)) {
    throw new Error("Missing .vercel/project.json. Link the project with Vercel before syncing env vars.");
  }

  const projectConfig = readJsonFile(projectConfigPath);
  const projectId = normalizeText(projectConfig.projectId);
  const teamId = normalizeText(projectConfig.orgId);

  if (!projectId || !teamId) {
    throw new Error("The local Vercel project config is missing projectId or orgId.");
  }

  return {
    projectId,
    teamId,
  };
};

const upsertVercelEnvVar = async ({ projectId, teamId, token, entry }) => {
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true&teamId=${encodeURIComponent(teamId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vercel env upsert failed for ${entry.key}: ${response.status} ${body}`);
  }
};

const isInvalidTokenError = (error) =>
  normalizeText(error instanceof Error ? error.message : error).includes("invalidToken");

const syncVercelEnvEntries = async ({ projectId, teamId, token, entries }) => {
  for (const entry of entries) {
    await upsertVercelEnvVar({
      projectId,
      teamId,
      token,
      entry,
    });
  }
};

export const runVercelEnvSync = async ({ entries }) => {
  let { token, source } = resolveAuthToken();
  const project = resolveProjectConfig();

  try {
    await syncVercelEnvEntries({
      ...project,
      token,
      entries,
    });
  } catch (error) {
    if (source !== "env" && isInvalidTokenError(error)) {
      refreshVercelCliAuth();
      ({ token, source } = resolveAuthToken());
      await syncVercelEnvEntries({
        ...project,
        token,
        entries,
      });
    } else {
      throw error;
    }
  }

  return {
    ok: true,
    syncedCount: entries.length,
    syncedKeys: entries.map((entry) => entry.key),
    target: Array.from(new Set(entries.flatMap((entry) => entry.target || []))),
  };
};
