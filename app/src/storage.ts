// Settings, campaign progress and saves in localStorage. Every access may fail (private windows,
// blocked site data), so the game must work with nothing stored.

export interface Settings {
  volume: number;
  music: boolean;
  edgeScroll: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  music: true,
  edgeScroll: false,
  reducedMotion: false,
};

export interface SavedGame {
  name: string;
  /** Seconds played. */
  seconds: number;
  /** Wall-clock time of the save, in milliseconds. */
  when: number;
  data: string;
}

export type Backing = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEYS = {
  settings: "ebbline.settings",
  progress: "ebbline.progress",
  save: "ebbline.save",
} as const;

export class Store {
  private readonly backing: Backing | null;

  constructor(backing: Backing | null) {
    this.backing = backing;
  }

  private read(key: string): unknown {
    try {
      const text = this.backing?.getItem(key);
      return text == null ? undefined : (JSON.parse(text) as unknown);
    } catch {
      return undefined;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      if (!this.backing) return false;
      this.backing.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  settings(): Settings {
    const stored = this.read(KEYS.settings);
    return { ...DEFAULT_SETTINGS, ...(typeof stored === "object" ? stored : {}) };
  }

  setSettings(settings: Settings): void {
    this.write(KEYS.settings, settings);
  }

  /** Best time in seconds per finished level id. */
  progress(): Record<string, number> {
    const stored = this.read(KEYS.progress);
    return typeof stored === "object" && stored !== null
      ? (stored as Record<string, number>)
      : {};
  }

  /** Records a win and returns whether it is a new best time. */
  recordWin(id: string, seconds: number): boolean {
    const progress = this.progress();
    const best = progress[id];
    if (best !== undefined && best <= seconds) return false;
    progress[id] = seconds;
    this.write(KEYS.progress, progress);
    return true;
  }

  saved(): SavedGame | undefined {
    const stored = this.read(KEYS.save) as Partial<SavedGame> | undefined;
    return stored && typeof stored.data === "string" && typeof stored.name === "string"
      ? { name: stored.name, seconds: stored.seconds ?? 0, when: stored.when ?? 0, data: stored.data }
      : undefined;
  }

  setSaved(game: SavedGame): boolean {
    return this.write(KEYS.save, game);
  }

  clearSaved(): void {
    try {
      this.backing?.removeItem(KEYS.save);
    } catch {
      // Nothing to clear.
    }
  }
}
