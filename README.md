# Rainer

Live radar at one map pin, for the past hour and the next, drawn from [RainViewer](https://www.rainviewer.com/).

This is not an official forecast or warning. Do not use it for safety decisions.

## Run locally

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Allow location, search for a place, or paste coordinates such as `60.17, 24.94`.

Next.js writes `next-env.d.ts` on the first `dev` or `build`. That file is gitignored.

## Data

- Radar frames and tiles come from the RainViewer public maps feed. Past frames are observed scans. When RainViewer publishes nowcast frames, those are sampled at the pin. When that list is empty, the next hour at the pin is estimated by moving the recent reflectivity field forward. The map keeps showing the latest scan.
- Rain rate uses the Marshall–Palmer relation, Z = 200 R^1.6.
- The arrow is the wind at about 1.5 km from [Open-Meteo](https://open-meteo.com/), pointing where that wind is blowing.
- The basemap is Esri World Dark Gray Canvas.
- Place search uses the public [Photon](https://photon.komoot.io/) service, which is OpenStreetMap data.

RainViewer, Open-Meteo, Esri, and OpenStreetMap require attribution. The credit sits in the panel menu.

## Checks

```bash
bun run verify
```

That runs Biome, the TypeScript check, and the unit tests.

## Deploy

No environment variables. Install with Bun, pinned in `packageManager`. Production runs on Node.js 24, the current LTS (`engines.node` is `24.x`, so Vercel stays on that major). `bun run build` is the production build.

`/api/nowcast` downloads radar images on the server and can run for up to 30 seconds. Successful radar responses can be cached at the edge for about a minute, wind readings for about ten minutes, and place lookups for a day. Each server instance also limits how fast one client can call those routes.

## Limits

- Some coordinates have no radar coverage. The panel says so instead of showing a dry hour.
- RainViewer allows about 100 radar tile requests a minute. A fast play loop can pass that and leave a tile blank. Moving the slider or playing again requests it once more.
- When RainViewer has not published a future image, the map keeps the latest scan through the current minute and the rest of the hour. The pin chart can still move ahead. The panel menu says that future is an estimate.
- Alerts are a local reading of that estimate, not a warning product.
