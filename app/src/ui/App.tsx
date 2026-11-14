import type { Controller } from "../controller.ts";
import { Game } from "./Game.tsx";
import { Campaign, Help, SettingsForm, Skirmish, Title } from "./Shell.tsx";

export function App({ c }: { c: Controller }) {
  const screen = c.screen.value;
  const back = (): void => {
    c.screen.value = "title";
  };
  return (
    <>
      {screen === "title" && <Title c={c} />}
      {screen === "campaign" && <Campaign c={c} />}
      {screen === "skirmish" && <Skirmish c={c} />}
      {screen === "settings" && (
        <div class="screen">
          <div class="card">
            <h2>Settings</h2>
            <SettingsForm c={c} />
            <button class="btn" onClick={back}>Back</button>
          </div>
        </div>
      )}
      {screen === "help" && (
        <div class="screen">
          <div class="card wide">
            <h2>How to play</h2>
            <Help />
            <button class="btn" onClick={back}>Back</button>
          </div>
        </div>
      )}
      {screen === "game" && <Game c={c} />}
      {c.notice.value !== "" && <div class="toast" role="status">{c.notice.value}</div>}
    </>
  );
}
