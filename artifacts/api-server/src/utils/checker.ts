import { db, websitesTable, monitoredUrlsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { parseSitemap } from "./sitemapParser";
import { checkUrlsBatch } from "./urlChecker";
import { send404Alert } from "./emailer";
import { logger } from "../lib/logger";

export interface CheckWebsiteResult {
  websiteId: number;
  checkedUrls: number;
  brokenUrls: number;
  newBrokenUrls: number;
  message: string;
}

/**
 * Run a full check for a single website:
 * 1. Fetch + re-parse sitemap to discover any new URLs
 * 2. Check all stored URLs for 404s
 * 3. Detect newly broken URLs (was 200, now 404)
 * 4. Send email alert if needed
 */
export async function checkWebsite(websiteId: number): Promise<CheckWebsiteResult> {
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
    // Step 1: Re-parse sitemap to catch new URLs
    let sitemapUrls: string[] = [];
    try {
      sitemapUrls = await parseSitemap(website.sitemapUrl);
      logger.info({ websiteId, count: sitemapUrls.length }, "Parsed sitemap URLs");
    } catch (err) {
      logger.error({ err, websiteId }, "Failed to parse sitemap during check");
    }

    // Step 2: Upsert new URLs into DB (insert ones not already tracked)
    if (sitemapUrls.length > 0) {
      const existingUrls = await db
        .select({ url: monitoredUrlsTable.url })
        .from(monitoredUrlsTable)
        .where(eq(monitoredUrlsTable.websiteId, websiteId));

      const existingSet = new Set(existingUrls.map((r) => r.url));
      const newUrls = sitemapUrls.filter((u) => !existingSet.has(u));

      if (newUrls.length > 0) {
        await db.insert(monitoredUrlsTable).values(
          newUrls.map((url) => ({ websiteId, url }))
        );
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
      return { websiteId, checkedUrls: 0, brokenUrls: 0, newBrokenUrls: 0, message: "No URLs to check" };
    }

    const urlStrings = urlRows.map((r) => r.url);
    const checkResults = await checkUrlsBatch(urlStrings, 5);

    // Step 4: Update URL statuses and detect new breakages
    const newBrokenUrls: string[] = [];

    for (const result of checkResults) {
      const existing = urlRows.find((r) => r.url === result.url);
      if (!existing) continue;

      const isNowBroken = result.statusCode === 404;
      const wasOk = !existing.isBroken && (existing.lastStatus === 200 || existing.lastStatus === null);

      // Detect transition: was ok (or unchecked) → now 404
      if (isNowBroken && wasOk) {
        newBrokenUrls.push(result.url);
      }

      await db
        .update(monitoredUrlsTable)
        .set({
          previousStatus: existing.lastStatus,
          lastStatus: result.statusCode,
          isBroken: isNowBroken,
          lastCheckedAt: new Date(),
          errorMessage: result.errorMessage,
        })
        .where(eq(monitoredUrlsTable.id, existing.id));
    }

    // Step 5: Update website summary
    const brokenCount = checkResults.filter((r) => r.statusCode === 404).length;
    await db
      .update(websitesTable)
      .set({
        totalUrls: urlRows.length,
        brokenUrls: brokenCount,
        status: "ok",
        lastCheckedAt: new Date(),
      })
      .where(eq(websitesTable.id, websiteId));

    // Step 6: Send email alert for newly broken URLs
    if (newBrokenUrls.length > 0) {
      await send404Alert({
        to: website.alertEmail,
        websiteName: website.name,
        brokenUrls: newBrokenUrls,
      });
    }

    logger.info({ websiteId, checkedUrls: urlRows.length, brokenCount, newBroken: newBrokenUrls.length }, "Website check complete");

    return {
      websiteId,
      checkedUrls: urlRows.length,
      brokenUrls: brokenCount,
      newBrokenUrls: newBrokenUrls.length,
      message: newBrokenUrls.length > 0
        ? `Found ${newBrokenUrls.length} new broken URL(s), alert sent`
        : "Check complete, no new issues",
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
  logger.info({ count: websites.length }, "Running scheduled check for all websites");

  for (const website of websites) {
    try {
      await checkWebsite(website.id);
    } catch (err) {
      logger.error({ err, websiteId: website.id }, "Error checking website in scheduled run");
    }
  }
}
