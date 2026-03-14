import {
  PREVIEW_ENV_OPTIONAL_KEYS,
  PREVIEW_ENV_REQUIRED_KEYS,
  buildVercelEnvEntries,
  normalizeText,
  readMergedEnvFiles,
  runVercelEnvSync,
} from "./vercelFieldEnvSync.mjs";

const buildPreviewEnvPayload = () => {
  const runtimeEnv = readMergedEnvFiles(["test.env", "logs/field-test.runtime.env"]);

  runtimeEnv.FIELD_TEST_FORCE_OUTBOUND_ENABLED = "true";
  runtimeEnv.FIELD_TEST_FORCE_OUTBOUND_PHONE =
    normalizeText(process.env.FIELD_TEST_FORCE_OUTBOUND_PHONE) ||
    normalizeText(runtimeEnv.FIELD_TEST_FORCE_OUTBOUND_PHONE) ||
    normalizeText(runtimeEnv.FIELD_TEST_OWNER_PHONE);
  runtimeEnv.FIELD_TEST_FORCE_OUTBOUND_EMAIL =
    normalizeText(process.env.FIELD_TEST_FORCE_OUTBOUND_EMAIL) ||
    normalizeText(runtimeEnv.FIELD_TEST_FORCE_OUTBOUND_EMAIL) ||
    normalizeText(runtimeEnv.FIELD_TEST_OWNER_EMAIL);

  return buildVercelEnvEntries({
    requiredKeys: PREVIEW_ENV_REQUIRED_KEYS,
    optionalKeys: PREVIEW_ENV_OPTIONAL_KEYS,
    envValues: runtimeEnv,
    target: "preview",
  });
};

const main = async () => {
  const previewEnvEntries = buildPreviewEnvPayload();
  const result = await runVercelEnvSync({
    entries: previewEnvEntries,
  });

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
