import { describe, expect, it } from "vitest";
import {
  LEVELS,
  CURRENT_BOOST,
  CURRENT_DRAG,
  againstCurrent,
  createGame,
  ridingCurrent,
  SHRINK_CELLS,
  SLOW_MOVES,
  key,
  moveMs,
  placeFood,
  speedNow,
  starsFor,
  tick,
  togglePause,
  turn,
  validateLevel,
  vehicleCells,
  type GameState,
  type LevelDef,
  type PowerKind,
} from "../src";

const farm = LEVELS[0];

/** A small open level for tests, so positions are easy to follow. */
function testLevel(over: Partial<LevelDef> = {}): LevelDef {
  return {
    ...farm,
    id: "test",
    width: 10,
    height: 10,
    edges: "wrap",
    goal: 3,
    speed: { start: 5, step: 0, every: 5, max: 5 },
    start: { x: 4, y: 5, dir: "right", length: 3 },
    map: undefined,
    ...over,
  };
}

function run(state: GameState, moves: number): GameState {
  for (let i = 0; i < moves; i++) state = tick(state).state;
  return state;
}

function withFood(state: GameState, x: number, y: number): GameState {
  return { ...state, food: { x, y } };
}

describe("starting a level", () => {
  it("lays the snake out behind its head and waits", () => {
    const g = createGame(testLevel(), 1);
    expect(g.snake).toEqual([{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }]);
    expect(g.status).toBe("ready");
    expect(tick(g).state).toBe(g);
  });

  it("starts moving on the first direction", () => {
    const g = turn(createGame(testLevel(), 1), "up");
    expect(g.status).toBe("running");
    expect(tick(g).state.snake[0]).toEqual({ x: 4, y: 4 });
  });

  it("ignores a first press back into the snake's own body", () => {
    const g = turn(createGame(testLevel(), 1), "left");
    expect(g.status).toBe("ready");
  });
});

describe("turning", () => {
  it("never reverses into the neck", () => {
    let g = turn(createGame(testLevel(), 1), "right");
    g = turn(g, "left");
    expect(g.queue).toEqual([]);
    expect(tick(g).state.snake[0]).toEqual({ x: 5, y: 5 });
  });

  it("keeps quick turns in order, up to two", () => {
    let g = turn(createGame(testLevel(), 1), "up");
    g = turn(g, "left");
    g = turn(g, "down");
    expect(g.queue).toEqual(["up", "left"]);
    g = run(g, 2);
    expect(g.snake[0]).toEqual({ x: 3, y: 4 });
  });

  it("checks a reverse against the last queued turn", () => {
    let g = turn(createGame(testLevel(), 1), "up");
    g = turn(g, "down");
    expect(g.queue).toEqual(["up"]);
  });
});

describe("edges", () => {
  it("wraps to the other side on a wrap level", () => {
    let g = withFood(turn(createGame(testLevel(), 1), "right"), 0, 0);
    g = run(g, 5);
    expect(g.snake[0]).toEqual({ x: 9, y: 5 });
    g = run(g, 1);
    expect(g.snake[0]).toEqual({ x: 0, y: 5 });
    expect(g.status).toBe("running");
  });

  it("ends the run at a wall on a walls level", () => {
    let g = withFood(turn(createGame(testLevel({ edges: "walls" }), 1), "right"), 0, 0);
    g = run(g, 5);
    const { state, events } = tick(g);
    expect(state.status).toBe("over");
    expect(state.crash).toBe("wall");
    expect(events).toContainEqual({ type: "crash", cause: "wall" });
  });
});

describe("eating and growing", () => {
  it("grows by one and scores 10 points for a cowrie", () => {
    let g = withFood(turn(createGame(testLevel(), 1), "right"), 5, 5);
    const { state, events } = tick(g);
    expect(state.snake).toHaveLength(4);
    expect(state.eaten).toBe(1);
    expect(state.score).toBe(10);
    expect(events[0]).toMatchObject({ type: "ate", points: 10 });
    expect(state.food).not.toBeNull();
  });

  it("never puts a cowrie on the snake or an obstacle", () => {
    const level = LEVELS[2];
    let g = createGame(level, 7);
    for (let seed = 0; seed < 300; seed++) {
      g = placeFood({ ...g, rng: seed });
      const k = key(g.food!);
      expect(g.obstacles.has(k)).toBe(false);
      expect(g.snake.some((c) => key(c) === k)).toBe(false);
    }
  });

  it("puts cowries in the same places for the same seed", () => {
    const a = createGame(testLevel(), 42);
    const b = createGame(testLevel(), 42);
    expect(a.food).toEqual(b.food);
  });
});

describe("crashing", () => {
  it("ends the run when the head hits the body", () => {
    // A snake of 5 cells turning in a tight square runs into itself.
    let g = createGame(testLevel({ start: { x: 4, y: 5, dir: "right", length: 5 } }), 1);
    g = withFood(g, 0, 0);
    for (const d of ["down", "left", "up"] as const) g = tick(turn(g, d)).state;
    expect(g.status).toBe("over");
    expect(g.crash).toBe("self");
  });

  it("lets the head move into the cell the tail is leaving", () => {
    let g = createGame(testLevel({ start: { x: 4, y: 5, dir: "right", length: 4 } }), 1);
    g = withFood(g, 0, 0);
    for (const d of ["down", "left", "up"] as const) g = tick(turn(g, d)).state;
    expect(g.status).toBe("running");
  });

  it("ends the run on an obstacle", () => {
    const map = Array.from({ length: 10 }, (_, y) => (y === 5 ? "......#..." : ".........."));
    let g = withFood(turn(createGame(testLevel({ map }), 1), "right"), 0, 0);
    g = run(g, 2);
    expect(g.status).toBe("over");
    expect(g.crash).toBe("obstacle");
    expect(g.crashAt).toEqual({ x: 6, y: 5 });
  });
});

describe("speed", () => {
  it("speeds up after every few cowries and stops at the cap", () => {
    const level = testLevel({ goal: 50, speed: { start: 5, step: 2, every: 2, max: 8 } });
    let g = turn(createGame(level, 1), "right");
    const speeds: number[] = [];
    for (let i = 0; i < 6; i++) {
      const head = g.snake[0];
      g = tick(withFood(g, (head.x + 1) % 10, head.y)).state;
      speeds.push(g.speed);
    }
    expect(speeds).toEqual([5, 7, 7, 8, 8, 8]);
  });

  it("makes each cowrie worth more after a speed-up", () => {
    const level = testLevel({ goal: 50, speed: { start: 5, step: 1, every: 1, max: 9 } });
    let g = turn(createGame(level, 1), "right");
    let head = g.snake[0];
    g = tick(withFood(g, head.x + 1, head.y)).state;
    head = g.snake[0];
    g = tick(withFood(g, head.x + 1, head.y)).state;
    expect(g.score).toBe(10 + 20);
  });
});

describe("clearing a level", () => {
  it("clears at the goal and adds a time bonus", () => {
    const level = testLevel({ goal: 2, parSeconds: 10, stars: [40, 80] });
    let g = turn(createGame(level, 1), "right");
    let head = g.snake[0];
    g = tick(withFood(g, head.x + 1, head.y)).state;
    head = g.snake[0];
    const { state, events } = tick(withFood(g, head.x + 1, head.y));
    expect(state.status).toBe("cleared");
    // Two moves at 5 moves a second take 0.4 seconds, so the bonus is (10 - 0) * 5 = 50.
    expect(events.at(-1)).toEqual({ type: "cleared", score: 20 + 50, stars: 2, timeBonus: 50 });
  });

  it("gives one, two or three stars by score", () => {
    const level = testLevel({ stars: [100, 200] });
    expect(starsFor(level, 50)).toBe(1);
    expect(starsFor(level, 100)).toBe(2);
    expect(starsFor(level, 250)).toBe(3);
  });
});

describe("pausing", () => {
  it("stops the snake while paused", () => {
    let g = togglePause(turn(createGame(testLevel(), 1), "right"));
    expect(g.status).toBe("paused");
    expect(tick(g).state).toBe(g);
    expect(turn(g, "up")).toBe(g);
    expect(togglePause(g).status).toBe("running");
  });
});

describe("vehicles", () => {
  // A taxi two cells long on row 2, driving right one cell per snake move, starting with its front at x = 1.
  const taxi = { kind: "taxi" as const, axis: "row" as const, lane: 2, dir: 1 as const, length: 2, every: 1, start: 1 };

  it("covers the cells behind its front, coming back around at the far edge", () => {
    const level = testLevel({ vehicles: [taxi] });
    expect(vehicleCells(taxi, level, 1)).toEqual([{ x: 1, y: 2 }, { x: 0, y: 2 }]);
    expect(vehicleCells(taxi, level, 0)).toEqual([{ x: 0, y: 2 }, { x: 9, y: 2 }]);
  });

  it("drives one cell per move, or one cell every few moves when it is slow", () => {
    const g = withFood(turn(createGame(testLevel({ vehicles: [taxi, { ...taxi, lane: 8, every: 3 }] }), 1), "right"), 0, 0);
    expect(run(g, 3).vehicles).toEqual([4, 2]);
    expect(run(g, 9).vehicles).toEqual([0, 4]);
  });

  it("ends the run when the snake drives into a vehicle", () => {
    // The snake heads up column 4 and meets a parked taxi on row 2 three moves later.
    const parked = { ...taxi, start: 5, every: 100 };
    let g = withFood(turn(createGame(testLevel({ vehicles: [parked] }), 1), "up"), 0, 9);
    g = run(g, 3);
    expect(g.status).toBe("over");
    expect(g.crash).toBe("vehicle");
    expect(g.crashVehicle).toBe("taxi");
    expect(g.crashAt).toEqual({ x: 4, y: 2 });
  });

  it("stops and waits while the snake crosses in front of it", () => {
    // The snake lies across row 3 at column 3, and the taxi on row 3 is right behind that cell.
    const level = testLevel({ start: { x: 3, y: 4, dir: "down", length: 3 }, vehicles: [{ ...taxi, lane: 3, start: 2 }] });
    let g = withFood(turn(createGame(level, 1), "down"), 9, 9);
    expect(g.snake).toEqual([{ x: 3, y: 4 }, { x: 3, y: 3 }, { x: 3, y: 2 }]);
    g = run(g, 1);
    expect(g.status).toBe("running");
    expect(g.vehicles).toEqual([2]);
    g = run(g, 2);
    expect(g.status).toBe("running");
    expect(g.vehicles[0]).toBeGreaterThan(2);
  });

  it("never puts a cowrie under a vehicle", () => {
    const bus = { ...taxi, lane: 0, length: 9, every: 100, start: 8 };
    const level = testLevel({ vehicles: [bus] });
    for (let seed = 1; seed < 40; seed++) {
      const g = createGame(level, seed);
      expect(g.food!.y === 0 && g.food!.x <= 8).toBe(false);
    }
  });

  it("catches a lane that runs through an obstacle", () => {
    const map = Array.from({ length: 10 }, (_, y) => (y === 2 ? "......#..." : ".........."));
    expect(validateLevel(testLevel({ map, vehicles: [taxi] }))).toContain("vehicle 0 drives through the obstacle at 6,2");
  });

  it("catches a snake that starts on a lane", () => {
    expect(validateLevel(testLevel({ vehicles: [{ ...taxi, lane: 5 }] }))).toContain("start cell 4,5 is on a vehicle's lane");
  });
});

describe("power-ups", () => {
  const rule = { kinds: ["slow", "shrink", "pass"] as PowerKind[], every: 2, lasts: 10 };

  function withPower(state: GameState, kind: PowerKind, x: number, y: number): GameState {
    return { ...state, powerUp: { kind, at: { x, y }, until: state.moves + 50 } };
  }

  it("appears after every few cowries, away from the snake and the cowrie", () => {
    const level = testLevel({ goal: 50, powerUps: rule });
    let g = turn(createGame(level, 3), "right");
    let head = g.snake[0];
    g = tick(withFood(g, head.x + 1, head.y)).state;
    expect(g.powerUp).toBeNull();
    head = g.snake[0];
    const { state, events } = tick(withFood(g, head.x + 1, head.y));
    expect(state.powerUp).not.toBeNull();
    expect(events).toContainEqual({ type: "powerAppeared", kind: state.powerUp!.kind, at: state.powerUp!.at });
    const k = key(state.powerUp!.at);
    expect(state.snake.some((c) => key(c) === k)).toBe(false);
    expect(key(state.food!)).not.toBe(k);
  });

  it("goes away when the snake doesn't reach it in time", () => {
    let g = withFood(turn(createGame(testLevel({ powerUps: rule }), 1), "right"), 0, 0);
    g = { ...g, powerUp: { kind: "slow", at: { x: 0, y: 9 }, until: 3 } };
    expect(run(g, 2).powerUp).not.toBeNull();
    const { state, events } = tick(run(g, 2));
    expect(state.powerUp).toBeNull();
    expect(events).toContainEqual({ type: "powerGone" });
  });

  it("slows the snake down for a while with slow motion", () => {
    const level = testLevel({ speed: { start: 10, step: 0, every: 5, max: 10 } });
    let g = withPower(withFood(turn(createGame(level, 1), "right"), 0, 0), "slow", 5, 5);
    g = tick(g).state;
    expect(speedNow(g)).toBe(6);
    expect(moveMs(g)).toBeCloseTo(1000 / 6);
    g = run(g, SLOW_MOVES - 1);
    expect(speedNow(g)).toBe(6);
    g = run(g, 1);
    expect(speedNow(g)).toBe(10);
  });

  it("takes cells off the tail with shrink, but never below three cells", () => {
    const long = testLevel({ start: { x: 8, y: 5, dir: "right", length: 8 } });
    let g = withPower(withFood(turn(createGame(long, 1), "right"), 0, 0), "shrink", 9, 5);
    g = tick(g).state;
    expect(g.snake).toHaveLength(8 - SHRINK_CELLS);
    g = withPower(g, "shrink", (g.snake[0].x + 1) % 10, 5);
    g = tick(g).state;
    expect(g.snake).toHaveLength(3);
  });

  it("lets the snake through its own tail once with a pass", () => {
    // A snake of 5 cells turning in a tight square runs into itself, as in the crash test above.
    const level = testLevel({ start: { x: 4, y: 5, dir: "right", length: 5 } });
    let g = withPower(withFood(createGame(level, 1), 0, 0), "pass", 5, 5);
    g = tick(turn(g, "right")).state;
    expect(g.passes).toBe(1);
    const events = [];
    for (const d of ["down", "left", "up"] as const) {
      const r = tick(turn(g, d));
      events.push(...r.events);
      g = r.state;
    }
    expect(g.status).toBe("running");
    expect(g.passes).toBe(0);
    expect(events).toContainEqual({ type: "passed" });
    // Without a pass left, the next turn back into the body ends the run.
    for (const d of ["right", "down", "left", "up"] as const) g = tick(turn(g, d)).state;
    expect(g.status).toBe("over");
    expect(g.crash).toBe("self");
  });

  it("catches power-up settings that don't make sense", () => {
    const bad = testLevel({ powerUps: { kinds: ["fly" as PowerKind], every: 0, lasts: 0 } });
    expect(validateLevel(bad)).toEqual([
      'power-up kinds must be some of "slow", "shrink" and "pass"',
      "power-ups must appear every 1 or more cowries",
      "power-ups must last 1 or more moves",
    ]);
  });
});

describe("currents", () => {
  // A current on row 3 that pushes right, across the whole board.
  const map = Array.from({ length: 10 }, (_, y) => (y === 3 ? ">>>>>>>>>>" : ".........."));

  it("pushes the head one cell sideways when the snake crosses it", () => {
    let g = withFood(turn(createGame(testLevel({ map }), 1), "up"), 0, 9);
    g = run(g, 1);
    expect(g.snake[0]).toEqual({ x: 4, y: 4 });
    const { state, events } = tick(g);
    expect(state.snake[0]).toEqual({ x: 5, y: 3 });
    expect(state.snake[1]).toEqual({ x: 4, y: 3 });
    expect(events).toContainEqual({ type: "current", dir: "right" });
    // The snake keeps heading up after the push.
    expect(tick(state).state.snake[0]).toEqual({ x: 5, y: 2 });
  });

  it("doesn't push the snake when it swims along it or against it", () => {
    const level = testLevel({ map, start: { x: 4, y: 3, dir: "left", length: 1 } });
    expect(validateLevel(level)).toContain("start cell 4,3 is on a current");
    let g = withFood(turn(createGame(level, 1), "left"), 0, 9);
    g = run(g, 2);
    expect(g.snake[0]).toEqual({ x: 2, y: 3 });
  });

  it("moves faster along the current and goes back to its own speed when it leaves", () => {
    const level = testLevel({ map, start: { x: 2, y: 3, dir: "right", length: 1 }, speed: { start: 6, step: 0, every: 5, max: 6 } });
    let g = withFood(turn(createGame(level, 1), "right"), 0, 9);
    expect(ridingCurrent(g)).toBe(true);
    expect(speedNow(g)).toBe(Math.round(6 * CURRENT_BOOST));
    expect(moveMs(g)).toBeCloseTo(1000 / 9);
    const start = g.elapsedMs;
    g = tick(g).state;
    expect(g.snake[0]).toEqual({ x: 3, y: 3 });
    expect(g.elapsedMs - start).toBeCloseTo(1000 / 9);
    // Swimming against the current slows the snake down instead.
    expect(ridingCurrent({ ...g, dir: "left" })).toBe(false);
    expect(speedNow({ ...g, dir: "left" })).toBe(3);
    // Once the head leaves the current, the snake is back at its own speed.
    g = tick(turn(g, "down")).state;
    expect(g.snake[0]).toEqual({ x: 3, y: 4 });
    expect(ridingCurrent(g)).toBe(false);
    expect(speedNow(g)).toBe(6);
  });

  it("moves at half speed against the current and goes back to its own speed when it leaves", () => {
    const level = testLevel({ map, start: { x: 4, y: 3, dir: "left", length: 1 }, speed: { start: 6, step: 0, every: 5, max: 6 } });
    let g = withFood(turn(createGame(level, 1), "left"), 0, 9);
    expect(againstCurrent(g)).toBe(true);
    expect(ridingCurrent(g)).toBe(false);
    expect(speedNow(g)).toBe(Math.round(6 * CURRENT_DRAG));
    expect(moveMs(g)).toBeCloseTo(1000 / 3);
    const start = g.elapsedMs;
    g = tick(g).state;
    expect(g.snake[0]).toEqual({ x: 3, y: 3 });
    expect(g.elapsedMs - start).toBeCloseTo(1000 / 3);
    expect(againstCurrent(g)).toBe(true);
    // Once the head leaves the current, the snake is back at its own speed.
    g = tick(turn(g, "down")).state;
    expect(g.snake[0]).toEqual({ x: 3, y: 4 });
    expect(againstCurrent(g)).toBe(false);
    expect(speedNow(g)).toBe(6);
  });

  it("slows slow motion against a current too, rounding the way JavaScript does", () => {
    const level = testLevel({ map, start: { x: 4, y: 3, dir: "left", length: 1 }, speed: { start: 10, step: 0, every: 5, max: 10 } });
    const g = { ...turn(createGame(level, 1), "left"), slowUntil: 99 };
    // Slow motion makes 10 into 6, and half of that is 3.
    expect(speedNow(g)).toBe(3);
    // At the lowest slow-motion speed, 3, half is 1.5, which rounds up to 2.
    expect(speedNow({ ...g, speed: 4 })).toBe(2);
  });

  it("doesn't count a snake crossing the current as swimming along it", () => {
    let g = withFood(turn(createGame(testLevel({ map }), 1), "up"), 0, 9);
    g = run(g, 1);
    g = tick(g).state;
    expect(g.snake[0]).toEqual({ x: 5, y: 3 });
    expect(g.dir).toBe("up");
    expect(ridingCurrent(g)).toBe(false);
    expect(speedNow(g)).toBe(5);
  });

  it("speeds up slow motion along a current too", () => {
    const level = testLevel({ map, start: { x: 4, y: 3, dir: "right", length: 1 }, speed: { start: 10, step: 0, every: 5, max: 10 } });
    const g = { ...turn(createGame(level, 1), "right"), slowUntil: 99 };
    expect(speedNow(g)).toBe(Math.round(6 * CURRENT_BOOST));
  });

  it("blocks a turn back into the neck right after a push", () => {
    let g = withFood(turn(createGame(testLevel({ map }), 1), "up"), 0, 9);
    g = run(g, 2);
    expect(g.lastStep).toBe("right");
    expect(turn(g, "left").queue).toEqual([]);
    expect(turn(g, "right").queue).toEqual(["right"]);
  });

  it("drops a queued turn that would go back into the neck after a push", () => {
    // Heading right along row 4, the player presses up and then left before the snake reaches the
    // current. Up crosses the current and gets pushed right, so the left turn would hit the neck.
    const level = testLevel({ map, start: { x: 3, y: 4, dir: "right", length: 3 } });
    let g = withFood(turn(createGame(level, 1), "right"), 0, 9);
    g = turn(turn(g, "up"), "left");
    expect(g.queue).toEqual(["up", "left"]);
    g = tick(g).state;
    expect(g.snake[0]).toEqual({ x: 4, y: 3 });
    expect(g.queue).toEqual(["left"]);
    g = tick(g).state;
    expect(g.status).toBe("running");
    expect(g.snake[0]).toEqual({ x: 4, y: 2 });
  });

  it("can push the snake into a wall, and says so", () => {
    const level = testLevel({ map, edges: "walls", start: { x: 9, y: 6, dir: "up", length: 3 } });
    let g = withFood(turn(createGame(level, 1), "up"), 0, 9);
    g = run(g, 3);
    expect(g.status).toBe("over");
    expect(g.crash).toBe("wall");
    expect(g.crashPushed).toBe(true);
  });

  it("lets the snake eat a cowrie where the current leaves it", () => {
    let g = withFood(turn(createGame(testLevel({ map }), 1), "up"), 5, 3);
    g = run(g, 2);
    expect(g.eaten).toBe(1);
    expect(g.snake).toHaveLength(4);
  });

  it("catches a vehicle lane through a current and a map with an unknown character", () => {
    const taxi = { kind: "taxi" as const, axis: "row" as const, lane: 3, dir: 1 as const, length: 2, every: 1, start: 1 };
    expect(validateLevel(testLevel({ map, vehicles: [taxi] }))).toContain("vehicle 0 drives through the current at 0,3");
    const bad = map.map((r, y) => (y === 0 ? "....~....." : r));
    expect(validateLevel(testLevel({ map: bad }))).toContain('map row 0 uses a character other than ".", "#", "<", ">", "^" and "v"');
  });
});

describe("level files", () => {
  it.each(LEVELS.map((l) => [l.name, l] as const))("%s has no mistakes", (_, level) => {
    expect(validateLevel(level)).toEqual([]);
  });

  it("numbers the levels in order from 1", () => {
    expect(LEVELS.map((l) => l.number)).toEqual(LEVELS.map((_, i) => i + 1));
  });

  it("catches a start on an obstacle", () => {
    const map = Array.from({ length: 10 }, (_, y) => (y === 5 ? "....#....." : ".........."));
    expect(validateLevel(testLevel({ map }))).toContain("start cell 4,5 is on an obstacle");
  });
});
