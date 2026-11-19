// The other ways to play, built from the nine levels: the daily challenge, free play and practice.
// Each one turns a level into a new level definition, so the rules in game.ts stay the same.
import { LEVELS } from "./levels";
import { nextRandom, seedFrom } from "./rng";
import type { Edges, LevelDef } from "./types";

/** A date as YYYY-MM-DD in the player's own time zone, so the daily challenge changes at their midnight. */
export function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day before a YYYY-MM-DD date. */
export function dayBefore(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

const PACES = {
  steady: { start: 6, step: 1, every: 5, max: 9 },
  brisk: { start: 7, step: 1, every: 5, max: 11 },
  fast: { start: 8, step: 1, every: 4, max: 12 },
} as const;

/**
 * The daily challenge for a date. The date picks one of the nine worlds, solid walls or
 * wrap-around edges, a pace, and whether power-ups appear. Every player gets the same mix on the
 * same date, and the cowries start in the same places for everyone.
 */
export function dailyLevel(date: string): LevelDef {
  let rng = seedFrom(`sankofa-daily:${date}`);
  const pick = () => {
    const [r, next] = nextRandom(rng);
    rng = next;
    return r;
  };
  const base = LEVELS[Math.floor(pick() * LEVELS.length)];
  const edges: Edges = pick() < 0.5 ? "walls" : "wrap";
  const paceNames = Object.keys(PACES) as (keyof typeof PACES)[];
  const pace = paceNames[Math.floor(pick() * paceNames.length)];
  const powerUps = base.powerUps ?? (pick() < 0.5 ? { kinds: ["slow", "shrink", "pass"], every: 3, lasts: 60 } : undefined);
  const parts = [edges === "walls" ? "solid walls" : "wrap-around edges", `a ${pace} pace`];
  if (powerUps) parts.push("power-ups");
  if (base.vehicles?.length) parts.push("road traffic");
  const last = parts.pop();
  return {
    ...base,
    id: `daily-${date}`,
    challenge: `The ${base.name}, with ${parts.join(", ")} and ${last}.`,
    edges,
    speed: { ...PACES[pace] },
    powerUps: powerUps as LevelDef["powerUps"],
  };
}

/** The seed for the daily challenge's cowries, the same for every player on that date. */
export const dailySeed = (date: string) => seedFrom(`sankofa-daily-seed:${date}`);

/**
 * The daily streak after clearing the challenge on a date: one more than before when the last
 * clear was the day before, the same when it was earlier today, and back to 1 after a gap.
 */
export function nextStreak(last: string | undefined, streak: number, today: string): number {
  if (last === today) return streak;
  if (last === dayBefore(today)) return streak + 1;
  return 1;
}

/** No cowrie count ends a free play run. It goes on until the snake crashes. */
export const ENDLESS = 100000;

/** Free play: the classic game in a level's world, with the edges the player chose, until the snake crashes. */
export function freePlayLevel(base: LevelDef, edges: Edges): LevelDef {
  return {
    ...base,
    id: `free-${base.id}-${edges}`,
    challenge: "Collect as many cowries as you can. The run goes on until the snake crashes.",
    edges,
    goal: ENDLESS,
  };
}

/** Practice: any level at a slower, steady speed, where running into something only stops the snake. */
export function practiceLevel(base: LevelDef): LevelDef {
  const start = Math.max(3, base.speed.start - 3);
  return {
    ...base,
    id: `practice-${base.id}`,
    speed: { start, step: 0, every: base.speed.every, max: start },
    practice: true,
  };
}
