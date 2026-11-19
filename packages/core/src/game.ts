// The rules of Sankofa Snake. Nothing here draws anything or reads the keyboard, so the web game,
// the phone app and the tests all share exactly the same rules.
//
// Every function takes a game state and returns a new one. The old state is never changed, which
// makes each move easy to test and easy to reason about.
import { nextRandom } from "./rng";
import { obstacleKeys } from "./levels";
import type { Cell, Crash, Direction, GameEvent, GameState, LevelDef, VehicleDef } from "./types";

const STEP: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

/** The most turns a player can press ahead of the snake. */
export const MAX_QUEUED_TURNS = 2;

export const key = (c: Cell) => `${c.x},${c.y}`;
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

/** Starts a level. The snake waits until the player picks a direction. */
export function createGame(level: LevelDef, seed: number): GameState {
  const { x, y, dir, length } = level.start;
  const back = STEP[OPPOSITE[dir]];
  const snake: Cell[] = [];
  for (let i = 0; i < length; i++) snake.push(wrapCell({ x: x + back.x * i, y: y + back.y * i }, level));
  const state: GameState = {
    level,
    snake,
    dir,
    queue: [],
    food: null,
    obstacles: obstacleKeys(level),
    eaten: 0,
    score: 0,
    speed: level.speed.start,
    speedLevel: 1,
    grow: 0,
    elapsedMs: 0,
    moves: 0,
    vehicles: (level.vehicles ?? []).map((v) => v.start),
    status: "ready",
    rng: seed >>> 0,
  };
  return placeFood(state);
}

/**
 * Records a turn. A turn back the way the snake came is ignored, because the snake would run into
 * its own neck. The first accepted direction starts the game.
 */
export function turn(state: GameState, dir: Direction): GameState {
  if (state.status !== "ready" && state.status !== "running") return state;
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
  if (dir === OPPOSITE[last]) return state;
  const status = "running" as const;
  if (dir === last || state.queue.length >= MAX_QUEUED_TURNS) return { ...state, status };
  return { ...state, status, queue: [...state.queue, dir] };
}

/** Pauses a running game, or resumes a paused one. */
export function togglePause(state: GameState): GameState {
  if (state.status === "running") return { ...state, status: "paused" };
  if (state.status === "paused") return { ...state, status: "running" };
  return state;
}

/** Pauses a running game. Does nothing in any other state. */
export function pause(state: GameState): GameState {
  return state.status === "running" ? { ...state, status: "paused" } : state;
}

/** How long one move takes right now, in milliseconds. */
export const moveMs = (state: GameState) => 1000 / state.speed;

/** Moves the snake one cell and applies everything that follows from that move. */
export function tick(state: GameState): { state: GameState; events: GameEvent[] } {
  if (state.status !== "running") return { state, events: [] };
  const events: GameEvent[] = [];
  const level = state.level;

  const queue = [...state.queue];
  const dir = queue.length ? (queue.shift() as Direction) : state.dir;
  // Vehicles move first, on the same beat as the snake, and wait while the snake is in their way.
  const moves = state.moves + 1;
  const vehicles = moveVehicles(level, state.vehicles, moves, state.snake);
  const moved: GameState = { ...state, moves, vehicles };

  const head = state.snake[0];
  let next: Cell = { x: head.x + STEP[dir].x, y: head.y + STEP[dir].y };
  const elapsedMs = state.elapsedMs + moveMs(state);

  const outside = next.x < 0 || next.y < 0 || next.x >= level.width || next.y >= level.height;
  if (outside && level.edges === "walls") return crash(moved, "wall", next, dir, elapsedMs, events);
  next = wrapCell(next, level);

  if (state.obstacles.has(key(next))) return crash(moved, "obstacle", next, dir, elapsedMs, events);
  const vehicle = vehicleAt(level, vehicles, next);
  if (vehicle) return crash(moved, "vehicle", next, dir, elapsedMs, events, vehicle);

  const eating = state.food !== null && sameCell(next, state.food);
  // The tail moves out of its cell on this move unless the snake is growing,
  // so the head may safely move into the cell the tail is leaving.
  const tailMoves = !eating && state.grow === 0;
  const body = tailMoves ? state.snake.slice(0, -1) : state.snake;
  if (body.some((c) => sameCell(c, next))) return crash(moved, "self", next, dir, elapsedMs, events);

  const snake = [next, ...body];
  let { grow, eaten, score, speed, speedLevel } = state;
  if (!eating && grow > 0) grow -= 1;

  let nextState: GameState = { ...moved, snake, dir, queue, grow, elapsedMs };
  if (!eating) return { state: nextState, events };

  eaten += 1;
  const points = 10 * speedLevel;
  score += points;
  events.push({ type: "ate", at: next, points });

  if (eaten >= level.goal) {
    const timeBonus = Math.max(0, Math.round(level.parSeconds - elapsedMs / 1000)) * 5;
    score += timeBonus;
    const stars = starsFor(level, score);
    events.push({ type: "cleared", score, stars, timeBonus });
    return { state: { ...nextState, eaten, score, food: null, status: "cleared" }, events };
  }

  const s = level.speed;
  if (s.step > 0 && eaten % s.every === 0 && speed < s.max) {
    speed = Math.min(s.max, speed + s.step);
    speedLevel += 1;
    events.push({ type: "speedup", speed });
  }

  nextState = { ...nextState, eaten, score, speed, speedLevel };
  return { state: placeFood(nextState), events };
}

/** One star for clearing the level, and one more for each score threshold reached. */
export function starsFor(level: LevelDef, score: number): number {
  return 1 + (score >= level.stars[0] ? 1 : 0) + (score >= level.stars[1] ? 1 : 0);
}

function crash(
  state: GameState,
  cause: Crash,
  at: Cell,
  dir: Direction,
  elapsedMs: number,
  events: GameEvent[],
  vehicle?: VehicleDef["kind"],
): { state: GameState; events: GameEvent[] } {
  events.push({ type: "crash", cause });
  const over: GameState = { ...state, dir, queue: [], elapsedMs, status: "over", crash: cause, crashAt: at };
  if (vehicle) over.crashVehicle = vehicle;
  return { state: over, events };
}

/**
 * The cells a vehicle covers when its front is at the given place along its lane, front first.
 * The vehicle comes back around at the far edge, so its cells can sit at both edges at once.
 */
export function vehicleCells(v: VehicleDef, level: LevelDef, front: number): Cell[] {
  const laneLength = v.axis === "row" ? level.width : level.height;
  const cells: Cell[] = [];
  for (let i = 0; i < v.length; i++) {
    const along = (((front - v.dir * i) % laneLength) + laneLength) % laneLength;
    cells.push(v.axis === "row" ? { x: along, y: v.lane } : { x: v.lane, y: along });
  }
  return cells;
}

/** Every cell covered by a vehicle right now, as "x,y" keys. */
export function vehicleKeys(state: GameState): Set<string> {
  const keys = new Set<string>();
  state.level.vehicles?.forEach((v, i) => {
    for (const c of vehicleCells(v, state.level, state.vehicles[i])) keys.add(key(c));
  });
  return keys;
}

/** The kind of vehicle on a cell, or null when the cell is clear. */
function vehicleAt(level: LevelDef, fronts: number[], cell: Cell): VehicleDef["kind"] | null {
  const vs = level.vehicles ?? [];
  for (let i = 0; i < vs.length; i++) {
    if (vehicleCells(vs[i], level, fronts[i]).some((c) => sameCell(c, cell))) return vs[i].kind;
  }
  return null;
}

/**
 * Moves each vehicle one cell when its turn comes. A vehicle waits instead when the next cell is
 * part of the snake or another vehicle, the way a driver brakes for someone crossing the road.
 */
function moveVehicles(level: LevelDef, fronts: number[], moves: number, snake: Cell[]): number[] {
  const vs = level.vehicles ?? [];
  if (!vs.length) return fronts;
  const next = [...fronts];
  const snakeKeys = new Set(snake.map(key));
  vs.forEach((v, i) => {
    if (moves % v.every !== 0) return;
    const ahead = vehicleCells(v, level, next[i] + v.dir)[0];
    const k = key(ahead);
    const blocked = snakeKeys.has(k) || vs.some((o, j) => j !== i && vehicleCells(o, level, next[j]).some((c) => key(c) === k));
    if (!blocked) {
      const laneLength = v.axis === "row" ? level.width : level.height;
      next[i] = (((next[i] + v.dir) % laneLength) + laneLength) % laneLength;
    }
  });
  return next;
}

function wrapCell(c: Cell, level: LevelDef): Cell {
  return {
    x: ((c.x % level.width) + level.width) % level.width,
    y: ((c.y % level.height) + level.height) % level.height,
  };
}

/** Puts a cowrie on a random open cell, never on the snake, an obstacle or a vehicle. */
export function placeFood(state: GameState): GameState {
  const taken = new Set(state.snake.map(key));
  for (const k of vehicleKeys(state)) taken.add(k);
  const open: Cell[] = [];
  for (let y = 0; y < state.level.height; y++) {
    for (let x = 0; x < state.level.width; x++) {
      const k = `${x},${y}`;
      if (!taken.has(k) && !state.obstacles.has(k)) open.push({ x, y });
    }
  }
  if (open.length === 0) return { ...state, food: null };
  const [r, rng] = nextRandom(state.rng);
  return { ...state, food: open[Math.floor(r * open.length)], rng };
}
