import {
  db,
  websitesTable,
  monitoredUrlsTable,
  websiteSitemapsTable,
  checkHistoryTable,
  urlStatusHistoryTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { parseSitemap } from "./sitemapParser";
import {
  checkUrlsBatch,
  getRecommendedConcurrency,
  getUrlCheckerConfig,
  runInBatches,
} from "./urlChecker";
import { send404Alert, sendCheckSummaryEmail } from "./emailer";
import { sendSlackAlert, type SlackAlertPayload } from "./slack-notifier";
import { sendTeamsAlert, type TeamsAlertPayload } from "./teams-notifier";
import { logger } from "../lib/logger";

export interface CheckWebsiteResult {
  websiteId: number;
  checkedUrls: number;
  brokenUrls: number;
  newBrokenUrls: number;
  message: string;
}

type AlertSummaryInterval =
  | "none"
  | "realtime"
  | "daily"
  | "3days"
  | "5days"
  | "7days"
  | "14days"
  | "30days"
  | "custom";

const DEFAULT_DASHBOARD_BASE_URL = "http://136.113.130.29:5173";

/**
 * Run a full check for a single website:
 * 1. Fetch + re-parse sitemap to discover any new URLs
 * 2. Check all stored URLs for 404s
 * 3. Detect newly broken URLs (was 200, now 404)
 * 4. Send email alert if needed
 */
export async function checkWebsite(
  websiteId: number,
): Promise<CheckWebsiteResult> {
  // Mark website as "checking"
  await db
    .update(websitesTable)
    .set({ status: "checking" })
    .where(eq(websitesTable.id, websiteId));

  const [website] = await db
    .select()
    .from(websitesTable)
    .where(eq(websitesTable.id, websiteId));

  if (!website) {
    throw new Error(`Website ${websiteId} not found`);
  }

  logger.info({ websiteId, name: website.name }, "Starting website check");

  try {
    // Step 1: Re-parse ALL sitemaps (primary + additional) to catch new URLs
    const additionalSitemaps = await db
      .select({ url: websiteSitemapsTable.url })
      .from(websiteSitemapsTable)
      .where(eq(websiteSitemapsTable.websiteId, websiteId));

    const allSitemapUrls = [
      website.sitemapUrl,
      ...additionalSitemaps.map((s) => s.url),
    ];

    let sitemapUrls: string[] = [];
    for (const sitemapUrl of allSitemapUrls) {
      try {
        const urls = await parseSitemap(sitemapUrl);
        sitemapUrls.push(...urls);
        logger.info(
          { websiteId, sitemapUrl, count: urls.length },
          "Parsed sitemap",
        );
      } catch (err) {
        logger.error(
          { err, websiteId, sitemapUrl },
          "Failed to parse sitemap during check",
        );
      }
    }
    // Deduplicate across sitemaps
    sitemapUrls = [...new Set(sitemapUrls)];
    logger.info(
      { websiteId, total: sitemapUrls.length },
      "Total unique sitemap URLs across all sitemaps",
    );

    // Step 2: Upsert new URLs into DB (insert ones not already tracked)
    if (sitemapUrls.length > 0) {
      const existingUrls = await db
        .select({ url: monitoredUrlsTable.url })
        .from(monitoredUrlsTable)
        .where(eq(monitoredUrlsTable.websiteId, websiteId));

      const existingSet = new Set(existingUrls.map((r) => r.url));
      const newUrls = sitemapUrls.filter((u) => !existingSet.has(u));

      if (newUrls.length > 0) {
        await db
          .insert(monitoredUrlsTable)
          .values(newUrls.map((url) => ({ websiteId, url })));
        logger.info({ websiteId, count: newUrls.length }, "Inserted new URLs");
      }
    }

    // Step 3: Fetch all URLs for this website and check them
    const urlRows = await db
      .select()
      .from(monitoredUrlsTable)
      .where(eq(monitoredUrlsTable.websiteId, websiteId));

    if (urlRows.length === 0) {
      await db
        .update(websitesTable)
        .set({ status: "error", lastCheckedAt: new Date() })
        .where(eq(websitesTable.id, websiteId));
      return {
        websiteId,
        checkedUrls: 0,
        brokenUrls: 0,
        newBrokenUrls: 0,
        message: "No URLs to check",
      };
    }

    const urlStrings = urlRows.map((r) => r.url);
    const concurrency = getRecommendedConcurrency(urlRows.length);
    const checkerConfig = getUrlCheckerConfig();

    logger.info(
      {
        websiteId,
        urlCount: urlRows.length,
        concurrency,
        timeoutMs: checkerConfig.timeoutMs,
        retries: checkerConfig.retries,
      },
      "Running URL checks",
    );
    const checkResults = await checkUrlsBatch(urlStrings, concurrency);

    // Step 4: Update URL statuses and detect new breakages/fixes
    const newBrokenUrls: string[] = [];
    const newFixedUrls: string[] = [];

    const urlRowByUrl = new Map(urlRows.map((r) => [r.url, r] as const));
    const dbWriteConcurrency = Number(process.env.URL_DB_WRITE_CONCURRENCY || 25);

    await runInBatches(checkResults, dbWriteConcurrency, async (result) => {
      const existing = urlRowByUrl.get(result.url);
      if (!existing) return;

      const isNowBroken = result.statusCode === 404;
      const wasOk =
        !existing.isBroken &&
        (existing.lastStatus === 200 || existing.lastStatus === null);

      const wasBroken = existing.isBroken && existing.lastStatus === 404;
      const isNowOk = result.statusCode === 200;
      const now = new Date();

      // Detect transition: was ok (or unchecked) → now 404
      if (isNowBroken && wasOk) {
        logger.info(
          { url: result.url, wasOk, existingIsBroken: existing.isBroken },
          "NEW broken URL detected",
        );
        newBrokenUrls.push(result.url);
      }

      // Detect transition: was broken → now fixed
      if (isNowOk && wasBroken) {
        newFixedUrls.push(result.url);
      }

      await db
        .update(monitoredUrlsTable)
        .set({
          previousStatus: existing.lastStatus,
          lastStatus: result.statusCode,
          isBroken: isNowBroken,
          lastCheckedAt: now,
          errorMessage: result.errorMessage,
        })
        .where(eq(monitoredUrlsTable.id, existing.id));

      if (isNowBroken && wasOk) {
        await db.insert(urlStatusHistoryTable).values({
          websiteId,
          url: result.url,
          previousStatus: existing.lastStatus,
          newStatus: result.statusCode,
          wasBroken: true,
          becameFixed: false,
          changedAt: now,
        });
      }

      if (isNowOk && wasBroken) {
        await db.insert(urlStatusHistoryTable).values({
          websiteId,
          url: result.url,
          previousStatus: existing.lastStatus,
          newStatus: result.statusCode,
          wasBroken: false,
          becameFixed: true,
          changedAt: now,
        });
      }
    });

    // Step 5: Update website summary
    const brokenCount = checkResults.filter((r) => r.statusCode === 404).length;
    await db
      .update(websitesTable)
      .set({
        totalUrls: urlRows.length,
        brokenUrls: brokenCount,
        status: brokenCount > 0 ? "error" : "ok",
        lastCheckedAt: new Date(),
      })
      .where(eq(websitesTable.id, websiteId));

    // Step 5b: Save check history
    await db.insert(checkHistoryTable).values({
      websiteId,
      totalUrls: urlRows.length,
      brokenUrls: brokenCount,
    });

    // Step 6: Send alerts based on website settings
    const shouldSendSlackAlert =
      website.slackAlertEnabled && website.slackWebhookUrl;
    const shouldSendTeamsAlert =
      website.teamsAlertEnabled && website.teamsWebhookUrl;
    const summaryInterval = (website.alertSummaryInterval ||
      "none") as AlertSummaryInterval;
    const slackRealtimeEnabled = website.slackRealtimeAlerts ?? true;
    const teamsRealtimeEnabled = website.teamsRealtimeAlerts ?? true;
    const dashboardBaseUrl = process.env.APP_URL || DEFAULT_DASHBOARD_BASE_URL;
    const dashboardUrl = `${dashboardBaseUrl}/dashboard`;

    const slackPayload: SlackAlertPayload = {
      websiteId: website.id,
      websiteName: website.name,
      brokenUrls: newBrokenUrls,
      fixedUrls: newFixedUrls,
      totalUrls: urlRows.length,
      checkedUrls: checkResults.length,
      dashboardUrl,
    };

    const teamsPayload: TeamsAlertPayload = {
      websiteId: website.id,
      websiteName: website.name,
      brokenUrls: newBrokenUrls,
      fixedUrls: newFixedUrls,
      totalUrls: urlRows.length,
      checkedUrls: checkResults.length,
      dashboardUrl,
    };

    const hasChanges = newBrokenUrls.length > 0 || newFixedUrls.length > 0;

    const getIntervalDays = (interval: AlertSummaryInterval): number => {
      switch (interval) {
        case "daily":
          return 1;
        case "3days":
          return 3;
        case "5days":
          return 5;
        case "7days":
          return 7;
        case "14days":
          return 14;
        case "30days":
          return 30;
        case "custom":
          return website.customSummaryDays || 7;
        default:
          return 0;
      }
    };

    const shouldSendSummary = (
      lastSentAt: Date | null,
      intervalDays: number,
    ): boolean => {
      if (!lastSentAt) return true;
      const elapsed = Date.now() - lastSentAt.getTime();
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
      return elapsed >= intervalMs;
    };

    const intervalDays = getIntervalDays(summaryInterval);

    logger.info(
      {
        websiteId: website.id,
        shouldSendEmail: newBrokenUrls.length > 0,
        shouldSendSlack: shouldSendSlackAlert,
        shouldSendTeams: shouldSendTeamsAlert,
        summaryInterval,
        intervalDays,
        hasChanges,
        newBrokenUrls: newBrokenUrls.length,
        newFixedUrls: newFixedUrls.length,
        slackRealtimeEnabled,
        teamsRealtimeEnabled,
        lastSlackSummarySentAt: website.lastSlackSummarySentAt,
        lastTeamsSummarySentAt: website.lastTeamsSummarySentAt,
      },
      "Alert decision check",
    );

    // Send email alert for newly broken URLs (existing behavior)
    let emailAlertSent = false;
    if (newBrokenUrls.length > 0) {
      logger.info(
        {
          to: website.alertEmail,
          count: newBrokenUrls.length,
          brokenUrls: newBrokenUrls,
        },
        "Sending email alert",
      );
      emailAlertSent = await send404Alert({
        to: website.alertEmail,
        websiteName: website.name,
        brokenUrls: newBrokenUrls,
      });
    }

    // Build summary payload once and use it for summary email / Teams summary.
    const summaryPayload = {
      brokenUrls: newBrokenUrls,
      fixedUrls: newFixedUrls,
      totalUrls: urlRows.length,
      checkedUrls: checkResults.length,
      currentStatus: {
        totalUrls: urlRows.length,
        brokenUrls: brokenCount,
        okUrls: urlRows.length - brokenCount,
      },
      dayWiseBreakdown: [] as Array<{
        date: string;
        broke: number;
        fixed: number;
      }>,
    };

    // Helper to build summary payload for day-wise summary
    const buildSummaryPayload = async (
      interval: AlertSummaryInterval,
    ): Promise<{
      brokenUrls: string[];
      fixedUrls: string[];
      totalUrls: number;
      checkedUrls: number;
      currentStatus: {
        totalUrls: number;
        brokenUrls: number;
        okUrls: number;
      };
      dayWiseBreakdown: Array<{
        date: string;
        broke: number;
        fixed: number;
      }>;
    }> => {
      const days = getIntervalDays(interval);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const history = await db
        .select()
        .from(urlStatusHistoryTable)
        .where(eq(urlStatusHistoryTable.websiteId, websiteId));

      const recentHistory = history.filter((h) => h.changedAt >= since);

      const brokenUrls = recentHistory
        .filter((h) => h.wasBroken && !h.becameFixed)
        .map((h) => h.url);
      const fixedUrls = recentHistory
        .filter((h) => h.becameFixed)
        .map((h) => h.url);

      const currentBroken = urlRows.filter((u) => u.isBroken).length;
      const currentOk = urlRows.length - currentBroken;

      const dayMap = new Map<
        string,
        { date: string; broke: number; fixed: number }
      >();
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split("T")[0];
        dayMap.set(dateStr, { date: dateStr, broke: 0, fixed: 0 });
      }

      for (const entry of recentHistory) {
        const dateStr = entry.changedAt.toISOString().split("T")[0];
        const day = dayMap.get(dateStr);
        if (day) {
          if (entry.becameFixed) {
            day.fixed += 1;
          } else if (entry.wasBroken) {
            day.broke += 1;
          }
        }
      }

      const dayWiseBreakdown = Array.from(dayMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      return {
        brokenUrls,
        fixedUrls,
        totalUrls: urlRows.length,
        checkedUrls: checkResults.length,
        currentStatus: {
          totalUrls: urlRows.length,
          brokenUrls: currentBroken,
          okUrls: currentOk,
        },
        dayWiseBreakdown,
      };
    };

    // Send a run summary email after every check, even if no URLs are broken.
    const summaryEmailSent = await sendCheckSummaryEmail({
      to: website.alertEmail,
      websiteName: website.name,
      totalUrls: summaryPayload.totalUrls,
      checkedUrls: summaryPayload.checkedUrls,
      brokenUrls: brokenCount > 0 ? urlRows.filter((u) => u.isBroken).map((u) => u.url) : [],
      fixedUrls: newFixedUrls,
      dashboardUrl,
    });

    // Send Slack alerts
    if (shouldSendSlackAlert) {
      const lastSentAt = website.lastSlackSummarySentAt;
      let sendSummary =
        summaryInterval !== "none" &&
        summaryInterval !== "realtime" &&
        shouldSendSummary(lastSentAt, intervalDays);

      // For realtime, always send summary
      if (summaryInterval === "realtime") {
        sendSummary = true;
      }

      if (sendSummary && summaryInterval !== "realtime") {
        // Send day-wise summary (not realtime)
        const summaryData = await buildSummaryPayload(summaryInterval);
        logger.info(
          { webhookUrl: website.slackWebhookUrl, summaryInterval },
          "Sending Slack day-wise summary",
        );
        await sendSlackAlert(
          website.slackWebhookUrl!,
          {
            ...slackPayload,
            brokenUrls: summaryData.brokenUrls,
            fixedUrls: summaryData.fixedUrls,
            currentStatus: summaryData.currentStatus,
            dayWiseBreakdown: summaryData.dayWiseBreakdown,
          },
          "summary",
        );

        // Update last summary sent time
        await db
          .update(websitesTable)
          .set({ lastSlackSummarySentAt: new Date() })
          .where(eq(websitesTable.id, websiteId));
      } else if (summaryInterval === "realtime") {
        // Realtime - always send summary after every check
        logger.info(
          { webhookUrl: website.slackWebhookUrl, summaryInterval },
          "Sending Slack realtime summary",
        );
        await sendSlackAlert(website.slackWebhookUrl!, slackPayload, "summary");
      } else if (hasChanges && slackRealtimeEnabled) {
        // Non-realtime, has changes, and realtime alerts enabled - send broken/fixed
        logger.info(
          { webhookUrl: website.slackWebhookUrl, summaryInterval },
          "Sending Slack broken/fixed alert",
        );
        if (newBrokenUrls.length > 0) {
          await sendSlackAlert(
            website.slackWebhookUrl!,
            slackPayload,
            "broken",
          );
        } else if (newFixedUrls.length > 0) {
          await sendSlackAlert(website.slackWebhookUrl!, slackPayload, "fixed");
        }
      }
    }

    // Send Teams summary after every check so the team knows the run completed.
    if (shouldSendTeamsAlert) {
      const realtimeSummaryData = await buildSummaryPayload(
        summaryInterval === "none" ? "7days" : summaryInterval,
      );
      logger.info(
        { webhookUrl: website.teamsWebhookUrl },
        "Sending Teams run summary",
      );
      await sendTeamsAlert(
        website.teamsWebhookUrl!,
        {
          ...teamsPayload,
          brokenUrls:
            brokenCount > 0
              ? urlRows.filter((u) => u.isBroken).map((u) => u.url)
              : [],
          fixedUrls: realtimeSummaryData.fixedUrls,
          currentStatus: realtimeSummaryData.currentStatus,
          dayWiseBreakdown: realtimeSummaryData.dayWiseBreakdown,
        },
        "summary",
      );
    }

    // Preserve existing additional Teams alert behavior for broken/fixed changes.
    if (shouldSendTeamsAlert) {
      const lastSentAt = website.lastTeamsSummarySentAt;
      let sendSummary =
        summaryInterval !== "none" &&
        summaryInterval !== "realtime" &&
        shouldSendSummary(lastSentAt, intervalDays);

      if (summaryInterval === "realtime") {
        sendSummary = true;
      }

      if (sendSummary && summaryInterval !== "realtime") {
        const summaryData = await buildSummaryPayload(summaryInterval);
        logger.info(
          { webhookUrl: website.teamsWebhookUrl, summaryInterval },
          "Sending Teams day-wise summary",
        );
        await sendTeamsAlert(
          website.teamsWebhookUrl!,
          {
            ...teamsPayload,
            brokenUrls: summaryData.brokenUrls,
            fixedUrls: summaryData.fixedUrls,
            currentStatus: summaryData.currentStatus,
            dayWiseBreakdown: summaryData.dayWiseBreakdown,
          },
          "summary",
        );

        await db
          .update(websitesTable)
          .set({ lastTeamsSummarySentAt: new Date() })
          .where(eq(websitesTable.id, websiteId));
      } else if (summaryInterval === "realtime") {
        logger.info(
          { webhookUrl: website.teamsWebhookUrl, summaryInterval },
          "Sending Teams realtime summary",
        );
        await sendTeamsAlert(website.teamsWebhookUrl!, teamsPayload, "summary");
      } else if (hasChanges && teamsRealtimeEnabled) {
        logger.info(
          { webhookUrl: website.teamsWebhookUrl, summaryInterval },
          "Sending Teams broken/fixed alert",
        );
        if (newBrokenUrls.length > 0) {
          await sendTeamsAlert(
            website.teamsWebhookUrl!,
            teamsPayload,
            "broken",
          );
        } else if (newFixedUrls.length > 0) {
          await sendTeamsAlert(website.teamsWebhookUrl!, teamsPayload, "fixed");
        }
      }
    }

    logger.info(
      {
        websiteId,
        checkedUrls: urlRows.length,
        brokenCount,
        newBroken: newBrokenUrls.length,
        emailAlertSent,
        summaryEmailSent,
      },
      "Website check complete",
    );

    return {
      websiteId,
      checkedUrls: urlRows.length,
      brokenUrls: brokenCount,
      newBrokenUrls: newBrokenUrls.length,
      message:
        newBrokenUrls.length > 0
          ? emailAlertSent
            ? `Found ${newBrokenUrls.length} new broken URL(s), email alert sent`
            : `Found ${newBrokenUrls.length} new broken URL(s), but email delivery failed`
          : summaryEmailSent
            ? "Check complete, no new issues, summary email sent"
            : "Check complete, no new issues, but summary email delivery failed",
    };
  } catch (err) {
    logger.error({ err, websiteId }, "Error during website check");
    await db
      .update(websitesTable)
      .set({ status: "error", lastCheckedAt: new Date() })
      .where(eq(websitesTable.id, websiteId));
    throw err;
  }
}

/**
 * Run checks for all websites (called by cron)
 */
export async function checkAllWebsites(): Promise<void> {
  const websites = await db.select().from(websitesTable);
  logger.info(
    { count: websites.length },
    "Running scheduled check for all websites",
  );

  for (const website of websites) {
    try {
      await checkWebsite(website.id);
    } catch (err) {
      logger.error(
        { err, websiteId: website.id },
        "Error checking website in scheduled run",
      );
    }
  }
}
