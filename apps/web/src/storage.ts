// Saves best scores, stars and cleared levels in the browser. Nothing leaves the device.
// Some browsers block storage (private windows, strict settings), so every read and write
// is wrapped, and the game still works without it. Progress then lasts only until the page closes.
import { dayBefore, nextStreak } from "../../../packages/core/src";

export interface LevelProgress {
  best: number;
  stars: number;
  cleared: boolean;
}

/** The daily challenge: today's best, and the streak of days in a row with a clear. */
export interface DailyProgress {
  /** The date the best score belongs to, as YYYY-MM-DD. */
  date: string;
  best: number;
  cleared: boolean;
  streak: number;
  /** The last date the player cleared the daily challenge. */
  lastCleared?: string;
  bestStreak: number;
}

export interface Progress {
  levels: Record<string, LevelProgress>;
  daily?: DailyProgress;
  /** The most cowries collected in one free play run, by world and edges. */
  free?: Record<string, number>;
  /** The sound and vibration switches. Both start on. */
  settings?: Settings;
}

export interface Settings {
  sound: boolean;
  vibration: boolean;
}

/** The sound and vibration switches, with both on until the player turns one off. */
export const settingsOf = (progress: Progress): Settings => ({ sound: true, vibration: true, ...progress.settings });

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
  return { ...progress, levels: { ...progress.levels, [levelId]: next } };
}

/** Records a daily challenge run and returns the updated progress. */
export function recordDaily(progress: Progress, date: string, score: number, cleared: boolean): Progress {
  const old = progress.daily;
  const sameDay = old?.date === date;
  const daily: DailyProgress = {
    date,
    best: Math.max(sameDay ? old.best : 0, score),
    cleared: (sameDay && old.cleared) || cleared,
    streak: old?.streak ?? 0,
    lastCleared: old?.lastCleared,
    bestStreak: old?.bestStreak ?? 0,
  };
  if (cleared) {
    daily.streak = nextStreak(old?.lastCleared, old?.streak ?? 0, date);
    daily.lastCleared = date;
    daily.bestStreak = Math.max(daily.bestStreak, daily.streak);
  }
  return { ...progress, daily };
}

/** The streak to show today. It drops to 0 once a whole day passes without a clear. */
export function currentStreak(progress: Progress, today: string): number {
  const d = progress.daily;
  if (!d?.lastCleared) return 0;
  return d.lastCleared === today || d.lastCleared === dayBefore(today) ? d.streak : 0;
}

/** Records a free play run and returns the updated progress. */
export function recordFree(progress: Progress, key: string, eaten: number): Progress {
  const free = { ...progress.free };
  free[key] = Math.max(free[key] ?? 0, eaten);
  return { ...progress, free };
}
