"use client";

import { useEffect, useState } from "react";
import { mapFramesFromCatalog } from "@/lib/map-frame";
import type { FrameCatalog, MapFrame } from "@/lib/types";

const REFRESH_MS = 60_000;

export function useRadarCatalog() {
  const [host, setHost] = useState<string | null>(null);
  const [frames, setFrames] = useState<MapFrame[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/frames", { cache: "no-store" });
        const json = (await response.json()) as FrameCatalog | { ok: false };
        if (cancelled || !json.ok) return;
        setHost(json.host);
        setFrames(mapFramesFromCatalog(json.past, json.nowcast, Date.now() / 1000));
      } catch {
        /* The pin forecast can still fill the map once it returns. */
      }
    };

    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  return { host, frames };
}
