import type { PNG } from "pngjs";
import { GRID_SIZE, GRID_STEP } from "@/lib/constants";
import { dbzFromRgba } from "@/lib/reflectivity";

export function dbzGridFromPng(png: PNG, gridSize = GRID_SIZE, step = GRID_STEP): Float32Array {
  const grid = new Float32Array(gridSize * gridSize);
  const originX = (png.width - 1) / 2;
  const originY = (png.height - 1) / 2;
  const half = (gridSize - 1) / 2;

  for (let gy = 0; gy < gridSize; gy += 1) {
    const py = Math.round(originY + (gy - half) * step);
    for (let gx = 0; gx < gridSize; gx += 1) {
      const px = Math.round(originX + (gx - half) * step);
      grid[gy * gridSize + gx] = readDbz(png, px, py);
    }
  }
  return grid;
}

export function centerDbzFromPng(png: PNG): number {
  const px = Math.round((png.width - 1) / 2);
  const py = Math.round((png.height - 1) / 2);
  return readDbz(png, px, py);
}

/** Transparent coverage pixels mean radar exists. Opaque black means it does not. */
export function hasRadarCoverage(png: PNG): boolean {
  const samples: Array<[number, number]> = [
    [0, 0],
    [8, 0],
    [-8, 0],
    [0, 8],
    [0, -8],
  ];
  const cx = Math.round((png.width - 1) / 2);
  const cy = Math.round((png.height - 1) / 2);
  let blocked = 0;
  for (const [dx, dy] of samples) {
    const px = cx + dx;
    const py = cy + dy;
    if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
    const index = (py * png.width + px) * 4;
    const r = png.data[index] ?? 0;
    const g = png.data[index + 1] ?? 0;
    const b = png.data[index + 2] ?? 0;
    const a = png.data[index + 3] ?? 0;
    if (a > 200 && r < 40 && g < 40 && b < 40) blocked += 1;
  }
  return blocked < 3;
}

function readDbz(png: PNG, px: number, py: number): number {
  if (px < 0 || py < 0 || px >= png.width || py >= png.height) return 0;
  const index = (py * png.width + px) * 4;
  return dbzFromRgba(
    png.data[index] ?? 0,
    png.data[index + 1] ?? 0,
    png.data[index + 2] ?? 0,
    png.data[index + 3] ?? 0,
  );
}
