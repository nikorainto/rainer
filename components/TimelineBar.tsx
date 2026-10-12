"use client";

import { Pause, Play, Repeat } from "lucide-react";
import { formatClock, formatLead, formatMm } from "@/lib/format";
import { nearestStopIndex, stopFraction, type TimelineStop } from "@/lib/map-frame";
import type { NowcastSample } from "@/lib/types";

type TimelineBarProps = {
  stops: TimelineStop[];
  offset: number;
  onOffset: (offset: number) => void;
  playing: boolean;
  loop: boolean;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  disabled: boolean;
  sample: NowcastSample | null;
};

export function TimelineBar({
  stops,
  offset,
  onOffset,
  playing,
  loop,
  onTogglePlay,
  onToggleLoop,
  disabled,
  sample,
}: TimelineBarProps) {
  const index = nearestStopIndex(stops, offset);
  const stop = stops[index] ?? null;
  const last = stops.length - 1;
  const nowFraction = stopFraction(stops, 0);
  const nowPercent = `${nowFraction * 100}%`;
  const reading = sample ? `${formatMm(sample.rateMmHr)} mm/h · ${sample.category}` : "Tap the map";
  const showNow = nowFraction > 0.14 && nowFraction < 0.86;

  return (
    <div>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{
            left: "calc(var(--thumb, 16px) / 2)",
            width: "calc(100% - var(--thumb, 16px))",
            background: `linear-gradient(90deg, #1a3a4a ${nowPercent}, #3a3422 ${nowPercent})`,
          }}
        />
        <input
          className="timeline-range relative"
          type="range"
          min={0}
          max={Math.max(last, 0)}
          step={1}
          value={stops.length === 0 ? 0 : index}
          disabled={disabled || stops.length < 2}
          aria-label="Radar timeline"
          aria-valuetext={stop ? `${formatLead(stop.offsetMin)}, ${reading}` : "No radar frames"}
          onChange={(event) => {
            const next = stops[Number(event.target.value)];
            if (next) onOffset(next.offsetMin);
          }}
        />
      </div>
      <div
        className="relative mt-0.5 h-4 text-[10px] uppercase tracking-wide text-muted"
        style={{ marginInline: "calc(var(--thumb, 16px) / 2)" }}
      >
        <span>{stop ? formatLead(stops[0]?.offsetMin ?? 0) : "−30 min"}</span>
        {showNow ? (
          <span className="absolute -translate-x-1/2" style={{ left: nowPercent }}>
            Now
          </span>
        ) : null}
        <span className="absolute right-0">
          {stops.length > 0 ? formatLead(stops[last]?.offsetMin ?? 0) : "+60 min"}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-ink disabled:opacity-40"
          onClick={onTogglePlay}
          disabled={disabled || stops.length < 2}
          aria-pressed={playing}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button
          type="button"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-ink disabled:opacity-40 ${
            loop ? "border-dry bg-dry/15 text-dry" : "border-line bg-panel"
          }`}
          onClick={onToggleLoop}
          disabled={disabled || stops.length < 2}
          aria-pressed={loop}
          aria-label={loop ? "Turn looping off" : "Loop playback"}
        >
          <Repeat size={16} />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
          <p className="font-mono text-sm text-ink">{stop ? formatLead(stop.offsetMin) : "Now"}</p>
          <p className="truncate text-xs text-muted">
            {sample ? formatClock(sample.time) : reading}
          </p>
        </div>
      </div>
    </div>
  );
}
