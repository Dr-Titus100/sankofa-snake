import { describe, expect, it } from "vitest";
import {
  ENDLESS,
  LEVELS,
  createGame,
  dailyLevel,
  dailySeed,
  dateKey,
  dayBefore,
  freePlayLevel,
  nextStreak,
  practiceLevel,
  tick,
  turn,
  validateLevel,
} from "../src";

describe("the daily challenge", () => {
  it("is the same level and the same first cowrie for everyone on the same date", () => {
    expect(dailyLevel("2026-11-19")).toEqual(dailyLevel("2026-11-19"));
    const a = createGame(dailyLevel("2026-11-19"), dailySeed("2026-11-19"));
    const b = createGame(dailyLevel("2026-11-19"), dailySeed("2026-11-19"));
    expect(a.food).toEqual(b.food);
  });

  it("changes from day to day and uses every world", () => {
    const worlds = new Set<string>();
    let date = "2027-01-01";
    const ids = new Set<string>();
    for (let i = 0; i < 365; i++) {
      const level = dailyLevel(date);
      worlds.add(level.world);
      ids.add(level.id);
      expect(validateLevel(level), date).toEqual([]);
      date = dayBefore(date);
    }
    expect(ids.size).toBe(365);
    expect(worlds.size).toBe(LEVELS.length);
  });

  it("describes its mix in one sentence", () => {
    const text = dailyLevel("2026-11-19").challenge;
    expect(text).toMatch(/^The [A-Z].*\.$/);
    expect(text).toMatch(/solid walls|wrap-around edges/);
  });
});

describe("dates and the streak", () => {
  it("writes dates in the player's time zone and finds the day before", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayBefore("2026-01-01")).toBe("2025-12-31");
  });

  it("grows on consecutive days, stays the same on a second clear, and restarts after a gap", () => {
    expect(nextStreak(undefined, 0, "2026-11-19")).toBe(1);
    expect(nextStreak("2026-11-18", 4, "2026-11-19")).toBe(5);
    expect(nextStreak("2026-11-19", 5, "2026-11-19")).toBe(5);
    expect(nextStreak("2026-11-16", 9, "2026-11-19")).toBe(1);
  });
});

describe("free play", () => {
  it("keeps the world, uses the chosen edges and never clears", () => {
    const level = freePlayLevel(LEVELS[2], "walls");
    expect(level.world).toBe("market");
    expect(level.edges).toBe("walls");
    expect(level.goal).toBe(ENDLESS);
    expect(validateLevel(level)).toEqual([]);
  });
});

describe("practice", () => {
  it("is slower and stays at one speed", () => {
    const level = practiceLevel(LEVELS[8]);
    expect(level.speed.start).toBe(LEVELS[8].speed.start - 3);
    expect(level.speed.step).toBe(0);
    expect(level.practice).toBe(true);
    expect(practiceLevel(LEVELS[0]).speed.start).toBeGreaterThanOrEqual(3);
  });

  it("stops the snake at a wall and waits for a new direction instead of ending the run", () => {
    // The City has solid walls. Its snake starts at row 10 in an open column, so 11 moves up reach the top wall.
    let g = turn(createGame(practiceLevel(LEVELS[3]), 1), "up");
    const events = [];
    for (let i = 0; i < 11; i++) {
      const r = tick(g);
      events.push(...r.events);
      g = r.state;
    }
    expect(g.status).toBe("ready");
    expect(g.bump).toBe("wall");
    expect(g.snake[0].y).toBe(0);
    expect(events).toContainEqual({ type: "bump", cause: "wall" });
    expect(events.some((e) => e.type === "crash")).toBe(false);
    g = tick(turn(g, "right")).state;
    expect(g.status).toBe("running");
    expect(g.bump).toBeUndefined();
    expect(g.snake[0]).toEqual({ x: 6, y: 0 });
  });
});
