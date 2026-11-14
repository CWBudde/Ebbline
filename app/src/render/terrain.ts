// The ground, baked into one canvas: height-banded colours with lit and shadowed edges.

import { ROCK, type Game } from "@ebbline/engine";

/** Canvas pixels per tile. */
export const BAKE = 16;

const STOPS: readonly (readonly [number, number, number, number])[] = [
  [0, 0x13, 0x22, 0x2b],
  [3, 0x2a, 0x47, 0x49],
  [6, 0x5a, 0x78, 0x61],
  [9, 0xb9, 0xc0, 0x96],
];

/** The colour of a terrain height as [r, g, b]. */
export function groundColor(height: number): [number, number, number] {
  let a = STOPS[0] ?? [0, 0, 0, 0];
  let b = STOPS[STOPS.length - 1] ?? a;
  for (let n = 0; n < STOPS.length - 1; n++) {
    const lo = STOPS[n];
    const hi = STOPS[n + 1];
    if (lo && hi && height >= lo[0] && height <= hi[0]) {
      a = lo;
      b = hi;
    }
  }
  const t = b[0] === a[0] ? 0 : (height - a[0]) / (b[0] - a[0]);
  return [
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

function drawTile(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number): void {
  const at = (tx: number, ty: number): number =>
    tx < 0 || ty < 0 || tx >= game.w || ty >= game.h
      ? ROCK
      : (game.height[ty * game.w + tx] ?? ROCK);
  const h = at(x, y);
  const px = x * BAKE;
  const py = y * BAKE;
  if (h === ROCK) {
    ctx.fillStyle = "#0a1013";
    ctx.fillRect(px, py, BAKE, BAKE);
    ctx.strokeStyle = "#1a252b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = -BAKE; d < BAKE; d += 5) {
      ctx.moveTo(px + Math.max(0, d), py + Math.max(0, -d));
      ctx.lineTo(px + Math.min(BAKE, d + BAKE), py + Math.min(BAKE, BAKE - d));
    }
    ctx.stroke();
    return;
  }
  const [r, g, b] = groundColor(h);
  // A fixed per-tile grain keeps large plateaus from looking flat.
  const grain = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 7 - 3;
  ctx.fillStyle = `rgb(${r + grain},${g + grain},${b + grain})`;
  ctx.fillRect(px, py, BAKE, BAKE);
  const north = at(x, y - 1);
  const west = at(x - 1, y);
  const south = at(x, y + 1);
  const east = at(x + 1, y);
  // Light comes from the north-west.
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  if (north !== ROCK && north < h) ctx.fillRect(px, py, BAKE, 2);
  if (west !== ROCK && west < h) ctx.fillRect(px, py, 2, BAKE);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  if (north > h) ctx.fillRect(px, py, BAKE, Math.min(5, 2 + (north - h)));
  if (west > h) ctx.fillRect(px, py, Math.min(5, 2 + (west - h)), BAKE);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  if (south !== ROCK && south < h) ctx.fillRect(px, py + BAKE - 2, BAKE, 2);
  if (east !== ROCK && east < h) ctx.fillRect(px + BAKE - 2, py, 2, BAKE);
}

export function bakeTerrain(game: Game): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = game.w * BAKE;
  canvas.height = game.h * BAKE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    for (let y = 0; y < game.h; y++) {
      for (let x = 0; x < game.w; x++) drawTile(ctx, game, x, y);
    }
  }
  return canvas;
}

/** Redraws a tile and its four neighbours after the ground changed. */
export function rebakeTile(canvas: HTMLCanvasElement, game: Game, tile: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const x = tile % game.w;
  const y = Math.floor(tile / game.w);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const tx = x + dx;
    const ty = y + dy;
    if (tx >= 0 && ty >= 0 && tx < game.w && ty < game.h) drawTile(ctx, game, tx, ty);
  }
}

/** Paints the silt depths into an image, one pixel per tile. */
export function paintSilt(image: ImageData, silt: Float32Array): void {
  const data = image.data;
  for (let i = 0; i < silt.length; i++) {
    const depth = silt[i] ?? 0;
    const o = i * 4;
    if (depth < 0.03) {
      data[o + 3] = 0;
      continue;
    }
    // Violet shallows, magenta pools, pale pink depths.
    const t = Math.min(1, depth / 5);
    const mid = Math.min(1, t * 2.5);
    const top = Math.max(0, (t - 0.4) / 0.6);
    data[o] = 122 + (255 - 122) * mid;
    data[o + 1] = 44 + (63 - 44) * mid + (208 - 63) * top;
    data[o + 2] = 255 + (164 - 255) * mid + (234 - 164) * top;
    data[o + 3] = Math.min(240, 105 + depth * 110);
  }
}
