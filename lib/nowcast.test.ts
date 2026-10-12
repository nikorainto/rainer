import assert from "node:assert/strict";
import test from "node:test";
import { toDisplayMotion } from "./display-motion";
import { buildNowcast, rainSpans } from "./nowcast";
import type { NowcastSample } from "./types";

function paint(grid: Float32Array, size: number, cx: number, cy: number, dbz: number) {
  for (let y = cy - 2; y <= cy + 2; y += 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      grid[y * size + x] = dbz;
    }
  }
}

function frames(size: number, positions: number[], dbz: number, start = 1_700_000_000) {
  return positions.map((x, index) => {
    const grid = new Float32Array(size * size);
    if (dbz > 0) paint(grid, size, x, (size - 1) / 2, dbz);
    return {
      time: start + index * 600,
      path: `/v2/radar/test${index}`,
      grid,
    };
  });
}

test("a coarser radar sample is scaled into native zoom pixels", () => {
  const shown = toDisplayMotion({ dxPerMin: 0.1, dyPerMin: 0, score: 0.9 }, 63, 5, 2);
  assert.equal(shown?.eastPxPerMin, 0.8);
  assert.ok((shown?.speedKmh ?? 0) > 3);
});

test("a dry window stays dry", () => {
  const size = 31;
  const observed = frames(size, [15, 15, 15], 0);
  const result = buildNowcast({
    evaluatedAt: observed[2].time,
    lat: 60,
    host: "https://tilecache.rainviewer.com",
    coverage: true,
    observed,
    nowcastFrames: [],
    gridSize: size,
    maxShift: 4,
  });
  assert.equal(result.summary.willRainIn30, false);
  assert.equal(result.summary.headline, "Looks dry for the next 60 mins");
  assert.equal(result.signals.immediate, false);
  assert.equal(result.signals.dissipated, false);
  assert.equal(result.source, "motion-vector");
});

test("an approaching cell is a yes within 30 minutes and not a 5-minute alarm", () => {
  const size = 31;
  const observed = frames(size, [3, 6, 9], 45);
  const result = buildNowcast({
    evaluatedAt: observed[2].time,
    lat: 51,
    host: "https://tilecache.rainviewer.com",
    coverage: true,
    observed,
    nowcastFrames: [],
    gridSize: size,
    maxShift: 6,
  });
  assert.equal(result.summary.rainingNow, false);
  assert.equal(result.summary.willRainIn30, true);
  assert.match(result.summary.headline, /^Rain may start in \d+ mins$/);
  assert.equal(result.signals.immediate, false);
  assert.ok(result.summary.intensityMmHr > 8);
  assert.equal(result.summary.intensityCategory, "Heavy downpour");
});

test("a heavy cell one step upwind raises the 5-minute alarm", () => {
  const size = 41;
  const half = 20;
  const observed = frames(size, [half - 15, half - 9, half - 3], 50);
  const result = buildNowcast({
    evaluatedAt: observed[2].time,
    lat: 61,
    host: "https://tilecache.rainviewer.com",
    coverage: true,
    observed,
    nowcastFrames: [],
    gridSize: size,
    maxShift: 8,
  });
  assert.equal(result.signals.immediate, true);
  assert.equal(result.summary.willRainIn30, true);
});

test("rain that was on the pin and then leaves is a dissipation", () => {
  const size = 31;
  const half = 15;
  const observed = [42, 42, 0].map((dbz, index) => {
    const grid = new Float32Array(size * size);
    if (dbz > 0) paint(grid, size, half, half, dbz);
    return {
      time: 1_700_000_000 + index * 600,
      path: `/v2/radar/dry${index}`,
      grid,
    };
  });
  const result = buildNowcast({
    evaluatedAt: observed[2].time,
    lat: 48,
    host: "https://tilecache.rainviewer.com",
    coverage: true,
    observed,
    nowcastFrames: [],
    gridSize: size,
    maxShift: 4,
  });
  assert.equal(result.summary.willRainIn30, false);
  assert.equal(result.signals.dissipated, true);
  assert.equal(result.signals.immediate, false);
});

test("official nowcast frames override motion at the future step", () => {
  const size = 21;
  const observed = frames(size, [10, 10, 10], 0);
  const latest = observed[2];
  const result = buildNowcast({
    evaluatedAt: latest.time,
    lat: 40,
    host: "https://tilecache.rainviewer.com",
    coverage: true,
    observed,
    nowcastFrames: [
      { time: latest.time + 600, path: "/v2/radar/future10", dbz: 0 },
      { time: latest.time + 1800, path: "/v2/radar/future30", dbz: 32 },
    ],
    gridSize: size,
    maxShift: 4,
  });
  assert.equal(result.source, "rainviewer-nowcast");
  const at30 = result.samples.find((sample) => sample.offsetMin === 30);
  assert.ok(at30);
  assert.ok((at30?.dbz ?? 0) > 20);
  assert.equal(result.summary.willRainIn30, true);
});

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

test("the pin chart keeps the last hour, not the whole archive", () => {
  const size = 11;
  const start = 1_700_000_000;
  const observed = Array.from({ length: 14 }, (_, index) => ({
    time: start + index * 600,
    path: `/v2/radar/${index}`,
    grid: new Float32Array(size * size),
  }));
  const latest = observed.at(-1);
  if (!latest) throw new Error("expected a latest scan");
  const result = buildNowcast({
    evaluatedAt: latest.time,
    lat: 60,
    host: "https://tilecache.rainviewer.com",
    coverage: true,
    observed,
    nowcastFrames: [],
    gridSize: size,
    maxShift: 2,
  });
  assert.equal(result.samples[0]?.offsetMin, -60);
  assert.equal(result.samples.at(-1)?.offsetMin, 60);
});

test("missing coverage does not invent rain", () => {
  const result = buildNowcast({
    evaluatedAt: 1_700_000_000,
    lat: 0,
    host: "https://tilecache.rainviewer.com",
    coverage: false,
    observed: [],
    nowcastFrames: [],
  });
  assert.equal(result.coverage, false);
  assert.equal(result.summary.headline, "No radar coverage here");
  assert.equal(result.summary.willRainIn30, false);
});
