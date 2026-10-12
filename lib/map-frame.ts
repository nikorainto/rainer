import { FUTURE_HORIZON_MIN, PAST_HORIZON_MIN } from "@/lib/constants";
import type { MapFrame, RadarFrameRef } from "@/lib/types";

export type TimelineStop = {
  offsetMin: number;
  /** `forecast` reuses the latest scan and does not advance past the current minute. */
  kind: "past" | "nowcast" | "forecast";
  path: string;
};

/** Typical spacing of the observed scans, in minutes. RainViewer is usually 10. */
export function frameStepMin(frames: MapFrame[]): number {
  const past = frames.filter((frame) => frame.kind === "past").sort((a, b) => a.time - b.time);
  const gaps: number[] = [];
  for (let index = 1; index < past.length; index++) {
    const previous = past[index - 1];
    const current = past[index];
    if (!previous || !current) continue;
    const gap = Math.round((current.time - previous.time) / 60);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return 10;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 10;
}

/**
 * Slider stops for the last hour of scans and the next hour.
 * The current minute is always a stop, using the latest scan when no image
 * lands on it. Published forecast frames extend the slider. Otherwise later
 * steps hold that scan, counted from now rather than from the scan's age.
 */
export function timelineStops(frames: MapFrame[]): TimelineStop[] {
  const past = frames
    .filter((frame) => frame.kind === "past")
    .sort((a, b) => a.offsetMin - b.offsetMin);
  const nowcast = frames
    .filter((frame) => frame.kind === "nowcast")
    .sort((a, b) => a.offsetMin - b.offsetMin);
  const step = frameStepMin(frames);
  const latest = past.filter((frame) => frame.offsetMin <= 2).at(-1);
  const stops: TimelineStop[] = [];

  for (const frame of past) {
    if (frame.offsetMin > 2 || frame.offsetMin < -PAST_HORIZON_MIN) continue;
    stops.push({ offsetMin: frame.offsetMin, kind: "past", path: frame.path });
  }

  if (nowcast.length > 0) {
    for (const frame of nowcast) {
      if (frame.offsetMin < 0 || frame.offsetMin > FUTURE_HORIZON_MIN + step / 2) continue;
      stops.push({ offsetMin: frame.offsetMin, kind: "nowcast", path: frame.path });
    }
  } else if (latest) {
    for (let offset = step; offset <= FUTURE_HORIZON_MIN; offset += step) {
      if (stops.some((stop) => stop.offsetMin === offset)) continue;
      stops.push({ offsetMin: offset, kind: "forecast", path: latest.path });
    }
  }

  if (latest && !stops.some((stop) => stop.offsetMin === 0)) {
    stops.push({ offsetMin: 0, kind: "past", path: latest.path });
  }

  stops.sort((a, b) => a.offsetMin - b.offsetMin);
  return stops;
}

/**
 * How many minutes old the scan on this stop is.
 * A frame shown at its own time is zero. A reused scan reports its age.
 */
export function scanAgeMin(stop: TimelineStop, frames: MapFrame[]): number {
  if (stop.kind === "nowcast") return 0;
  let imageOffset: number | null = null;
  for (const frame of frames) {
    if (frame.kind !== "past" || frame.path !== stop.path) continue;
    if (imageOffset == null || frame.offsetMin > imageOffset) imageOffset = frame.offsetMin;
  }
  if (imageOffset == null) return 0;
  const age = Math.max(0, -imageOffset);
  if (stop.kind === "forecast") return age;
  return Math.max(0, Math.min(age, stop.offsetMin - imageOffset));
}

/** Turn a RainViewer catalog into slider frames. Offsets are minutes from `nowSec`. */
export function mapFramesFromCatalog(
  past: RadarFrameRef[],
  nowcast: RadarFrameRef[],
  nowSec: number,
): MapFrame[] {
  const frames: MapFrame[] = [
    ...past.map((frame) => ({
      time: frame.time,
      offsetMin: Math.round((frame.time - nowSec) / 60),
      path: frame.path,
      kind: "past" as const,
    })),
    ...nowcast.map((frame) => ({
      time: frame.time,
      offsetMin: Math.round((frame.time - nowSec) / 60),
      path: frame.path,
      kind: "nowcast" as const,
    })),
  ];
  return frames.sort((a, b) => a.time - b.time);
}

/**
 * 0 at the first stop and 1 at the last. A time between two stops is linear,
 * so a chart point and the slider thumb share one x.
 */
export function stopFraction(stops: TimelineStop[], offsetMin: number): number {
  const lastIndex = stops.length - 1;
  if (lastIndex <= 0) return 0;
  const first = stops[0];
  const last = stops[lastIndex];
  if (!first || !last) return 0;
  if (offsetMin <= first.offsetMin) return 0;
  if (offsetMin >= last.offsetMin) return 1;

  for (let index = 1; index <= lastIndex; index++) {
    const right = stops[index];
    const left = stops[index - 1];
    if (!right || !left || offsetMin > right.offsetMin) continue;
    const span = right.offsetMin - left.offsetMin;
    const part = span === 0 ? 0 : (offsetMin - left.offsetMin) / span;
    return (index - 1 + part) / lastIndex;
  }
  return 1;
}

/** Pixel position of a slider thumb, matching `--thumb` on the sheet. */
export function trackMarkerLeft(fraction: number): string {
  const clamped = Math.min(1, Math.max(0, fraction));
  return `calc(var(--thumb, 16px) / 2 + ${clamped} * (100% - var(--thumb, 16px)))`;
}

export function nearestStopIndex(stops: TimelineStop[], offsetMin: number): number {
  if (stops.length === 0) return 0;
  let best = 0;
  let bestDistance = Math.abs(stops[0].offsetMin - offsetMin);
  for (let index = 1; index < stops.length; index++) {
    const stop = stops[index];
    if (!stop) continue;
    const distance = Math.abs(stop.offsetMin - offsetMin);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}
