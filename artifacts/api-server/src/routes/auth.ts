import { Router, type IRouter } from "express";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  authenticate,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
} from "../middleware/auth";
import { verifyPassword, hashPassword } from "../utils/password";
import { logger } from "../lib/logger";
import { sendPasswordResetEmail } from "../utils/emailer";

const router: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as "admin" | "user",
    });

    setAuthCookie(res, token);

    logger.info({ userId: user.id, email: user.email }, "User logged in");

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", authenticate, (req, res) => {
  clearAuthCookie(res);
  logger.info({ userId: req.user?.userId }, "User logged out");
  res.json({ success: true, message: "Logged out successfully" });
});

router.get("/auth/me", authenticate, async (req, res) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt?.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/auth/password", authenticate, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const validPassword = await verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!validPassword) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(usersTable)
      .set({ passwordHash: newPasswordHash })
      .where(eq(usersTable.id, user.id));

    logger.info({ userId: user.id }, "Password changed");

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    logger.error({ err }, "Error changing password");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const resetLink = `${process.env.APP_URL || "http://localhost:5173"}/reset-password?token=${token}`;

    await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetLink,
    });

    logger.info(
      { userId: user.id, email: user.email },
      "Password reset email sent",
    );

    res.json({
      success: true,
      message:
        "If an account exists with that email, a reset link has been sent",
    });
  } catch (err) {
    logger.error({ err }, "Error sending password reset email");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, newPassword } = parsed.data;

  try {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          isNull(passwordResetTokensTable.usedAt),
        ),
      )
      .limit(1);

    if (!resetToken) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    if (new Date() > resetToken.expiresAt) {
      res.status(400).json({ error: "Reset token has expired" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, resetToken.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(usersTable)
      .set({ passwordHash: newPasswordHash })
      .where(eq(usersTable.id, user.id));

    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetToken.id));

    logger.info({ userId: user.id }, "Password reset successfully");

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (err) {
    logger.error({ err }, "Error resetting password");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
