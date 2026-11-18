import { describe, expect, it } from "vitest";
import { DEFAULT_PART_SIZE, MAX_PARTS, MIN_PART_SIZE, choosePartSize, partCount, partRange, safeFileName, titleFromFileName } from "@/lib/upload/plan";

describe("upload planning", () => {
  it("uses 16 MB parts for normal photos", () => {
    expect(choosePartSize(80 * 1024 * 1024)).toBe(DEFAULT_PART_SIZE);
    expect(partCount(80 * 1024 * 1024, DEFAULT_PART_SIZE)).toBe(5);
  });

  it("never needs more parts than R2 allows", () => {
    const huge = 400 * 1024 ** 3;
    const size = choosePartSize(huge);
    expect(partCount(huge, size)).toBeLessThanOrEqual(MAX_PARTS);
    expect(size).toBeGreaterThanOrEqual(MIN_PART_SIZE);
  });

  it("covers every byte exactly once, with equal parts except the last", () => {
    const fileSize = 3 * DEFAULT_PART_SIZE + 12345;
    const n = partCount(fileSize, DEFAULT_PART_SIZE);
    let covered = 0;
    for (let i = 1; i <= n; i++) {
      const { start, end } = partRange(i, DEFAULT_PART_SIZE, fileSize);
      expect(start).toBe(covered);
      if (i < n) expect(end - start).toBe(DEFAULT_PART_SIZE);
      covered = end;
    }
    expect(covered).toBe(fileSize);
  });

  it("treats tiny files as a single part", () => {
    expect(partCount(10, DEFAULT_PART_SIZE)).toBe(1);
  });

  it("makes tidy file names and titles", () => {
    expect(safeFileName("Sunset at Marina (final).JPG")).toBe("Sunset-at-Marina-final-.JPG");
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
    expect(safeFileName("")).toBe("photo");
    expect(titleFromFileName("golden_hour-kerala.jpg")).toBe("golden hour kerala");
  });
});
