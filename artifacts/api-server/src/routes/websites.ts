import { Router, type IRouter } from "express";
import { db, websitesTable, monitoredUrlsTable, websiteSitemapsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { parseSitemap } from "../utils/sitemapParser";
import { checkWebsite } from "../utils/checker";
import { z } from "zod";

const router: IRouter = Router();

// Validation schema for adding a website
const addWebsiteSchema = z.object({
  name: z.string().min(1),
  sitemapUrl: z.string().url(),
  alertEmail: z.string().email(),
  checkIntervalMinutes: z.number().int().min(5).max(10080).optional().default(60),
});

// GET /api/websites — list all monitored websites
router.get("/websites", async (req, res) => {
  try {
    const websites = await db.select().from(websitesTable).orderBy(websitesTable.createdAt);
    res.json(websites.map(formatWebsite));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch websites");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/websites — add a new website
router.post("/websites", async (req, res) => {
  const parsed = addWebsiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, sitemapUrl, alertEmail, checkIntervalMinutes } = parsed.data;

  try {
    // Insert the website record
    const [website] = await db
      .insert(websitesTable)
      .values({ name, sitemapUrl, alertEmail, checkIntervalMinutes, status: "pending" })
      .returning();

    // Asynchronously parse the sitemap and insert URLs (fire and forget)
    parseSitemapAndStore(website.id, sitemapUrl, req.log).catch((err) => {
      req.log.error({ err, websiteId: website.id }, "Background sitemap parse failed");
    });

    res.status(201).json(formatWebsite(website));
  } catch (err) {
    req.log.error({ err }, "Failed to add website");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/websites/:id — get a single website
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

    res.json(formatWebsite(website));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch website");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/websites/:id — delete a website
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

    await db.delete(websitesTable).where(eq(websitesTable.id, id));
    res.json({ success: true, message: "Website deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete website");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/websites/:id/update — update sitemap URL / alert email / check interval
const updateWebsiteSchema = z.object({
  name: z.string().min(1).optional(),
  sitemapUrl: z.string().url().optional(),
  alertEmail: z.string().email().optional(),
  checkIntervalMinutes: z.number().int().min(5).max(10080).optional(),
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
    const [existing] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    const updates: Partial<typeof existing> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.alertEmail) updates.alertEmail = parsed.data.alertEmail;
    if (parsed.data.checkIntervalMinutes !== undefined) updates.checkIntervalMinutes = parsed.data.checkIntervalMinutes;

    const sitemapChanged = parsed.data.sitemapUrl && parsed.data.sitemapUrl !== existing.sitemapUrl;
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

    // If sitemap URL changed, clear old URLs and re-parse in background
    if (sitemapChanged) {
      await db.delete(monitoredUrlsTable).where(eq(monitoredUrlsTable.websiteId, id));
      parseSitemapAndStore(id, updates.sitemapUrl!, req.log).catch((err) => {
        req.log.error({ err, websiteId: id }, "Background sitemap re-parse failed");
      });
    }

    res.json(formatWebsite(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update website");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/websites/:id/sitemaps — list all sitemaps for a website
router.get("/websites/:id/sitemaps", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid website ID" }); return; }

  try {
    const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const sitemaps = await db
      .select()
      .from(websiteSitemapsTable)
      .where(eq(websiteSitemapsTable.websiteId, id))
      .orderBy(websiteSitemapsTable.createdAt);

    res.json(sitemaps.map((s) => ({
      id: s.id,
      websiteId: s.websiteId,
      url: s.url,
      createdAt: s.createdAt?.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sitemaps");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/websites/:id/sitemaps — add an additional sitemap
const addSitemapSchema = z.object({ url: z.string().url() });

router.post("/websites/:id/sitemaps", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid website ID" }); return; }

  const parsed = addSitemapSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const [sitemap] = await db
      .insert(websiteSitemapsTable)
      .values({ websiteId: id, url: parsed.data.url })
      .returning();

    // Parse the new sitemap in the background to add its URLs
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

// DELETE /api/websites/:id/sitemaps/:sitemapId — remove an additional sitemap
router.delete("/websites/:id/sitemaps/:sitemapId", async (req, res) => {
  const id = parseInt(req.params.id);
  const sitemapId = parseInt(req.params.sitemapId);
  if (isNaN(id) || isNaN(sitemapId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  try {
    const [deleted] = await db
      .delete(websiteSitemapsTable)
      .where(and(eq(websiteSitemapsTable.id, sitemapId), eq(websiteSitemapsTable.websiteId, id)))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Sitemap not found" }); return; }

    res.json({ success: true, message: "Sitemap removed" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete sitemap");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/websites/:id/urls — get all URLs for a website
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

    let urlRows = await db
      .select()
      .from(monitoredUrlsTable)
      .where(eq(monitoredUrlsTable.websiteId, id))
      .orderBy(monitoredUrlsTable.url);

    // Apply status filter if provided
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

// POST /api/websites/:id/check — manually trigger a check
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

    // Run check immediately (synchronous so user can see result)
    const result = await checkWebsite(id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to trigger manual check");
    res.status(500).json({ error: "Failed to run check" });
  }
});

// GET /api/dashboard/summary — summary stats
router.get("/dashboard/summary", async (req, res) => {
  try {
    const websites = await db.select().from(websitesTable);
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

// Helper: parse sitemap and store URLs in the background
async function parseSitemapAndStore(
  websiteId: number,
  sitemapUrl: string,
  log: typeof console
): Promise<void> {
  try {
    const urls = await parseSitemap(sitemapUrl);

    if (urls.length > 0) {
      // Batch insert all URLs
      await db.insert(monitoredUrlsTable).values(
        urls.map((url) => ({ websiteId, url }))
      );
    }

    await db
      .update(websitesTable)
      .set({ totalUrls: urls.length, status: "ok" })
      .where(eq(websitesTable.id, websiteId));

    log.info?.(`Stored ${urls.length} URLs for website ${websiteId}`);
  } catch (err) {
    await db
      .update(websitesTable)
      .set({ status: "error" })
      .where(eq(websitesTable.id, websiteId));
    throw err;
  }
}

// Format website for API response
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
  };
}

// Format URL for API response
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
