"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { LocationBar } from "@/components/LocationBar";
import { forecastFootnote, NowcastPanel } from "@/components/NowcastPanel";
import { TimelineBar } from "@/components/TimelineBar";
import { useNowcastMonitor } from "@/hooks/useNowcastMonitor";
import { useRadarCatalog } from "@/hooks/useRadarCatalog";
import { nearestStopIndex, timelineStops } from "@/lib/map-frame";
import { installAudioUnlock, setAlertsMuted } from "@/lib/sound";
import {
  loadLastPin,
  loadSoundEnabled,
  saveLastPin,
  saveSoundEnabled,
  type Pin,
} from "@/lib/storage";
import { radarTileUrl } from "@/lib/tiles";
import type { NowcastSample } from "@/lib/types";

const RadarMap = dynamic(() => import("@/components/RadarMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-sea" />,
});

export function Dashboard() {
  const [place, setPlace] = useState<Pin | null>(() => loadLastPin());
  const [locating, setLocating] = useState(false);
  const [soundOn, setSoundOn] = useState(() => loadSoundEnabled());
  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [follow, setFollow] = useState(true);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const pinned = useRef(false);
  const offsetRef = useRef(offset);

  const monitor = useNowcastMonitor(place?.lat ?? null, place?.lon ?? null);
  const catalog = useRadarCatalog();

  const locate = useCallback((fromUser: boolean) => {
    if (!navigator.geolocation) {
      setGpsNote("This browser has no GPS.");
      setLocating(false);
      return;
    }
    setLocating(true);
    setGpsNote(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        if (pinned.current && !fromUser) return;
        const next = roundPin({
          name: "Current location",
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setPlaying(false);
        setFollow(true);
        setPlace(next);
        void labelPin(next.lat, next.lon).then((name) => {
          if (!name) return;
          setPlace((current) => {
            if (!current || current.lat !== next.lat || current.lon !== next.lon) return current;
            if (pinned.current && !fromUser) return current;
            return { ...current, name };
          });
        });
      },
      () => {
        setLocating(false);
        setGpsNote("GPS unavailable");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    setAlertsMuted(!loadSoundEnabled());
    installAudioUnlock();
    const timer = window.setTimeout(() => locate(false), 0);
    return () => window.clearTimeout(timer);
  }, [locate]);

  useEffect(() => {
    if (place) saveLastPin(place);
  }, [place]);

  const frames = monitor.data?.mapFrames ?? catalog.frames;
  const stops = useMemo(() => timelineStops(frames), [frames]);
  const firstOffset = stops[0]?.offsetMin ?? null;
  const placeKey = place ? `${place.lat.toFixed(4)},${place.lon.toFixed(4)}` : "map";
  const headId = firstOffset == null ? null : placeKey;
  const [startedKey, setStartedKey] = useState<string | null>(null);
  if (headId && startedKey !== headId && firstOffset != null) {
    setStartedKey(headId);
    offsetRef.current = firstOffset;
    setOffset(firstOffset);
  }

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    if (!playing || stops.length < 2) return;
    const timer = window.setInterval(() => {
      const index = nearestStopIndex(stops, offsetRef.current);
      const next = stops[index + 1];
      if (next) {
        offsetRef.current = next.offsetMin;
        setOffset(next.offsetMin);
        return;
      }
      if (loop) {
        const first = stops[0]?.offsetMin ?? offsetRef.current;
        offsetRef.current = first;
        setOffset(first);
        return;
      }
      setPlaying(false);
    }, 800);
    return () => window.clearInterval(timer);
  }, [loop, playing, stops]);

  function pin(next: Pin, options?: { follow?: boolean }) {
    pinned.current = true;
    setGpsNote(null);
    setPlaying(false);
    setFollow(options?.follow !== false);
    setPlace(roundPin(next));
  }

  function pickOnMap(lat: number, lon: number) {
    const next = roundPin({
      name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      lat,
      lon,
    });
    pin(next, { follow: false });
    void labelPin(next.lat, next.lon).then((name) => {
      if (!name) return;
      setPlace((current) => {
        if (!current || current.lat !== next.lat || current.lon !== next.lon) return current;
        return { ...current, name };
      });
    });
  }

  const stop = stops[nearestStopIndex(stops, offset)] ?? null;
  const footnote = forecastFootnote(monitor.data);
  const selected = closestSample(monitor.data?.samples ?? [], stop?.offsetMin ?? 0);
  const host = monitor.data?.host ?? catalog.host;
  const frozen = stop?.kind === "forecast";
  const tileUrl = host && stop ? radarTileUrl(host, stop.path) : null;

  return (
    <div className="relative h-full">
      <RadarMap
        lat={place?.lat ?? 64.8}
        lon={place?.lon ?? 26}
        hasPlace={place != null}
        tileUrl={tileUrl}
        frozen={frozen}
        band={selected?.band ?? monitor.data?.summary.bandNow ?? "none"}
        alert={monitor.alert?.type === "immediate"}
        follow={follow}
        onPick={pickOnMap}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col gap-2 p-3">
        <div className="pointer-events-auto">
          <LocationBar
            onPin={pin}
            onLocate={() => locate(true)}
            locating={locating}
            soundOn={soundOn}
            onToggleSound={() => {
              const next = !soundOn;
              setSoundOn(next);
              setAlertsMuted(!next);
              saveSoundEnabled(next);
            }}
          />
          {gpsNote ? <p className="mt-1 px-1 text-xs text-muted">{gpsNote}</p> : null}
        </div>
        {monitor.alert ? (
          <div className="pointer-events-auto">
            <AlertBanner alert={monitor.alert} onDismiss={monitor.dismissAlert} />
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[500] flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-line bg-sea/95 px-2.5 py-2 shadow-2xl backdrop-blur-sm [--thumb:16px] lg:inset-x-auto lg:bottom-4 lg:left-4 lg:w-[22rem]">
        <NowcastPanel
          place={place}
          data={monitor.data}
          loading={monitor.loading}
          error={monitor.error}
          selected={selected}
          markerOffset={stop?.offsetMin ?? 0}
          stops={stops}
          onRetry={() => void monitor.refresh()}
        />
        <TimelineBar
          stops={stops}
          offset={offset}
          onOffset={(value) => {
            setPlaying(false);
            setOffset(value);
          }}
          playing={playing}
          loop={loop}
          onTogglePlay={() => {
            if (playing) {
              setPlaying(false);
              return;
            }
            const index = nearestStopIndex(stops, offset);
            if (!loop && index >= stops.length - 1 && stops[0]) {
              offsetRef.current = stops[0].offsetMin;
              setOffset(stops[0].offsetMin);
            }
            setPlaying(true);
          }}
          onToggleLoop={() => setLoop((current) => !current)}
          disabled={stops.length < 2}
          sample={selected}
        />
        {footnote ? <p className="text-[11px] leading-4 text-muted">{footnote}</p> : null}
      </div>
    </div>
  );
}

function closestSample(samples: NowcastSample[], offsetMin: number): NowcastSample | null {
  let best = samples[0] ?? null;
  let bestDistance = best ? Math.abs(best.offsetMin - offsetMin) : Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const distance = Math.abs(sample.offsetMin - offsetMin);
    if (distance < bestDistance) {
      best = sample;
      bestDistance = distance;
    }
  }
  return best;
}

function roundPin(pin: Pin): Pin {
  return {
    name: pin.name,
    lat: Number(pin.lat.toFixed(4)),
    lon: Number(pin.lon.toFixed(4)),
  };
}

async function labelPin(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`, { cache: "no-store" });
    const json = (await response.json()) as { ok?: boolean; name?: string };
    return json.ok && json.name ? json.name : null;
  } catch {
    return null;
  }
}
