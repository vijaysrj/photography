import { describe, expect, it } from "vitest";
import { sharePath, slugify } from "@/lib/share";

describe("share addresses", () => {
  it("private things have no address", () => {
    expect(sharePath({ kind: "photo", id: "abc", visibility: "private", shareToken: "tok" })).toBeNull();
  });
  it("link-only things use the secret link", () => {
    expect(sharePath({ kind: "album", slug: "x", visibility: "unlisted", shareToken: "s3cret" })).toBe("/s/s3cret");
    expect(sharePath({ kind: "photo", id: "abc", visibility: "unlisted", shareToken: null })).toBeNull();
  });
  it("public things use their readable address", () => {
    expect(sharePath({ kind: "photo", id: "abc", visibility: "public", shareToken: "t" })).toBe("/photos/abc");
    expect(sharePath({ kind: "album", slug: "monsoon", visibility: "public", shareToken: "t" })).toBe("/albums/monsoon");
  });
  it("makes readable album addresses", () => {
    expect(slugify("Monsoon Diaries — Kerala, 2026!")).toBe("monsoon-diaries-kerala-2026");
    expect(slugify("Café Été")).toBe("cafe-ete");
    expect(slugify("!!!")).toBe("album");
  });
});
