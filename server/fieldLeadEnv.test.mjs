import assert from "node:assert/strict";
import test from "node:test";
import {
  getFieldLeadFollowupDelaySeconds,
  getFieldLeadInitialSmsDelaySeconds,
  getFieldLeadFollowupDelayMinutes,
  getFieldLeadPublicBaseUrl,
  getFieldLeadRuntimeEnvironment,
} from "./fieldLeadEnv.mjs";

const withEnv = async (overrides, run) => {
  const snapshot = { ...process.env };
  process.env = {
    ...snapshot,
    ...overrides,
  };

  try {
    await run();
  } finally {
    process.env = snapshot;
  }
};

test("field public base url prefers field-specific preview values before shared booking urls", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      FIELD_TEST_PUBLIC_BASE_URL: "https://preview-field.midtown.test",
      BOOKING_MANAGE_BASE_URL: "https://manage.midtown.test",
      CORS_ORIGIN: "https://cors.midtown.test",
    },
    async () => {
      assert.equal(getFieldLeadRuntimeEnvironment(), "preview");
      assert.equal(getFieldLeadPublicBaseUrl(), "https://preview-field.midtown.test");
    }
  );

  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      FIELD_TEST_PUBLIC_BASE_URL: "",
      BOOKING_MANAGE_BASE_URL: "https://manage.midtown.test",
      CORS_ORIGIN: "https://cors.midtown.test",
    },
    async () => {
      assert.equal(getFieldLeadPublicBaseUrl(), "https://manage.midtown.test");
    }
  );

  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      FIELD_TEST_PUBLIC_BASE_URL: "",
      BOOKING_MANAGE_BASE_URL: "",
      CORS_ORIGIN: "https://cors.midtown.test",
    },
    async () => {
      assert.equal(getFieldLeadPublicBaseUrl(), "https://cors.midtown.test");
    }
  );
});

test("production field public base url uses the production namespace", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      FIELD_PUBLIC_BASE_URL: "https://field.midtownpainting.ca",
      FIELD_TEST_PUBLIC_BASE_URL: "https://preview-field.midtown.test",
      BOOKING_MANAGE_BASE_URL: "https://manage.midtown.test",
    },
    async () => {
      assert.equal(getFieldLeadRuntimeEnvironment(), "production");
      assert.equal(getFieldLeadPublicBaseUrl(), "https://field.midtownpainting.ca");
    }
  );
});

test("field follow-up delay prefers the new env names and falls back to the deprecated first-follow-up key", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      FIELD_TEST_FOLLOWUP_DELAY_MINUTES: "25",
      FIELD_TEST_FOLLOWUP_1_DELAY_MINUTES: "10",
    },
    async () => {
      assert.equal(getFieldLeadFollowupDelayMinutes(), 25);
    }
  );

  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      FIELD_TEST_FOLLOWUP_DELAY_MINUTES: "",
      FIELD_TEST_FOLLOWUP_1_DELAY_MINUTES: "12",
    },
    async () => {
      assert.equal(getFieldLeadFollowupDelayMinutes(), 12);
    }
  );
});

test("field preview delay seconds override the default timers without changing production defaults", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      FIELD_TEST_INITIAL_SMS_DELAY_SECONDS: "10",
      FIELD_TEST_FOLLOWUP_DELAY_SECONDS: "30",
      FIELD_TEST_FOLLOWUP_DELAY_MINUTES: "25",
    },
    async () => {
      assert.equal(getFieldLeadInitialSmsDelaySeconds(), 10);
      assert.equal(getFieldLeadFollowupDelaySeconds(), 30);
      assert.equal(getFieldLeadFollowupDelayMinutes(), 25);
    }
  );

  await withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      FIELD_INITIAL_SMS_DELAY_SECONDS: "",
      FIELD_FOLLOWUP_DELAY_SECONDS: "",
      FIELD_FOLLOWUP_DELAY_MINUTES: "",
    },
    async () => {
      assert.equal(getFieldLeadInitialSmsDelaySeconds(), 300);
      assert.equal(getFieldLeadFollowupDelaySeconds(), 86400);
    }
  );
});
