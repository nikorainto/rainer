/** Smoothed Universal Blue tiles for the map loop. Sampling uses the unsmoothed tiles. */
export function radarTileUrl(host: string, path: string): string | null {
  const origin = rainViewerOrigin(host);
  if (!origin || !isRadarFramePath(path)) return null;
  return `${origin}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/** RainViewer tile hosts only. Rejects lookalike domains and extra URL parts. */
export function rainViewerOrigin(host: string): string | null {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.port || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  const hostname = url.hostname.toLowerCase();
  const allowed = hostname === "rainviewer.com" || hostname.endsWith(".rainviewer.com");
  return allowed ? url.origin : null;
}

export function isRadarFramePath(path: string): boolean {
  return /^\/v2\/radar\/[A-Za-z0-9_-]+$/.test(path);
}
