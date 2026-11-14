import { describe, expect, it } from "vitest";
import { CAMPAIGN } from "./levels.ts";
import { generate } from "./terrain.ts";
import { play } from "./testing/bot.ts";

// Every mission must punish doing nothing and must be winnable by a simple scripted player.
describe.each(CAMPAIGN)("mission $id $name", (level) => {
  it("is lost by a player who does nothing", () => {
    expect(play(generate(level), 60 * 60, false).phase).toBe("lost");
  });

  it("is won by the bot within fifty minutes", () => {
    const outcome = play(generate(level), 50 * 60);
    expect(outcome.phase).toBe("won");
  });
});
