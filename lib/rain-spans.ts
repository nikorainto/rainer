import type { NowcastSample } from "@/lib/types";

/** Clock span of each wet stretch on the timeline. Dry gaps split the ranges. */
export function rainSpans(samples: NowcastSample[]): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let start: number | null = null;
  let end = 0;
  for (const sample of samples) {
    if (sample.band === "none") {
      if (start != null) spans.push({ start, end });
      start = null;
      continue;
    }
    if (start == null) start = sample.time;
    end = sample.time;
  }
  if (start != null) spans.push({ start, end });
  return spans;
}
