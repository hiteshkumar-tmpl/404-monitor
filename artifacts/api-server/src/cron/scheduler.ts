import cron from "node-cron";
import { checkAllWebsites } from "../utils/checker";
import { logger } from "../lib/logger";

/**
 * Start the hourly cron job that checks all monitored websites.
 */
export function startScheduler(): void {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    logger.info("Cron: running hourly sitemap check");
    try {
      await checkAllWebsites();
    } catch (err) {
      logger.error({ err }, "Cron: error during scheduled check");
    }
  });

  logger.info("Scheduler started — checking all websites every hour");
}
