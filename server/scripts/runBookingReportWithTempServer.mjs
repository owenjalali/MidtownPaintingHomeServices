import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const REPO_CWD = process.cwd();
const API_BASE_URL = "http://localhost:8790";
const HEALTH_URL = `${API_BASE_URL}/api/health`;

const requestHealth = async () => {
  const response = await fetch(HEALTH_URL);
  return response.ok;
};

const waitForHealth = async (timeoutMs = 45000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ok = await requestHealth();
      if (ok) {
        return;
      }
    } catch {
      // continue polling
    }
    await sleep(750);
  }

  throw new Error("Timed out waiting for temporary server health.");
};

const run = async () => {
  const serverProcess = spawn("node", ["server/index.mjs"], {
    cwd: REPO_CWD,
    env: {
      ...process.env,
      PORT: "8790",
    },
    stdio: "inherit",
    shell: false,
  });

  try {
    await waitForHealth();

    const reportProcess = spawn("node", ["server/scripts/bookingStressTimingReport.mjs"], {
      cwd: REPO_CWD,
      env: {
        ...process.env,
        SMOKE_BASE_URL: API_BASE_URL,
        SMOKE_WEB_BASE_URL: "http://localhost:5173",
      },
      stdio: "inherit",
      shell: false,
    });

    await new Promise((resolve, reject) => {
      reportProcess.on("error", reject);
      reportProcess.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Report script failed with exit code ${code ?? "unknown"}.`));
      });
    });
  } finally {
    if (!serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
  }
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
