import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, "../../../.env") });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/** Local dev against Docker/postgres on this machine — no TLS. */
const isProbablyLocal =
  /@localhost(?::|$|\/)|@127\.0\.0\.1(?::|$|\/)/.test(connectionString);

/**
 * Supabase and most cloud Postgres require TLS. Without `ssl`, node-pg can
 * fail at query time (e.g. login → 500). Set DATABASE_SSL=disable to opt out.
 */
const useSsl =
  process.env.DATABASE_SSL !== "disable" && !isProbablyLocal;

export const pool = new Pool({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
