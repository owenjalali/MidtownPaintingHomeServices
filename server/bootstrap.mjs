const envFile = process.argv[2];

if (typeof envFile === "string" && envFile.trim()) {
  process.env.DOTENV_CONFIG_PATH = envFile.trim();
  process.env.DOTENV_CONFIG_OVERRIDE = "true";
}

const { startServer } = await import("./index.mjs");
startServer();
