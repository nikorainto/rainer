import assert from "node:assert/strict";
import test from "node:test";
import { isLatLon, parseCoordinates } from "./coords";

test("coordinates accept a pair inside the valid range", () => {
  assert.deepEqual(parseCoordinates("60.17, 24.94"), { lat: 60.17, lon: 24.94 });
  assert.deepEqual(parseCoordinates("-33.8 151.2"), { lat: -33.8, lon: 151.2 });
  assert.equal(parseCoordinates("Helsinki"), null);
  assert.equal(parseCoordinates("91, 0"), null);
  assert.equal(parseCoordinates("0, 181"), null);
});

test("lat and lon bounds reject non-finite values", () => {
  assert.equal(isLatLon(0, 0), true);
  assert.equal(isLatLon(90, 180), true);
  assert.equal(isLatLon(-90, -180), true);
  assert.equal(isLatLon(Number.NaN, 0), false);
  assert.equal(isLatLon(0, Number.POSITIVE_INFINITY), false);
  assert.equal(isLatLon(90.1, 0), false);
});
