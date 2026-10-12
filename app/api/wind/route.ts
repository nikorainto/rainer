import type { NextRequest } from "next/server";
import { isLatLon } from "@/lib/coords";
import { clientKey, errorJson, json, tooMany } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";
import { loadWind } from "@/lib/server/wind";

export const maxDuration = 15;

const CACHE = "public, s-maxage=600, stale-while-revalidate=600";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!isLatLon(lat, lon)) {
    return json({ ok: false, error: "Invalid coordinates" }, { status: 400 });
  }
  if (!allow(`wind:${clientKey(request)}`, 30, 60_000)) return tooMany();

  try {
    const wind = await loadWind(Number(lat.toFixed(4)), Number(lon.toFixed(4)));
    return json({ ok: true, wind }, { cache: CACHE });
  } catch (error) {
    return errorJson(error, "Wind data is unavailable");
  }
}
