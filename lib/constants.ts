/** RainViewer native zoom. One pixel is about 0.6–1.2 km depending on latitude. */
export const SAMPLE_ZOOM = 7;

/** Odd so the pinned coordinate sits on a single grid cell. */
export const GRID_SIZE = 101;

/** Image pixels between grid cells. 2 keeps a ~60–120 km window inside one coordinate tile. */
export const GRID_STEP = 2;

/** Maximum cell displacement searched across a 10-minute pair. */
export const MAX_SHIFT = 10;

/** Above this is rain rather than drizzle or trace. */
export const RAIN_DBZ = 20;

/** Above this is a heavy downpour. */
export const HEAVY_DBZ = 40;

export const POLL_MS = 3 * 60 * 1000;

/** How far the timeline looks behind the current minute. */
export const PAST_HORIZON_MIN = 60;

/** How far the timeline looks ahead of the current minute. */
export const FUTURE_HORIZON_MIN = 60;
