import { SignJWT, jwtVerify } from "jose";

/** Signed login token. Kept free of Next.js imports so the proxy and tests can use it. */
export const SESSION_COOKIE = "studio_session";
export const SESSION_DAYS = 30;

const key = (secret: string) => new TextEncoder().encode(secret);

export async function createToken(secret: string, now = Date.now()): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(now / 1000) + SESSION_DAYS * 24 * 60 * 60)
    .sign(key(secret));
}

export async function verifyToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return payload.role === "owner";
  } catch {
    return false;
  }
}
