const envFile = String(process.argv[2] || "").trim();

if (envFile) {
  process.env.DOTENV_CONFIG_PATH = envFile;
  process.env.DOTENV_CONFIG_OVERRIDE = "true";
}

await import("dotenv/config");

const { syncFieldLeadSheetTabs } = await import("../fieldLeadStore.mjs");

try {
  const result = await syncFieldLeadSheetTabs();
  console.log(
    `[field-lead-crm-sync] Synced ${result.rowCount} row(s) from "${result.rawTabName}" to "${result.crmTabName}".`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[field-lead-crm-sync] ${message}`);
  process.exitCode = 1;
}
