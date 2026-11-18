import { describe, expect, it } from "vitest";
import { createToken, verifyToken } from "@/lib/auth/token";

const secret = "x".repeat(40);

describe("login token", () => {
  it("accepts a token it signed", async () => {
    expect(await verifyToken(await createToken(secret), secret)).toBe(true);
  });
  it("rejects a token signed with another secret", async () => {
    expect(await verifyToken(await createToken("y".repeat(40)), secret)).toBe(false);
  });
  it("rejects expired, missing and garbage tokens", async () => {
    const old = await createToken(secret, Date.now() - 31 * 24 * 3600 * 1000);
    expect(await verifyToken(old, secret)).toBe(false);
    expect(await verifyToken(undefined, secret)).toBe(false);
    expect(await verifyToken("not-a-token", secret)).toBe(false);
  });
});
