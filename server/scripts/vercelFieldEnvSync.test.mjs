import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildStaticVercelEnvEntries,
  buildVercelEnvEntries,
  getVercelCliScopeArgs,
  readEnvFile,
} from "./vercelFieldEnvSync.mjs";

const withTempEnvFile = (contents, callback) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "vercel-field-env-"));
  const tempFile = path.join(tempDir, "sample.env");
  writeFileSync(tempFile, contents, "utf8");

  try {
    return callback(tempFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

test("readEnvFile preserves equals signs and strips wrapping quotes", () => {
  withTempEnvFile(
    [
      "FIELD_INTAKE_SECRET=secret-value",
      'FIELD_REP_OPTIONS_JSON=[{"id":"sam","name":"Sam"}]',
      'FIELD_SHEETS_PRIVATE_KEY="line-1=line-2"',
      "# comment",
      "",
    ].join("\n"),
    (tempFile) => {
      const parsed = readEnvFile(tempFile);
      assert.equal(parsed.FIELD_INTAKE_SECRET, "secret-value");
      assert.equal(parsed.FIELD_REP_OPTIONS_JSON, '[{"id":"sam","name":"Sam"}]');
      assert.equal(parsed.FIELD_SHEETS_PRIVATE_KEY, "line-1=line-2");
    }
  );
});

test("buildVercelEnvEntries prefers process env overrides and includes optional values", () => {
  const original = process.env.FIELD_INTAKE_SECRET;
  process.env.FIELD_INTAKE_SECRET = "override-from-process";

  try {
    const entries = buildVercelEnvEntries({
      requiredKeys: ["FIELD_INTAKE_SECRET"],
      optionalKeys: ["FIELD_INITIAL_SMS_DELAY_SECONDS"],
      envValues: {
        FIELD_INTAKE_SECRET: "from-file",
        FIELD_INITIAL_SMS_DELAY_SECONDS: "300",
      },
      target: "production",
    });

    assert.deepEqual(entries, [
      {
        key: "FIELD_INTAKE_SECRET",
        value: "override-from-process",
        type: "encrypted",
        target: ["production"],
      },
      {
        key: "FIELD_INITIAL_SMS_DELAY_SECONDS",
        value: "300",
        type: "encrypted",
        target: ["production"],
      },
    ]);
  } finally {
    if (typeof original === "string") {
      process.env.FIELD_INTAKE_SECRET = original;
    } else {
      delete process.env.FIELD_INTAKE_SECRET;
    }
  }
});

test("buildVercelEnvEntries throws when a required value is missing", () => {
  assert.throws(
    () =>
      buildVercelEnvEntries({
        requiredKeys: ["FIELD_OWNER_PHONE"],
        envValues: {},
        target: "production",
      }),
    /FIELD_OWNER_PHONE/
  );
});

test("buildStaticVercelEnvEntries creates encrypted entries for activation values", () => {
  const entries = buildStaticVercelEnvEntries({
    valuesByKey: {
      FIELD_ENABLED: "true",
      FIELD_ALLOW_PRODUCTION: "true",
    },
    target: "production",
  });

  assert.deepEqual(entries, [
    {
      key: "FIELD_ENABLED",
      value: "true",
      type: "encrypted",
      target: ["production"],
    },
    {
      key: "FIELD_ALLOW_PRODUCTION",
      value: "true",
      type: "encrypted",
      target: ["production"],
    },
  ]);
});

test("getVercelCliScopeArgs returns a scope flag only when VERCEL_SCOPE is set", () => {
  const original = process.env.VERCEL_SCOPE;

  try {
    delete process.env.VERCEL_SCOPE;
    assert.deepEqual(getVercelCliScopeArgs(), []);

    process.env.VERCEL_SCOPE = "owenjalalis-projects";
    assert.deepEqual(getVercelCliScopeArgs(), ["--scope", "owenjalalis-projects"]);
  } finally {
    if (typeof original === "string") {
      process.env.VERCEL_SCOPE = original;
    } else {
      delete process.env.VERCEL_SCOPE;
    }
  }
});
