import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Websites being monitored
export const websitesTable = pgTable("websites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sitemapUrl: text("sitemap_url").notNull(),
  alertEmail: text("alert_email").notNull(),
  totalUrls: integer("total_urls").notNull().default(0),
  brokenUrls: integer("broken_urls").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | checking | ok | error
  checkIntervalMinutes: integer("check_interval_minutes").notNull().default(60),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWebsiteSchema = createInsertSchema(websitesTable).omit({ id: true, createdAt: true });
export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
export type Website = typeof websitesTable.$inferSelect;

// Individual URLs parsed from the sitemap
export const monitoredUrlsTable = pgTable("monitored_urls", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  lastStatus: integer("last_status"), // HTTP status code, null if never checked
  previousStatus: integer("previous_status"), // previous HTTP status code
  isBroken: boolean("is_broken").notNull().default(false),
  lastCheckedAt: timestamp("last_checked_at"),
  errorMessage: text("error_message"),
});

export const insertMonitoredUrlSchema = createInsertSchema(monitoredUrlsTable).omit({ id: true });
export type InsertMonitoredUrl = z.infer<typeof insertMonitoredUrlSchema>;
export type MonitoredUrl = typeof monitoredUrlsTable.$inferSelect;

// Additional sitemap URLs per website (the primary one stays on the websites table)
export const websiteSitemapsTable = pgTable("website_sitemaps", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WebsiteSitemap = typeof websiteSitemapsTable.$inferSelect;
