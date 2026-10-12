import assert from "node:assert/strict";
import test from "node:test";
import { advectPoint, estimateMotion, estimateShift } from "./motion";

function paint(grid: Float32Array, size: number, cx: number, cy: number, dbz: number) {
  for (let y = cy - 2; y <= cy + 2; y += 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      grid[y * size + x] = dbz;
    }
  }
}

test("estimateShift finds an eastward, northward cell", () => {
  const size = 25;
  const prev = new Float32Array(size * size);
  const curr = new Float32Array(size * size);
  paint(prev, size, 8, 12, 40);
  paint(curr, size, 11, 10, 40);
  const shift = estimateShift(prev, curr, size, 5);
  assert.equal(shift?.dx, 3);
  assert.equal(shift?.dy, -2);
  assert.ok((shift?.score ?? 0) > 0.8);
});

test("advection looks upwind of a cell moving east", () => {
  const size = 21;
  const grid = new Float32Array(size * size);
  paint(grid, size, 7, 10, 46);
  const value = advectPoint(grid, size, { dxPerMin: 0.3, dyPerMin: 0, score: 1 }, 10);
  assert.ok(value > 40);
  const missed = advectPoint(grid, size, { dxPerMin: 0, dyPerMin: 0, score: 1 }, 10);
  assert.equal(missed, 0);
});

test("a wide smooth echo keeps its eastward shift", () => {
  const size = 31;
  const paintSmooth = (grid: Float32Array, cx: number) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const distance = (x - cx) ** 2 + (y - 15) ** 2;
        grid[y * size + x] = 18 + 20 * Math.exp(-distance / 80);
      }
    }
  };
  const prev = new Float32Array(size * size);
  const curr = new Float32Array(size * size);
  paintSmooth(prev, 12);
  paintSmooth(curr, 14);
  const shift = estimateShift(prev, curr, size, 5);
  assert.equal(shift?.dx, 2);
  assert.equal(shift?.dy, 0);
});

test("rain next to the pin beats a distant cell moving another way", () => {
  const size = 61;
  const center = (size - 1) / 2;
  const paint = (grid: Float32Array, cx: number, cy: number) => {
    for (let y = cy - 2; y <= cy + 2; y += 1) {
      for (let x = cx - 2; x <= cx + 2; x += 1) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        grid[y * size + x] = 42;
      }
    }
  };
  const prev = new Float32Array(size * size);
  const curr = new Float32Array(size * size);
  paint(prev, center - 1, center - 8);
  paint(curr, center + 2, center - 8);
  paint(prev, center + 24, center + 24);
  paint(curr, center + 24, center + 21);
  const shift = estimateShift(prev, curr, size, 4);
  assert.equal(shift?.dx, 3);
  assert.equal(shift?.dy, 0);
});

test("a featureless echo has no shift", () => {
  const size = 21;
  const prev = new Float32Array(size * size).fill(28);
  const curr = new Float32Array(size * size).fill(30);
  const shift = estimateShift(prev, curr, size, 4);
  assert.equal(shift, null);
});

test("estimateMotion averages consistent 10- and 20-minute shifts", () => {
  const size = 31;
  const frames = [0, 600, 1200].map((offset, index) => {
    const grid = new Float32Array(size * size);
    paint(grid, size, 8 + index * 3, 15, 42);
    return { time: 1_000_000 + offset, grid };
  });
  const motion = estimateMotion(frames, size, 6);
  assert.ok(Math.abs(motion.dxPerMin * 10 - 3) < 0.6);
  assert.ok(Math.abs(motion.dyPerMin) < 0.2);
});
