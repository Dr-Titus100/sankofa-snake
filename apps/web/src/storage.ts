// Saves best scores, stars and cleared levels in the browser. Nothing leaves the device.
// Some browsers block storage (private windows, strict settings), so every read and write
// is wrapped, and the game still works without it. Progress then lasts only until the page closes.
//
// On the website the game shares storage with every other page, so a save can't be trusted.
// Every value is checked when it loads. Good values are kept and anything else is dropped.
import { LEVELS, dayBefore, nextStreak } from "../../../packages/core/src";

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

export const PROGRESS_KEY = "sankofa-snake/v1";
const KEY = PROGRESS_KEY;
/** Sent on window after progress is saved, so other copies of the game on the page can load it. */
export const SAVED_EVENT = "sankofa-snake:saved";

/**
 * The version of the save format. Saves from 0.6 and earlier have no version and count as 1.
 * When the format changes, raise this number and add a step to `migrate`.
 */
export const SAVE_VERSION = 2;

/** The highest values a save can hold. Anything above is tampering or damage, and is dropped. */
export const LIMITS = { score: 1_000_000, cowries: 10_000, streak: 100_000 } as const;

const LEVEL_IDS = new Set(LEVELS.map((l) => l.id));
const FREE_KEY = /^([a-z]+)-(wrap|walls)$/;

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;

/** A real calendar date written as YYYY-MM-DD. */
export function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Brings a save from an older version up to the current format. */
function migrate(raw: Raw): Raw {
  const version = count(raw.version, 1_000) ? raw.version : 1;
  // Version 1 (0.6 and earlier) has the same fields as version 2, without a version number.
  // A later format adds its steps here, such as `if (version < 3) raw = toVersion3(raw)`.
  void version;
  return raw;
}

/** Keeps the good values of a saved object and drops the rest. Never throws. */
export function cleanProgress(input: unknown): Progress {
  const progress: Progress = { levels: {} };
  if (!isObject(input)) return progress;
  const raw = migrate(input);

  if (isObject(raw.levels)) {
    for (const [id, value] of Object.entries(raw.levels)) {
      if (!LEVEL_IDS.has(id) || !isObject(value)) continue;
      progress.levels[id] = {
        best: count(value.best, LIMITS.score) ? value.best : 0,
        stars: count(value.stars, 3) ? value.stars : 0,
        cleared: value.cleared === true,
      };
    }
  }

  const d = raw.daily;
  if (isObject(d) && isDate(d.date)) {
    const streak = count(d.streak, LIMITS.streak) ? d.streak : 0;
    const lastCleared = isDate(d.lastCleared) ? d.lastCleared : undefined;
    progress.daily = {
      date: d.date,
      best: count(d.best, LIMITS.score) ? d.best : 0,
      cleared: d.cleared === true,
      // A streak needs the date it was last extended, or it can't be shown or continued.
      streak: lastCleared ? streak : 0,
      bestStreak: Math.max(count(d.bestStreak, LIMITS.streak) ? d.bestStreak : 0, lastCleared ? streak : 0),
    };
    if (lastCleared) progress.daily.lastCleared = lastCleared;
  }

  if (isObject(raw.free)) {
    const free: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.free)) {
      const m = FREE_KEY.exec(k);
      if (m && LEVEL_IDS.has(m[1]) && count(v, LIMITS.cowries)) free[k] = v;
    }
    if (Object.keys(free).length) progress.free = free;
  }

  if (isObject(raw.settings)) {
    const s = raw.settings;
    progress.settings = { sound: s.sound !== false, vibration: s.vibration !== false };
  }
  return progress;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return cleanProgress(JSON.parse(raw));
  } catch {
    // Storage is blocked or the saved data is damaged. Start fresh.
  }
  return { levels: {} };
}

/** Saves progress. Returns false when the browser won't keep it. */
export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: SAVE_VERSION, ...progress }));
    window.dispatchEvent(new Event(SAVED_EVENT));
    return true;
  } catch {
    // Storage is blocked or full. Progress lasts until the page closes.
    return false;
  }
}

/** Whether this browser lets the game save. Private windows and strict settings can block it. */
export function canSave(): boolean {
  try {
    const probe = `${KEY}/probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Deletes scores, stars, cleared levels, the daily streak and free play bests. Keeps the switches. */
export function resetProgress(progress: Progress): Progress {
  return progress.settings ? { levels: {}, settings: progress.settings } : { levels: {} };
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
