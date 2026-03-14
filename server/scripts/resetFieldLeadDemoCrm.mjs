import { existsSync } from "node:fs";

const explicitEnvFile = String(process.argv[2] || "").trim();
const fallbackEnvFile = existsSync("logs/field-test.runtime.env")
  ? "logs/field-test.runtime.env"
  : existsSync("test.env")
    ? "test.env"
    : "";
const envFile = explicitEnvFile || fallbackEnvFile;

if (envFile) {
  process.env.DOTENV_CONFIG_PATH = envFile;
  process.env.DOTENV_CONFIG_OVERRIDE = "true";
}

await import("dotenv/config");

const { resetFieldLeadSheetTabsForDemo } = await import("../fieldLeadStore.mjs");

try {
  const result = await resetFieldLeadSheetTabsForDemo();
  console.log(
    JSON.stringify(
      {
        ok: true,
        envFile,
        rawTabName: result.rawTabName,
        crmTabName: result.crmTabName,
        archiveTabName: result.archiveTabName,
        archivedRowCount: result.archivedRowCount,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        envFile,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
