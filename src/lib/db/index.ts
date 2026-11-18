import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB };

/** One small connection pool per server instance (serverless friendly). */
export function db(): DB {
  if (!globalForDb.__db) {
    const client = postgres(env().DATABASE_URL, { max: 3, prepare: false, idle_timeout: 20 });
    globalForDb.__db = drizzle(client, { schema });
  }
  return globalForDb.__db;
}

export { schema };
