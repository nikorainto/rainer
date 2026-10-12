import { loadWeatherMaps, requireFramePath } from "@/lib/server/rainviewer";
import type { FrameCatalog } from "@/lib/types";

/** Radar frames for the map, without waiting on a pin sample. */
export async function loadFrameCatalog(): Promise<Omit<FrameCatalog, "ok">> {
  const maps = await loadWeatherMaps();
  const past = [...maps.radar.past].sort((a, b) => a.time - b.time);
  for (const frame of past) requireFramePath(frame.path);
  const latest = past[past.length - 1];
  const nowcast = [...maps.radar.nowcast]
    .filter((frame) => latest && frame.time > latest.time)
    .sort((a, b) => a.time - b.time)
    .slice(0, 12);
  for (const frame of nowcast) requireFramePath(frame.path);
  return { host: maps.host, past, nowcast };
}
