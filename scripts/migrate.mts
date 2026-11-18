/**
 * Applies database migrations. Runs automatically on every Vercel deploy
 * (see "vercel-build" in package.json), and you can run it by hand with
 * `npm run db:migrate`.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.end();
console.log("Database is up to date.");
