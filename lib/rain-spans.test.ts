import assert from "node:assert/strict";
import test from "node:test";
import { rainSpans } from "./rain-spans";
import type { NowcastSample } from "./types";

test("rain spans skip dry gaps", () => {
  const sample = (offsetMin: number, band: NowcastSample["band"]): NowcastSample => ({
    time: 1_700_000_000 + offsetMin * 60,
    offsetMin,
    dbz: band === "none" ? 0 : 30,
    rateMmHr: band === "none" ? 0 : 2,
    category: band,
    band,
  });
  const spans = rainSpans([
    sample(0, "none"),
    sample(10, "steady"),
    sample(20, "steady"),
    sample(30, "none"),
    sample(40, "heavy"),
  ]);
  assert.deepEqual(spans, [
    { start: 1_700_000_000 + 10 * 60, end: 1_700_000_000 + 20 * 60 },
    { start: 1_700_000_000 + 40 * 60, end: 1_700_000_000 + 40 * 60 },
  ]);
});
