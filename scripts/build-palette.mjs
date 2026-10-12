import fs from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("usage: node scripts/build-palette.mjs <palette.csv>");
  process.exit(1);
}
const text = fs.readFileSync(csvPath, "utf8");
const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
const entries = [];
const seen = new Set();
let started = false;

for (const line of lines.slice(1)) {
  const cols = line.split(",");
  const dbz = Number(cols[0]);
  if (!Number.isFinite(dbz)) continue;
  if (started && dbz === -32) break;
  started = true;
  const hex = (cols[3] ?? "").trim().toLowerCase();
  if (!/^#[0-9a-f]{8}$/.test(hex)) continue;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const a = Number.parseInt(hex.slice(7, 9), 16);
  if (a === 0) continue;
  const key = `${r},${g},${b},${a}`;
  if (seen.has(key)) continue;
  seen.add(key);
  entries.push([dbz, r, g, b, a]);
}

const body = entries.map((entry) => `  [${entry.join(", ")}],`).join("\n");
const src = `/** RainViewer Universal Blue (color scheme 2), rain palette. Duplicate RGBA keeps the lowest dBZ. */
export const UNIVERSAL_BLUE: readonly (readonly [number, number, number, number, number])[] = [
${body}
];
`;

fs.mkdirSync("lib", { recursive: true });
fs.writeFileSync("lib/palette.ts", src);
console.log(`wrote ${entries.length} colors`);
