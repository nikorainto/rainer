import { UNIVERSAL_BLUE } from "@/lib/palette";
import type { RainBand } from "@/lib/types";

const EXACT = new Map<string, number>();

for (const [dbz, r, g, b, a] of UNIVERSAL_BLUE) {
  const key = `${r},${g},${b},${a}`;
  if (!EXACT.has(key)) EXACT.set(key, dbz);
}

/**
 * Marshall–Palmer Z–R relation: Z = 200 R^1.6, Z = 10^(dBZ/10).
 * Returns rainfall rate in mm/h.
 */
export function dbzToRainRate(dbz: number): number {
  if (dbz < 5) return 0;
  const reflectivity = 10 ** (dbz / 10);
  return (reflectivity / 200) ** (1 / 1.6);
}

export function classifyDbz(dbz: number): {
  rateMmHr: number;
  category: string;
  band: RainBand;
} {
  if (dbz < 5) return { rateMmHr: 0, category: "Dry", band: "none" };
  const rateMmHr = dbzToRainRate(dbz);
  if (dbz <= 20) return { rateMmHr, category: "Drizzle / Trace", band: "drizzle" };
  if (dbz <= 40) return { rateMmHr, category: "Steady rain", band: "steady" };
  return { rateMmHr, category: "Heavy downpour", band: "heavy" };
}

/** Map an unsmoothed Universal Blue pixel to dBZ. Transparent pixels are no echo. */
export function dbzFromRgba(r: number, g: number, b: number, a: number): number {
  if (a < 16) return 0;
  const exact = EXACT.get(`${r},${g},${b},${a}`);
  if (exact != null) return exact;

  let bestDbz = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [dbz, pr, pg, pb, pa] of UNIVERSAL_BLUE) {
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const da = a - pa;
    const distance = dr * dr + dg * dg + db * db + da * da;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDbz = dbz;
    }
  }
  return bestDistance > 60 * 60 ? 0 : bestDbz;
}
