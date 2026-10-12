import type { NextRequest } from "next/server";
import { isLatLon } from "@/lib/coords";
import { type PhotonProperties, type PlaceHit, reverseLabel, searchLabel } from "@/lib/places";
import { PublicError, clientKey, errorJson, json } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";

const PHOTON = "https://photon.komoot.io";
const USER_AGENT = "Rainer/1.0 (radar nowcast)";
const PLACE_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type PhotonFeature = {
  properties?: PhotonProperties;
  geometry?: { coordinates?: unknown };
};

const searchCache = new Map<string, { at: number; results: PlaceHit[] }>();
const reverseCache = new Map<string, { at: number; name: string }>();
let photonNotBefore = 0;

export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");

  try {
    if (latParam != null && lonParam != null) {
      const lat = Number(latParam);
      const lon = Number(lonParam);
      if (!isLatLon(lat, lon)) {
        return json({ ok: false, error: "Invalid coordinates" }, { status: 400 });
      }
      const name = await reverseGeocode(Number(lat.toFixed(4)), Number(lon.toFixed(4)), request);
      if (!name) return json({ ok: false, error: "No place name found" }, { status: 404 });
      return json({ ok: true, name }, { cache: PLACE_CACHE });
    }

    const query = request.nextUrl.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
    if (query.length < 3 || query.length > 120) {
      return json({ ok: false, error: "Enter a place name" }, { status: 400 });
    }
    const results = await searchPlaces(query, request);
    return json({ ok: true, results }, { cache: PLACE_CACHE });
  } catch (error) {
    return errorJson(error, "Place search failed");
  }
}

async function searchPlaces(query: string, request: NextRequest): Promise<PlaceHit[]> {
  const key = query.toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;
  limit(request);

  const url = new URL("/api/", PHOTON);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "en");
  const body = (await photon(url)) as { features?: PhotonFeature[] };
  const results = (body.features ?? [])
    .map((feature) => toHit(feature))
    .filter((feature) => feature != null)
    .slice(0, 5);
  remember(searchCache, key, { at: Date.now(), results });
  return results;
}

async function reverseGeocode(
  lat: number,
  lon: number,
  request: NextRequest,
): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = reverseCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.name;
  limit(request);

  const url = new URL("/reverse", PHOTON);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("lang", "en");
  const body = (await photon(url)) as { features?: PhotonFeature[] };
  const name = reverseLabel(body.features?.[0]?.properties ?? {});
  if (name) remember(reverseCache, key, { at: Date.now(), name });
  return name;
}

function toHit(feature: PhotonFeature): PlaceHit | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!isLatLon(lat, lon)) return null;
  const name = searchLabel(feature.properties ?? {});
  if (!name) return null;
  return { name, lat, lon };
}

function limit(request: NextRequest) {
  if (!allow(`geocode:${clientKey(request)}`, 30, 60_000)) {
    throw new PublicError("Too many requests. Wait a moment and try again.", 429);
  }
}

async function photon(url: URL): Promise<unknown> {
  const wait = Math.max(0, photonNotBefore - Date.now());
  photonNotBefore = Date.now() + wait + 1_000;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
  } catch {
    throw new PublicError("Place search failed");
  }
  if (response.status === 429) {
    throw new PublicError("Place search is busy. Try again in a moment.", 503);
  }
  if (!response.ok) throw new PublicError("Place search failed");
  return response.json();
}

function remember<T>(store: Map<string, T>, key: string, value: T) {
  store.set(key, value);
  if (store.size <= 200) return;
  const oldest = store.keys().next().value;
  if (oldest) store.delete(oldest);
}
