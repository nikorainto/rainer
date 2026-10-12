export type Motion = {
  dxPerMin: number;
  dyPerMin: number;
  score: number;
};

export type Shift = {
  dx: number;
  dy: number;
  score: number;
};

const ZERO_MOTION: Motion = { dxPerMin: 0, dyPerMin: 0, score: 0 };

export function centerIndex(gridSize: number): number {
  return (gridSize - 1) / 2;
}

export function gridCenter(grid: Float32Array, gridSize: number): number {
  const center = centerIndex(gridSize);
  return grid[center * gridSize + center] ?? 0;
}

export function sampleGrid(
  grid: Float32Array,
  gridSize: number,
  x: number,
  y: number,
): number | null {
  if (x < 0 || y < 0 || x > gridSize - 1 || y > gridSize - 1) return null;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, gridSize - 1);
  const y1 = Math.min(y0 + 1, gridSize - 1);
  const tx = x - x0;
  const ty = y - y0;
  const v00 = grid[y0 * gridSize + x0] ?? 0;
  const v10 = grid[y0 * gridSize + x1] ?? 0;
  const v01 = grid[y1 * gridSize + x0] ?? 0;
  const v11 = grid[y1 * gridSize + x1] ?? 0;
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

/**
 * Displacement of the reflectivity pattern from `prev` to `curr`, in grid cells.
 * Positive dx is east, positive dy is south.
 */
export function estimateShift(
  prev: Float32Array,
  curr: Float32Array,
  gridSize: number,
  maxShift: number,
): Shift | null {
  if (maxShift < 1 || gridSize < maxShift * 2 + 5) return null;

  let best: Shift | null = null;
  let zero: Shift | null = null;
  const margin = maxShift;

  for (let dy = -maxShift; dy <= maxShift; dy += 1) {
    for (let dx = -maxShift; dx <= maxShift; dx += 1) {
      let product = 0;
      let currEnergy = 0;
      let prevEnergy = 0;
      let count = 0;

      for (let y = margin; y < gridSize - margin; y += 1) {
        const currRow = y * gridSize;
        const prevRow = (y - dy) * gridSize;
        for (let x = margin; x < gridSize - margin; x += 1) {
          const a = curr[currRow + x] ?? 0;
          const b = prev[prevRow + (x - dx)] ?? 0;
          if (a < 5 && b < 5) continue;
          product += a * b;
          currEnergy += a * a;
          prevEnergy += b * b;
          count += 1;
        }
      }

      if (count < 12 || currEnergy === 0 || prevEnergy === 0) continue;
      const score = product / Math.sqrt(currEnergy * prevEnergy);
      const shift = { dx, dy, score };
      if (dx === 0 && dy === 0) zero = shift;
      if (!best || score > best.score) best = shift;
    }
  }

  if (!best) return null;
  if (best.dx === 0 && best.dy === 0) return best;
  if (zero && best.score < zero.score + 0.08) return zero;
  return best;
}

export function estimateMotion(
  frames: { time: number; grid: Float32Array }[],
  gridSize: number,
  maxShift: number,
): Motion {
  if (frames.length < 2) return ZERO_MOTION;
  const recent = frames.slice(-3);
  const last = recent[recent.length - 1];
  const previous = recent[recent.length - 2];
  if (!last || !previous) return ZERO_MOTION;

  const dt = (last.time - previous.time) / 60;
  if (!(dt > 0)) return ZERO_MOTION;

  const shift = estimateShift(previous.grid, last.grid, gridSize, maxShift);
  if (!shift) return ZERO_MOTION;

  let dxPerMin = shift.dx / dt;
  let dyPerMin = shift.dy / dt;
  let score = shift.score;

  const older = recent.length >= 3 ? recent[0] : null;
  if (older) {
    const dt2 = (last.time - older.time) / 60;
    const span = dt2 / dt;
    const wider = Math.min(
      Math.floor(gridSize / 2) - 2,
      Math.max(maxShift, Math.ceil(maxShift * span)),
    );
    const shift2 = dt2 > 0 ? estimateShift(older.grid, last.grid, gridSize, wider) : null;
    if (shift2 && dt2 > 0) {
      const dx2 = shift2.dx / dt2;
      const dy2 = shift2.dy / dt2;
      const disagree = Math.hypot(dxPerMin - dx2, dyPerMin - dy2) * 10;
      if (disagree <= 4.5) {
        dxPerMin = (dxPerMin + dx2) / 2;
        dyPerMin = (dyPerMin + dy2) / 2;
        score = Math.max(score, shift2.score);
      }
    }
  }

  if (score < 0.4) return { dxPerMin: 0, dyPerMin: 0, score };
  return { dxPerMin, dyPerMin, score };
}

/** Value that will arrive at the pin. Looks upwind along the motion vector. */
export function advectPoint(
  grid: Float32Array,
  gridSize: number,
  motion: Motion,
  leadMin: number,
): number {
  const center = centerIndex(gridSize);
  if (leadMin <= 0) return grid[center * gridSize + center] ?? 0;
  const x = center - motion.dxPerMin * leadMin;
  const y = center - motion.dyPerMin * leadMin;
  return sampleGrid(grid, gridSize, x, y) ?? 0;
}
