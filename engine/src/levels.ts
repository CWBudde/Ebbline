// The campaign, and skirmish levels made from a seed.

import { TICK_HZ, type Kind, type LevelDef } from "./state.ts";

const BASIC: readonly Kind[] = ["pylon", "tap", "lance", "cap"];

export const CAMPAIGN: readonly LevelDef[] = [
  {
    id: "c1",
    name: "First Light",
    brief: "One sluggish vent. Tap the lodes, walk the grid downhill and cap it.",
    seed: 1101,
    size: 40,
    vents: { count: 1, period: 60, amount: 3, ramp: 0.1 },
    spitters: { count: 0, period: 0, amount: 0 },
    lodes: 5,
    allowed: BASIC,
    objective: { kind: "cap" },
    hints: [
      "Place Taps on the glowing lodes near the lander to earn energy.",
      "Pylons extend the grid. Everything must be within six tiles of one.",
      "Lances burn silt away. Put them on high ground: they cannot aim uphill.",
      "When the vent runs dry between pulses, place a Cap on it and keep it supplied.",
    ],
  },
  {
    id: "c2",
    name: "Reservoir",
    brief: "Two vents. Cells bank energy for the push; Lobbers reach deep pools.",
    seed: 2207,
    size: 48,
    vents: { count: 2, period: 60, amount: 3.5, ramp: 0.1 },
    spitters: { count: 0, period: 0, amount: 0 },
    lodes: 6,
    allowed: [...BASIC, "cell", "lobber"],
    objective: { kind: "cap" },
    hints: ["Lobbers ignore height but cannot hit anything closer than three tiles."],
  },
  {
    id: "c3",
    name: "Skimmers",
    brief: "Lodes are scarce here. Pumps turn the shallows into energy, at a risk.",
    seed: 3313,
    size: 48,
    vents: { count: 2, period: 60, amount: 4, ramp: 0.1 },
    spitters: { count: 0, period: 0, amount: 0 },
    lodes: 3,
    allowed: [...BASIC, "cell", "lobber", "pump"],
    objective: { kind: "cap" },
    hints: ["A Pump works only on silt within two tiles, so it lives on the front line."],
  },
  {
    id: "c4",
    name: "Long Haul",
    brief: "The vents are far away. Trunks carry packets fast over long gaps.",
    seed: 4421,
    size: 64,
    vents: { count: 2, period: 60, amount: 4, ramp: 0.12 },
    spitters: { count: 0, period: 0, amount: 0 },
    lodes: 7,
    allowed: [...BASIC, "cell", "lobber", "pump", "trunk"],
    objective: { kind: "cap" },
    hints: ["Trunks link to each other over fourteen tiles and double packet speed."],
  },
  {
    id: "c5",
    name: "Incoming",
    brief: "A spitter has found you. Watch for the landing marker and shoot the globs down.",
    seed: 5531,
    size: 56,
    vents: { count: 2, period: 60, amount: 4.5, ramp: 0.12 },
    spitters: { count: 1, period: 900, amount: 9 },
    lodes: 7,
    allowed: [...BASIC, "cell", "lobber", "pump", "trunk", "interceptor"],
    objective: { kind: "cap" },
    hints: ["Globs aim at your densest cluster. Interceptors need three hits per glob."],
  },
  {
    id: "c6",
    name: "Breakwater",
    brief: "You are down in the basin and the vents are out of reach. Hold out for ten minutes.",
    seed: 6641,
    size: 56,
    vents: { count: 3, period: 60, amount: 11, ramp: 0.15 },
    spitters: { count: 0, period: 0, amount: 0 },
    lodes: 7,
    lowStart: true,
    allowed: [...BASIC, "cell", "lobber", "pump", "trunk", "interceptor", "baffle"],
    objective: { kind: "survive", ticks: 10 * 60 * TICK_HZ },
    hints: ["A powered Baffle makes silt climb two extra steps: a dam across a valley."],
  },
  {
    id: "c7",
    name: "Earthworks",
    brief: "Three vents and broken ground. Graders raise dykes and cut ramps.",
    seed: 7753,
    size: 64,
    vents: { count: 3, period: 60, amount: 4.5, ramp: 0.12 },
    spitters: { count: 1, period: 840, amount: 10 },
    lodes: 8,
    allowed: [
      ...BASIC,
      "cell",
      "lobber",
      "pump",
      "trunk",
      "interceptor",
      "baffle",
      "grader",
    ],
    objective: { kind: "cap" },
    hints: ["Select Mark, pick a height and paint tiles; a Grader in range does the work."],
  },
  {
    id: "c8",
    name: "Ebbline",
    brief: "Four vents, two spitters, everything you have. Turn the tide.",
    seed: 8867,
    size: 80,
    vents: { count: 4, period: 60, amount: 5, ramp: 0.14 },
    spitters: { count: 2, period: 780, amount: 11 },
    lodes: 10,
    allowed: [
      ...BASIC,
      "cell",
      "lobber",
      "pump",
      "trunk",
      "interceptor",
      "baffle",
      "grader",
    ],
    objective: { kind: "cap" },
    hints: [],
  },
];

/** What a campaign mission shows the player for the first time. */
export interface Introduced {
  /** Structures the mission allows that no earlier mission did, in the order the mission lists them. */
  readonly structures: readonly Kind[];
  /** The first mission with a spitter. */
  readonly spitters: boolean;
  /** The first mission that is won by holding out instead of capping. */
  readonly survive: boolean;
}

/**
 * What is new in a campaign mission, worked out from the missions before it. A level that is not
 * part of the campaign introduces nothing.
 */
export function introduced(levelId: string): Introduced {
  const index = CAMPAIGN.findIndex((l) => l.id === levelId);
  const level = CAMPAIGN[index];
  if (!level) return { structures: [], spitters: false, survive: false };
  const earlier = CAMPAIGN.slice(0, index);
  const known = new Set(earlier.flatMap((l) => l.allowed));
  return {
    structures: level.allowed.filter((kind, i, all) => !known.has(kind) && all.indexOf(kind) === i),
    spitters: level.spitters.count > 0 && earlier.every((l) => l.spitters.count === 0),
    survive: level.objective.kind === "survive" && earlier.every((l) => l.objective.kind !== "survive"),
  };
}

export type MapSize = "small" | "medium" | "large";
export type Difficulty = "easy" | "normal" | "hard";

const SIZES: Record<MapSize, { size: number; vents: number; lodes: number }> = {
  small: { size: 48, vents: 2, lodes: 6 },
  medium: { size: 64, vents: 3, lodes: 8 },
  large: { size: 80, vents: 4, lodes: 10 },
};

const DIFFICULTIES: Record<
  Difficulty,
  { period: number; amount: number; ramp: number; spitters: number }
> = {
  easy: { period: 60, amount: 3.5, ramp: 0.1, spitters: 0 },
  normal: { period: 60, amount: 4.5, ramp: 0.12, spitters: 1 },
  hard: { period: 60, amount: 5.5, ramp: 0.16, spitters: 2 },
};

export function skirmish(
  seed: number,
  mapSize: MapSize,
  difficulty: Difficulty,
): LevelDef {
  const map = SIZES[mapSize];
  const level = DIFFICULTIES[difficulty];
  return {
    id: `s-${seed}-${mapSize}-${difficulty}`,
    name: `Skirmish ${seed}`,
    brief: "Cap every vent.",
    seed,
    size: map.size,
    vents: {
      count: map.vents,
      period: level.period,
      amount: level.amount,
      ramp: level.ramp,
    },
    spitters: { count: level.spitters, period: 840, amount: 10 },
    lodes: map.lodes,
    allowed: CAMPAIGN[CAMPAIGN.length - 1]?.allowed ?? BASIC,
    objective: { kind: "cap" },
    hints: [],
  };
}
