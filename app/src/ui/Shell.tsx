// Screens outside a running game: title, campaign, skirmish, settings and help.

import { useState } from "preact/hooks";
import { BUILDABLE, CAMPAIGN, KINDS, skirmish, type Difficulty, type MapSize } from "@ebbline/engine";
import type { Controller, Screen } from "../controller.ts";

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function Title({ c }: { c: Controller }) {
  const go = (screen: Screen) => (): void => {
    c.sound.click();
    c.screen.value = screen;
  };
  const saved = c.savedName.value;
  return (
    <div class="screen title">
      <div class="card">
        <h1>Ebbline</h1>
        <p class="lede">Silt is rising from the vents. Build a grid, push it back, cap them all.</p>
        <div class="stack">
          {saved !== "" && (
            <button class="btn primary" onClick={() => { c.resume(); }}>
              Continue <small>{saved}</small>
            </button>
          )}
          <button class={saved === "" ? "btn primary" : "btn"} onClick={go("campaign")}>Campaign</button>
          <button class="btn" onClick={go("skirmish")}>Skirmish</button>
          <button class="btn" onClick={go("help")}>How to play</button>
          <button class="btn" onClick={go("settings")}>Settings</button>
        </div>
      </div>
    </div>
  );
}

export function Campaign({ c }: { c: Controller }) {
  const done = c.progress.value;
  // A mission opens once the one before it is won.
  const open = (index: number): boolean =>
    index === 0 || CAMPAIGN[index - 1]?.id === undefined || (CAMPAIGN[index - 1]?.id ?? "") in done;
  return (
    <div class="screen">
      <div class="card wide">
        <h2>Campaign</h2>
        <ol class="missions">
          {CAMPAIGN.map((level, index) => {
            const best = done[level.id];
            return (
              <li key={level.id}>
                <button
                  class="mission"
                  disabled={!open(index)}
                  onClick={() => { c.start(level); }}
                >
                  <span class="num">{index + 1}</span>
                  <span class="what">
                    <strong>{level.name}</strong>
                    <span>{open(index) ? level.brief : "Win the mission before this one to unlock it."}</span>
                  </span>
                  <span class="best">{best !== undefined ? `Best ${clock(best)}` : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button class="btn" onClick={() => { c.screen.value = "title"; }}>Back</button>
      </div>
    </div>
  );
}

export function Skirmish({ c }: { c: Controller }) {
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 100000)));
  const [size, setSize] = useState<MapSize>("medium");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const value = Number(seed);
  const valid = seed.trim() !== "" && Number.isInteger(value);
  return (
    <div class="screen">
      <div class="card">
        <h2>Skirmish</h2>
        <label class="field">
          <span>Seed</span>
          <input
            type="text"
            inputMode="numeric"
            value={seed}
            onInput={(e) => { setSeed(e.currentTarget.value); }}
          />
        </label>
        <label class="field">
          <span>Map size</span>
          <select value={size} onChange={(e) => { setSize(e.currentTarget.value as MapSize); }}>
            <option value="small">Small, two vents</option>
            <option value="medium">Medium, three vents</option>
            <option value="large">Large, four vents</option>
          </select>
        </label>
        <label class="field">
          <span>Difficulty</span>
          <select value={difficulty} onChange={(e) => { setDifficulty(e.currentTarget.value as Difficulty); }}>
            <option value="easy">Easy, no spitters</option>
            <option value="normal">Normal, one spitter</option>
            <option value="hard">Hard, two spitters</option>
          </select>
        </label>
        <p class="note">The same seed, size and difficulty always give the same map. The address bar holds a link to it once the game starts.</p>
        <div class="row">
          <button class="btn" onClick={() => { c.screen.value = "title"; }}>Back</button>
          <button
            class="btn primary"
            disabled={!valid}
            onClick={() => { c.start(skirmish(value, size, difficulty)); }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsForm({ c }: { c: Controller }) {
  const s = c.settings.value;
  return (
    <div class="settings">
      <label class="field">
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={s.volume}
          onInput={(e) => { c.setSettings({ ...s, volume: Number(e.currentTarget.value) }); }}
        />
      </label>
      <label class="check">
        <input type="checkbox" checked={s.music} onChange={(e) => { c.setSettings({ ...s, music: e.currentTarget.checked }); }} />
        <span>Ambient drone</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={s.edgeScroll} onChange={(e) => { c.setSettings({ ...s, edgeScroll: e.currentTarget.checked }); }} />
        <span>Scroll when the pointer touches the screen edge</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={s.reducedMotion} onChange={(e) => { c.setSettings({ ...s, reducedMotion: e.currentTarget.checked }); }} />
        <span>Reduce flashes and pulsing</span>
      </label>
    </div>
  );
}

export function Help() {
  return (
    <div class="help">
      <p>
        Silt wells up from <b class="silt">vents</b> and flows downhill. It wears down anything it stands on.
        Lose the lander and the mission is lost. Win by building a <b>Cap</b> on every vent.
      </p>
      <h3>The grid</h3>
      <p>
        Energy leaves the lander as packets and travels along grid links. Pylons and Trunks carry packets on;
        everything else must stand within six tiles of one of them. A red dot marks a structure the grid does not reach.
      </p>
      <h3>Capping a vent</h3>
      <p>
        A Cap can only be started when the vent tile is nearly dry, shown by a white ring. While it is being built it
        holds the vent shut, but the pressure builds up: if the Cap is lost, all of it bursts out at once.
      </p>
      <h3>Structures</h3>
      <dl class="roster">
        {BUILDABLE.map((kind) => (
          <div key={kind}>
            <dt>{KINDS[kind].name} <small>{KINDS[kind].cost}</small></dt>
            <dd>{KINDS[kind].blurb}</dd>
          </div>
        ))}
      </dl>
      <h3>Controls</h3>
      <dl class="keys">
        <div><dt>Click, tap</dt><dd>Place with a tool, otherwise select</dd></div>
        <div><dt>Drag</dt><dd>Place a row or paint marks with a tool, otherwise move the map</dd></div>
        <div><dt>Right click, Esc</dt><dd>Put the tool away, deselect, open the menu</dd></div>
        <div><dt>Wheel, pinch</dt><dd>Zoom</dd></div>
        <div><dt>W A S D, arrows</dt><dd>Move the map</dd></div>
        <div><dt>1 to 0, −</dt><dd>Pick a structure from the build bar</dd></div>
        <div><dt>G</dt><dd>Mark ground for Graders</dd></div>
        <div><dt>Space</dt><dd>Pause</dd></div>
        <div><dt>[ ]</dt><dd>Slower, faster</dd></div>
        <div><dt>X</dt><dd>Switch the selected structure off or on</dd></div>
        <div><dt>Delete</dt><dd>Dismantle the selected structure for half its cost</dd></div>
      </dl>
    </div>
  );
}
