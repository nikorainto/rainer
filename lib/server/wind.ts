import { PublicError } from "@/lib/server/http";
import { describeWind, pickSteeringWind, type WindReading } from "@/lib/wind";

const WIND_URL = "https://api.open-meteo.com/v1/forecast";
const USER_AGENT = "Rainer/1.0 (radar nowcast)";
const CACHE_TTL_MS = 10 * 60 * 1000;

type HourlyWind = {
  hourly?: {
    time?: string[];
    wind_speed_850hPa?: (number | null)[];
    wind_direction_850hPa?: (number | null)[];
  };
};

const cache = new Map<string, { at: number; wind: WindReading }>();

/** Model wind at about 1.5 km, the level that usually carries shower clouds. */
export async function loadWind(lat: number, lon: number): Promise<WindReading> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.wind;

  const url = new URL(WIND_URL);
  url.searchParams.set("latitude", lat.toFixed(2));
  url.searchParams.set("longitude", lon.toFixed(2));
  url.searchParams.set("hourly", "wind_speed_850hPa,wind_direction_850hPa");
  url.searchParams.set("past_hours", "1");
  url.searchParams.set("forecast_hours", "3");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "UTC");

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
  } catch {
    throw new PublicError("Wind data is unavailable");
  }
  if (!response.ok) throw new PublicError("Wind data is unavailable");

  const body = (await response.json()) as HourlyWind;
  const hourly = body.hourly;
  const picked = pickSteeringWind(
    hourly?.time ?? [],
    hourly?.wind_speed_850hPa ?? [],
    hourly?.wind_direction_850hPa ?? [],
    Date.now(),
  );
  const wind = picked ? describeWind(picked.fromDeg, picked.speedKmh) : null;
  if (!wind) throw new PublicError("Wind data is unavailable");

  cache.set(key, { at: Date.now(), wind });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return wind;
}
