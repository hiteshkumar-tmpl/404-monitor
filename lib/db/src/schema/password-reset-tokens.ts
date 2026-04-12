import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export type InsertPasswordResetToken = z.infer<
  typeof insertPasswordResetTokenSchema
>;
export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;

export const insertPasswordResetTokenSchema = createInsertSchema(
  passwordResetTokensTable,
).omit({ id: true });
