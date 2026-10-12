import type { NextRequest } from "next/server";
import { isLatLon } from "@/lib/coords";
import { clientKey, errorJson, json, tooMany } from "@/lib/server/http";
import { computeNowcast } from "@/lib/server/radar";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 30;

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!isLatLon(lat, lon)) {
    return json({ ok: false, error: "Invalid coordinates" }, { status: 400 });
  }
  if (!allow(`nowcast:${clientKey(request)}`, 30, 60_000)) return tooMany();

  try {
    const nowcast = await computeNowcast(Number(lat.toFixed(4)), Number(lon.toFixed(4)));
    return json(nowcast, { cache: CACHE });
  } catch (error) {
    return errorJson(error, "Radar request failed");
  }
}
