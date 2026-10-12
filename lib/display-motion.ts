import { SAMPLE_ZOOM } from "@/lib/constants";
import { compass, roundTo } from "@/lib/format";
import { metersPerPixel } from "@/lib/geo";
import type { Motion } from "@/lib/motion";
import type { NowcastMotion } from "@/lib/types";

/** Pixel rates are in native radar-zoom pixels, so a coarser sample still lines up on the map. */
export function toDisplayMotion(
  motion: Motion,
  lat: number,
  zoom: number,
  step: number,
  minSpeedKmh = 3,
): NowcastMotion | null {
  const meters = metersPerPixel(lat, zoom);
  const eastPerMin = motion.dxPerMin * step * meters;
  const southPerMin = motion.dyPerMin * step * meters;
  const speedKmh = (Math.hypot(eastPerMin, southPerMin) * 60) / 1000;
  if (speedKmh < minSpeedKmh) return null;
  const bearingDeg = (Math.atan2(eastPerMin, -southPerMin) * 180) / Math.PI;
  const normalized = (bearingDeg + 360) % 360;
  const native = 2 ** (SAMPLE_ZOOM - zoom);
  return {
    speedKmh: roundTo(speedKmh, 1),
    bearingDeg: roundTo(normalized, 0),
    direction: compass(normalized),
    eastPxPerMin: roundTo(motion.dxPerMin * step * native, 3),
    southPxPerMin: roundTo(motion.dyPerMin * step * native, 3),
  };
}
