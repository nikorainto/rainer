const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function formatMm(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0.05) return "0.0";
  if (rate >= 10) return rate.toFixed(0);
  return rate.toFixed(1);
}

export function formatKmh(speed: number): string {
  if (!Number.isFinite(speed) || speed < 0) return "0";
  if (speed >= 10) return speed.toFixed(0);
  return speed.toFixed(1);
}

export function compass(bearingDeg: number): string {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 22.5) % 16];
}

export function formatLead(minutes: number): string {
  if (minutes === 0) return "Now";
  const sign = minutes > 0 ? "+" : "−";
  return `${sign}${Math.abs(minutes)} min`;
}

export function formatClock(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
