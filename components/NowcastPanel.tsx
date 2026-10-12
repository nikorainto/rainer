"use client";

import { RainChart } from "@/components/RainChart";
import { formatClock, formatMm } from "@/lib/format";
import type { TimelineStop } from "@/lib/map-frame";
import { rainSpans } from "@/lib/nowcast";
import type { Pin } from "@/lib/storage";
import type { NowcastOk, NowcastSample, RainBand } from "@/lib/types";

const BAND_TEXT = {
  none: "text-dry",
  drizzle: "text-sky-300",
  steady: "text-rain",
  heavy: "text-storm",
} as const;

export function forecastFootnote(data: NowcastOk | null, loading: boolean): string {
  if (!data?.coverage) return "Estimate from radar. Not an official forecast or warning.";
  const spans = rainSpans(data.samples);
  const when =
    spans.length === 0
      ? "No rain on this timeline"
      : `Rain ${spans
          .map((span) =>
            span.start === span.end
              ? formatClock(span.start)
              : `${formatClock(span.start)}–${formatClock(span.end)}`,
          )
          .join(" · ")}`;
  const estimate = data.source === "motion-vector" ? " Future is an estimate." : "";
  const updating = loading ? " Updating." : "";
  return `${when}.${estimate}${updating} Not an official forecast.`;
}

export function NowcastPanel({
  place,
  data,
  loading,
  error,
  selected,
  markerOffset,
  stops,
  onRetry,
}: {
  place: Pin | null;
  data: NowcastOk | null;
  loading: boolean;
  error: string | null;
  selected: NowcastSample | null;
  markerOffset: number;
  stops: TimelineStop[];
  onRetry: () => void;
}) {
  const tick = selected ?? data?.samples.find((sample) => sample.offsetMin === 0) ?? null;

  return (
    <aside className="flex flex-col gap-2">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-medium text-ink">{place?.name ?? "Tap the map"}</h2>
        {place ? (
          <p className="font-mono text-[11px] text-muted">
            {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
          </p>
        ) : (
          <p className="text-sm text-muted">Search, or tap the map.</p>
        )}
      </div>

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
          <h1 className="text-xl font-semibold tracking-tight text-ink">{data.summary.headline}</h1>
          <p className="text-sm text-muted">{data.summary.detail}</p>
        </div>
      ) : null}

      {data?.coverage ? (
        <>
          {error ? (
            <p className="text-xs text-rain">
              Couldn&apos;t refresh — showing the last reading. {error}
            </p>
          ) : null}
          {tick ? (
            <div className="flex items-baseline justify-between gap-3" aria-live="polite">
              <h1 className={`text-2xl font-semibold tracking-tight ${BAND_TEXT[tick.band]}`}>
                {tickTitle(tick.band)}
              </h1>
              <p className={`font-mono text-2xl font-semibold ${BAND_TEXT[tick.band]}`}>
                {formatMm(tick.rateMmHr)}
                <span className="ml-1 text-sm font-normal text-muted">mm/h</span>
              </p>
            </div>
          ) : null}
          <RainChart samples={data.samples} markerOffset={markerOffset} stops={stops} />
        </>
      ) : null}
    </aside>
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
      <div className="h-8 w-3/5 animate-pulse rounded-lg bg-white/5" />
      <div className="h-12 animate-pulse rounded-lg bg-white/5" />
      <p className="text-sm text-muted">Reading radar at this pin…</p>
    </div>
  );
}
