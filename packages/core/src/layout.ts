// New layouts for every run. A level file is a template: its map says which obstacle pieces,
// currents and roads the level has, and newLayout() places them somewhere new on the board.
// The Maze builds a new maze instead. The same seed always gives the same layout, so the daily
// challenge is the same for everyone and the tests can fix a layout with a seed.
//
// Every layout follows the same rules, so a run is always fair:
// - The snake's starting cells and the cells just ahead of it stay clear.
// - Obstacle pieces keep one open cell between each other, the edge, roads and currents.
// - Roads keep clear of the start. Parallel roads sit at least 4 cells apart, farther than the
//   longest vehicle, so vehicles waiting at crossings can never block each other in a loop.
// - Vehicles stop for each other at crossings, the same way they stop for the snake.
// - Every open cell can be reached from the start, and validateLevel() finds no problem.
import { obstacleKeys, validateLevel } from "./levels";
import { nextRandom, seedFrom } from "./rng";
import type { Direction, LevelDef, VehicleDef } from "./types";

type Rand = () => number;

function randomFrom(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    const [r, next] = nextRandom(s);
    s = next;
    return r;
  };
}

const below = (r: Rand, n: number) => Math.floor(r() * n);

function shuffle<T>(r: Rand, list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = below(r, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The seed for a run's layout. It differs from the seed for the cowries, so the two don't move together. */
export const layoutSeed = (seed: number) => seedFrom(`sankofa-layout:${seed >>> 0}`);

/** How many fresh tries a layout gets before the level falls back to its own map. */
const TRIES = 80;

/** The gap, in cells, between parallel roads. Must be more than the longest vehicle. */
export const LANE_GAP = 4;

/** An obstacle piece from the template map, as cell offsets from its top left corner. */
interface Piece {
  cells: [number, number][];
  width: number;
  height: number;
}

/** A straight run of one current arrow in the template map. */
interface Run {
  axis: "row" | "column";
  length: number;
}

/** The pieces of obstacle in a map: groups of "#" cells that touch side by side. */
export function obstaclePieces(level: LevelDef): Piece[] {
  const left = obstacleKeys(level);
  const pieces: Piece[] = [];
  for (const start of [...left]) {
    if (!left.has(start)) continue;
    const found: [number, number][] = [];
    const stack = [start];
    left.delete(start);
    while (stack.length) {
      const [x, y] = stack.pop()!.split(",").map(Number);
      found.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (left.has(k)) {
          left.delete(k);
          stack.push(k);
        }
      }
    }
    const minX = Math.min(...found.map((c) => c[0]));
    const minY = Math.min(...found.map((c) => c[1]));
    const cells = found.map(([x, y]) => [x - minX, y - minY] as [number, number]);
    pieces.push({
      cells,
      width: Math.max(...cells.map((c) => c[0])) + 1,
      height: Math.max(...cells.map((c) => c[1])) + 1,
    });
  }
  return pieces;
}

/** The currents in a map, as straight runs: "<" and ">" along a row, "^" and "v" down a column. */
export function currentRuns(level: LevelDef): Run[] {
  const map = level.map ?? [];
  const runs: Run[] = [];
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if ((ch === "<" || ch === ">") && row[x - 1] !== ch) {
        let n = 0;
        while (row[x + n] === ch) n++;
        runs.push({ axis: "row", length: n });
      }
      if ((ch === "^" || ch === "v") && map[y - 1]?.[x] !== ch) {
        let n = 0;
        while (map[y + n]?.[x] === ch) n++;
        runs.push({ axis: "column", length: n });
      }
    }
  });
  return runs;
}

const STEP: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The snake's starting cells and the four cells ahead of its head, which every layout keeps clear. */
export function startZone(level: LevelDef): [number, number][] {
  const { x, y, dir, length } = level.start;
  const [dx, dy] = STEP[dir];
  const cells: [number, number][] = [];
  for (let i = -(length - 1); i <= 4; i++) cells.push([x + dx * i, y + dy * i]);
  return cells.filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < level.width && cy < level.height);
}

/** Every open cell can be reached from the snake's head without wrapping around an edge. */
export function allOpenConnected(level: LevelDef): boolean {
  const blocked = obstacleKeys(level);
  const { width, height } = level;
  const open = width * height - blocked.size;
  const first = `${level.start.x},${level.start.y}`;
  if (blocked.has(first)) return false;
  const seen = new Set([first]);
  const stack = [first];
  while (stack.length) {
    const [x, y] = stack.pop()!.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      stack.push(k);
    }
  }
  return seen.size === open;
}

/**
 * A new layout for a level. Levels with nothing to move, such as the Farm, come back unchanged.
 * If no fair layout turns up after many tries, the level keeps its own map.
 */
export function newLayout(level: LevelDef, seed: number): LevelDef {
  const mode = level.layout ?? "shuffle";
  if (mode === "fixed") return level;
  if (mode === "maze") return newMaze(level, randomFrom(seed));
  if (!level.map?.length && !level.vehicles?.length) return level;
  const r = randomFrom(seed);
  const pieces = obstaclePieces(level);
  const runs = currentRuns(level);
  for (let i = 0; i < TRIES; i++) {
    const made = tryShuffle(level, r, pieces, runs);
    if (made && allOpenConnected(made) && validateLevel(made).length === 0) return made;
  }
  return level;
}

function tryShuffle(level: LevelDef, r: Rand, pieces: Piece[], runs: Run[]): LevelDef | null {
  const { width, height } = level;
  const grid: string[][] = Array.from({ length: height }, () => Array<string>(width).fill("."));
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  // Cells nothing may cover: the start zone and the ring around it.
  const reserved = new Set<string>();
  for (const [x, y] of startZone(level)) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserved.add(`${x + dx},${y + dy}`);
  }

  // Roads first, since they cross the whole board.
  const lanes = placeLanes(level, r, reserved);
  if (!lanes) return null;
  const road = new Set<string>();
  for (const lane of lanes) {
    const along = lane.axis === "row" ? width : height;
    for (let p = 0; p < along; p++) road.add(lane.axis === "row" ? `${p},${lane.lane}` : `${lane.lane},${p}`);
  }
  const vehicles = placeVehicles(level, r, lanes);
  if (!vehicles) return null;

  // Nothing but open ground may touch a current or an obstacle, apart from roads under a current.
  const nearTaken = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (inside(nx, ny) && grid[ny][nx] !== ".") return true;
      }
    }
    return false;
  };

  for (const run of runs) {
    let placed = false;
    for (let t = 0; t < 200 && !placed; t++) {
      const flip = r() < 0.5;
      const arrow = run.axis === "row" ? (flip ? "<" : ">") : flip ? "^" : "v";
      const len = Math.min(run.length, run.axis === "row" ? width : height);
      const x0 = run.axis === "row" ? below(r, width - len + 1) : 1 + below(r, width - 2);
      const y0 = run.axis === "row" ? 1 + below(r, height - 2) : below(r, height - len + 1);
      const cells: [number, number][] = [];
      for (let i = 0; i < len; i++) cells.push(run.axis === "row" ? [x0 + i, y0] : [x0, y0 + i]);
      // A current may cross a road, and the road cells stay road. It never runs along one.
      const line = run.axis === "row" ? y0 : x0;
      if (lanes.some((l) => l.axis === run.axis && Math.abs(l.lane - line) < 2)) continue;
      const water = cells.filter(([x, y]) => !road.has(`${x},${y}`));
      if (water.some(([x, y]) => reserved.has(`${x},${y}`) || nearTaken(x, y))) continue;
      for (const [x, y] of water) grid[y][x] = arrow;
      placed = true;
    }
    if (!placed) return null;
  }

  for (const piece of shuffle(r, pieces)) {
    let placed = false;
    for (let t = 0; t < 300 && !placed; t++) {
      const x0 = 1 + below(r, width - piece.width - 1);
      const y0 = 1 + below(r, height - piece.height - 1);
      const cells = piece.cells.map(([x, y]) => [x0 + x, y0 + y] as [number, number]);
      const clash = cells.some(([x, y]) => {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const k = `${x + dx},${y + dy}`;
            if (road.has(k) || reserved.has(k)) return true;
          }
        }
        return nearTaken(x, y);
      });
      if (clash) continue;
      for (const [x, y] of cells) grid[y][x] = "#";
      placed = true;
    }
    if (!placed) return null;
  }

  const made: LevelDef = { ...level, map: grid.map((row) => row.join("")) };
  if (vehicles.length) made.vehicles = vehicles;
  else delete made.vehicles;
  if (!pieces.length && !runs.length) delete made.map;
  return made;
}

interface Lane {
  axis: "row" | "column";
  lane: number;
  dir: 1 | -1;
  vehicles: VehicleDef[];
}

/**
 * New roads, one for each road in the template. With two or more roads, at least one runs across
 * and one runs down, so they cross.
 */
function placeLanes(level: LevelDef, r: Rand, reserved: Set<string>): Lane[] | null {
  const groups = new Map<string, VehicleDef[]>();
  for (const v of level.vehicles ?? []) {
    const k = `${v.axis}:${v.lane}`;
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  const lists = [...groups.values()];
  if (!lists.length) return [];
  const axes: ("row" | "column")[] = lists.map(() => (r() < 0.5 ? "row" : "column"));
  if (lists.length >= 2 && axes.every((a) => a === axes[0])) axes[below(r, axes.length)] = axes[0] === "row" ? "column" : "row";
  const lanes: Lane[] = [];
  for (let i = 0; i < lists.length; i++) {
    const axis = axes[i];
    const across = axis === "row" ? level.height : level.width;
    const along = axis === "row" ? level.width : level.height;
    const options: number[] = [];
    for (let lane = 2; lane <= across - 3; lane++) {
      let free = true;
      for (let p = 0; p < along && free; p++) if (reserved.has(axis === "row" ? `${p},${lane}` : `${lane},${p}`)) free = false;
      if (free && lanes.every((l) => l.axis !== axis || Math.abs(l.lane - lane) >= LANE_GAP)) options.push(lane);
    }
    if (!options.length) return null;
    lanes.push({ axis, lane: options[below(r, options.length)], dir: r() < 0.5 ? 1 : -1, vehicles: lists[i] });
  }
  return lanes;
}

/** Puts each road's vehicles on it, spread out, with none starting on another. */
function placeVehicles(level: LevelDef, r: Rand, lanes: Lane[]): VehicleDef[] | null {
  const out: VehicleDef[] = [];
  const taken = new Set<string>();
  for (const lane of lanes) {
    const along = lane.axis === "row" ? level.width : level.height;
    for (const template of lane.vehicles) {
      let done = false;
      for (let t = 0; t < 100 && !done; t++) {
        const front = below(r, along);
        const cells: string[] = [];
        // The vehicle and one free cell in front of and behind it.
        for (let i = -1; i <= template.length; i++) {
          const p = (((front - lane.dir * i) % along) + along) % along;
          cells.push(lane.axis === "row" ? `${p},${lane.lane}` : `${lane.lane},${p}`);
        }
        if (cells.some((k) => taken.has(k))) continue;
        cells.forEach((k) => taken.add(k));
        out.push({ ...template, axis: lane.axis, lane: lane.lane, dir: lane.dir, start: front });
        done = true;
      }
      if (!done) return null;
    }
  }
  return out;
}

/**
 * A new maze: passages one cell wide on the even rows and columns, carved by a random walk, then
 * opened up so there are no dead ends, because a long snake can't turn round in one. A straight
 * stretch of passage holds the snake at the start.
 */
function newMaze(level: LevelDef, r: Rand): LevelDef {
  const { width, height } = level;
  const grid: string[][] = Array.from({ length: height }, () => Array<string>(width).fill("#"));
  const cols = Math.floor((width + 1) / 2);
  const rows = Math.floor((height + 1) / 2);
  const open = (x: number, y: number) => (grid[y][x] = ".");
  const seen = new Set<string>();
  const stack: [number, number][] = [[0, 0]];
  seen.add("0,0");
  open(0, 0);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const next = shuffle(r, [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][])
      .map(([dx, dy]) => [cx + dx, cy + dy] as [number, number])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen.has(`${nx},${ny}`));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next[0];
    seen.add(`${nx},${ny}`);
    open(cx + nx, cy + ny);
    open(nx * 2, ny * 2);
    stack.push([nx, ny]);
  }
  // Open one more wall at every dead end, and a few more at random, so the maze has loops.
  const wallsAround = (x: number, y: number) =>
    ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).filter(([dx, dy]) => {
      const nx = x + dx * 2;
      const ny = y + dy * 2;
      return nx >= 0 && ny >= 0 && nx < width && ny < height && grid[y + dy][x + dx] === "#";
    });
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const walls = wallsAround(x, y);
      const exits = 4 - walls.length - (x === 0 || x === width - 1 ? 1 : 0) - (y === 0 || y === height - 1 ? 1 : 0);
      if (exits <= 1 && walls.length) {
        const [dx, dy] = walls[below(r, walls.length)];
        open(x + dx, y + dy);
      } else if (walls.length && r() < 0.12) {
        const [dx, dy] = walls[below(r, walls.length)];
        open(x + dx, y + dy);
      }
    }
  }
  // The start sits on an even row, on a straight stretch from 3 cells behind the head to 4 ahead.
  const sy = level.start.y - (level.start.y % 2);
  const sx = level.start.x;
  for (let x = Math.max(0, sx - 3); x <= Math.min(width - 1, sx + 4); x++) open(x, sy);
  return { ...level, start: { ...level.start, y: sy }, map: grid.map((row) => row.join("")) };
}
