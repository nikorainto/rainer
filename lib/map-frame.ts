import type { MapFrame, RadarFrameRef } from "@/lib/types";

const FUTURE_HORIZON_MIN = 60;

export type TimelineStop = {
  offsetMin: number;
  /** `forecast` reuses the latest scan. The clouds stay put. */
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
 * One stop per real radar image. Published forecast frames extend the slider.
 * Otherwise the future steps keep the latest scan frozen, so the pin chart can
 * move ahead without pretending the clouds are animating.
 */
export function timelineStops(frames: MapFrame[]): TimelineStop[] {
  const past = frames
    .filter((frame) => frame.kind === "past")
    .sort((a, b) => a.offsetMin - b.offsetMin);
  const nowcast = frames
    .filter((frame) => frame.kind === "nowcast")
    .sort((a, b) => a.offsetMin - b.offsetMin);
  const step = frameStepMin(frames);
  const latest = past[past.length - 1];
  const stops: TimelineStop[] = [];

  for (const frame of past) {
    if (frame.offsetMin > 2) continue;
    stops.push({ offsetMin: frame.offsetMin, kind: "past", path: frame.path });
  }

  if (nowcast.length > 0) {
    for (const frame of nowcast) {
      if (frame.offsetMin <= 0 || frame.offsetMin > FUTURE_HORIZON_MIN + step / 2) continue;
      stops.push({ offsetMin: frame.offsetMin, kind: "nowcast", path: frame.path });
    }
  } else if (latest) {
    for (let offset = latest.offsetMin + step; offset <= FUTURE_HORIZON_MIN; offset += step) {
      stops.push({ offsetMin: offset, kind: "forecast", path: latest.path });
    }
  }

  return stops;
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
