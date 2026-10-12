import assert from "node:assert/strict";
import test from "node:test";
import {
  frameStepMin,
  mapFramesFromCatalog,
  nearestStopIndex,
  stopFraction,
  timelineStops,
} from "./map-frame";
import type { MapFrame } from "./types";

function past(offsets: number[]): MapFrame[] {
  return offsets.map((offsetMin) => ({
    time: 1_700_000_000 + offsetMin * 60,
    offsetMin,
    path: `/v2/radar/${offsetMin}`,
    kind: "past",
  }));
}

test("observed scans keep their 10 minute spacing", () => {
  const frames = past([-40, -30, -20, -10, 0]);
  assert.equal(frameStepMin(frames), 10);
  const stops = timelineStops(frames);
  assert.deepEqual(
    stops.filter((stop) => stop.kind === "past").map((stop) => stop.offsetMin),
    [-40, -30, -20, -10, 0],
  );
  assert.equal(stops.filter((stop) => stop.kind === "past").at(-1)?.offsetMin, 0);
  assert.equal(stops.at(-1)?.kind, "forecast");
  assert.equal(stops.at(-1)?.offsetMin, 60);
});

test("future steps freeze the latest scan instead of inventing motion", () => {
  const stops = timelineStops(past([-20, -10, 0]));
  const future = stops.filter((stop) => stop.kind === "forecast");
  assert.deepEqual(
    future.map((stop) => stop.offsetMin),
    [10, 20, 30, 40, 50, 60],
  );
  assert.ok(future.every((stop) => stop.path === "/v2/radar/0"));
});

test("published forecast frames extend the slider", () => {
  const frames: MapFrame[] = [
    ...past([-10, 0]),
    { time: 1_700_000_600, offsetMin: 10, path: "/v2/radar/future", kind: "nowcast" },
  ];
  const stops = timelineStops(frames);
  assert.equal(stops.at(-1)?.kind, "nowcast");
  assert.equal(stops.at(-1)?.path, "/v2/radar/future");
  assert.equal(stops.at(-1)?.offsetMin, 10);
});

test("a catalog frame is offset from the clock used to fetch it", () => {
  const frames = mapFramesFromCatalog([{ time: 1_000, path: "/v2/radar/a" }], [], 1_600);
  assert.equal(frames[0]?.offsetMin, -10);
  assert.equal(frames[0]?.kind, "past");
  assert.equal(frames[0]?.path, "/v2/radar/a");
});

test("a time lands on the same fraction as its slider stop", () => {
  const stops = timelineStops(past([-20, -10, 0]));
  assert.equal(stopFraction(stops, stops[0]?.offsetMin ?? 0), 0);
  assert.equal(stopFraction(stops, stops.at(-1)?.offsetMin ?? 0), 1);
  assert.equal(stopFraction(stops, 0), 2 / (stops.length - 1));
  assert.equal(stopFraction(stops, -15), 0.5 / (stops.length - 1));
});

test("the play head snaps to a real stop", () => {
  const stops = timelineStops(past([-20, -10, 0]));
  assert.equal(nearestStopIndex(stops, 4), 2);
  assert.equal(stops[2]?.offsetMin, 0);
});
