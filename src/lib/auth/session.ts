import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { SESSION_COOKIE, SESSION_DAYS, createToken, verifyToken } from "./token";

export function passwordMatches(attempt: string): boolean {
  // Hash both sides so the comparison takes the same time whatever the length.
  const a = createHash("sha256").update(attempt).digest();
  const b = createHash("sha256").update(env().ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

export async function startSession() {
  const token = await createToken(env().SESSION_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isOwner(): Promise<boolean> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value, env().SESSION_SECRET);
}

/** Use at the top of every studio page and action: the proxy is a first line, this is the real check. */
export async function requireOwner() {
  if (!(await isOwner())) redirect("/login");
}
