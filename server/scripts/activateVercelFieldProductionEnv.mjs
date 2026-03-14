import {
  FIELD_PRODUCTION_ACTIVATION_VALUES,
  buildStaticVercelEnvEntries,
  runVercelEnvSync,
} from "./vercelFieldEnvSync.mjs";

const main = async () => {
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
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
