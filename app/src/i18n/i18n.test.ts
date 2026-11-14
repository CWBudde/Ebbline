import { afterEach, describe, expect, it } from "vitest";
import { BUILDABLE, CAMPAIGN, KINDS, skirmish, type Kind, type PlaceError } from "@ebbline/engine";
import { de, deContent } from "./de.ts";
import { en, type Key } from "./en.ts";
import {
  clock,
  detect,
  fill,
  kindBlurb,
  kindName,
  lang,
  levelBrief,
  levelHints,
  levelName,
  num,
  placeErrorText,
  setLanguage,
  t,
} from "./index.ts";

const KEYS = Object.keys(en) as Key[];
const PLACE_ERRORS: Record<PlaceError, true> = {
  locked: true,
  outside: true,
  rock: true,
  occupied: true,
  flooded: true,
  "needs lode": true,
  "needs vent": true,
  vent: true,
  spitter: true,
};

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
}

afterEach(() => {
  lang.value = "en";
});

describe("dictionaries", () => {
  it("has the same keys in German as in English, none of them empty", () => {
    expect(Object.keys(de).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) expect(de[key].trim(), key).not.toBe("");
  });

  it("uses the same placeholders and marks in German as in English", () => {
    for (const key of KEYS) {
      expect(placeholders(de[key]), key).toEqual(placeholders(en[key]));
      for (const mark of [/\*[^*]+\*/g, /_[^_]+_/g]) {
        expect(de[key].match(mark)?.length ?? 0, key).toBe(en[key].match(mark)?.length ?? 0);
      }
    }
    expect(placeholders(deContent.skirmish.name)).toEqual(["seed"]);
  });

  it("has German text for every campaign level and each of its hints", () => {
    expect(Object.keys(deContent.levels).sort()).toEqual(CAMPAIGN.map((l) => l.id).sort());
    for (const level of CAMPAIGN) {
      const text = deContent.levels[level.id];
      expect(text?.name.trim(), level.id).toBeTruthy();
      expect(text?.brief.trim(), level.id).toBeTruthy();
      expect(text?.brief, level.id).not.toBe(level.brief);
      expect(text?.hints.length, level.id).toBe(level.hints.length);
      level.hints.forEach((hint, i) => {
        expect(text?.hints[i]?.trim(), `${level.id} hint ${i}`).toBeTruthy();
        expect(text?.hints[i], `${level.id} hint ${i}`).not.toBe(hint);
      });
    }
  });

  it("has a German name and description for every structure kind", () => {
    const kinds = Object.keys(KINDS) as Kind[];
    expect(Object.keys(deContent.kinds).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      expect(deContent.kinds[kind].name.trim(), kind).not.toBe("");
      expect(deContent.kinds[kind].blurb.trim(), kind).not.toBe("");
      expect(deContent.kinds[kind].blurb, kind).not.toBe(KINDS[kind].blurb);
    }
    expect(BUILDABLE.every((kind) => kind in deContent.kinds)).toBe(true);
  });

  it("has English and German text for every placement error", () => {
    for (const code of Object.keys(PLACE_ERRORS) as PlaceError[]) {
      const english = placeErrorText(code);
      lang.value = "de";
      const german = placeErrorText(code);
      lang.value = "en";
      expect(english.trim(), code).not.toBe("");
      expect(german.trim(), code).not.toBe("");
      expect(german, code).not.toBe(english);
    }
  });
});

describe("language", () => {
  it("takes the first German or English entry the browser lists, else English", () => {
    expect(detect("auto", ["de-AT", "en"])).toBe("de");
    expect(detect("auto", ["fr", "en-GB"])).toBe("en");
    expect(detect("auto", ["fr"])).toBe("en");
    expect(detect("auto", [])).toBe("en");
    expect(detect("auto", ["DE"])).toBe("de");
    // "den" is not German: only the primary subtag counts.
    expect(detect("auto", ["den", "de"])).toBe("de");
  });

  it("lets an explicit setting win over the browser", () => {
    expect(detect("en", ["de-DE", "de"])).toBe("en");
    expect(detect("de", ["en-US"])).toBe("de");
  });

  it("switches every lookup with the signal", () => {
    setLanguage("de");
    expect(lang.value).toBe("de");
    expect(t("menu.settings")).toBe("Einstellungen");
    expect(t("campaign.best", { time: "1:05" })).toBe("Bestzeit 1:05");
    expect(kindName("cap")).toBe("Kappe");
    setLanguage("en");
    expect(t("menu.settings")).toBe("Settings");
    expect(kindName("cap")).toBe("Cap");
    expect(kindBlurb("cap")).toBe(KINDS.cap.blurb);
  });

  it("fills named placeholders and leaves unknown ones alone", () => {
    expect(fill("{a} of {b}, {c}", { a: 1, b: "two" })).toBe("1 of two, {c}");
  });

  it("formats numbers and times for the language", () => {
    expect(num(1.25, 1)).toBe("1.3");
    expect(num(12345)).toBe("12,345");
    expect(clock(247)).toBe("4:07");
    expect(clock(3600)).toBe("60:00");
    lang.value = "de";
    expect(num(0.5, 1)).toBe("0,5");
    expect(num(12345)).toBe("12.345");
    expect(clock(247)).toBe("4:07");
  });
});

describe("level text", () => {
  const first = CAMPAIGN[0];
  if (!first) throw new Error("no campaign");

  it("is the engine's own text in English", () => {
    expect(levelName(first)).toBe(first.name);
    expect(levelBrief(first)).toBe(first.brief);
    expect(levelHints(first)).toEqual(first.hints);
    expect(levelName(skirmish(42, "small", "easy"))).toBe("Skirmish 42");
  });

  it("is looked up by id in German", () => {
    lang.value = "de";
    expect(levelName(first)).toBe("Erstes Licht");
    expect(levelBrief(first)).toBe(deContent.levels["c1"]?.brief);
    expect(levelHints(first)).toEqual(deContent.levels["c1"]?.hints);
    const level = skirmish(-7, "large", "hard");
    expect(levelName(level)).toBe("Gefecht -7");
    expect(levelBrief(level)).toBe("Verschließ jeden Schlot.");
    expect(levelHints(level)).toEqual([]);
  });

  it("names a saved game by its id, and an old save by its stored name", () => {
    lang.value = "de";
    expect(levelName({ id: "c2", name: "Reservoir" })).toBe("Reservoir");
    expect(levelName({ id: "c4", name: "Long Haul" })).toBe("Langstrecke");
    expect(levelName({ id: "", name: "Long Haul" })).toBe("Long Haul");
  });
});
