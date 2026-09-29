import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Keep database failures bounded in serverless environments. Without an
// explicit connection timeout, a blocked connection can exhaust the function
// window and surface to users as a generic 504.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  max: 5,
  keepAlive: true,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
