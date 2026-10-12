import { PublicError } from "@/lib/server/http";
import { isRadarFramePath, rainViewerOrigin } from "@/lib/tiles";
import type { WeatherMaps } from "@/lib/types";

const MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";
export const RAINVIEWER_USER_AGENT = "Rainer/1.0 (radar nowcast)";
const MAPS_TTL_MS = 60_000;

let cache: { at: number; data: WeatherMaps } | null = null;
let pending: Promise<WeatherMaps> | null = null;

/** Shared catalog. One in-flight fetch per instance, then a minute of reuse. */
export function loadWeatherMaps(): Promise<WeatherMaps> {
  const now = Date.now();
  if (cache && now - cache.at < MAPS_TTL_MS) return Promise.resolve(cache.data);
  if (pending) return pending;
  pending = fetchMaps().finally(() => {
    pending = null;
  });
  return pending;
}

export function requireFramePath(path: string) {
  if (!isRadarFramePath(path)) {
    throw new PublicError("RainViewer returned an unexpected frame path");
  }
}

async function fetchMaps(): Promise<WeatherMaps> {
  let response: Response;
  try {
    response = await fetch(MAPS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json", "User-Agent": RAINVIEWER_USER_AGENT },
    });
  } catch {
    throw new PublicError("RainViewer is unavailable");
  }
  if (!response.ok) throw new PublicError(`RainViewer is unavailable (${response.status})`);

  const data = (await response.json()) as WeatherMaps;
  if (!data?.host || !Array.isArray(data.radar?.past) || data.radar.past.length === 0) {
    throw new PublicError("RainViewer returned no radar frames");
  }
  const origin = rainViewerOrigin(data.host);
  if (!origin) throw new PublicError("RainViewer returned an unexpected host");
  if (!Array.isArray(data.radar.nowcast)) data.radar.nowcast = [];
  for (const frame of data.radar.past) requireFramePath(frame.path);
  for (const frame of data.radar.nowcast) requireFramePath(frame.path);

  const maps = { ...data, host: origin };
  cache = { at: Date.now(), data: maps };
  return maps;
}
