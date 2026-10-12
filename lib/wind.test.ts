import assert from "node:assert/strict";
import test from "node:test";
import { describeWind, pickSteeringWind } from "./wind";

test("a wind from the east blows west", () => {
  const wind = describeWind(90, 30);
  assert.equal(wind?.from, "E");
  assert.equal(wind?.bearingDeg, 270);
  assert.equal(wind?.toward, "W");
  assert.equal(wind?.calm, false);
});

test("a wind from the south blows north", () => {
  const wind = describeWind(180, 12.4);
  assert.equal(wind?.from, "S");
  assert.equal(wind?.bearingDeg, 0);
  assert.equal(wind?.toward, "N");
});

test("a light wind is calm", () => {
  assert.equal(describeWind(10, 1)?.calm, true);
  assert.equal(describeWind(10, Number.NaN), null);
});

test("the current hour wins over a later one", () => {
  const now = Date.parse("2026-10-12T10:20:00Z");
  const picked = pickSteeringWind(
    ["2026-10-12T09:00", "2026-10-12T10:00", "2026-10-12T11:00"],
    [20, 31.3, 40],
    [10, 94, 200],
    now,
  );
  assert.equal(picked?.fromDeg, 94);
  assert.equal(picked?.speedKmh, 31.3);
});

test("a missing hour is skipped", () => {
  const now = Date.parse("2026-10-12T10:20:00Z");
  const picked = pickSteeringWind(
    ["2026-10-12T09:00", "2026-10-12T10:00"],
    [18, null],
    [40, null],
    now,
  );
  assert.equal(picked?.fromDeg, 40);
  assert.equal(picked?.speedKmh, 18);
});
