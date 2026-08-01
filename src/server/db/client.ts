import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type PrivateRollupDatabase = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: PrivateRollupDatabase | undefined;

export function hasDatabaseConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(databaseUrl(env));
}

export function getDatabase(env: NodeJS.ProcessEnv = process.env): PrivateRollupDatabase {
  if (database) return database;

  const connectionString = databaseUrl(env);
  if (!connectionString) {
    throw new Error("Postgres is not configured");
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  database = drizzle(pool, { schema });
  return database;
}

export async function closeDatabaseForTests() {
  await pool?.end();
  pool = undefined;
  database = undefined;
}

function databaseUrl(env: NodeJS.ProcessEnv) {
  return (
    env.DATABASE_URL?.trim() ||
    env.POSTGRES_URL?.trim() ||
    env.NEON_DATABASE_URL?.trim() ||
    undefined
  );
}
