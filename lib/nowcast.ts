import { GRID_SIZE, GRID_STEP, HEAVY_DBZ, MAX_SHIFT, RAIN_DBZ, SAMPLE_ZOOM } from "@/lib/constants";
import { toDisplayMotion } from "@/lib/display-motion";
import { formatMm, roundTo } from "@/lib/format";
import { metersPerPixel } from "@/lib/geo";
import { advectPoint, estimateMotion, gridCenter, type Motion } from "@/lib/motion";
import { classifyDbz } from "@/lib/reflectivity";
import type { MapFrame, NowcastOk, NowcastSample, RadarFrameRef, RainBand } from "@/lib/types";

export type ObservedInput = RadarFrameRef & { grid: Float32Array };

export type NowcastFrameInput = RadarFrameRef & { dbz: number };

const ZERO_MOTION: Motion = { dxPerMin: 0, dyPerMin: 0, score: 0 };

function interpolateDbz(series: { time: number; dbz: number }[], time: number): number {
  if (series.length === 0) return 0;
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) return 0;
  if (time <= first.time) return first.dbz;
  if (time >= last.time) return last.dbz;
  for (let index = 1; index < series.length; index += 1) {
    const right = series[index];
    const left = series[index - 1];
    if (!right || !left || time > right.time) continue;
    const span = right.time - left.time;
    const fraction = span === 0 ? 0 : (time - left.time) / span;
    return left.dbz + (right.dbz - left.dbz) * fraction;
  }
  return last.dbz;
}

/** Clock span of each wet stretch on the timeline. Dry gaps split the ranges. */
export function rainSpans(samples: NowcastSample[]): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let start: number | null = null;
  let end = 0;
  for (const sample of samples) {
    if (sample.band === "none") {
      if (start != null) spans.push({ start, end });
      start = null;
      continue;
    }
    if (start == null) start = sample.time;
    end = sample.time;
  }
  if (start != null) spans.push({ start, end });
  return spans;
}

function minutesUntilRain(samples: NowcastSample[]): number | null {
  const window = samples.filter((sample) => sample.offsetMin >= 0 && sample.offsetMin <= 60);
  const now = window.find((sample) => sample.offsetMin === 0);
  if (now && now.dbz > RAIN_DBZ) return null;

  for (let index = 1; index < window.length; index += 1) {
    const previous = window[index - 1];
    const current = window[index];
    if (!previous || !current) continue;
    if (previous.dbz <= RAIN_DBZ && current.dbz > RAIN_DBZ) {
      const span = current.dbz - previous.dbz;
      const fraction = span === 0 ? 1 : (RAIN_DBZ - previous.dbz) / span;
      const clamped = Math.min(1, Math.max(0, fraction));
      const minutes = previous.offsetMin + clamped * (current.offsetMin - previous.offsetMin);
      return Math.max(1, Math.round(minutes));
    }
  }
  return null;
}

function headlineFor(
  coverage: boolean,
  rainingNow: boolean,
  bandNow: RainBand,
  minutesUntil: number | null,
): string {
  if (!coverage) return "No radar coverage here";
  if (rainingNow && bandNow === "heavy") return "Heavy rain overhead";
  if (rainingNow) return "Raining now";
  if (minutesUntil != null && minutesUntil <= 45) {
    return `Rain may start in ${minutesUntil} mins`;
  }
  if (bandNow === "drizzle") return "Drizzle now";
  if (minutesUntil != null && minutesUntil < 60) {
    const dryFor = Math.max(5, Math.floor((minutesUntil - 1) / 5) * 5);
    return `Looks dry for the next ${dryFor} mins`;
  }
  return "Looks dry for the next 60 mins";
}

function detailFor(args: {
  coverage: boolean;
  rainingNow: boolean;
  categoryNow: string;
  rateNow: number;
  minutesUntil: number | null;
  willRain: boolean;
  peak: number;
  peakCategory: string;
  bandNow: RainBand;
}): string {
  if (!args.coverage) return "RainViewer has no radar covering this coordinate.";
  if (args.rainingNow) {
    return `${args.categoryNow} at the pin, ${formatMm(args.rateNow)} mm/h.`;
  }
  if (args.willRain && args.minutesUntil != null) {
    return `Peak ${formatMm(args.peak)} mm/h (${args.peakCategory.toLowerCase()}) if these cells hold their course.`;
  }
  if (args.bandNow === "drizzle") {
    return "Only drizzle is on the pin. No steady rain is lined up for the next hour.";
  }
  return "No steady rain is lined up for this pin in the next hour.";
}

function mapFramesFor(
  evaluatedAt: number,
  observed: RadarFrameRef[],
  nowcastFrames: RadarFrameRef[],
): MapFrame[] {
  const frames: MapFrame[] = [];
  for (const frame of observed) {
    frames.push({
      time: frame.time,
      offsetMin: Math.round((frame.time - evaluatedAt) / 60),
      path: frame.path,
      kind: "past",
    });
  }
  for (const frame of nowcastFrames) {
    frames.push({
      time: frame.time,
      offsetMin: Math.round((frame.time - evaluatedAt) / 60),
      path: frame.path,
      kind: "nowcast",
    });
  }
  return frames.sort((a, b) => a.time - b.time);
}

function emptySummary(coverage: boolean): NowcastOk["summary"] {
  return {
    headline: coverage ? "Looks dry for the next 60 mins" : "No radar coverage here",
    detail: coverage
      ? "No steady rain is lined up for this pin in the next hour."
      : "RainViewer has no radar covering this coordinate.",
    willRainIn30: false,
    intensityMmHr: 0,
    intensityDbz: 0,
    intensityCategory: "Dry",
    intensityBand: "none",
    at30MmHr: 0,
    at30Category: "Dry",
    minutesUntilRain: null,
    rainingNow: false,
    rateNow: 0,
    dbzNow: 0,
    categoryNow: "Dry",
    bandNow: "none",
  };
}

function peakAhead(
  grid: Float32Array,
  gridSize: number,
  motion: Motion,
  horizonMin: number,
): number {
  let peak = 0;
  for (let lead = 0; lead <= horizonMin; lead += 5) {
    peak = Math.max(peak, advectPoint(grid, gridSize, motion, lead));
  }
  return peak;
}

export function buildNowcast(input: {
  evaluatedAt: number;
  lat: number;
  host: string;
  coverage: boolean;
  observed: ObservedInput[];
  nowcastFrames: NowcastFrameInput[];
  gridSize?: number;
  maxShift?: number;
  zoom?: number;
  step?: number;
}): NowcastOk {
  const gridSize = input.gridSize ?? GRID_SIZE;
  const maxShift = input.maxShift ?? MAX_SHIFT;
  const zoom = input.zoom ?? SAMPLE_ZOOM;
  const step = input.step ?? GRID_STEP;
  const observed = [...input.observed].sort((a, b) => a.time - b.time);
  const nowcastFrames = [...input.nowcastFrames].sort((a, b) => a.time - b.time);
  const latest = observed[observed.length - 1];
  const scanTime = latest?.time ?? input.evaluatedAt;
  const scanAgeMin = Math.max(0, (input.evaluatedAt - scanTime) / 60);
  const half = (gridSize - 1) / 2;
  const windowKm = (half * step * metersPerPixel(input.lat, zoom)) / 1000;
  const frames = mapFramesFor(input.evaluatedAt, observed, nowcastFrames);
  const source = nowcastFrames.length > 0 ? "rainviewer-nowcast" : "motion-vector";

  if (!input.coverage || !latest) {
    return {
      ok: true,
      evaluatedAt: input.evaluatedAt,
      coverage: input.coverage && Boolean(latest),
      host: input.host,
      source,
      scanTime,
      scanAgeMin: roundTo(scanAgeMin, 1),
      windowKm: roundTo(windowKm, 0),
      motion: null,
      samples: [],
      mapFrames: frames,
      summary: emptySummary(input.coverage && Boolean(latest)),
      signals: { immediate: false, dissipated: false },
      diagnostics: { echoPixels: 0, framesUsed: observed.length },
    };
  }

  const motion = estimateMotion(observed, gridSize, maxShift);
  const history = observed.slice(0, -1);
  const previous = history[history.length - 1];
  const previousMotion = previous ? estimateMotion(history, gridSize, maxShift) : ZERO_MOTION;

  const centers = observed.map((frame) => ({
    time: frame.time,
    dbz: gridCenter(frame.grid, gridSize),
  }));
  const futureSeries = [
    { time: latest.time, dbz: gridCenter(latest.grid, gridSize) },
    ...nowcastFrames.map((frame) => ({ time: frame.time, dbz: frame.dbz })),
  ];

  const oldest = observed[0];
  const oldestMin = oldest ? Math.round((oldest.time - input.evaluatedAt) / 60) : -30;
  const sampleStart = Math.min(-30, Math.floor(oldestMin / 5) * 5);
  const samples: NowcastSample[] = [];
  for (let offsetMin = sampleStart; offsetMin <= 60; offsetMin += 5) {
    const time = input.evaluatedAt + offsetMin * 60;
    let dbz = 0;
    if (time <= latest.time) {
      dbz = interpolateDbz(centers, time);
    } else if (nowcastFrames.length > 0) {
      dbz = interpolateDbz(futureSeries, time);
    } else {
      dbz = advectPoint(latest.grid, gridSize, motion, (time - latest.time) / 60);
    }
    const classified = classifyDbz(dbz);
    samples.push({
      time,
      offsetMin,
      dbz: roundTo(dbz, 1),
      rateMmHr: roundTo(classified.rateMmHr, 2),
      category: classified.category,
      band: classified.band,
    });
  }

  const horizon = samples.filter((sample) => sample.offsetMin >= 0 && sample.offsetMin <= 30);
  const nowSample = samples.find((sample) => sample.offsetMin === 0) ?? horizon[0];
  const at30 = samples.find((sample) => sample.offsetMin === 30) ?? nowSample;
  let peak = horizon[0] ?? nowSample;
  for (const sample of horizon) {
    if (sample.rateMmHr > (peak?.rateMmHr ?? 0)) peak = sample;
  }

  const dbzNow = nowSample?.dbz ?? 0;
  const rainingNow = dbzNow > RAIN_DBZ;
  const willRainIn30 = horizon.some((sample) => sample.dbz > RAIN_DBZ);
  const until = minutesUntilRain(samples);
  const bandNow = nowSample?.band ?? "none";
  const categoryNow = nowSample?.category ?? "Dry";
  const rateNow = nowSample?.rateMmHr ?? 0;
  const intensity = peak ?? nowSample;

  const lead5 = Math.max(0, (input.evaluatedAt + 5 * 60 - latest.time) / 60);
  const dbzApproach = advectPoint(latest.grid, gridSize, motion, lead5);
  const previousCenter = previous ? gridCenter(previous.grid, gridSize) : dbzNow;
  const elapsed = previous ? Math.max(1, (latest.time - previous.time) / 60) : 10;
  const jump = dbzNow - previousCenter;
  const trend5 = dbzNow + (jump * 5) / elapsed;
  const intensifying = jump >= 12 && trend5 > HEAVY_DBZ && dbzNow <= 35;
  const approaching = dbzApproach > HEAVY_DBZ && dbzNow <= 35;
  const immediate = intensifying || approaching;

  const previousPeak = previous ? peakAhead(previous.grid, gridSize, previousMotion, 30) : 0;
  const currentPeak = horizon.reduce((max, sample) => Math.max(max, sample.dbz), 0);
  const dissipated = !immediate && previousPeak > RAIN_DBZ && currentPeak <= 15;

  let echoPixels = 0;
  for (const value of latest.grid) {
    if (value > 5) echoPixels += 1;
  }

  const speed = toDisplayMotion(motion, input.lat, zoom, step);

  return {
    ok: true,
    evaluatedAt: input.evaluatedAt,
    coverage: true,
    host: input.host,
    source,
    scanTime,
    scanAgeMin: roundTo(scanAgeMin, 1),
    windowKm: roundTo(windowKm, 0),
    motion: speed,
    samples,
    mapFrames: frames,
    summary: {
      headline: headlineFor(true, rainingNow, bandNow, until),
      detail: detailFor({
        coverage: true,
        rainingNow,
        categoryNow,
        rateNow,
        minutesUntil: until,
        willRain: willRainIn30,
        peak: intensity?.rateMmHr ?? 0,
        peakCategory: intensity?.category ?? "Dry",
        bandNow,
      }),
      willRainIn30,
      intensityMmHr: intensity?.rateMmHr ?? 0,
      intensityDbz: intensity?.dbz ?? 0,
      intensityCategory: intensity?.category ?? "Dry",
      intensityBand: intensity?.band ?? "none",
      at30MmHr: at30?.rateMmHr ?? 0,
      at30Category: at30?.category ?? "Dry",
      minutesUntilRain: until,
      rainingNow,
      rateNow,
      dbzNow,
      categoryNow,
      bandNow,
    },
    signals: { immediate, dissipated },
    diagnostics: { echoPixels, framesUsed: observed.length },
  };
}
