import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_BUCKET: z.string().min(1, "R2_BUCKET is required"),
});

export type Env = z.infer<typeof schema> & { r2Endpoint: string };

let cached: Env | null = null;

/** Reads and validates server environment variables once, on first use. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Missing or invalid environment variables:\n${problems.join("\n")}\nSee .env.example.`);
  }
  const e = parsed.data;
  const r2Endpoint =
    e.R2_ENDPOINT ?? (e.R2_ACCOUNT_ID ? `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  if (!r2Endpoint) throw new Error("Set R2_ACCOUNT_ID (or R2_ENDPOINT). See .env.example.");
  cached = { ...e, r2Endpoint };
  return cached;
}
