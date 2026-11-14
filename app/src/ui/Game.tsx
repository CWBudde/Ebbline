// Everything drawn over the map while a game runs.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  BUILDABLE,
  KINDS,
  TICK_HZ,
  find,
  type Kind,
  type Structure,
} from "@ebbline/engine";
import { tileAt } from "../camera.ts";
import type { Controller } from "../controller.ts";
import { groundColor } from "../render/terrain.ts";
import { SPEEDS, type Hud, type Runtime } from "../runtime.ts";
import { Help, SettingsForm, clock } from "./Shell.tsx";

const SLOT_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "−"];

function TopBar({ c, rt }: { c: Controller; rt: Runtime }) {
  const hud = rt.hud.value;
  const share = hud.capacity > 0 ? hud.energy / hud.capacity : 0;
  const net = hud.rateIn - hud.rateOut;
  return (
    <header class="topbar">
      <div class="energy" title="Energy in the bank, and what came in and went out over the last second">
        <div class="meter"><div style={{ width: `${Math.round(share * 100)}%` }} /></div>
        <span class="amount" data-testid="energy">{Math.floor(hud.energy)} / {hud.capacity}</span>
        <span class={net < 0 ? "rate minus" : "rate"}>+{hud.rateIn.toFixed(1)} −{hud.rateOut.toFixed(1)}</span>
      </div>
      <div class="goal" data-testid="goal">
        {hud.remaining >= 0 ? `Hold ${clock(hud.remaining)}` : `Vents capped ${hud.capped} / ${hud.vents}`}
      </div>
      <div class="time" data-testid="time">{clock(hud.seconds)}</div>
      <div class="speeds">
        <button
          class={rt.paused.value ? "chip on" : "chip"}
          aria-pressed={rt.paused.value}
          title="Pause (Space)"
          onClick={() => { rt.paused.value = !rt.paused.value; }}
        >
          {rt.paused.value ? "Paused" : "Pause"}
        </button>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            class={rt.speed.value === speed ? "chip on" : "chip"}
            aria-pressed={rt.speed.value === speed}
            onClick={() => { rt.speed.value = speed; }}
          >
            {speed}×
          </button>
        ))}
        <button class="chip" title="Menu (Esc)" onClick={() => { c.toggleMenu(); }}>Menu</button>
      </div>
    </header>
  );
}

function BuildBar({ c, rt }: { c: Controller; rt: Runtime }) {
  const tool = rt.tool.value;
  const allowed = rt.game.level.allowed;
  const icons = c.icons.value;
  const pick = (kind: Kind) => (): void => {
    c.sound.click();
    rt.selected.value = 0;
    rt.tool.value =
      tool.kind === "build" && tool.structure === kind ? { kind: "none" } : { kind: "build", structure: kind };
  };
  return (
    <nav class="buildbar" aria-label="Build">
      {BUILDABLE.map((kind, slot) =>
        allowed.includes(kind) ? (
          <button
            key={kind}
            class={tool.kind === "build" && tool.structure === kind ? "slot on" : "slot"}
            aria-pressed={tool.kind === "build" && tool.structure === kind}
            data-kind={kind}
            title={KINDS[kind].blurb}
            onClick={pick(kind)}
          >
            {icons[kind] !== undefined ? <img src={icons[kind]} alt="" /> : <span class="swatch" />}
            <span class="name">{KINDS[kind].name}</span>
            <span class="cost">{KINDS[kind].cost}</span>
            <kbd>{SLOT_LABELS[slot]}</kbd>
          </button>
        ) : null,
      )}
      {allowed.includes("grader") && (
        <button
          class={tool.kind === "grade" ? "slot on" : "slot"}
          aria-pressed={tool.kind === "grade"}
          title="Mark ground for Graders to raise or lower"
          onClick={() => {
            c.sound.click();
            rt.tool.value = tool.kind === "grade" ? { kind: "none" } : { kind: "grade", height: 9 };
          }}
        >
          <span class="swatch mark" />
          <span class="name">Mark</span>
          <span class="cost">ground</span>
          <kbd>G</kbd>
        </button>
      )}
    </nav>
  );
}

function status(s: Structure): string {
  if (!Number.isFinite(s.dist)) return "Off the grid: needs a Pylon or Trunk within six tiles";
  if (!s.built) return "Under construction";
  if (!s.active) return "Switched off";
  if (s.health < KINDS[s.kind].cost) return "Damaged, repairing";
  return "Working";
}

/** `hud` is passed only so that the panel refreshes with it, ten times a second. */
function Info({ rt }: { rt: Runtime; hud: Hud }) {
  const [briefing, setBriefing] = useState(true);
  const tool = rt.tool.value;
  const level = rt.game.level;
  const selected = find(rt.game, rt.selected.value);
  if (tool.kind === "build") {
    const def = KINDS[tool.structure];
    return (
      <aside class="info">
        <h3>{def.name} <small>{def.cost} energy</small></h3>
        <p>{def.blurb}</p>
        {def.range > 0 && <p class="dim">Range {def.range}{def.minRange > 0 ? `, not closer than ${def.minRange}` : ""}</p>}
        <p class="dim">Click to place, drag for a row. Right click or Esc puts it away.</p>
      </aside>
    );
  }
  if (tool.kind === "grade") {
    return (
      <aside class="info">
        <h3>Mark ground</h3>
        <p>Pick a target height, then paint tiles. A Grader within eight tiles does the work.</p>
        <div class="heights">
          {Array.from({ length: 10 }, (_, height) => (
            <button
              key={height}
              class={tool.height === height ? "chip on" : "chip"}
              aria-pressed={tool.height === height}
              onClick={() => { rt.tool.value = { kind: "grade", height }; }}
            >
              {height}
            </button>
          ))}
          <button
            class={tool.height === -1 ? "chip on" : "chip"}
            aria-pressed={tool.height === -1}
            onClick={() => { rt.tool.value = { kind: "grade", height: -1 }; }}
          >
            Erase
          </button>
        </div>
      </aside>
    );
  }
  if (selected) {
    const def = KINDS[selected.kind];
    return (
      <aside class="info">
        <h3>{def.name}</h3>
        <p>{def.blurb}</p>
        <p class="dim">{status(selected)}</p>
        <p class="dim">
          Health {Math.ceil(selected.health)} / {def.cost}
          {def.store > 0 ? `, energy ${selected.energy.toFixed(1)} / ${def.store}` : ""}
        </p>
        {selected.kind !== "lander" && (
          <div class="row">
            <button class="chip" onClick={() => { rt.act({ kind: "toggle", id: selected.id }); }}>
              {selected.active ? "Switch off" : "Switch on"} <kbd>X</kbd>
            </button>
            <button class="chip danger" onClick={() => { rt.act({ kind: "dismantle", id: selected.id }); }}>
              Dismantle <kbd>Del</kbd>
            </button>
          </div>
        )}
      </aside>
    );
  }
  if (!briefing) {
    return (
      <aside class="info compact">
        <button class="chip" onClick={() => { setBriefing(true); }}>Briefing</button>
      </aside>
    );
  }
  return (
    <aside class="info">
      <h3>{level.name}</h3>
      <p>{level.brief}</p>
      {level.hints.length > 0 && (
        <ul class="hints">
          {level.hints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
      )}
      <button class="chip" onClick={() => { setBriefing(false); }}>Hide</button>
    </aside>
  );
}

function Minimap({ c, rt }: { c: Controller; rt: Runtime }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hud = rt.hud.value;
  const game = rt.game;
  const scale = Math.max(1, Math.floor(160 / game.w));
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(game.w, game.h);
    for (let i = 0; i < game.height.length; i++) {
      const depth = game.silt[i] ?? 0;
      const h = game.height[i] ?? -1;
      const [r, g, b] = depth >= 0.05 ? [255, 63, 164] : h < 0 ? [10, 16, 19] : groundColor(h);
      image.data.set([r, g, b, 255], i * 4);
    }
    for (const s of game.structures) {
      const half = (KINDS[s.kind].size - 1) / 2;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          image.data.set([95, 227, 255, 255], ((s.y + dy) * game.w + s.x + dx) * 4);
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    const size = c.screenSize();
    const a = tileAt(c.view, 0, 0);
    const b = tileAt(c.view, size.w, size.h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(a.x + 0.5, a.y + 0.5, b.x - a.x, b.y - a.y);
  }, [hud, game, c]);
  const jump = (e: PointerEvent): void => {
    if (e.buttons === 0 && e.type !== "pointerdown") return;
    const box = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    c.lookAt(((e.clientX - box.left) / box.width) * game.w, ((e.clientY - box.top) / box.height) * game.h);
  };
  return (
    <canvas
      ref={ref}
      class="minimap"
      width={game.w}
      height={game.h}
      style={{ width: `${game.w * scale}px`, height: `${game.h * scale}px` }}
      aria-label="Map overview"
      onPointerDown={jump}
      onPointerMove={jump}
    />
  );
}

function PauseMenu({ c }: { c: Controller }) {
  const overlay = c.overlay.value;
  const back = (): void => {
    c.overlay.value = "menu";
  };
  if (overlay === "help") {
    return (
      <div class="veil">
        <div class="card wide"><h2>How to play</h2><Help /><button class="btn" onClick={back}>Back</button></div>
      </div>
    );
  }
  if (overlay === "settings") {
    return (
      <div class="veil">
        <div class="card"><h2>Settings</h2><SettingsForm c={c} /><button class="btn" onClick={back}>Back</button></div>
      </div>
    );
  }
  return (
    <div class="veil">
      <div class="card">
        <h2>Paused</h2>
        <div class="stack">
          <button class="btn primary" onClick={() => { c.toggleMenu(); }}>Resume</button>
          <button class="btn" onClick={() => { c.saveNow(true); }}>Save</button>
          <button class="btn" onClick={() => { c.overlay.value = "help"; }}>How to play</button>
          <button class="btn" onClick={() => { c.overlay.value = "settings"; }}>Settings</button>
          <button class="btn" onClick={() => { c.restart(); }}>Restart mission</button>
          <button class="btn" onClick={() => { c.quit(); }}>Save and quit</button>
        </div>
      </div>
    </div>
  );
}

function EndScreen({ c, rt }: { c: Controller; rt: Runtime }) {
  const won = rt.phase.value === "won";
  const stats = rt.game.stats;
  const next = won ? c.nextLevel() : undefined;
  return (
    <div class="veil">
      <div class="card" data-testid="end">
        <h2>{won ? "Vents sealed" : "Lander lost"}</h2>
        <p class="lede">
          {won
            ? rt.game.level.objective.kind === "survive" ? "You held the line." : "The silt is ebbing away."
            : "The silt reached the lander."}
        </p>
        <dl class="stats">
          <div><dt>Time</dt><dd>{clock(Math.floor(rt.game.tick / TICK_HZ))}{c.newBest.value ? " (new best)" : ""}</dd></div>
          <div><dt>Energy spent</dt><dd>{Math.round(stats.spent)}</dd></div>
          <div><dt>Structures built</dt><dd>{stats.built}</dd></div>
          <div><dt>Structures lost</dt><dd>{stats.lost}</dd></div>
          <div><dt>Silt removed</dt><dd>{Math.round(stats.removed)}</dd></div>
        </dl>
        <div class="stack">
          {next && <button class="btn primary" onClick={() => { c.start(next); }}>Next: {next.name}</button>}
          <button class={next ? "btn" : "btn primary"} onClick={() => { c.restart(); }}>{won ? "Play again" : "Try again"}</button>
          <button class="btn" onClick={() => { c.quit(); }}>Main menu</button>
        </div>
      </div>
    </div>
  );
}

export function Game({ c }: { c: Controller }) {
  const rt = c.runtime.value;
  if (!rt) return null;
  const over = rt.phase.value !== "playing";
  return (
    <div class="hud">
      <TopBar c={c} rt={rt} />
      <div class="side">
        <Info rt={rt} hud={rt.hud.value} />
        <Minimap c={c} rt={rt} />
      </div>
      <BuildBar c={c} rt={rt} />
      {over && <EndScreen c={c} rt={rt} />}
      {!over && c.overlay.value !== "none" && <PauseMenu c={c} />}
    </div>
  );
}

