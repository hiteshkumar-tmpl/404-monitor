import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const SALT_ROUNDS = 12;
const ADMIN_EMAIL = "hitesh.k@tunica.tech";
const ADMIN_PASSWORD = "#Hitesh001";
const ADMIN_NAME = "Hitesh Kumar";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function seedAdminUser(): Promise<void> {
  try {
    const [existingAdmin] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL))
      .limit(1);

    if (!existingAdmin) {
      const passwordHash = await hashPassword(ADMIN_PASSWORD);
      await db.insert(usersTable).values({
        email: ADMIN_EMAIL,
        passwordHash,
        name: ADMIN_NAME,
        role: "admin",
      });
      logger.info({ email: ADMIN_EMAIL }, "Admin user seeded");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
