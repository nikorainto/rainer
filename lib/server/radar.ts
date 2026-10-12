import { PNG } from "pngjs";
import { SAMPLE_ZOOM } from "@/lib/constants";
import { buildNowcast } from "@/lib/nowcast";
import { centerDbzFromPng, dbzGridFromPng, hasRadarCoverage } from "@/lib/raster";
import { PublicError } from "@/lib/server/http";
import { RAINVIEWER_USER_AGENT, loadWeatherMaps, requireFramePath } from "@/lib/server/rainviewer";
import { rainViewerOrigin } from "@/lib/tiles";
import type { NowcastOk, RadarFrameRef } from "@/lib/types";

const pngCache = new Map<string, PNG>();
const results = new Map<string, { at: number; data: NowcastOk }>();
const inflight = new Map<string, Promise<NowcastOk>>();
const RESULT_TTL_MS = 60_000;

export function computeNowcast(lat: number, lon: number): Promise<NowcastOk> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = results.get(key);
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) return Promise.resolve(hit.data);
  const existing = inflight.get(key);
  if (existing) return existing;

  const pending = runNowcast(lat, lon)
    .then((data) => {
      results.set(key, { at: Date.now(), data });
      if (results.size > 100) {
        const oldest = results.keys().next().value;
        if (oldest) results.delete(oldest);
      }
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, pending);
  return pending;
}

async function runNowcast(lat: number, lon: number): Promise<NowcastOk> {
  const maps = await loadWeatherMaps();
  const origin = rainViewerOrigin(maps.host);
  if (!origin) throw new PublicError("RainViewer returned an unexpected host");

  const past = [...maps.radar.past].sort((a, b) => a.time - b.time);
  for (const frame of past) requireFramePath(frame.path);

  const latest = past[past.length - 1];
  if (!latest) throw new PublicError("RainViewer returned no radar frames");

  const nowcastRefs = [...maps.radar.nowcast]
    .filter((frame) => frame.time > latest.time)
    .sort((a, b) => a.time - b.time)
    .slice(0, 12);
  for (const frame of nowcastRefs) requireFramePath(frame.path);

  const evaluatedAt = Date.now() / 1000;
  const covered = await loadCoverage(origin, lat, lon);

  if (!covered) {
    return buildNowcast({
      evaluatedAt,
      lat,
      host: origin,
      coverage: false,
      observed: past.map((frame) => ({
        time: frame.time,
        path: frame.path,
        grid: new Float32Array(1),
      })),
      nowcastFrames: [],
    });
  }

  const observed = await loadObserved(origin, lat, lon, past);
  if (observed.length === 0) throw new PublicError("Radar tiles could not be read");

  const nowcastFrames = await Promise.all(
    nowcastRefs.map(async (frame) => {
      const png = await loadPng(pointUrl(origin, frame.path, lat, lon));
      return { time: frame.time, path: frame.path, dbz: centerDbzFromPng(png) };
    }),
  );

  return buildNowcast({
    evaluatedAt,
    lat,
    host: origin,
    coverage: true,
    observed,
    nowcastFrames,
  });
}

async function loadCoverage(host: string, lat: number, lon: number): Promise<boolean> {
  try {
    const png = await loadPng(coverageUrl(host, lat, lon));
    return hasRadarCoverage(png);
  } catch {
    return true;
  }
}

async function loadObserved(host: string, lat: number, lon: number, frames: RadarFrameRef[]) {
  const loaded = await Promise.all(
    frames.map(async (frame) => {
      try {
        const png = await loadPng(pointUrl(host, frame.path, lat, lon));
        return { time: frame.time, path: frame.path, grid: dbzGridFromPng(png) };
      } catch {
        return null;
      }
    }),
  );
  return loaded.filter((frame) => frame != null);
}

async function loadPng(url: string): Promise<PNG> {
  const cached = pngCache.get(url);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "image/png", "User-Agent": RAINVIEWER_USER_AGENT },
    });
  } catch {
    throw new PublicError("Radar tile failed");
  }
  if (!response.ok) throw new PublicError(`Radar tile failed (${response.status})`);

  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  pngCache.set(url, png);
  if (pngCache.size > 48) {
    const oldest = pngCache.keys().next().value;
    if (oldest) pngCache.delete(oldest);
  }
  return png;
}

function pointUrl(host: string, path: string, lat: number, lon: number): string {
  requireFramePath(path);
  return `${host}${path}/256/${SAMPLE_ZOOM}/${lat.toFixed(4)}/${lon.toFixed(4)}/2/0_0.png`;
}

function coverageUrl(host: string, lat: number, lon: number): string {
  return `${host}/v2/coverage/0/256/${SAMPLE_ZOOM}/${lat.toFixed(4)}/${lon.toFixed(4)}/0/0_0.png`;
}
