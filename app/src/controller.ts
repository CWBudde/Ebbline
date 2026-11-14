// Ties the pieces together: screens, the running game, saving, settings and the frame loop.

import { signal } from "@preact/signals";
import { Application } from "pixi.js";
import {
  BUILDABLE,
  CAMPAIGN,
  find,
  generate,
  load,
  save,
  seconds,
  skirmish,
  type Difficulty,
  type Event,
  type Game,
  type Kind,
  type LevelDef,
  type MapSize,
} from "@ebbline/engine";
import { Sound } from "./audio.ts";
import { TILE, centreOn, clamp, type View } from "./camera.ts";
import { Input } from "./input.ts";
import { drawStructure } from "./render/art.ts";
import { Renderer } from "./render/world.ts";
import { Runtime } from "./runtime.ts";
import { Store, type Settings } from "./storage.ts";

export type Screen = "title" | "campaign" | "skirmish" | "settings" | "help" | "game";
export type Overlay = "none" | "menu" | "help" | "settings";

const AUTOSAVE_MS = 30_000;
const SIZES: readonly MapSize[] = ["small", "medium", "large"];
const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class Controller {
  readonly screen = signal<Screen>("title");
  readonly overlay = signal<Overlay>("none");
  readonly runtime = signal<Runtime | undefined>(undefined);
  readonly notice = signal("");
  readonly store = new Store(localStorageOrNull());
  readonly settings = signal<Settings>(this.store.settings());
  readonly progress = signal<Record<string, number>>(this.store.progress());
  readonly savedName = signal(this.store.saved()?.name ?? "");
  /** Whether the last win beat the stored best time. */
  readonly newBest = signal(false);
  readonly icons = signal<Partial<Record<Kind, string>>>({});
  readonly view: View = { x: 0, y: 0, zoom: 1 };
  readonly sound = new Sound(this.settings.value);
  private readonly app = new Application();
  private renderer: Renderer | undefined;
  private input: Input | undefined;
  private sinceSave = 0;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  async init(stage: HTMLElement): Promise<void> {
    const app = this.app;
    await app.init({
      resizeTo: stage,
      background: 0x070d10,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
    });
    stage.appendChild(app.canvas);
    this.renderer = new Renderer(app);
    this.renderer.load(undefined);
    this.makeIcons();
    this.input = new Input(app.canvas, {
      view: this.view,
      runtime: () => (this.overlay.value === "none" ? this.runtime.value : undefined),
      menu: () => {
        this.toggleMenu();
      },
      overlayOpen: () => this.overlay.value !== "none",
      deny: () => {
        this.sound.deny();
      },
      edgeScroll: () => this.settings.value.edgeScroll,
    });
    app.ticker.add((ticker) => {
      this.frame(ticker.deltaMS);
    });
    window.addEventListener("pointerdown", () => {
      this.sound.unlock();
    });
    window.addEventListener("keydown", () => {
      this.sound.unlock();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.saveNow(false);
    });
    this.openFromUrl();
  }

  private makeIcons(): void {
    const icons: Partial<Record<Kind, string>> = {};
    try {
      for (const kind of BUILDABLE) {
        const drawing = drawStructure(kind, 20);
        const canvas = this.app.renderer.extract.canvas({ target: drawing, resolution: 1 });
        if (canvas.toDataURL) icons[kind] = canvas.toDataURL();
        drawing.destroy();
      }
    } catch {
      // The build bar falls back to plain swatches.
    }
    this.icons.value = icons;
  }

  /** A link with ?seed=…&size=…&difficulty=… opens that skirmish directly. */
  private openFromUrl(): void {
    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get("seed"));
    if (!params.has("seed") || !Number.isInteger(seed)) return;
    const size = SIZES.find((s) => s === params.get("size")) ?? "medium";
    const difficulty = DIFFICULTIES.find((d) => d === params.get("difficulty")) ?? "normal";
    this.start(skirmish(seed, size, difficulty));
  }

  private say(text: string): void {
    this.notice.value = text;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice.value = "";
    }, 2500);
  }

  private frame(elapsedMs: number): void {
    const rt = this.runtime.value;
    if (!rt) return;
    this.input?.frame(elapsedMs);
    const playing = rt.game.phase === "playing";
    // An open menu holds the game.
    if (this.overlay.value === "none") rt.tick(elapsedMs);
    if (playing && rt.game.phase !== "playing") this.finish(rt);
    if (playing && !rt.paused.value) {
      this.sinceSave += elapsedMs;
      if (this.sinceSave >= AUTOSAVE_MS) this.saveNow(false);
    }
    this.renderer?.frame(rt, this.view, performance.now(), this.settings.value.reducedMotion);
  }

  private finish(rt: Runtime): void {
    this.store.clearSaved();
    this.savedName.value = "";
    if (rt.game.phase !== "won") return;
    this.newBest.value = this.store.recordWin(rt.game.level.id, seconds(rt.game));
    this.progress.value = this.store.progress();
  }

  private enter(game: Game): void {
    const rt = new Runtime(game, (event: Event) => {
      this.sound.play(event);
    });
    this.renderer?.load(game);
    const lander = find(game, game.landerId);
    const screen = { w: this.app.screen.width, h: this.app.screen.height };
    // Show roughly thirty tiles across, less on a narrow screen.
    this.view.zoom = Math.max(0.6, Math.min(1.6, screen.w / (30 * TILE)));
    centreOn(this.view, screen, ((lander?.x ?? game.w / 2) + 0.5) * TILE, ((lander?.y ?? game.h / 2) + 0.5) * TILE);
    clamp(this.view, { w: game.w * TILE, h: game.h * TILE }, screen);
    this.sinceSave = 0;
    this.newBest.value = false;
    this.overlay.value = "none";
    this.runtime.value = rt;
    this.screen.value = "game";
  }

  start(level: LevelDef): void {
    this.enter(generate(level));
    const url = new URL(window.location.href);
    url.search = "";
    const match = /^s-(-?\d+)-(\w+)-(\w+)$/.exec(level.id);
    if (match) {
      url.searchParams.set("seed", match[1] ?? "");
      url.searchParams.set("size", match[2] ?? "");
      url.searchParams.set("difficulty", match[3] ?? "");
    }
    window.history.replaceState(null, "", url);
  }

  resume(): void {
    const saved = this.store.saved();
    if (!saved) return;
    try {
      this.enter(load(saved.data));
    } catch {
      this.store.clearSaved();
      this.savedName.value = "";
      this.say("That save could not be read.");
    }
  }

  saveNow(announce: boolean): void {
    const rt = this.runtime.value;
    if (!rt || rt.game.phase !== "playing") return;
    this.sinceSave = 0;
    const ok = this.store.setSaved({
      name: rt.game.level.name,
      seconds: seconds(rt.game),
      when: Date.now(),
      data: save(rt.game),
    });
    if (ok) this.savedName.value = rt.game.level.name;
    if (announce) this.say(ok ? "Game saved." : "Saving is not available in this browser.");
  }

  restart(): void {
    const rt = this.runtime.value;
    if (rt) this.start(rt.game.level);
  }

  /** The campaign mission after the current one, if any. */
  nextLevel(): LevelDef | undefined {
    const id = this.runtime.value?.game.level.id;
    const index = CAMPAIGN.findIndex((l) => l.id === id);
    return index >= 0 ? CAMPAIGN[index + 1] : undefined;
  }

  quit(): void {
    this.saveNow(false);
    this.runtime.value = undefined;
    this.renderer?.load(undefined);
    this.overlay.value = "none";
    this.screen.value = "title";
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState(null, "", url);
  }

  toggleMenu(): void {
    const rt = this.runtime.value;
    if (!rt || rt.game.phase !== "playing") return;
    this.overlay.value = this.overlay.value === "none" ? "menu" : "none";
  }

  setSettings(settings: Settings): void {
    this.settings.value = settings;
    this.store.setSettings(settings);
    this.sound.apply(settings);
  }

  /** Centres the map view on a tile. */
  lookAt(x: number, y: number): void {
    const rt = this.runtime.value;
    if (!rt) return;
    const screen = { w: this.app.screen.width, h: this.app.screen.height };
    centreOn(this.view, screen, (x + 0.5) * TILE, (y + 0.5) * TILE);
    clamp(this.view, { w: rt.game.w * TILE, h: rt.game.h * TILE }, screen);
  }

  screenSize(): { w: number; h: number } {
    return { w: this.app.screen.width, h: this.app.screen.height };
  }
}
