import { logger, task } from "@trigger.dev/sdk";

export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { name: string; source?: string }) => {
    logger.info("Hello world task received payload", payload);

    return {
      message: `Hello ${payload.name}`,
      source: payload.source ?? "manual-trigger",
      timestamp: new Date().toISOString(),
    };
  },
});
