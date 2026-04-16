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
import { sendCheckSummaryEmail, sendIssueAlert } from "./emailer";
import { sendSlackAlert, type SlackAlertPayload } from "./slack-notifier";
import { sendTeamsAlert, type TeamsAlertPayload } from "./teams-notifier";
import { logger } from "../lib/logger";
import {
  classifyIssueType,
  deriveHistoryIssueTypes,
  deriveStoredIssueType,
  type IssueAlertEntry,
  type TrackedIssueType,
} from "./issue-status";

export interface CheckWebsiteResult {
  websiteId: number;
  checkedUrls: number;
  brokenUrls: number;
  serverErrorUrls: number;
  trackedIssueUrls: number;
  newBrokenUrls: number;
  newServerErrorUrls: number;
  newIssueUrls: number;
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
 * 2. Check all stored URLs for tracked issues
 * 3. Detect newly tracked issues (404 + 5xx)
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
        serverErrorUrls: 0,
        trackedIssueUrls: 0,
        newBrokenUrls: 0,
        newServerErrorUrls: 0,
        newIssueUrls: 0,
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

    // Step 4: Update URL statuses and detect new issue / recovery transitions.
    const newIssueEntries: IssueAlertEntry[] = [];
    const newNotFoundEntries: IssueAlertEntry[] = [];
    const newServerErrorEntries: IssueAlertEntry[] = [];
    const newFixedUrls: string[] = [];

    const urlRowByUrl = new Map(urlRows.map((r) => [r.url, r] as const));
    const dbWriteConcurrency = Number(process.env.URL_DB_WRITE_CONCURRENCY || 25);

    await runInBatches(checkResults, dbWriteConcurrency, async (result) => {
      const existing = urlRowByUrl.get(result.url);
      if (!existing) return;

      const previousIssueType = deriveStoredIssueType(existing);
      const nextIssueType = classifyIssueType(result.statusCode);
      const now = new Date();

      if (nextIssueType !== previousIssueType && nextIssueType) {
        const issueEntry: IssueAlertEntry = {
          url: result.url,
          statusCode: result.statusCode ?? 0,
          issueType: nextIssueType,
        };

        newIssueEntries.push(issueEntry);
        if (nextIssueType === "not_found") {
          newNotFoundEntries.push(issueEntry);
        } else {
          newServerErrorEntries.push(issueEntry);
        }

        logger.info(
          {
            url: result.url,
            previousIssueType,
            nextIssueType,
            statusCode: result.statusCode,
          },
          "NEW tracked issue detected",
        );
      }

      if (previousIssueType && nextIssueType === null) {
        newFixedUrls.push(result.url);
      }

      await db
        .update(monitoredUrlsTable)
        .set({
          previousStatus: existing.lastStatus,
          lastStatus: result.statusCode,
          isBroken: nextIssueType === "not_found",
          issueType: nextIssueType,
          isTrackedIssue: nextIssueType !== null,
          lastCheckedAt: now,
          errorMessage: result.errorMessage,
        })
        .where(eq(monitoredUrlsTable.id, existing.id));

      if (nextIssueType !== previousIssueType) {
        await db.insert(urlStatusHistoryTable).values({
          websiteId,
          url: result.url,
          previousStatus: existing.lastStatus,
          newStatus: result.statusCode,
          previousIssueType,
          newIssueType: nextIssueType,
          wasBroken: nextIssueType === "not_found",
          becameFixed: previousIssueType !== null && nextIssueType === null,
          changedAt: now,
        });
      }
    });

    // Step 5: Update website summary
    const notFoundResults = checkResults.filter(
      (r) => classifyIssueType(r.statusCode) === "not_found",
    );
    const serverErrorResults = checkResults.filter(
      (r) => classifyIssueType(r.statusCode) === "server_error",
    );
    const brokenCount = notFoundResults.length;
    const serverErrorCount = serverErrorResults.length;
    const trackedIssueCount = brokenCount + serverErrorCount;
    const currentNotFoundUrls = notFoundResults.map((r) => r.url);
    const currentServerErrorUrls = serverErrorResults.map((r) => r.url);

    await db
      .update(websitesTable)
      .set({
        totalUrls: urlRows.length,
        brokenUrls: brokenCount,
        notFoundUrls: brokenCount,
        serverErrorUrls: serverErrorCount,
        trackedIssueUrls: trackedIssueCount,
        status: trackedIssueCount > 0 ? "error" : "ok",
        lastCheckedAt: new Date(),
      })
      .where(eq(websitesTable.id, websiteId));

    // Step 5b: Save check history
    await db.insert(checkHistoryTable).values({
      websiteId,
      totalUrls: urlRows.length,
      brokenUrls: trackedIssueCount,
      notFoundUrls: brokenCount,
      serverErrorUrls: serverErrorCount,
      trackedIssueUrls: trackedIssueCount,
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
      issues: newIssueEntries,
      notFoundUrls: newNotFoundEntries.map((entry) => entry.url),
      serverErrorUrls: newServerErrorEntries.map((entry) => entry.url),
      fixedUrls: newFixedUrls,
      totalUrls: urlRows.length,
      checkedUrls: checkResults.length,
      dashboardUrl,
    };

    const teamsPayload: TeamsAlertPayload = {
      websiteId: website.id,
      websiteName: website.name,
      issues: newIssueEntries,
      notFoundUrls: newNotFoundEntries.map((entry) => entry.url),
      serverErrorUrls: newServerErrorEntries.map((entry) => entry.url),
      fixedUrls: newFixedUrls,
      totalUrls: urlRows.length,
      checkedUrls: checkResults.length,
      dashboardUrl,
    };

    const hasChanges = newIssueEntries.length > 0 || newFixedUrls.length > 0;

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
        shouldSendEmail: newIssueEntries.length > 0,
        shouldSendSlack: shouldSendSlackAlert,
        shouldSendTeams: shouldSendTeamsAlert,
        summaryInterval,
        intervalDays,
        hasChanges,
        newNotFoundUrls: newNotFoundEntries.length,
        newServerErrorUrls: newServerErrorEntries.length,
        newFixedUrls: newFixedUrls.length,
        slackRealtimeEnabled,
        teamsRealtimeEnabled,
        lastSlackSummarySentAt: website.lastSlackSummarySentAt,
        lastTeamsSummarySentAt: website.lastTeamsSummarySentAt,
      },
      "Alert decision check",
    );

    // Send email alert for newly detected tracked issues.
    let emailAlertSent = false;
    if (newIssueEntries.length > 0) {
      logger.info(
        {
          to: website.alertEmail,
          count: newIssueEntries.length,
          issues: newIssueEntries,
        },
        "Sending email alert",
      );
      emailAlertSent = await sendIssueAlert({
        to: website.alertEmail,
        websiteName: website.name,
        issues: newIssueEntries,
      });
    }

    // Build summary payload once and use it for summary email / Teams summary.
    const summaryPayload = {
      issues: newIssueEntries,
      notFoundUrls: currentNotFoundUrls,
      serverErrorUrls: currentServerErrorUrls,
      fixedUrls: newFixedUrls,
      totalUrls: urlRows.length,
      checkedUrls: checkResults.length,
      currentStatus: {
        totalUrls: urlRows.length,
        trackedIssueUrls: trackedIssueCount,
        notFoundUrls: brokenCount,
        serverErrorUrls: serverErrorCount,
        okUrls: urlRows.length - trackedIssueCount,
      },
      dayWiseBreakdown: [] as Array<{
        date: string;
        notFound: number;
        serverError: number;
        fixed: number;
      }>,
    };

    // Helper to build summary payload for day-wise summary
    const buildSummaryPayload = async (
      interval: AlertSummaryInterval,
    ): Promise<{
      issues: IssueAlertEntry[];
      notFoundUrls: string[];
      serverErrorUrls: string[];
      fixedUrls: string[];
      totalUrls: number;
      checkedUrls: number;
      currentStatus: {
        totalUrls: number;
        trackedIssueUrls: number;
        notFoundUrls: number;
        serverErrorUrls: number;
        okUrls: number;
      };
      dayWiseBreakdown: Array<{
        date: string;
        notFound: number;
        serverError: number;
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

      const uniqueNotFoundUrls = new Set<string>();
      const uniqueServerErrorUrls = new Set<string>();
      const uniqueFixedUrls = new Set<string>();
      for (const entry of recentHistory) {
        const { newIssueType } = deriveHistoryIssueTypes(entry);
        if (newIssueType === "not_found") {
          uniqueNotFoundUrls.add(entry.url);
        }
        if (newIssueType === "server_error") {
          uniqueServerErrorUrls.add(entry.url);
        }
        if (entry.becameFixed) {
          uniqueFixedUrls.add(entry.url);
        }
      }
      const notFoundUrls = Array.from(uniqueNotFoundUrls);
      const serverErrorUrls = Array.from(uniqueServerErrorUrls);
      const fixedUrls = Array.from(uniqueFixedUrls);
      const issues: IssueAlertEntry[] = [
        ...notFoundUrls.map((url) => ({
          url,
          statusCode: 404,
          issueType: "not_found" as TrackedIssueType,
        })),
        ...serverErrorUrls.map((url) => ({
          url,
          statusCode: 500,
          issueType: "server_error" as TrackedIssueType,
        })),
      ];

      const currentNotFound = currentNotFoundUrls.length;
      const currentServerError = currentServerErrorUrls.length;
      const currentTrackedIssueCount = currentNotFound + currentServerError;
      const currentOk = urlRows.length - currentTrackedIssueCount;

      const dayMap = new Map<
        string,
        {
          date: string;
          notFoundSet: Set<string>;
          serverErrorSet: Set<string>;
          fixedSet: Set<string>;
        }
      >();
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split("T")[0];
        dayMap.set(dateStr, {
          date: dateStr,
          notFoundSet: new Set<string>(),
          serverErrorSet: new Set<string>(),
          fixedSet: new Set<string>(),
        });
      }

      for (const entry of recentHistory) {
        const dateStr = entry.changedAt.toISOString().split("T")[0];
        const day = dayMap.get(dateStr);
        if (day) {
          const { newIssueType } = deriveHistoryIssueTypes(entry);
          if (entry.becameFixed) {
            day.fixedSet.add(entry.url);
          } else if (newIssueType === "not_found") {
            day.notFoundSet.add(entry.url);
          } else if (newIssueType === "server_error") {
            day.serverErrorSet.add(entry.url);
          }
        }
      }

      const dayWiseBreakdown = Array.from(dayMap.values())
        .map((day) => ({
          date: day.date,
          notFound: day.notFoundSet.size,
          serverError: day.serverErrorSet.size,
          fixed: day.fixedSet.size,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        issues,
        notFoundUrls,
        serverErrorUrls,
        fixedUrls,
        totalUrls: urlRows.length,
        checkedUrls: checkResults.length,
        currentStatus: {
          totalUrls: urlRows.length,
          trackedIssueUrls: currentTrackedIssueCount,
          notFoundUrls: currentNotFound,
          serverErrorUrls: currentServerError,
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
      notFoundUrls: currentNotFoundUrls,
      serverErrorUrls: currentServerErrorUrls,
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
            issues: summaryData.issues,
            notFoundUrls: summaryData.notFoundUrls,
            serverErrorUrls: summaryData.serverErrorUrls,
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
        await sendSlackAlert(
          website.slackWebhookUrl!,
          {
            ...slackPayload,
            notFoundUrls: currentNotFoundUrls,
            serverErrorUrls: currentServerErrorUrls,
            currentStatus: summaryPayload.currentStatus,
          },
          "summary",
        );
      } else if (hasChanges && slackRealtimeEnabled) {
        // Non-realtime, has changes, and realtime alerts enabled - send broken/fixed
        logger.info(
          { webhookUrl: website.slackWebhookUrl, summaryInterval },
          "Sending Slack broken/fixed alert",
        );
        if (newIssueEntries.length > 0) {
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
          issues: realtimeSummaryData.issues,
          notFoundUrls: currentNotFoundUrls,
          serverErrorUrls: currentServerErrorUrls,
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
            issues: summaryData.issues,
            notFoundUrls: summaryData.notFoundUrls,
            serverErrorUrls: summaryData.serverErrorUrls,
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
        await sendTeamsAlert(
          website.teamsWebhookUrl!,
          {
            ...teamsPayload,
            notFoundUrls: currentNotFoundUrls,
            serverErrorUrls: currentServerErrorUrls,
            currentStatus: summaryPayload.currentStatus,
          },
          "summary",
        );
      } else if (hasChanges && teamsRealtimeEnabled) {
        logger.info(
          { webhookUrl: website.teamsWebhookUrl, summaryInterval },
          "Sending Teams broken/fixed alert",
        );
        if (newIssueEntries.length > 0) {
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
        serverErrorCount,
        trackedIssueCount,
        newBroken: newNotFoundEntries.length,
        newServerErrors: newServerErrorEntries.length,
        emailAlertSent,
        summaryEmailSent,
      },
      "Website check complete",
    );

    return {
      websiteId,
      checkedUrls: urlRows.length,
      brokenUrls: brokenCount,
      serverErrorUrls: serverErrorCount,
      trackedIssueUrls: trackedIssueCount,
      newBrokenUrls: newNotFoundEntries.length,
      newServerErrorUrls: newServerErrorEntries.length,
      newIssueUrls: newIssueEntries.length,
      message:
        newIssueEntries.length > 0
          ? emailAlertSent
            ? `Found ${newIssueEntries.length} new issue URL(s), email alert sent`
            : `Found ${newIssueEntries.length} new issue URL(s), but email delivery failed`
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
