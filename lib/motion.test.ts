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
