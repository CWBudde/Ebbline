// Draws the map: baked ground, the silt texture, structure sprites and a per-frame overlay.

import { Container, Graphics, Sprite, Texture, type Application } from "pixi.js";
import {
  BUILDABLE,
  KINDS,
  LINK_RANGE,
  globAt,
  linkLength,
  placeError,
  ventDry,
  type Game,
  type Kind,
  type Structure,
} from "@ebbline/engine";
import { TILE, type View } from "../camera.ts";
import type { Runtime } from "../runtime.ts";
import { ACCENT, COLORS, drawStructure } from "./art.ts";
import { BAKE, bakeTerrain, paintSilt, rebakeTile } from "./terrain.ts";

const centre = (tile: number): number => (tile + 0.5) * TILE;

export class Renderer {
  readonly world = new Container();
  private readonly ground = new Sprite();
  private readonly silt = new Sprite();
  private readonly features = new Graphics();
  private readonly under = new Graphics();
  private readonly sprites = new Container();
  private readonly ghost = new Sprite();
  private readonly over = new Graphics();
  private readonly textures = new Map<Kind, Texture>();
  private readonly byId = new Map<number, Sprite>();
  private groundCanvas: HTMLCanvasElement | undefined;
  private siltCanvas: HTMLCanvasElement | undefined;
  private siltImage: ImageData | undefined;
  private game: Game | undefined;
  private paintedTick = -1;

  constructor(app: Application) {
    for (const kind of ["lander", ...BUILDABLE] as const) {
      const drawing = drawStructure(kind, TILE);
      this.textures.set(
        kind,
        app.renderer.generateTexture({ target: drawing, resolution: 1, antialias: true }),
      );
      drawing.destroy();
    }
    this.ghost.anchor.set(0.5);
    this.ghost.alpha = 0.55;
    this.world.addChild(
      this.ground,
      this.features,
      this.silt,
      this.under,
      this.sprites,
      this.ghost,
      this.over,
    );
    app.stage.addChild(this.world);
  }

  /** Switches to a new game, or to none. */
  load(game: Game | undefined): void {
    this.game = game;
    this.world.visible = game !== undefined;
    for (const sprite of this.byId.values()) sprite.destroy();
    this.byId.clear();
    this.paintedTick = -1;
    if (!game) return;
    this.groundCanvas = bakeTerrain(game);
    this.ground.texture.destroy(true);
    this.ground.texture = Texture.from(this.groundCanvas);
    this.ground.scale.set(TILE / BAKE);
    this.siltCanvas = document.createElement("canvas");
    this.siltCanvas.width = game.w;
    this.siltCanvas.height = game.h;
    this.siltImage = new ImageData(game.w, game.h);
    this.silt.texture.destroy(true);
    this.silt.texture = Texture.from(this.siltCanvas);
    this.silt.texture.source.scaleMode = "linear";
    this.silt.scale.set(TILE);
    this.features.clear();
    for (let i = 0; i < game.lode.length; i++) {
      if (game.lode[i] !== 1) continue;
      const x = centre(i % game.w);
      const y = centre(Math.floor(i / game.w));
      const r = TILE * 0.42;
      this.features
        .poly([x, y - r, x + r, y, x, y + r, x - r, y])
        .fill({ color: COLORS.economy, alpha: 0.28 })
        .stroke({ width: 2, color: COLORS.economy, alpha: 0.9 });
      this.features.circle(x, y, TILE * 0.1).fill(COLORS.economy);
    }
  }

  private syncSprites(game: Game): void {
    const alive = new Set<number>();
    for (const s of game.structures) {
      alive.add(s.id);
      let sprite = this.byId.get(s.id);
      if (!sprite) {
        sprite = new Sprite(this.textures.get(s.kind) ?? Texture.EMPTY);
        sprite.anchor.set(0.5);
        sprite.scale.set(0.5);
        sprite.position.set(centre(s.x), centre(s.y));
        this.sprites.addChild(sprite);
        this.byId.set(s.id, sprite);
      }
      sprite.alpha = s.built ? 1 : 0.4 + 0.3 * (s.health / KINDS[s.kind].cost);
      sprite.tint = s.active ? 0xffffff : 0x7d8a90;
    }
    for (const [id, sprite] of this.byId) {
      if (alive.has(id)) continue;
      sprite.destroy();
      this.byId.delete(id);
    }
  }

  frame(rt: Runtime, view: View, now: number, calm: boolean): void {
    const game = this.game;
    if (!game || game !== rt.game) return;
    this.world.scale.set(view.zoom);
    this.world.position.set(-view.x * view.zoom, -view.y * view.zoom);
    const px = 1 / view.zoom;

    if (rt.regraded.length > 0 && this.groundCanvas) {
      for (const tile of rt.regraded) rebakeTile(this.groundCanvas, game, tile);
      rt.regraded = [];
      this.ground.texture.source.update();
    }
    if (this.paintedTick !== game.tick && this.siltCanvas && this.siltImage) {
      this.paintedTick = game.tick;
      paintSilt(this.siltImage, game.silt);
      this.siltCanvas.getContext("2d")?.putImageData(this.siltImage, 0, 0);
      this.silt.texture.source.update();
    }
    this.syncSprites(game);

    const byId = new Map<number, Structure>();
    for (const s of game.structures) byId.set(s.id, s);
    const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(now / 300);

    // Below the structures: links, fields and ranges.
    const under = this.under.clear();
    for (let n = 0; n < game.links.length; n += 2) {
      const a = byId.get(game.links[n] ?? 0);
      const b = byId.get(game.links[n + 1] ?? 0);
      if (!a || !b) continue;
      const live = a.built && b.built;
      under
        .moveTo(centre(a.x), centre(a.y))
        .lineTo(centre(b.x), centre(b.y))
        .stroke({ width: Math.max(1.5, 2 * px), color: COLORS.grid, alpha: live ? 0.55 : 0.2 });
    }
    for (const s of game.structures) {
      if (s.kind === "baffle" && s.built && s.active && s.energy > 0) {
        under
          .circle(centre(s.x), centre(s.y), (KINDS.baffle.range + 0.5) * TILE)
          .fill({ color: COLORS.utility, alpha: 0.07 })
          .stroke({ width: 2 * px, color: COLORS.utility, alpha: 0.35 });
      }
    }
    for (let i = 0; i < game.mark.length; i++) {
      const mark = game.mark[i] ?? -1;
      if (mark < 0) continue;
      const raise = mark > (game.height[i] ?? 0);
      const x = (i % game.w) * TILE;
      const y = Math.floor(i / game.w) * TILE;
      under
        .rect(x + 2, y + 2, TILE - 4, TILE - 4)
        .fill({ color: raise ? COLORS.utility : COLORS.grid, alpha: 0.22 })
        .stroke({ width: 1.5, color: raise ? COLORS.utility : COLORS.grid, alpha: 0.9 });
    }
    for (const vent of game.vents) {
      if (vent.capped) continue;
      const x = centre(vent.x);
      const y = centre(vent.y);
      under.circle(x, y, TILE * (0.55 + 0.25 * pulse)).stroke({
        width: 3,
        color: ventDry(game, vent) ? 0xffffff : COLORS.silt,
        alpha: 0.9,
      });
      under.circle(x, y, TILE * 0.25).fill(COLORS.silt);
      if (vent.pressure > 0) {
        under.circle(x, y, TILE * (1 + Math.min(2, vent.pressure / 20))).stroke({
          width: 2,
          color: COLORS.bad,
          alpha: 0.5 + 0.4 * pulse,
        });
      }
    }
    for (const spitter of game.spitters) {
      const x = centre(spitter.x);
      const y = centre(spitter.y);
      const points: number[] = [];
      for (let n = 0; n < 10; n++) {
        const a = (n / 10) * Math.PI * 2;
        const r = TILE * (n % 2 === 0 ? 0.75 : 0.35);
        points.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      under.poly(points).fill(0x2a0f24).stroke({ width: 2, color: COLORS.silt });
      under.circle(x, y, TILE * 0.18).fill(COLORS.silt);
    }

    // Above the structures: status, packets, projectiles, effects and the tool preview.
    const over = this.over.clear();
    for (const s of game.structures) {
      const def = KINDS[s.kind];
      const x = centre(s.x);
      const y = centre(s.y);
      const half = (def.size * TILE) / 2;
      const bar = (row: number, share: number, color: number): void => {
        const top = y + half - 5 - row * 4;
        over.rect(x - half + 2, top, (half * 2 - 4), 3).fill({ color: 0x000000, alpha: 0.6 });
        over.rect(x - half + 2, top, (half * 2 - 4) * Math.max(0, Math.min(1, share)), 3).fill(color);
      };
      if (s.health < def.cost) bar(0, s.health / def.cost, s.built ? COLORS.bad : 0xffffff);
      if (s.built && def.store > 0 && s.energy < def.store * 0.75) {
        bar(s.health < def.cost ? 1 : 0, s.energy / def.store, COLORS.economy);
      }
      if (!Number.isFinite(s.dist) && pulse > 0.4) {
        over.circle(x + half - 4, y - half + 4, 4).fill(COLORS.bad);
      }
    }
    for (const p of game.packets) {
      const a = p.tiles[p.seg] ?? 0;
      const b = p.tiles[p.seg + 1] ?? a;
      const ax = centre(a % game.w);
      const ay = centre(Math.floor(a / game.w));
      const bx = centre(b % game.w);
      const by = centre(Math.floor(b / game.w));
      over
        .circle(ax + (bx - ax) * p.t, ay + (by - ay) * p.t, 3.2)
        .fill(p.kind === "build" ? 0xe9fbff : COLORS.economy);
    }
    for (const shell of game.shells) {
      const f = shell.t / shell.duration;
      const span = Math.hypot(shell.tx - shell.sx, shell.ty - shell.sy);
      const x = centre(shell.sx + (shell.tx - shell.sx) * f);
      const y = centre(shell.sy + (shell.ty - shell.sy) * f);
      const lift = Math.sin(Math.PI * f) * span * TILE * 0.3;
      over.circle(x, y, 3).fill({ color: 0x000000, alpha: 0.35 });
      over.circle(x, y - lift, 4.5).fill(COLORS.weapon);
    }
    for (const glob of game.globs) {
      const p = globAt(glob);
      const tx = centre(glob.tx);
      const ty = centre(glob.ty);
      over.circle(tx, ty, TILE * (1.6 + 0.3 * pulse)).stroke({ width: 2.5, color: COLORS.bad, alpha: 0.9 });
      over.moveTo(tx - 8, ty).lineTo(tx + 8, ty).moveTo(tx, ty - 8).lineTo(tx, ty + 8).stroke({ width: 2, color: COLORS.bad });
      over.circle(centre(p.x), centre(p.y), TILE * (0.3 + 0.12 * glob.hp)).fill(COLORS.silt).stroke({ width: 2, color: 0xffd0ea });
    }
    for (const fx of rt.fx) {
      const f = fx.age / fx.life;
      const x = centre(fx.x);
      const y = centre(fx.y);
      if (fx.kind === "beam") {
        over.moveTo(x, y).lineTo(centre(fx.x2), centre(fx.y2)).stroke({ width: 2.5, color: fx.color, alpha: 1 - f });
        over.circle(centre(fx.x2), centre(fx.y2), 4 + 6 * f).fill({ color: fx.color, alpha: 0.6 * (1 - f) });
      } else if (fx.kind === "ring") {
        over.circle(x, y, fx.radius * TILE * (calm ? 1 : 0.3 + 0.7 * f)).stroke({ width: 3, color: fx.color, alpha: 1 - f });
      } else if (!calm) {
        over.circle(x, y, fx.radius * TILE).fill({ color: fx.color, alpha: 0.5 * (1 - f) });
      }
    }

    const selected = byId.get(rt.selected.value);
    if (selected) {
      const def = KINDS[selected.kind];
      const x = centre(selected.x);
      const y = centre(selected.y);
      over.circle(x, y, def.size * TILE * 0.72).stroke({ width: 2, color: 0xffffff });
      if (def.range > 0) this.range(over, x, y, def.range, def.minRange, ACCENT[selected.kind]);
    }

    const tool = rt.tool.value;
    const hover = rt.hover;
    this.ghost.visible = false;
    if (hover && tool.kind === "build") {
      const def = KINDS[tool.structure];
      const error = placeError(game, tool.structure, hover.x, hover.y);
      const x = centre(hover.x);
      const y = centre(hover.y);
      const probe = { kind: tool.structure, x: hover.x, y: hover.y } as Structure;
      let linked = false;
      for (const s of game.structures) {
        if (!KINDS[s.kind].connector && !def.connector) continue;
        if (linkLength(probe, s) === 0) continue;
        if (KINDS[s.kind].connector) linked = true;
        over.moveTo(x, y).lineTo(centre(s.x), centre(s.y)).stroke({ width: 2, color: COLORS.grid, alpha: 0.5 });
      }
      const ok = error === null && linked;
      this.ghost.visible = true;
      this.ghost.texture = this.textures.get(tool.structure) ?? Texture.EMPTY;
      this.ghost.scale.set(0.5);
      this.ghost.position.set(x, y);
      this.ghost.tint = error === null ? 0xffffff : COLORS.bad;
      over.rect(hover.x * TILE, hover.y * TILE, TILE, TILE).stroke({
        width: 2,
        color: ok ? COLORS.utility : error === null ? COLORS.economy : COLORS.bad,
      });
      if (def.range > 0) this.range(over, x, y, def.range, def.minRange, ACCENT[tool.structure]);
      else if (def.connector) this.range(over, x, y, LINK_RANGE, 0, COLORS.grid);
    } else if (hover && tool.kind === "grade") {
      over.rect(hover.x * TILE, hover.y * TILE, TILE, TILE).stroke({ width: 2, color: COLORS.utility });
    }
  }

  private range(g: Graphics, x: number, y: number, range: number, min: number, color: number): void {
    g.circle(x, y, (range + 0.5) * TILE)
      .fill({ color, alpha: 0.05 })
      .stroke({ width: 2, color, alpha: 0.6 });
    if (min > 0) g.circle(x, y, min * TILE).stroke({ width: 1.5, color, alpha: 0.4 });
  }
}
