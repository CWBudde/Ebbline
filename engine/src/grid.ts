// The power grid: which structures link, and the cheapest way from the lander to each.

import {
  KINDS,
  LINK_RANGE,
  TRUNK_RANGE,
  type Game,
  type Structure,
} from "./state.ts";

/** Packet speed in tiles per tick on an ordinary link; trunk-to-trunk links run twice as fast. */
export const PACKET_SPEED = 0.3;

export function isTrunkLink(a: Structure, b: Structure): boolean {
  return a.kind === "trunk" && b.kind === "trunk";
}

/** Length of the link between two structures, or 0 if they do not link. */
export function linkLength(a: Structure, b: Structure): number {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (isTrunkLink(a, b)) return d <= TRUNK_RANGE ? d : 0;
  if (!KINDS[a.kind].connector && !KINDS[b.kind].connector) return 0;
  return d <= LINK_RANGE ? d : 0;
}

/** Whether a structure placed here would link to a built or planned connector. */
export function reaches(game: Game, kind: Structure["kind"], x: number, y: number): boolean {
  const probe = { kind, x, y } as Structure;
  return game.structures.some(
    (s) => KINDS[s.kind].connector && linkLength(probe, s) > 0,
  );
}

/**
 * Recomputes every structure's distance and parent toward the lander, and the link list.
 * Packets pass only through built connectors; anything may be the end of a route.
 */
export function rebuild(game: Game): void {
  const nodes = game.structures;
  for (const s of nodes) {
    s.dist = s.id === game.landerId ? 0 : Infinity;
    s.parent = 0;
  }
  const open = new Set(nodes);
  for (;;) {
    let u: Structure | undefined;
    for (const s of open) {
      if (!u || s.dist < u.dist) u = s;
    }
    if (!u || !Number.isFinite(u.dist)) break;
    open.delete(u);
    if (!u.built || !KINDS[u.kind].connector) continue;
    for (const v of open) {
      const length = linkLength(u, v);
      if (length === 0) continue;
      const cost = u.dist + (isTrunkLink(u, v) ? length / 2 : length);
      if (cost < v.dist) {
        v.dist = cost;
        v.parent = u.id;
      }
    }
  }
  const links: number[] = [];
  for (let a = 0; a < nodes.length; a++) {
    const s = nodes[a];
    if (!s) continue;
    if (!KINDS[s.kind].connector) {
      if (s.parent !== 0) links.push(s.id, s.parent);
      continue;
    }
    for (let b = a + 1; b < nodes.length; b++) {
      const t = nodes[b];
      if (t && KINDS[t.kind].connector && linkLength(s, t) > 0) {
        links.push(s.id, t.id);
      }
    }
  }
  game.links = links;
  game.gridDirty = false;
}
