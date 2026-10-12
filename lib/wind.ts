import { compass, roundTo } from "@/lib/format";

/** Below this the direction is not worth an arrow. */
const CALM_KMH = 2;

export type WindReading = {
  /** Meteorological direction the wind comes from. */
  fromDeg: number;
  from: string;
  /** Where the wind is blowing. Bearing 0 is north. */
  bearingDeg: number;
  toward: string;
  speedKmh: number;
  calm: boolean;
};

export function describeWind(fromDeg: number, speedKmh: number): WindReading | null {
  if (!Number.isFinite(fromDeg) || !Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 400) {
    return null;
  }
  const from = ((fromDeg % 360) + 360) % 360;
  const bearing = (from + 180) % 360;
  return {
    fromDeg: roundTo(from, 0),
    from: compass(from),
    bearingDeg: roundTo(bearing, 0),
    toward: compass(bearing),
    speedKmh: roundTo(speedKmh, 1),
    calm: speedKmh < CALM_KMH,
  };
}

/** Latest steering-level hour that is not in the future. Open-Meteo stamps have no zone. */
export function pickSteeringWind(
  times: readonly string[],
  speeds: readonly (number | null)[],
  directions: readonly (number | null)[],
  nowMs: number,
): { speedKmh: number; fromDeg: number } | null {
  let chosen: { at: number; speedKmh: number; fromDeg: number } | null = null;
  const limit = nowMs + 10 * 60 * 1000;
  for (let index = 0; index < times.length; index += 1) {
    const stamp = times[index];
    const speed = speeds[index];
    const direction = directions[index];
    if (!stamp || speed == null || direction == null) continue;
    const at = parseUtcHour(stamp);
    if (!Number.isFinite(at) || at > limit) continue;
    if (!chosen || at > chosen.at) chosen = { at, speedKmh: speed, fromDeg: direction };
  }
  if (!chosen) return null;
  return { speedKmh: chosen.speedKmh, fromDeg: chosen.fromDeg };
}

function parseUtcHour(stamp: string): number {
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) ? stamp : `${stamp}Z`;
  return Date.parse(zoned);
}
