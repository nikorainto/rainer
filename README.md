# Rainer

A 30–60 minute rain estimate for one map pin, drawn from live [RainViewer](https://www.rainviewer.com/) radar.

This is not an official forecast or warning. Do not use it for safety decisions.

## Run locally

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Allow location, search for a place, or paste coordinates such as `60.17, 24.94`.

Next.js writes `next-env.d.ts` on the first `dev` or `build`. That file is gitignored.

## Data

- Radar frames and tiles come from the RainViewer public maps feed. Past frames are observed scans. When RainViewer publishes nowcast frames, those are sampled at the pin. When that list is empty, the next hour is estimated by moving the recent reflectivity field forward.
- Rain rate uses the Marshall–Palmer relation, Z = 200 R^1.6.
- The basemap is Esri World Dark Gray Canvas.
- Place search uses the public [Photon](https://photon.komoot.io/) service, which is OpenStreetMap data.

RainViewer, Esri, and OpenStreetMap require attribution. The map shows it.

## Checks

```bash
bun run verify
```

That runs Biome, the TypeScript check, and the unit tests.

## Deploy

No environment variables. Install with Bun, as set in `packageManager`. Next.js 16 needs Node.js 20.9 or newer, which is what Vercel runs. `bun run build` is the production build.

`/api/nowcast` downloads radar images on the server and can run for up to 30 seconds. Successful radar responses can be cached at the edge for about a minute, and place lookups for a day. Each server instance also limits how fast one client can call those routes.

## Limits

- Some coordinates have no radar coverage. The panel says so instead of showing a dry hour.
- When RainViewer has not published a future image, later map frames keep the latest scan in place. The pin chart can still move ahead, and it is marked as an estimate.
- Alerts are a local reading of that estimate, not a warning product.
