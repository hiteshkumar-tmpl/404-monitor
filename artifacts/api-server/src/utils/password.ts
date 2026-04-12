import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * One-time bootstrap: set on the host (e.g. Railway) then remove the password after first deploy:
 * ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, optional ADMIN_SEED_NAME (default "Admin").
 */
export async function seedAdminUser(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const plainPassword = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME?.trim() || "Admin";

  if (!email || !plainPassword) {
    return;
  }

  try {
    const [existingAdmin] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!existingAdmin) {
      const passwordHash = await hashPassword(plainPassword);
      await db.insert(usersTable).values({
        email,
        passwordHash,
        name,
        role: "admin",
      });
      logger.info({ email }, "Admin user seeded from ADMIN_SEED_* env");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
