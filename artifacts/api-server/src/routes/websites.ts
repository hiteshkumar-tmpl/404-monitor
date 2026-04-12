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

const router: IRouter = Router();

router.use(authenticate);

const addWebsiteSchema = z.object({
  name: z.string().min(1),
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

  const { name, sitemapUrl, alertEmail, checkIntervalMinutes } = parsed.data;

  try {
    const [website] = await db
      .insert(websitesTable)
      .values({
        name,
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

    if (statusFilter === "broken") {
      urlRows = urlRows.filter((r) => r.isBroken);
    } else if (statusFilter === "ok") {
      urlRows = urlRows.filter((r) => !r.isBroken);
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
    const totalUrls = websites.reduce((sum, w) => sum + w.totalUrls, 0);
    const totalBroken = websites.reduce((sum, w) => sum + w.brokenUrls, 0);
    const websitesWithErrors = websites.filter((w) => w.brokenUrls > 0).length;

    res.json({
      totalWebsites: websites.length,
      totalUrls,
      totalBroken,
      websitesWithErrors,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch dashboard summary");
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

    const currentBroken = urls.filter((u) => u.isBroken);
    const currentOk = urls.filter((u) => !u.isBroken);

    const dayMap = new Map<
      string,
      { date: string; broke: number; fixed: number }
    >();

    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      dayMap.set(dateStr, { date: dateStr, broke: 0, fixed: 0 });
    }

    for (const entry of statusHistory) {
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

    const recentlyBrokenUrls = statusHistory
      .filter((h) => h.wasBroken && !h.becameFixed)
      .map((h) => h.url)
      .slice(0, 20);

    const recentlyFixedUrls = statusHistory
      .filter((h) => h.becameFixed)
      .map((h) => h.url)
      .slice(0, 20);

    const interval =
      website.alertSummaryInterval === "custom"
        ? `${website.customSummaryDays}days`
        : website.alertSummaryInterval || "7days";

    res.json({
      websiteId: website.id,
      websiteName: website.name,
      interval,
      currentStatus: {
        totalUrls: urls.length,
        brokenUrls: currentBroken.length,
        okUrls: currentOk.length,
      },
      dayWiseBreakdown,
      recentlyBrokenUrls,
      recentlyFixedUrls,
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

    const overallTrend: Record<string, number> = {};
    const websiteTrends: Record<
      number,
      { name: string; history: Array<{ date: string; broken: number }> }
    > = {};

    for (const w of websites) {
      websiteTrends[w.id] = { name: w.name, history: [] };
    }

    for (const h of history) {
      if (!websiteTrends[h.websiteId]) continue;
      const dateKey = h.checkedAt?.toISOString().split("T")[0] || "";
      overallTrend[dateKey] = (overallTrend[dateKey] || 0) + h.brokenUrls;
      websiteTrends[h.websiteId].history.push({
        date: dateKey,
        broken: h.brokenUrls,
      });
    }

    const overallTrendArray = Object.entries(overallTrend)
      .map(([date, count]) => ({ date, totalBroken: count }))
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
  log: typeof console,
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
      .set({ totalUrls: urls.length, status: "ok" })
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

function formatUrl(u: {
  id: number;
  websiteId: number;
  url: string;
  lastStatus: number | null;
  previousStatus: number | null;
  isBroken: boolean;
  lastCheckedAt: Date | null;
  errorMessage: string | null;
}) {
  return {
    id: u.id,
    websiteId: u.websiteId,
    url: u.url,
    lastStatus: u.lastStatus,
    previousStatus: u.previousStatus,
    isBroken: u.isBroken,
    lastCheckedAt: u.lastCheckedAt?.toISOString() ?? null,
    errorMessage: u.errorMessage,
  };
}

export default router;
