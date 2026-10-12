import assert from "node:assert/strict";
import test from "node:test";
import { classifyDbz, dbzFromRgba, dbzToRainRate } from "./reflectivity";

test("Universal Blue yellow is 35 dBZ", () => {
  assert.equal(dbzFromRgba(255, 238, 0, 255), 35);
  assert.equal(dbzFromRgba(0, 0, 0, 0), 0);
});

test("near-palette pixels still resolve", () => {
  assert.equal(dbzFromRgba(255, 236, 2, 255), 35);
});

test("Marshall–Palmer rates follow the radar bands", () => {
  assert.equal(classifyDbz(0).band, "none");
  assert.equal(classifyDbz(0).rateMmHr, 0);

  const drizzle = classifyDbz(20);
  assert.equal(drizzle.band, "drizzle");
  assert.ok(drizzle.rateMmHr > 0.4 && drizzle.rateMmHr < 1);

  const steady = classifyDbz(30);
  assert.equal(steady.band, "steady");
  assert.ok(steady.rateMmHr > 1 && steady.rateMmHr < 6);

  assert.equal(classifyDbz(40).band, "steady");
  assert.equal(classifyDbz(41).band, "heavy");
  assert.ok(dbzToRainRate(45) > 8);
});
