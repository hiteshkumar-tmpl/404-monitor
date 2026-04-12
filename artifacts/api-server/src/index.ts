import { config } from "dotenv";
import path from "path";
config({ path: path.join(import.meta.dirname, "../../../.env") });

import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./cron/scheduler";
import { seedAdminUser } from "./utils/password";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed admin user on startup
  await seedAdminUser();

  // Start the hourly cron scheduler after server is up
  startScheduler();
});
