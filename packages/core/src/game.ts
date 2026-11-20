// The rules of Sankofa Snake. Nothing here draws anything or reads the keyboard, so the web game,
// the phone app and the tests all share exactly the same rules.
//
// Every function takes a game state and returns a new one. The old state is never changed, which
// makes each move easy to test and easy to reason about.
import { nextRandom } from "./rng";
import { currentKeys, obstacleKeys } from "./levels";
import type { Cell, Crash, Direction, GameEvent, GameState, LevelDef, PowerKind, VehicleDef } from "./types";

const STEP: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

/** The most turns a player can press ahead of the snake. */
export const MAX_QUEUED_TURNS = 2;

/** How many moves slow motion lasts. */
export const SLOW_MOVES = 40;
/** In slow motion the snake moves at this share of its speed, and never slower than MIN_SPEED. */
const SLOW_SHARE = 0.6;
const MIN_SPEED = 3;
/** Swimming along a current, with the current flowing the way the snake is heading, the snake moves this much faster. */
export const CURRENT_BOOST = 1.5;
/** How many cells the shrink power-up takes off the tail. */
export const SHRINK_CELLS = 4;
/** Shrinking never makes the snake shorter than this. */
const MIN_LENGTH = 3;

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
    lastStep: dir,
    queue: [],
    food: null,
    obstacles: obstacleKeys(level),
    currents: currentKeys(level),
    eaten: 0,
    score: 0,
    speed: level.speed.start,
    speedLevel: 1,
    grow: 0,
    elapsedMs: 0,
    moves: 0,
    vehicles: (level.vehicles ?? []).map((v) => v.start),
    powerUp: null,
    slowUntil: 0,
    passes: 0,
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
  // After a current pushes the snake sideways, its neck is beside the head, so that way is blocked too.
  if (!state.queue.length && dir === OPPOSITE[state.lastStep]) return state;
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

/** Whether slow motion is on right now. */
export const isSlow = (state: GameState) => state.moves < state.slowUntil;

/**
 * Whether the snake is swimming along a current: its head is on a current that flows the way the
 * snake is heading. It drops back to its own speed as soon as its head leaves the current.
 */
export function ridingCurrent(state: GameState): boolean {
  const head = state.snake[0];
  return head !== undefined && state.currents.get(key(head)) === state.dir;
}

/** Moves per second right now, counting slow motion and a current the snake is swimming along. */
export function speedNow(state: GameState): number {
  const speed = isSlow(state) ? Math.max(MIN_SPEED, Math.round(state.speed * SLOW_SHARE)) : state.speed;
  return ridingCurrent(state) ? Math.round(speed * CURRENT_BOOST) : speed;
}

/** How long one move takes right now, in milliseconds. */
export const moveMs = (state: GameState) => 1000 / speedNow(state);

/**
 * Moves the snake one cell and applies everything that follows from that move. When the head
 * crosses a current, the current carries it one more cell sideways on the same move.
 */
export function tick(state: GameState): { state: GameState; events: GameEvent[] } {
  if (state.status !== "running") return { state, events: [] };
  const events: GameEvent[] = [];
  const level = state.level;

  const queue = [...state.queue];
  // A turn pressed before a current pushed the snake may now point back into its neck. Drop it,
  // the same way turn() ignores that press when it comes after the push.
  while (queue.length && (queue[0] === OPPOSITE[state.lastStep] || queue[0] === OPPOSITE[state.dir])) queue.shift();
  const dir = queue.length ? (queue.shift() as Direction) : state.dir;
  // Vehicles move first, on the same beat as the snake, and wait while the snake is in their way.
  const moves = state.moves + 1;
  const vehicles = moveVehicles(level, state.vehicles, moves, state.snake);
  // A power-up the snake didn't reach in time goes away.
  let powerUp = state.powerUp;
  if (powerUp && moves >= powerUp.until) {
    powerUp = null;
    events.push({ type: "powerGone" });
  }
  const elapsedMs = state.elapsedMs + moveMs(state);
  const moved: GameState = { ...state, moves, vehicles, powerUp, queue, elapsedMs };

  let next = moveOnce(moved, dir, dir, events, false);
  const push = next.status === "running" ? next.currents.get(key(next.snake[0])) : undefined;
  if (push && push !== dir && push !== OPPOSITE[dir]) {
    events.push({ type: "current", dir: push });
    next = moveOnce(next, push, dir, events, true);
  }
  return { state: next, events };
}

/**
 * Moves the head one cell in the given direction, with the body following, and applies what
 * happens there: a crash, a power-up, a cowrie, a speed-up or clearing the level. "heading" is the
 * way the snake keeps going on the next move. It differs from "step" only when a current pushes.
 */
function moveOnce(state: GameState, step: Direction, heading: Direction, events: GameEvent[], pushed: boolean): GameState {
  const level = state.level;
  const head = state.snake[0];
  let next: Cell = { x: head.x + STEP[step].x, y: head.y + STEP[step].y };
  const fail = (cause: Crash, vehicle?: VehicleDef["kind"]) => crash(state, cause, next, heading, events, pushed, vehicle);

  const outside = next.x < 0 || next.y < 0 || next.x >= level.width || next.y >= level.height;
  if (outside && level.edges === "walls") return fail("wall");
  next = wrapCell(next, level);

  if (state.obstacles.has(key(next))) return fail("obstacle");
  const vehicle = vehicleAt(level, state.vehicles, next);
  if (vehicle) return fail("vehicle", vehicle);

  const eating = state.food !== null && sameCell(next, state.food);
  // The tail moves out of its cell on this move unless the snake is growing,
  // so the head may safely move into the cell the tail is leaving.
  const tailMoves = !eating && state.grow === 0;
  const body = tailMoves ? state.snake.slice(0, -1) : state.snake;
  let { passes, powerUp } = state;
  if (body.some((c) => sameCell(c, next))) {
    // A pass power-up lets the snake through its own tail once.
    if (passes === 0) return fail("self");
    passes -= 1;
    events.push({ type: "passed" });
  }

  let snake = [next, ...body];
  let { grow, eaten, score, speed, speedLevel, slowUntil } = state;
  if (!eating && grow > 0) grow -= 1;

  if (powerUp && sameCell(next, powerUp.at)) {
    if (powerUp.kind === "slow") slowUntil = state.moves + SLOW_MOVES;
    if (powerUp.kind === "pass") passes += 1;
    if (powerUp.kind === "shrink") {
      snake = snake.slice(0, Math.max(MIN_LENGTH, snake.length - SHRINK_CELLS));
      grow = 0;
    }
    events.push({ type: "power", kind: powerUp.kind });
    powerUp = null;
  }

  let nextState: GameState = { ...state, snake, dir: heading, lastStep: step, grow, powerUp, slowUntil, passes, bump: undefined };
  if (!eating) return nextState;

  eaten += 1;
  const points = 10 * speedLevel;
  score += points;
  events.push({ type: "ate", at: next, points });

  if (eaten >= level.goal) {
    const timeBonus = Math.max(0, Math.round(level.parSeconds - state.elapsedMs / 1000)) * 5;
    score += timeBonus;
    const stars = starsFor(level, score);
    events.push({ type: "cleared", score, stars, timeBonus });
    return { ...nextState, eaten, score, food: null, status: "cleared" };
  }

  const s = level.speed;
  if (s.step > 0 && eaten % s.every === 0 && speed < s.max) {
    speed = Math.min(s.max, speed + s.step);
    speedLevel += 1;
    events.push({ type: "speedup", speed });
  }

  nextState = placeFood({ ...nextState, eaten, score, speed, speedLevel });
  const rule = level.powerUps;
  if (rule && rule.kinds.length && eaten % rule.every === 0 && !nextState.powerUp) {
    nextState = placePowerUp(nextState);
    if (nextState.powerUp) events.push({ type: "powerAppeared", kind: nextState.powerUp.kind, at: nextState.powerUp.at });
  }
  return nextState;
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
  events: GameEvent[],
  pushed: boolean,
  vehicle?: VehicleDef["kind"],
): GameState {
  if (state.level.practice) {
    // In practice the snake stops in front of what it ran into and waits for a new direction.
    // It keeps the heading of its last real step, since it never moved the way that was blocked.
    events.push({ type: "bump", cause });
    return { ...state, dir: state.lastStep, queue: [], status: "ready", bump: cause };
  }
  events.push({ type: "crash", cause });
  const over: GameState = { ...state, dir, queue: [], status: "over", crash: cause, crashAt: at };
  if (vehicle) over.crashVehicle = vehicle;
  if (pushed) over.crashPushed = true;
  return over;
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
export function moveVehicles(level: LevelDef, fronts: number[], moves: number, snake: Cell[]): number[] {
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

/** The cells where a cowrie or a power-up may go: not on the snake, an obstacle, a vehicle or each other. */
function openCells(state: GameState): Cell[] {
  const taken = new Set(state.snake.map(key));
  for (const k of vehicleKeys(state)) taken.add(k);
  if (state.food) taken.add(key(state.food));
  if (state.powerUp) taken.add(key(state.powerUp.at));
  const open: Cell[] = [];
  for (let y = 0; y < state.level.height; y++) {
    for (let x = 0; x < state.level.width; x++) {
      const k = `${x},${y}`;
      if (!taken.has(k) && !state.obstacles.has(k)) open.push({ x, y });
    }
  }
  return open;
}

/** Puts a cowrie on a random open cell. */
export function placeFood(state: GameState): GameState {
  const open = openCells({ ...state, food: null });
  if (open.length === 0) return { ...state, food: null };
  const [r, rng] = nextRandom(state.rng);
  return { ...state, food: open[Math.floor(r * open.length)], rng };
}

/** Puts a power-up of a random kind from the level's list on a random open cell. */
export function placePowerUp(state: GameState, kind?: PowerKind): GameState {
  const rule = state.level.powerUps;
  if (!rule || !rule.kinds.length) return state;
  let rng = state.rng;
  if (!kind) {
    const [r, next] = nextRandom(rng);
    rng = next;
    kind = rule.kinds[Math.floor(r * rule.kinds.length)];
  }
  const open = openCells({ ...state, powerUp: null });
  if (open.length === 0) return { ...state, rng };
  const [r, next] = nextRandom(rng);
  return { ...state, powerUp: { kind, at: open[Math.floor(r * open.length)], until: state.moves + rule.lasts }, rng: next };
}
