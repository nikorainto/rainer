"use client";

import { ArrowUp, Ellipsis } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { RainChart } from "@/components/RainChart";
import { formatClock, formatKmh, formatMm } from "@/lib/format";
import type { TimelineStop } from "@/lib/map-frame";
import { rainSpans } from "@/lib/rain-spans";
import { loadShowCoordinates, saveShowCoordinates, type Pin } from "@/lib/storage";
import type { NowcastOk, NowcastSample, RainBand } from "@/lib/types";
import type { WindReading } from "@/lib/wind";

const BAND_TEXT = {
  none: "text-dry",
  drizzle: "text-sky-300",
  steady: "text-rain",
  heavy: "text-storm",
} as const;

export function forecastFootnote(data: NowcastOk | null): string | null {
  if (!data?.coverage) return null;
  const spans = rainSpans(data.samples);
  if (spans.length === 0) return null;
  return `Rain ${spans
    .map((span) =>
      span.start === span.end
        ? formatClock(span.start)
        : `${formatClock(span.start)}–${formatClock(span.end)}`,
    )
    .join(" · ")}`;
}

export function NowcastPanel({
  place,
  data,
  wind,
  loading,
  error,
  selected,
  markerOffset,
  stops,
  onRetry,
}: {
  place: Pin | null;
  data: NowcastOk | null;
  wind: WindReading | null;
  loading: boolean;
  error: string | null;
  selected: NowcastSample | null;
  markerOffset: number;
  stops: TimelineStop[];
  onRetry: () => void;
}) {
  const tick = selected ?? data?.samples.find((sample) => sample.offsetMin === 0) ?? null;
  const [showCoordinates, setShowCoordinates] = useState(() => loadShowCoordinates());
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="flex flex-col gap-1">
      <PanelMenu
        open={menuOpen}
        showCoordinates={showCoordinates}
        onToggleOpen={() => setMenuOpen((open) => !open)}
        onClose={() => setMenuOpen(false)}
        onToggleCoordinates={() => {
          setShowCoordinates((current) => {
            const next = !current;
            saveShowCoordinates(next);
            return next;
          });
        }}
        trailing={
          tick ? (
            <h1
              className={`shrink-0 text-sm font-semibold tracking-tight ${BAND_TEXT[tick.band]}`}
              aria-live="polite"
            >
              {tickTitle(tick.band)}
              <span className="ml-1.5 font-mono">{formatMm(tick.rateMmHr)}</span>
              <span className="ml-0.5 text-[11px] font-normal text-muted">mm/h</span>
            </h1>
          ) : null
        }
      >
        <h2 className="truncate text-sm font-medium text-ink">{place?.name ?? "Tap the map"}</h2>
        {place && showCoordinates ? (
          <p className="font-mono text-[11px] text-muted">
            {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
          </p>
        ) : null}
      </PanelMenu>

      {wind ? <WindLine wind={wind} /> : null}

      {place && !data && loading ? <PanelSkeleton /> : null}

      {place && !data && error ? (
        <div className="rounded-xl border border-storm/40 bg-storm/10 px-3 py-3">
          <p className="text-sm text-ink">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs"
          >
            Try again
          </button>
        </div>
      ) : null}

      {data && !data.coverage ? (
        <div>
          {error ? (
            <p className="mb-1 text-xs text-rain">
              Couldn&apos;t refresh — showing the last reading. {error}
            </p>
          ) : null}
          <h1 className="text-base font-semibold tracking-tight text-ink">
            {data.summary.headline}
          </h1>
          <p className="text-xs text-muted">{data.summary.detail}</p>
        </div>
      ) : null}

      {data?.coverage ? (
        <>
          {error ? (
            <p className="text-xs text-rain">
              Couldn&apos;t refresh — showing the last reading. {error}
            </p>
          ) : null}
          <RainChart samples={data.samples} markerOffset={markerOffset} stops={stops} />
        </>
      ) : null}
    </aside>
  );
}

function WindLine({ wind }: { wind: WindReading }) {
  if (wind.calm) {
    return <p className="text-[11px] leading-4 text-muted">Calm</p>;
  }
  return (
    <p className="flex items-center gap-1.5 text-[11px] leading-4 text-muted">
      <ArrowUp
        size={14}
        aria-hidden
        className="shrink-0 text-ink"
        style={{ transform: `rotate(${wind.bearingDeg}deg)` }}
      />
      <span>
        From {wind.from} · blowing {wind.toward} ·{" "}
        <span className="font-mono">{formatKmh(wind.speedKmh)} km/h</span>
      </span>
    </p>
  );
}

function PanelMenu({
  open,
  showCoordinates,
  onToggleOpen,
  onClose,
  onToggleCoordinates,
  trailing,
  children,
}: {
  open: boolean;
  showCoordinates: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onToggleCoordinates: () => void;
  trailing: ReactNode;
  children: ReactNode;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {trailing}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={onToggleOpen}
        >
          <Ellipsis size={16} />
        </button>
      </div>
      {open ? (
        <div id={menuId} className="mt-2 rounded-xl border border-line bg-panel px-3 py-2">
          <button
            type="button"
            role="switch"
            aria-checked={showCoordinates}
            onClick={onToggleCoordinates}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm text-ink"
          >
            <span>Show coordinates</span>
            <span
              className={`relative inline-block h-6 w-10 shrink-0 rounded-full border ${
                showCoordinates ? "border-dry bg-dry/20" : "border-line bg-sea"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink ${
                  showCoordinates ? "left-5" : "left-0.5"
                }`}
              />
            </span>
          </button>
          <p className="mt-3 text-[11px] leading-4 text-muted">
            Future frames are an estimate, not an official forecast. The arrow points where the wind
            is blowing, about 1.5 km up.
          </p>
          <p className="mt-2 text-[11px] leading-4 text-muted">
            Radar{" "}
            <a
              className="underline decoration-line"
              href="https://www.rainviewer.com/"
              target="_blank"
              rel="noreferrer"
            >
              RainViewer
            </a>
            {" · "}
            Map{" "}
            <a
              className="underline decoration-line"
              href="https://www.esri.com/"
              target="_blank"
              rel="noreferrer"
            >
              Esri
            </a>
            {" · "}
            Wind{" "}
            <a
              className="underline decoration-line"
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open-Meteo
            </a>
            {" · "}
            Places{" "}
            <a
              className="underline decoration-line"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function tickTitle(band: RainBand): string {
  if (band === "heavy") return "Heavy";
  if (band === "steady") return "Rain";
  if (band === "drizzle") return "Drizzle";
  return "Dry";
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="h-8 animate-pulse rounded-lg bg-white/5" />
      <p className="text-xs text-muted">Reading radar at this pin…</p>
    </div>
  );
}
