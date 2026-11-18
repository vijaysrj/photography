"use server";

import { redirect } from "next/navigation";
import { passwordMatches, startSession } from "@/lib/auth/session";

// Slows down anyone guessing passwords. Per server instance, which is enough for one owner.
const attempts = new Map<string, { count: number; until: number }>();

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/studio");
  const bucket = "owner";
  const now = Date.now();
  const a = attempts.get(bucket);
  if (a && a.until > now) {
    return { error: `Too many tries. Please wait ${Math.ceil((a.until - now) / 1000)} seconds.` };
  }

  if (!password || !passwordMatches(password)) {
    const count = (a?.count ?? 0) + 1;
    attempts.set(bucket, { count, until: count >= 5 ? now + 60_000 : 0 });
    await new Promise((r) => setTimeout(r, 600));
    return { error: "That password isn't right." };
  }

  attempts.delete(bucket);
  await startSession();
  redirect(next.startsWith("/studio") ? next : "/studio");
}
