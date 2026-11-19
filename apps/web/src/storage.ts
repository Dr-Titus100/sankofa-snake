// Saves best scores, stars and cleared levels in the browser. Nothing leaves the device.
// Some browsers block storage (private windows, strict settings), so every read and write
// is wrapped, and the game still works without it. Progress then lasts only until the page closes.

export interface LevelProgress {
  best: number;
  stars: number;
  cleared: boolean;
}

export interface Progress {
  levels: Record<string, LevelProgress>;
}

const KEY = "sankofa-snake/v1";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Progress;
      if (parsed && typeof parsed.levels === "object") return parsed;
    }
  } catch {
    // Storage is blocked or the saved data is damaged. Start fresh.
  }
  return { levels: {} };
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage is blocked. Progress lasts until the page closes.
  }
}

/** Records a finished run and returns the updated progress. */
export function recordRun(progress: Progress, levelId: string, score: number, stars: number, cleared: boolean): Progress {
  const old = progress.levels[levelId] ?? { best: 0, stars: 0, cleared: false };
  const next: LevelProgress = {
    best: Math.max(old.best, score),
    stars: Math.max(old.stars, stars),
    cleared: old.cleared || cleared,
  };
  return { levels: { ...progress.levels, [levelId]: next } };
}
