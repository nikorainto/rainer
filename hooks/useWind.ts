"use client";

import { useEffect, useState } from "react";
import type { WindReading } from "@/lib/wind";

export function useWind(lat: number | null, lon: number | null): WindReading | null {
  const [wind, setWind] = useState<WindReading | null>(null);

  useEffect(() => {
    if (lat == null || lon == null) return;
    const controller = new AbortController();
    setWind(null);

    const load = async () => {
      try {
        const response = await fetch(`/api/wind?lat=${lat}&lon=${lon}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await response.json()) as { ok: true; wind: WindReading } | { ok: false };
        if (controller.signal.aborted) return;
        setWind(json.ok ? json.wind : null);
      } catch {
        if (controller.signal.aborted) return;
        setWind(null);
      }
    };

    void load();
    return () => controller.abort();
  }, [lat, lon]);

  return wind;
}
