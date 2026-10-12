export type RainBand = "none" | "drizzle" | "steady" | "heavy";

export type RadarFrameRef = {
  time: number;
  path: string;
};

export type WeatherMaps = {
  host: string;
  generated: number;
  radar: {
    past: RadarFrameRef[];
    nowcast: RadarFrameRef[];
  };
};

export type NowcastSample = {
  time: number;
  offsetMin: number;
  dbz: number;
  rateMmHr: number;
  category: string;
  band: RainBand;
};

export type MapFrame = {
  time: number;
  offsetMin: number;
  path: string;
  kind: "past" | "nowcast";
};

export type NowcastMotion = {
  speedKmh: number;
  bearingDeg: number;
  direction: string;
  /** Native-zoom image pixels per minute. Positive east and south. */
  eastPxPerMin: number;
  southPxPerMin: number;
};

export type NowcastSummary = {
  headline: string;
  detail: string;
  willRainIn30: boolean;
  intensityMmHr: number;
  intensityDbz: number;
  intensityCategory: string;
  intensityBand: RainBand;
  at30MmHr: number;
  at30Category: string;
  minutesUntilRain: number | null;
  rainingNow: boolean;
  rateNow: number;
  dbzNow: number;
  categoryNow: string;
  bandNow: RainBand;
};

export type NowcastOk = {
  ok: true;
  evaluatedAt: number;
  coverage: boolean;
  host: string;
  source: "rainviewer-nowcast" | "motion-vector";
  scanTime: number;
  scanAgeMin: number;
  windowKm: number;
  motion: NowcastMotion | null;
  samples: NowcastSample[];
  mapFrames: MapFrame[];
  summary: NowcastSummary;
  signals: {
    immediate: boolean;
    dissipated: boolean;
  };
  diagnostics: {
    echoPixels: number;
    framesUsed: number;
  };
};

export type NowcastResponse = NowcastOk | { ok: false; error: string };

export type FrameCatalog = {
  ok: true;
  host: string;
  past: RadarFrameRef[];
  nowcast: RadarFrameRef[];
};
