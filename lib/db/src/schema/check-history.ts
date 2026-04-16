import {
  pgTable,
  serial,
  integer,
  timestamp,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";

export const checkHistoryTable = pgTable("check_history", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id")
    .notNull()
    .references(() => websitesTable.id, { onDelete: "cascade" }),
  totalUrls: integer("total_urls").notNull().default(0),
  brokenUrls: integer("broken_urls").notNull().default(0),
  notFoundUrls: integer("not_found_urls").notNull().default(0),
  serverErrorUrls: integer("server_error_urls").notNull().default(0),
  trackedIssueUrls: integer("tracked_issue_urls").notNull().default(0),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

export type InsertCheckHistory = z.infer<typeof insertCheckHistorySchema>;
export type CheckHistory = typeof checkHistoryTable.$inferSelect;

export const insertCheckHistorySchema = createInsertSchema(
  checkHistoryTable,
).omit({ id: true });

export const urlStatusHistoryTable = pgTable("url_status_history", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id")
    .notNull()
    .references(() => websitesTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  previousStatus: integer("previous_status"),
  newStatus: integer("new_status"),
  previousIssueType: text("previous_issue_type"),
  newIssueType: text("new_issue_type"),
  wasBroken: boolean("was_broken").notNull().default(false),
  becameFixed: boolean("became_fixed").notNull().default(false),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

export type InsertUrlStatusHistory = z.infer<
  typeof insertUrlStatusHistorySchema
>;
export type UrlStatusHistory = typeof urlStatusHistoryTable.$inferSelect;

export const insertUrlStatusHistorySchema = createInsertSchema(
  urlStatusHistoryTable,
).omit({ id: true });
