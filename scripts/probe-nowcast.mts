/** Manual live check against RainViewer. Not part of `bun run test`. */
import { computeNowcast } from "../lib/server/radar";

const points = [
  { name: "alaska", lat: 61.4151, lon: -146.1786 },
  { name: "london", lat: 51.5074, lon: -0.1278 },
];

for (const point of points) {
  const started = Date.now();
  const result = await computeNowcast(point.lat, point.lon);
  console.log(
    JSON.stringify({
      name: point.name,
      ms: Date.now() - started,
      coverage: result.coverage,
      source: result.source,
      headline: result.summary.headline,
      willRainIn30: result.summary.willRainIn30,
      intensity: result.summary.intensityMmHr,
      dbzNow: result.summary.dbzNow,
      category: result.summary.categoryNow,
      echoPixels: result.diagnostics.echoPixels,
      frames: result.diagnostics.framesUsed,
      immediate: result.signals.immediate,
      dissipated: result.signals.dissipated,
      motion: result.motion,
      scanAgeMin: result.scanAgeMin,
    }),
  );
}
