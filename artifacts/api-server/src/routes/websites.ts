import { Router, type IRouter } from "express";
import {
  db,
  websitesTable,
  monitoredUrlsTable,
  websiteSitemapsTable,
  usersTable,
  checkHistoryTable,
  urlStatusHistoryTable,
} from "@workspace/db";
import { eq, and, gte, sql, desc, asc } from "drizzle-orm";
import { parseSitemap } from "../utils/sitemapParser";
import { checkWebsite } from "../utils/checker";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import {
  classifyIssueType,
  deriveHistoryIssueTypes,
  deriveStoredIssueType,
} from "../utils/issue-status";

const router: IRouter = Router();

router.use(authenticate);

const addWebsiteSchema = z.object({
  name: z.string().min(1),
  ownerName: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  tags: z.string().optional(),
  notes: z.string().optional(),
  sitemapUrl: z.string().url(),
  alertEmail: z.string().email(),
  checkIntervalMinutes: z
    .number()
    .int()
    .min(5)
    .max(10080)
    .optional()
    .default(60),
});

router.get("/websites", async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const query = isAdmin
      ? db.select().from(websitesTable)
      : db
          .select()
          .from(websitesTable)
          .where(eq(websitesTable.userId, req.user!.userId));

    const websites = await query.orderBy(websitesTable.createdAt);
    res.json(websites.map(formatWebsite));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch websites");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/websites", async (req, res) => {
  const parsed = addWebsiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    name,
    ownerName,
    priority,
    tags,
    notes,
    sitemapUrl,
    alertEmail,
    checkIntervalMinutes,
  } = parsed.data;

  try {
    const [website] = await db
      .insert(websitesTable)
      .values({
        name,
        ownerName: ownerName?.trim() || null,
        priority,
        tags: tags?.trim() || null,
        notes: notes?.trim() || null,
        sitemapUrl,
        alertEmail,
        checkIntervalMinutes,
        status: "pending",
        userId: req.user!.userId,
      })
      .returning();

    parseSitemapAndStore(website.id, sitemapUrl, req.log).catch((err) => {
      req.log.error(
        { err, websiteId: website.id },
        "Background sitemap parse failed",
      );
    });

    res.status(201).json(formatWebsite(website));
  } catch (err) {
    req.log.error({ err }, "Failed to add website");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/websites/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    res.json(formatWebsite(website));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch website");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/websites/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    await db.delete(websitesTable).where(eq(websitesTable.id, id));
    res.json({ success: true, message: "Website deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete website");
    res.status(500).json({ error: "Internal server error" });
  }
});

const updateWebsiteSchema = z.object({
  name: z.string().min(1).optional(),
  ownerName: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  tags: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  sitemapUrl: z.string().url().optional(),
  alertEmail: z.string().email().optional(),
  checkIntervalMinutes: z.number().int().min(5).max(10080).optional(),
  slackWebhookUrl: z.string().optional().nullable(),
  slackAlertEnabled: z.boolean().optional(),
  slackRealtimeAlerts: z.boolean().optional(),
  teamsWebhookUrl: z.string().optional().nullable(),
  teamsAlertEnabled: z.boolean().optional(),
  teamsRealtimeAlerts: z.boolean().optional(),
  alertSummaryInterval: z
    .enum([
      "none",
      "realtime",
      "daily",
      "3days",
      "5days",
      "7days",
      "14days",
      "30days",
      "custom",
    ])
    .optional(),
  customSummaryDays: z.number().int().min(2).max(90).optional().nullable(),
});

router.patch("/websites/:id/update", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  const parsed = updateWebsiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && existing.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const updates: Partial<typeof existing> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.ownerName !== undefined)
      updates.ownerName = parsed.data.ownerName?.trim() || null;
    if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
    if (parsed.data.tags !== undefined)
      updates.tags = parsed.data.tags?.trim() || null;
    if (parsed.data.notes !== undefined)
      updates.notes = parsed.data.notes?.trim() || null;
    if (parsed.data.alertEmail) updates.alertEmail = parsed.data.alertEmail;
    if (parsed.data.checkIntervalMinutes !== undefined)
      updates.checkIntervalMinutes = parsed.data.checkIntervalMinutes;
    if (parsed.data.slackWebhookUrl !== undefined)
      updates.slackWebhookUrl = parsed.data.slackWebhookUrl || null;
    if (parsed.data.slackAlertEnabled !== undefined)
      updates.slackAlertEnabled = parsed.data.slackAlertEnabled;
    if (parsed.data.slackRealtimeAlerts !== undefined)
      updates.slackRealtimeAlerts = parsed.data.slackRealtimeAlerts;
    if (parsed.data.teamsWebhookUrl !== undefined)
      updates.teamsWebhookUrl = parsed.data.teamsWebhookUrl || null;
    if (parsed.data.teamsAlertEnabled !== undefined)
      updates.teamsAlertEnabled = parsed.data.teamsAlertEnabled;
    if (parsed.data.teamsRealtimeAlerts !== undefined)
      updates.teamsRealtimeAlerts = parsed.data.teamsRealtimeAlerts;
    if (parsed.data.alertSummaryInterval !== undefined)
      updates.alertSummaryInterval = parsed.data.alertSummaryInterval;
    if (parsed.data.customSummaryDays !== undefined)
      updates.customSummaryDays = parsed.data.customSummaryDays;

    const sitemapChanged =
      parsed.data.sitemapUrl && parsed.data.sitemapUrl !== existing.sitemapUrl;
    if (sitemapChanged) {
      updates.sitemapUrl = parsed.data.sitemapUrl!;
      updates.status = "pending";
      updates.totalUrls = 0;
      updates.brokenUrls = 0;
      updates.notFoundUrls = 0;
      updates.serverErrorUrls = 0;
      updates.trackedIssueUrls = 0;
    }

    const [updated] = await db
      .update(websitesTable)
      .set(updates)
      .where(eq(websitesTable.id, id))
      .returning();

    if (sitemapChanged) {
      await db
        .delete(monitoredUrlsTable)
        .where(eq(monitoredUrlsTable.websiteId, id));
      parseSitemapAndStore(id, updates.sitemapUrl!, req.log).catch((err) => {
        req.log.error(
          { err, websiteId: id },
          "Background sitemap re-parse failed",
        );
      });
    }

    res.json(formatWebsite(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update website");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/websites/:id/sitemaps", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));
    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const sitemaps = await db
      .select()
      .from(websiteSitemapsTable)
      .where(eq(websiteSitemapsTable.websiteId, id))
      .orderBy(websiteSitemapsTable.createdAt);

    res.json(
      sitemaps.map((s) => ({
        id: s.id,
        websiteId: s.websiteId,
        url: s.url,
        createdAt: s.createdAt?.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sitemaps");
    res.status(500).json({ error: "Internal server error" });
  }
});

const addSitemapSchema = z.object({ url: z.string().url() });

router.post("/websites/:id/sitemaps", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  const parsed = addSitemapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));
    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [sitemap] = await db
      .insert(websiteSitemapsTable)
      .values({ websiteId: id, url: parsed.data.url })
      .returning();

    parseSitemapAndStore(id, parsed.data.url, req.log).catch((err) => {
      req.log.error({ err, websiteId: id }, "Background sitemap parse failed");
    });

    res.status(201).json({
      id: sitemap.id,
      websiteId: sitemap.websiteId,
      url: sitemap.url,
      createdAt: sitemap.createdAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add sitemap");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/websites/:id/sitemaps/:sitemapId", async (req, res) => {
  const id = parseInt(req.params.id);
  const sitemapId = parseInt(req.params.sitemapId);
  if (isNaN(id) || isNaN(sitemapId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));
    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [deleted] = await db
      .delete(websiteSitemapsTable)
      .where(
        and(
          eq(websiteSitemapsTable.id, sitemapId),
          eq(websiteSitemapsTable.websiteId, id),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Sitemap not found" });
      return;
    }

    res.json({ success: true, message: "Sitemap removed" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete sitemap");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/websites/:id/refresh-sitemap", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Get all sitemaps for this website
    const additionalSitemaps = await db
      .select({ url: websiteSitemapsTable.url })
      .from(websiteSitemapsTable)
      .where(eq(websiteSitemapsTable.websiteId, id));

    const allSitemapUrls = [
      website.sitemapUrl,
      ...additionalSitemaps.map((s) => s.url),
    ];

    let totalNewUrls = 0;
    let totalUrls = 0;

    for (const sitemapUrl of allSitemapUrls) {
      try {
        const urls = await parseSitemap(sitemapUrl);
        totalUrls = urls.length;

        if (urls.length > 0) {
          // Check for existing URLs to avoid duplicates
          const existingUrls = await db
            .select({ url: monitoredUrlsTable.url })
            .from(monitoredUrlsTable)
            .where(eq(monitoredUrlsTable.websiteId, id));

          const existingSet = new Set(existingUrls.map((r) => r.url));
          const newUrls = urls.filter((url) => !existingSet.has(url));

          if (newUrls.length > 0) {
            await db
              .insert(monitoredUrlsTable)
              .values(newUrls.map((url) => ({ websiteId: id, url })));
            totalNewUrls += newUrls.length;
          }
        }
      } catch (err) {
        req.log.error(
          { err, sitemapUrl },
          "Failed to parse sitemap during refresh",
        );
      }
    }

    // Update total URLs count
    const allUrls = await db
      .select({ url: monitoredUrlsTable.url })
      .from(monitoredUrlsTable)
      .where(eq(monitoredUrlsTable.websiteId, id));

    await db
      .update(websitesTable)
      .set({ totalUrls: allUrls.length })
      .where(eq(websitesTable.id, id));

    res.json({
      success: true,
      message: `Found ${totalNewUrls} new URLs`,
      newUrls: totalNewUrls,
      totalUrls: allUrls.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to refresh sitemap");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/websites/:id/urls", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  const statusFilter = req.query.status as string | undefined;

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    let urlRows = await db
      .select()
      .from(monitoredUrlsTable)
      .where(eq(monitoredUrlsTable.websiteId, id))
      .orderBy(monitoredUrlsTable.url);

    if (statusFilter === "broken" || statusFilter === "not_found") {
      urlRows = urlRows.filter(
        (r) => deriveStoredIssueType(r) === "not_found",
      );
    } else if (statusFilter === "server_error") {
      urlRows = urlRows.filter(
        (r) => deriveStoredIssueType(r) === "server_error",
      );
    } else if (statusFilter === "ok") {
      urlRows = urlRows.filter((r) => deriveStoredIssueType(r) === null);
    }

    res.json(urlRows.map(formatUrl));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch website URLs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/websites/:id/urls/:urlId", async (req, res) => {
  const id = parseInt(req.params.id);
  const urlId = parseInt(req.params.urlId);
  if (isNaN(id) || isNaN(urlId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [deleted] = await db
      .delete(monitoredUrlsTable)
      .where(
        and(
          eq(monitoredUrlsTable.id, urlId),
          eq(monitoredUrlsTable.websiteId, id),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "URL not found" });
      return;
    }

    // Update total URLs count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(monitoredUrlsTable)
      .where(eq(monitoredUrlsTable.websiteId, id));

    await db
      .update(websitesTable)
      .set({ totalUrls: countResult[0]?.count ?? 0 })
      .where(eq(websitesTable.id, id));

    res.json({ success: true, message: "URL deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete URL");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/websites/:id/check", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const result = await checkWebsite(id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to trigger manual check");
    res.status(500).json({ error: "Failed to run check" });
  }
});

router.get("/dashboard/summary", async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const query = isAdmin
      ? db.select().from(websitesTable)
      : db
          .select()
          .from(websitesTable)
          .where(eq(websitesTable.userId, req.user!.userId));

    const websites = await query;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const websiteIds = websites.map((website) => website.id);
    const recentHistory =
      websiteIds.length > 0
        ? await db
            .select()
            .from(urlStatusHistoryTable)
            .where(gte(urlStatusHistoryTable.changedAt, since))
            .orderBy(desc(urlStatusHistoryTable.changedAt))
        : [];
    const scopedHistory = recentHistory.filter((entry) =>
      websiteIds.includes(entry.websiteId),
    );
    const totalUrls = websites.reduce((sum, w) => sum + w.totalUrls, 0);
    const totalBroken = websites.reduce(
      (sum, w) => sum + (w.trackedIssueUrls ?? w.brokenUrls),
      0,
    );
    const totalNotFound = websites.reduce(
      (sum, w) => sum + (w.notFoundUrls ?? w.brokenUrls),
      0,
    );
    const totalServerErrors = websites.reduce(
      (sum, w) => sum + (w.serverErrorUrls ?? 0),
      0,
    );
    const websitesWithErrors = websites.filter(
      (w) => (w.trackedIssueUrls ?? w.brokenUrls) > 0,
    ).length;
    const totalRecoveredRecent = scopedHistory.filter((entry) => entry.becameFixed)
      .length;
    const sitesCheckedRecent = websites.filter((website) => {
      if (!website.lastCheckedAt) return false;
      return website.lastCheckedAt >= since;
    }).length;

    res.json({
      totalWebsites: websites.length,
      totalUrls,
      totalBroken,
      totalTrackedIssues: totalBroken,
      totalNotFound,
      totalServerErrors,
      totalRecoveredRecent,
      sitesCheckedRecent,
      websitesWithErrors,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/insights", async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const isAdmin = req.user?.role === "admin";
    const websites = await (isAdmin
      ? db.select().from(websitesTable)
      : db
          .select()
          .from(websitesTable)
          .where(eq(websitesTable.userId, req.user!.userId)));
    const websiteIds = websites.map((website) => website.id);

    if (websiteIds.length === 0) {
      res.json({
        recentActivity: [],
        needsAttention: [],
        websiteHealth: [],
      });
      return;
    }

    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const urlHistory = await db
      .select()
      .from(urlStatusHistoryTable)
      .where(gte(urlStatusHistoryTable.changedAt, since))
      .orderBy(desc(urlStatusHistoryTable.changedAt));

    const scopedHistory = urlHistory.filter((entry) =>
      websiteIds.includes(entry.websiteId),
    );

    const recentActivity = scopedHistory.slice(0, 40).map((entry) => {
      const website = websites.find((site) => site.id === entry.websiteId);
      const { previousIssueType, newIssueType } = deriveHistoryIssueTypes(entry);
      const changeType = entry.becameFixed
        ? "recovered"
        : previousIssueType && newIssueType && previousIssueType !== newIssueType
          ? "reclassified"
          : newIssueType === "server_error"
            ? "new_server_error"
            : "new_not_found";

      return {
        websiteId: entry.websiteId,
        websiteName: website?.name ?? "Unknown website",
        url: entry.url,
        changedAt: entry.changedAt?.toISOString(),
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        previousIssueType,
        newIssueType,
        changeType,
      };
    });

    const recentCounts = new Map<
      number,
      { introduced: number; recovered: number; serverErrors: number }
    >();
    for (const entry of scopedHistory) {
      const counts = recentCounts.get(entry.websiteId) ?? {
        introduced: 0,
        recovered: 0,
        serverErrors: 0,
      };
      const { newIssueType } = deriveHistoryIssueTypes(entry);
      if (entry.becameFixed) counts.recovered += 1;
      if (newIssueType) counts.introduced += 1;
      if (newIssueType === "server_error") counts.serverErrors += 1;
      recentCounts.set(entry.websiteId, counts);
    }

    const websiteHealth = websites
      .map((website) => {
        const counts = recentCounts.get(website.id) ?? {
          introduced: 0,
          recovered: 0,
          serverErrors: 0,
        };
        const owner =
          website.ownerName?.trim() ||
          userMap.get(website.userId)?.name ||
          "Unassigned";

        return {
          websiteId: website.id,
          websiteName: website.name,
          ownerName: owner,
          priority: website.priority ?? "medium",
          tags: parseTags(website.tags),
          alertDestinations: getAlertDestinations(website),
          checkIntervalMinutes: website.checkIntervalMinutes,
          totalUrls: website.totalUrls,
          trackedIssueUrls: website.trackedIssueUrls ?? website.brokenUrls,
          notFoundUrls: website.notFoundUrls ?? website.brokenUrls,
          serverErrorUrls: website.serverErrorUrls ?? 0,
          recentIntroducedCount: counts.introduced,
          recentRecoveredCount: counts.recovered,
          recentServerErrorCount: counts.serverErrors,
          lastCheckedAt: website.lastCheckedAt?.toISOString() ?? null,
          status: website.status,
        };
      })
      .sort((a, b) => {
        const severityA =
          a.serverErrorUrls * 100 +
          a.trackedIssueUrls * 10 +
          a.recentIntroducedCount * 5;
        const severityB =
          b.serverErrorUrls * 100 +
          b.trackedIssueUrls * 10 +
          b.recentIntroducedCount * 5;
        return severityB - severityA;
      });

    res.json({
      recentActivity,
      needsAttention: websiteHealth.filter(
        (website) =>
          website.trackedIssueUrls > 0 ||
          website.recentIntroducedCount > 0 ||
          website.recentServerErrorCount > 0,
      ),
      websiteHealth,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch dashboard insights");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/export.csv", async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const websites = await (isAdmin
      ? db.select().from(websitesTable)
      : db
          .select()
          .from(websitesTable)
          .where(eq(websitesTable.userId, req.user!.userId)));
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map((user) => [user.id, user]));

    const rows = [
      [
        "Website",
        "Owner",
        "Priority",
        "Tags",
        "Open Issues",
        "Open 404",
        "Open 5xx",
        "Check Interval Minutes",
        "Alert Destinations",
        "Last Checked",
      ],
      ...websites.map((website) => [
        website.name,
        website.ownerName?.trim() || userMap.get(website.userId)?.name || "",
        website.priority ?? "medium",
        parseTags(website.tags).join("|"),
        String(website.trackedIssueUrls ?? website.brokenUrls),
        String(website.notFoundUrls ?? website.brokenUrls),
        String(website.serverErrorUrls ?? 0),
        String(website.checkIntervalMinutes),
        getAlertDestinations(website).join("|"),
        website.lastCheckedAt?.toISOString() ?? "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sitewatch-dashboard.csv"',
    );
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Failed to export dashboard CSV");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/websites/:id/history", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  const days = Math.min(parseInt(req.query.days as string) || 7, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const history = await db
      .select()
      .from(checkHistoryTable)
      .where(
        and(
          eq(checkHistoryTable.websiteId, id),
          gte(checkHistoryTable.checkedAt, since),
        ),
      )
      .orderBy(checkHistoryTable.checkedAt);

    res.json({
      websiteId: website.id,
      websiteName: website.name,
      days,
      history: history.map((h) => ({
        checkedAt: h.checkedAt?.toISOString(),
        totalUrls: h.totalUrls,
        brokenUrls: h.brokenUrls,
        trackedIssueUrls: h.trackedIssueUrls ?? h.brokenUrls,
        notFoundUrls: h.notFoundUrls ?? h.brokenUrls,
        serverErrorUrls: h.serverErrorUrls ?? 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch website history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/websites/:id/summary-data", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid website ID" });
    return;
  }

  const days = Math.min(parseInt(req.query.days as string) || 7, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [website] = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.id, id));

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    if (req.user?.role !== "admin" && website.userId !== req.user?.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const statusHistory = await db
      .select()
      .from(urlStatusHistoryTable)
      .where(
        and(
          eq(urlStatusHistoryTable.websiteId, id),
          gte(urlStatusHistoryTable.changedAt, since),
        ),
      )
      .orderBy(desc(urlStatusHistoryTable.changedAt));

    const urls = await db
      .select()
      .from(monitoredUrlsTable)
      .where(eq(monitoredUrlsTable.websiteId, id));

    const currentNotFound = urls.filter(
      (u) => deriveStoredIssueType(u) === "not_found",
    );
    const currentServerErrors = urls.filter(
      (u) => deriveStoredIssueType(u) === "server_error",
    );
    const currentTrackedIssues = [...currentNotFound, ...currentServerErrors];
    const currentOk = urls.filter((u) => deriveStoredIssueType(u) === null);

    const uniqueUrls = (urls: string[]) => {
      const seen = new Set<string>();
      const result: string[] = [];

      for (const url of urls) {
        if (seen.has(url)) continue;
        seen.add(url);
        result.push(url);
      }

      return result;
    };

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

    for (const entry of statusHistory) {
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
        broke: day.notFoundSet.size + day.serverErrorSet.size,
        notFound: day.notFoundSet.size,
        serverError: day.serverErrorSet.size,
        fixed: day.fixedSet.size,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const recentlyNotFoundUrls = uniqueUrls(
      statusHistory
        .filter((h) => deriveHistoryIssueTypes(h).newIssueType === "not_found")
        .map((h) => h.url),
    ).slice(0, 20);

    const recentlyServerErrorUrls = uniqueUrls(
      statusHistory
        .filter(
          (h) => deriveHistoryIssueTypes(h).newIssueType === "server_error",
        )
        .map((h) => h.url),
    ).slice(0, 20);

    const recentlyFixedUrls = uniqueUrls(
      statusHistory.filter((h) => h.becameFixed).map((h) => h.url),
    ).slice(0, 20);

    const interval =
      website.alertSummaryInterval === "custom"
        ? `${website.customSummaryDays}days`
        : website.alertSummaryInterval || "7days";

    const latestTransitionByUrl = new Map<
      string,
      (typeof statusHistory)[number]
    >();
    for (const entry of statusHistory) {
      if (!latestTransitionByUrl.has(entry.url)) {
        latestTransitionByUrl.set(entry.url, entry);
      }
    }
    const openIssues = currentTrackedIssues
      .map((url) => {
        const transition = latestTransitionByUrl.get(url.url);
        const currentIssueType = deriveStoredIssueType(url);
        const enteredIssueAt =
          transition &&
          deriveHistoryIssueTypes(transition).newIssueType === currentIssueType
            ? transition.changedAt
            : url.lastCheckedAt;
        return {
          url: url.url,
          issueType: currentIssueType,
          currentStatus: url.lastStatus,
          previousStatus: url.previousStatus,
          lastCheckedAt: url.lastCheckedAt?.toISOString() ?? null,
          enteredIssueAt: enteredIssueAt?.toISOString() ?? null,
          ageHours: enteredIssueAt
            ? Math.max(
                1,
                Math.round(
                  (Date.now() - enteredIssueAt.getTime()) / (1000 * 60 * 60),
                ),
              )
            : null,
          errorMessage: url.errorMessage ?? null,
        };
      })
      .sort((a, b) => (b.ageHours ?? 0) - (a.ageHours ?? 0));

    const recentTransitions = statusHistory.slice(0, 25).map((entry) => {
      const { previousIssueType, newIssueType } = deriveHistoryIssueTypes(entry);
      return {
        url: entry.url,
        changedAt: entry.changedAt?.toISOString() ?? null,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        previousIssueType,
        newIssueType,
        changeType: entry.becameFixed
          ? "recovered"
          : previousIssueType &&
              newIssueType &&
              previousIssueType !== newIssueType
            ? "reclassified"
            : newIssueType === "server_error"
              ? "new_server_error"
              : "new_not_found",
      };
    });

    res.json({
      websiteId: website.id,
      websiteName: website.name,
      interval,
      currentStatus: {
        totalUrls: urls.length,
        brokenUrls: currentNotFound.length,
        trackedIssueUrls: currentTrackedIssues.length,
        notFoundUrls: currentNotFound.length,
        serverErrorUrls: currentServerErrors.length,
        okUrls: currentOk.length,
      },
      dayWiseBreakdown,
      recentlyBrokenUrls: recentlyNotFoundUrls,
      recentlyNotFoundUrls,
      recentlyServerErrorUrls,
      recentlyFixedUrls,
      openIssues,
      recentIssues: {
        notFoundUrls: recentlyNotFoundUrls,
        serverErrorUrls: recentlyServerErrorUrls,
      },
      recoveredIssues: recentlyFixedUrls,
      recentTransitions,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch website summary data");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/trends", async (req, res) => {
  const days = Math.min(parseInt(req.query.days as string) || 7, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const isAdmin = req.user?.role === "admin";
    const websiteQuery = isAdmin
      ? db.select().from(websitesTable)
      : db
          .select()
          .from(websitesTable)
          .where(eq(websitesTable.userId, req.user!.userId));

    const websites = await websiteQuery;
    const websiteIds = websites.map((w) => w.id);

    if (websiteIds.length === 0) {
      res.json({
        days,
        overallTrend: [],
        websites: [],
      });
      return;
    }

    const history = await db
      .select()
      .from(checkHistoryTable)
      .where(gte(checkHistoryTable.checkedAt, since))
      .orderBy(checkHistoryTable.checkedAt);

    const overallTrend: Record<
      string,
      { totalBroken: number; totalNotFound: number; totalServerErrors: number }
    > = {};
    const websiteTrends: Record<
      number,
      {
        name: string;
        history: Array<{
          date: string;
          broken: number;
          trackedIssues: number;
          notFound: number;
          serverError: number;
        }>;
      }
    > = {};

    for (const w of websites) {
      websiteTrends[w.id] = { name: w.name, history: [] };
    }

    for (const h of history) {
      if (!websiteTrends[h.websiteId]) continue;
      const dateKey = h.checkedAt?.toISOString().split("T")[0] || "";
      if (!overallTrend[dateKey]) {
        overallTrend[dateKey] = {
          totalBroken: 0,
          totalNotFound: 0,
          totalServerErrors: 0,
        };
      }
      overallTrend[dateKey].totalBroken += h.trackedIssueUrls ?? h.brokenUrls;
      overallTrend[dateKey].totalNotFound += h.notFoundUrls ?? h.brokenUrls;
      overallTrend[dateKey].totalServerErrors += h.serverErrorUrls ?? 0;
      websiteTrends[h.websiteId].history.push({
        date: dateKey,
        broken: h.trackedIssueUrls ?? h.brokenUrls,
        trackedIssues: h.trackedIssueUrls ?? h.brokenUrls,
        notFound: h.notFoundUrls ?? h.brokenUrls,
        serverError: h.serverErrorUrls ?? 0,
      });
    }

    const overallTrendArray = Object.entries(overallTrend)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const websitesArray = websiteIds.map((id) => ({
      id,
      name: websiteTrends[id].name,
      history: websiteTrends[id].history,
    }));

    res.json({
      days,
      overallTrend: overallTrendArray,
      websites: websitesArray,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trends");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function parseSitemapAndStore(
  websiteId: number,
  sitemapUrl: string,
  log: { info?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void },
): Promise<void> {
  try {
    const urls = await parseSitemap(sitemapUrl);

    if (urls.length > 0) {
      // Check for existing URLs to avoid duplicates
      const existingUrls = await db
        .select({ url: monitoredUrlsTable.url })
        .from(monitoredUrlsTable)
        .where(eq(monitoredUrlsTable.websiteId, websiteId));

      const existingSet = new Set(existingUrls.map((r) => r.url));
      const newUrls = urls.filter((url) => !existingSet.has(url));

      if (newUrls.length > 0) {
        await db
          .insert(monitoredUrlsTable)
          .values(newUrls.map((url) => ({ websiteId, url })));
        log.info?.(
          `Stored ${newUrls.length} new URLs for website ${websiteId}`,
        );
      } else {
        log.info?.(`No new URLs to store for website ${websiteId}`);
      }
    }

    await db
      .update(websitesTable)
      .set({ totalUrls: urls.length, status: "ok", trackedIssueUrls: 0 })
      .where(eq(websitesTable.id, websiteId));
  } catch (err) {
    await db
      .update(websitesTable)
      .set({ status: "error" })
      .where(eq(websitesTable.id, websiteId));
    throw err;
  }
}

function formatWebsite(w: {
  id: number;
  name: string;
  sitemapUrl: string;
  alertEmail: string;
  totalUrls: number;
  brokenUrls: number;
  notFoundUrls?: number;
  serverErrorUrls?: number;
  trackedIssueUrls?: number;
  ownerName?: string | null;
  priority?: string;
  tags?: string | null;
  notes?: string | null;
  checkIntervalMinutes: number;
  status: string;
  lastCheckedAt: Date | null;
  createdAt: Date;
  userId: number;
  slackWebhookUrl?: string | null;
  slackAlertEnabled?: boolean;
  slackRealtimeAlerts?: boolean;
  teamsWebhookUrl?: string | null;
  teamsAlertEnabled?: boolean;
  teamsRealtimeAlerts?: boolean;
  alertSummaryInterval?: string;
  customSummaryDays?: number | null;
  lastSlackSummarySentAt?: Date | null;
  lastTeamsSummarySentAt?: Date | null;
}) {
  return {
    id: w.id,
    name: w.name,
    sitemapUrl: w.sitemapUrl,
    alertEmail: w.alertEmail,
    totalUrls: w.totalUrls,
    brokenUrls: w.brokenUrls,
    notFoundUrls: w.notFoundUrls ?? w.brokenUrls,
    serverErrorUrls: w.serverErrorUrls ?? 0,
    trackedIssueUrls:
      w.trackedIssueUrls ?? (w.notFoundUrls ?? w.brokenUrls) + (w.serverErrorUrls ?? 0),
    ownerName: w.ownerName ?? null,
    priority: w.priority ?? "medium",
    tags: parseTags(w.tags),
    notes: w.notes ?? null,
    checkIntervalMinutes: w.checkIntervalMinutes,
    status: w.status,
    lastCheckedAt: w.lastCheckedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
    userId: w.userId,
    slackWebhookUrl: w.slackWebhookUrl ?? null,
    slackAlertEnabled: w.slackAlertEnabled ?? false,
    slackRealtimeAlerts: w.slackRealtimeAlerts ?? true,
    teamsWebhookUrl: w.teamsWebhookUrl ?? null,
    teamsAlertEnabled: w.teamsAlertEnabled ?? false,
    teamsRealtimeAlerts: w.teamsRealtimeAlerts ?? true,
    alertSummaryInterval: w.alertSummaryInterval ?? "none",
    customSummaryDays: w.customSummaryDays ?? null,
    lastSlackSummarySentAt: w.lastSlackSummarySentAt?.toISOString() ?? null,
    lastTeamsSummarySentAt: w.lastTeamsSummarySentAt?.toISOString() ?? null,
  };
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getAlertDestinations(website: {
  alertEmail: string;
  slackAlertEnabled?: boolean;
  teamsAlertEnabled?: boolean;
}): string[] {
  return [
    website.alertEmail ? "email" : null,
    website.slackAlertEnabled ? "Slack" : null,
    website.teamsAlertEnabled ? "Teams" : null,
  ].filter(Boolean) as string[];
}

function formatUrl(u: {
  id: number;
  websiteId: number;
  url: string;
  lastStatus: number | null;
  previousStatus: number | null;
  isBroken: boolean;
  issueType?: string | null;
  isTrackedIssue?: boolean;
  lastCheckedAt: Date | null;
  errorMessage: string | null;
}) {
  const issueType = deriveStoredIssueType(u);
  return {
    id: u.id,
    websiteId: u.websiteId,
    url: u.url,
    lastStatus: u.lastStatus,
    previousStatus: u.previousStatus,
    isBroken: u.isBroken,
    issueType,
    isTrackedIssue: issueType !== null,
    lastCheckedAt: u.lastCheckedAt?.toISOString() ?? null,
    errorMessage: u.errorMessage,
  };
}

export default router;
