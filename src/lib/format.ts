export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

export function shutter(seconds?: number): string | undefined {
  if (!seconds) return undefined;
  return seconds >= 1 ? `${seconds}s` : `1/${Math.round(1 / seconds)}s`;
}

export function megapixels(w?: number | null, h?: number | null): string | undefined {
  return w && h ? `${((w * h) / 1e6).toFixed(1)} MP` : undefined;
}
