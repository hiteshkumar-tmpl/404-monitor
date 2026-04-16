import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const websitesTable = pgTable("websites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sitemapUrl: text("sitemap_url").notNull(),
  alertEmail: text("alert_email").notNull(),
  totalUrls: integer("total_urls").notNull().default(0),
  brokenUrls: integer("broken_urls").notNull().default(0),
  notFoundUrls: integer("not_found_urls").notNull().default(0),
  serverErrorUrls: integer("server_error_urls").notNull().default(0),
  trackedIssueUrls: integer("tracked_issue_urls").notNull().default(0),
  ownerName: text("owner_name"),
  priority: text("priority").notNull().default("medium"),
  tags: text("tags"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending | checking | ok | error | paused
  checkIntervalMinutes: integer("check_interval_minutes").notNull().default(60),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  // Slack integration
  slackWebhookUrl: text("slack_webhook_url"),
  slackAlertEnabled: boolean("slack_alert_enabled").notNull().default(false),
  slackRealtimeAlerts: boolean("slack_realtime_alerts").notNull().default(true),
  lastSlackSummarySentAt: timestamp("last_slack_summary_sent_at"),
  // Microsoft Teams integration
  teamsWebhookUrl: text("teams_webhook_url"),
  teamsAlertEnabled: boolean("teams_alert_enabled").notNull().default(false),
  teamsRealtimeAlerts: boolean("teams_realtime_alerts").notNull().default(true),
  lastTeamsSummarySentAt: timestamp("last_teams_summary_sent_at"),
  // Alert summary interval: realtime | daily | 3days | 5days | 7days | 14days | 30days | custom
  alertSummaryInterval: text("alert_summary_interval")
    .notNull()
    .default("none"),
  // Custom summary days (when alertSummaryInterval is "custom")
  customSummaryDays: integer("custom_summary_days"),
});

export const insertWebsiteSchema = createInsertSchema(websitesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
export type Website = typeof websitesTable.$inferSelect;

// Individual URLs parsed from the sitemap
export const monitoredUrlsTable = pgTable("monitored_urls", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id")
    .notNull()
    .references(() => websitesTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  lastStatus: integer("last_status"), // HTTP status code, null if never checked
  previousStatus: integer("previous_status"), // previous HTTP status code
  isBroken: boolean("is_broken").notNull().default(false),
  issueType: text("issue_type"),
  isTrackedIssue: boolean("is_tracked_issue").notNull().default(false),
  lastCheckedAt: timestamp("last_checked_at"),
  errorMessage: text("error_message"),
});

export const insertMonitoredUrlSchema = createInsertSchema(
  monitoredUrlsTable,
).omit({ id: true });
export type InsertMonitoredUrl = z.infer<typeof insertMonitoredUrlSchema>;
export type MonitoredUrl = typeof monitoredUrlsTable.$inferSelect;

// Additional sitemap URLs per website (the primary one stays on the websites table)
export const websiteSitemapsTable = pgTable("website_sitemaps", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id")
    .notNull()
    .references(() => websitesTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WebsiteSitemap = typeof websiteSitemapsTable.$inferSelect;
