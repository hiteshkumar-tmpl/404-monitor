import { Router, type IRouter } from "express";
import { db, usersTable, websitesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { hashPassword } from "../utils/password";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user"]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "user"]).optional(),
});

router.use(requireAdmin);

router.get("/users", async (req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt?.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    logger.error({ err }, "Failed to fetch users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, role } = parsed.data;

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(400).json({ error: "A user with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
      })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });

    logger.info(
      { userId: user.id, email: user.email, createdBy: req.user?.userId },
      "User created",
    );

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt?.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to create user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (id === req.user?.userId) {
    res.status(400).json({ error: "Cannot modify your own account" });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updates: Partial<typeof existing> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.role) updates.role = parsed.data.role;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
      });

    logger.info({ userId: id, updatedBy: req.user?.userId }, "User updated");

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      createdAt: updated.createdAt?.toISOString(),
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (id === req.user?.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [deleted] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    logger.info({ userId: id, deletedBy: req.user?.userId }, "User deleted");

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/stats", async (req, res) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);

    const [websiteCount] = await db
      .select({ count: count() })
      .from(websitesTable);

    const [totalWebsites] = await db
      .select({
        totalUrls: websitesTable.totalUrls,
        brokenUrls: websitesTable.brokenUrls,
      })
      .from(websitesTable);

    const totalUrls = totalWebsites.reduce(
      (sum, w) => sum + (w.totalUrls || 0),
      0,
    );
    const totalBroken = totalWebsites.reduce(
      (sum, w) => sum + (w.brokenUrls || 0),
      0,
    );

    res.json({
      totalUsers: userCount?.count || 0,
      totalWebsites: websiteCount?.count || 0,
      totalUrls,
      totalBroken,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
