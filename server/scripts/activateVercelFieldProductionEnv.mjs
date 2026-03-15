import {
  FIELD_PRODUCTION_ACTIVATION_VALUES,
  buildStaticVercelEnvEntries,
  runVercelEnvSync,
} from "./vercelFieldEnvSync.mjs";
import { assertFieldProductionGuardrails } from "./fieldProductionGuardrails.mjs";

const PROD_ENV_FILE = process.argv[2] || process.env.VERCEL_FIELD_PROD_ENV_FILE || "prod.env";

const main = async () => {
  assertFieldProductionGuardrails(PROD_ENV_FILE);

  const activationEntries = buildStaticVercelEnvEntries({
    valuesByKey: FIELD_PRODUCTION_ACTIVATION_VALUES,
    target: "production",
  });
  const result = await runVercelEnvSync({
    entries: activationEntries,
  });

  console.log(JSON.stringify(result, null, 2));
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
