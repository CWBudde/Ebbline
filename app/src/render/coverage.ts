// The tiles the finished power grid reaches: where a structure can stand and be supplied now.

import { KINDS, LINK_RANGE, type Game } from "@ebbline/engine";

/** A key that changes whenever the connectors of the grid do. */
export function coverageKey(game: Game): string {
  let key = "";
  for (const s of game.structures) {
    if (s.built && KINDS[s.kind].connector) key += `${String(s.id)}:${String(s.x)},${String(s.y)};`;
  }
  return key;
}

/** One byte per tile: 1 where a built lander, Pylon or Trunk is within link range. */
export function gridCoverage(game: Game): Uint8Array {
  const covered = new Uint8Array(game.w * game.h);
  for (const s of game.structures) {
    if (!s.built || !KINDS[s.kind].connector) continue;
    for (let dy = -LINK_RANGE; dy <= LINK_RANGE; dy++) {
      const y = s.y + dy;
      if (y < 0 || y >= game.h) continue;
      for (let dx = -LINK_RANGE; dx <= LINK_RANGE; dx++) {
        const x = s.x + dx;
        if (x < 0 || x >= game.w) continue;
        // The same measure the engine links by: the distance between tile positions.
        if (Math.hypot(dx, dy) <= LINK_RANGE) covered[y * game.w + x] = 1;
      }
    }
  }
  return covered;
}
