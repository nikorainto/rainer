import { formatLead } from "@/lib/format";
import { stopFraction, trackMarkerLeft, type TimelineStop } from "@/lib/map-frame";
import type { NowcastSample } from "@/lib/types";

const VB_W = 100;
const VB_H = 32;
const Y_PAD = 6;

export function RainChart({
  samples,
  markerOffset,
  stops,
}: {
  samples: NowcastSample[];
  markerOffset: number;
  stops: TimelineStop[];
}) {
  if (samples.length < 2) return null;

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || first.offsetMin === last.offsetMin) return null;

  const maxRate = Math.max(1, ...samples.map((sample) => sample.rateMmHr));
  const past = samples.filter((sample) => sample.offsetMin <= 0);
  const future = samples.filter((sample) => sample.offsetMin >= 0);
  const selected =
    samples.find((sample) => sample.offsetMin === markerOffset) ??
    samples.reduce((best, sample) =>
      Math.abs(sample.offsetMin - markerOffset) < Math.abs(best.offsetMin - markerOffset)
        ? sample
        : best,
    );

  const xFraction = (offsetMin: number) => {
    if (stops.length >= 2) return stopFraction(stops, offsetMin);
    const span = last.offsetMin - first.offsetMin;
    return Math.min(1, Math.max(0, (offsetMin - first.offsetMin) / span));
  };
  const yOf = (rate: number) => Y_PAD + (1 - rate / maxRate) * (VB_H - Y_PAD * 2);
  const line = (points: NowcastSample[]) =>
    points
      .map((sample, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command}${(xFraction(sample.offsetMin) * VB_W).toFixed(2)},${yOf(sample.rateMmHr).toFixed(2)}`;
      })
      .join(" ");

  const nowFraction = xFraction(0);
  const markerFraction = xFraction(markerOffset);
  const markerTop = `${(yOf(selected.rateMmHr) / VB_H) * 100}%`;

  return (
    <figure className="m-0 w-full">
      <div className="relative h-8 w-full">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Rain at this pin. Selected ${formatLead(markerOffset)}, ${selected.rateMmHr} millimeters per hour.`}
          className="absolute inset-y-0 block h-full"
          style={{
            left: "calc(var(--thumb, 16px) / 2)",
            width: "calc(100% - var(--thumb, 16px))",
          }}
        >
          <line
            x1={nowFraction * VB_W}
            x2={nowFraction * VB_W}
            y1={Y_PAD}
            y2={VB_H - Y_PAD}
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className="text-line"
          />
          <path
            d={line(past)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="text-ink"
          />
          <path
            d={line(future)}
            fill="none"
            pathLength={100}
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            className="text-rain"
          />
        </svg>
        <div
          className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: trackMarkerLeft(markerFraction), top: markerTop }}
        />
      </div>
    </figure>
  );
}
