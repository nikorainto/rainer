import type { NextRequest } from "next/server";
import { clientKey, errorJson, json, tooMany } from "@/lib/server/http";
import { loadFrameCatalog } from "@/lib/server/catalog";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 15;

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(request: NextRequest) {
  if (!allow(`frames:${clientKey(request)}`, 30, 60_000)) return tooMany();
  try {
    const catalog = await loadFrameCatalog();
    return json({ ok: true, ...catalog }, { cache: CACHE });
  } catch (error) {
    return errorJson(error, "Radar request failed");
  }
}
