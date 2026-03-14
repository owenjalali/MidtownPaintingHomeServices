import {
  PRODUCTION_FIELD_ENV_OPTIONAL_KEYS,
  PRODUCTION_FIELD_ENV_REQUIRED_KEYS,
  buildVercelEnvEntries,
  fileExists,
  normalizeText,
  readEnvFile,
  runVercelEnvSync,
} from "./vercelFieldEnvSync.mjs";

const PROD_ENV_FILE =
  normalizeText(process.argv[2]) ||
  normalizeText(process.env.VERCEL_FIELD_PROD_ENV_FILE) ||
  "prod.env";

const buildProductionEnvPayload = () => {
  if (!fileExists(PROD_ENV_FILE)) {
    throw new Error(`Missing ${PROD_ENV_FILE}. Create the local production env file before syncing Vercel production vars.`);
  }

  return buildVercelEnvEntries({
    requiredKeys: PRODUCTION_FIELD_ENV_REQUIRED_KEYS,
    optionalKeys: PRODUCTION_FIELD_ENV_OPTIONAL_KEYS,
    envValues: readEnvFile(PROD_ENV_FILE),
    target: "production",
  });
};

const main = async () => {
  const productionEnvEntries = buildProductionEnvPayload();
  const result = await runVercelEnvSync({
    entries: productionEnvEntries,
  });

  console.log(
    JSON.stringify(
      {
        ...result,
        sourceEnvFile: PROD_ENV_FILE,
      },
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
        sourceEnvFile: PROD_ENV_FILE,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
