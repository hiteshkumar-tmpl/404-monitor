import cron from "node-cron";
import { db, websitesTable } from "@workspace/db";
import { checkWebsite } from "../utils/checker";
import { logger } from "../lib/logger";

/**
 * Start the scheduler. Runs every minute and fires any website whose
 * check interval has elapsed since its last check.
 */
export function startScheduler(): void {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const websites = await db.select().from(websitesTable);

    for (const website of websites) {
      if (website.status === "paused") {
        continue;
      }

      const intervalMs = website.checkIntervalMinutes * 60 * 1000;
      const lastChecked = website.lastCheckedAt ? new Date(website.lastCheckedAt).getTime() : 0;
      const due = now.getTime() - lastChecked >= intervalMs;

      if (due) {
        logger.info(
          { websiteId: website.id, name: website.name, intervalMinutes: website.checkIntervalMinutes },
          "Cron: running scheduled check"
        );
        checkWebsite(website.id).catch((err) => {
          logger.error({ err, websiteId: website.id }, "Cron: error during scheduled check");
        });
      }
    }
  });

  logger.info("Scheduler started — checking each website on its own configured interval");
}
