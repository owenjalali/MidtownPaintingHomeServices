import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PRODUCTION_TEST_MIRROR_ALLOW_KEY,
  assertFieldProductionGuardrails,
  getFieldProductionGuardrailState,
} from "./fieldProductionGuardrails.mjs";

const withTempWorkspace = async (files, callback) => {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "field-prod-guardrails-"));

  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = path.join(tempDir, relativePath);
      writeFileSync(absolutePath, contents, "utf8");
    }

    process.chdir(tempDir);
    await callback(tempDir);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
};

test("guardrails detect mirrored production/test field credentials", async () => {
  await withTempWorkspace(
    {
      "prod.env": [
        "FIELD_OWNER_EMAIL=test@example.com",
        "FIELD_OWNER_PHONE=+15550001111",
      ].join("\n"),
      "test.env": [
        "FIELD_TEST_OWNER_EMAIL=test@example.com",
        "FIELD_TEST_OWNER_PHONE=+15550001111",
      ].join("\n"),
    },
    async () => {
      const state = getFieldProductionGuardrailState("prod.env");
      assert.equal(state.allowTestMirror, false);
      assert.deepEqual(
        state.mirroredPairs.map((entry) => entry.productionKey).sort(),
        ["FIELD_OWNER_EMAIL", "FIELD_OWNER_PHONE"]
      );
      assert.throws(() => assertFieldProductionGuardrails("prod.env"), /blocked/);
    }
  );
});

test("guardrails allow activation when production values differ from test values", async () => {
  await withTempWorkspace(
    {
      "prod.env": [
        "FIELD_OWNER_EMAIL=client@example.com",
        "FIELD_OWNER_PHONE=+15550002222",
      ].join("\n"),
      "test.env": [
        "FIELD_TEST_OWNER_EMAIL=test@example.com",
        "FIELD_TEST_OWNER_PHONE=+15550001111",
      ].join("\n"),
    },
    async () => {
      const state = assertFieldProductionGuardrails("prod.env");
      assert.equal(state.mirroredPairs.length, 0);
    }
  );
});

test("guardrails allow intentional one-time production smoke with explicit override", async () => {
  await withTempWorkspace(
    {
      "prod.env": [
        "FIELD_OWNER_EMAIL=test@example.com",
        `FIELD_PRODUCTION_ALLOW_TEST_MIRROR=true`,
      ].join("\n"),
      "test.env": "FIELD_TEST_OWNER_EMAIL=test@example.com",
    },
    async () => {
      const previous = process.env[PRODUCTION_TEST_MIRROR_ALLOW_KEY];
      delete process.env[PRODUCTION_TEST_MIRROR_ALLOW_KEY];

      try {
        const state = assertFieldProductionGuardrails("prod.env");
        assert.equal(state.allowTestMirror, true);
      } finally {
        if (typeof previous === "string") {
          process.env[PRODUCTION_TEST_MIRROR_ALLOW_KEY] = previous;
        } else {
          delete process.env[PRODUCTION_TEST_MIRROR_ALLOW_KEY];
        }
      }
    }
  );
});
