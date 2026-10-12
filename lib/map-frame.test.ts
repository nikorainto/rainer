import assert from "node:assert/strict";
import test from "node:test";
import {
  scanAgeMin,
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

test("future steps keep showing the latest scan", () => {
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

test("stops include now and drop scans older than an hour", () => {
  const frames = past([-130, -120, -70, -60, -50, -40, -30, -20, -10, -7]);
  const stops = timelineStops(frames);
  const offsets = stops.map((stop) => stop.offsetMin);
  assert.equal(Math.min(...offsets), -60);
  assert.ok(offsets.includes(0));
  assert.equal(stops.find((stop) => stop.offsetMin === 0)?.path, "/v2/radar/-7");
  assert.ok(!offsets.includes(-70));
  assert.deepEqual(offsets.slice(offsets.indexOf(0)), [0, 10, 20, 30, 40, 50, 60]);
});

test("now sits between a late scan and the next forecast image", () => {
  const frames: MapFrame[] = [
    ...past([-80, -7]),
    { time: 1_700_000_000 + 3 * 60, offsetMin: 3, path: "/v2/radar/future", kind: "nowcast" },
  ];
  const stops = timelineStops(frames);
  assert.deepEqual(
    stops.map((stop) => stop.offsetMin),
    [-7, 0, 3],
  );
  assert.equal(stops[1]?.kind, "past");
  assert.equal(stops[1]?.path, "/v2/radar/-7");
  assert.equal(stops[2]?.kind, "nowcast");
});

test("the current minute reuses the latest scan and reports its age", () => {
  const frames = past([-20, -10]);
  const stops = timelineStops(frames);
  const now = stops.find((stop) => stop.offsetMin === 0);
  const previous = stops.find((stop) => stop.offsetMin === -10);
  const future = stops.find((stop) => stop.offsetMin === 20);
  assert.ok(now && previous && future);
  assert.equal(now.path, "/v2/radar/-10");
  assert.equal(scanAgeMin(previous, frames), 0);
  assert.equal(scanAgeMin(now, frames), 10);
  assert.equal(scanAgeMin(future, frames), 10);
});

test("a scan that already lands on now has no age", () => {
  const frames = past([-10, 0]);
  const now = timelineStops(frames).find((stop) => stop.offsetMin === 0);
  assert.ok(now);
  assert.equal(scanAgeMin(now, frames), 0);
});

test("a published forecast frame does not inherit the scan age", () => {
  const frames: MapFrame[] = [
    ...past([-7]),
    { time: 1_700_000_000 + 3 * 60, offsetMin: 3, path: "/v2/radar/future", kind: "nowcast" },
  ];
  const stops = timelineStops(frames);
  const now = stops.find((stop) => stop.offsetMin === 0);
  const ahead = stops.find((stop) => stop.offsetMin === 3);
  assert.ok(now && ahead);
  assert.equal(scanAgeMin(now, frames), 7);
  assert.equal(scanAgeMin(ahead, frames), 0);
});

test("a scan that lands on a future step is kept once", () => {
  const stops = timelineStops(past([0, 2]));
  const atStep = stops.filter((stop) => stop.offsetMin === 2);
  assert.equal(atStep.length, 1);
  assert.equal(atStep[0]?.kind, "past");
});
