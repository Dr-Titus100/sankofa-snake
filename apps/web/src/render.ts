// Draws the board on a canvas: the kente frame, the scenery of each world, the market stalls,
// city buildings, lab benches, maze walls, canoes and looms, the roads and their vehicles, the
// currents, the power-ups, the cowrie and the snake made of woven blocks.
// Nothing here changes the game.
import {
  isSlow,
  vehicleCells,
  type Cell,
  type Direction,
  type GameState,
  type LevelDef,
  type PowerUp,
  type VehicleDef,
} from "../../../packages/core/src";
import { KENTE as K } from "./logo";

interface World {
  ground: string;
  /** Draws the world's ground marks in one cell (crop rows, grass, floor tiles). */
  detail: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, cx: number, cy: number) => void;
}

/** A fixed pseudo-random number for a cell, so scenery stays in place from frame to frame. */
const cellHash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

const WORLDS: Record<LevelDef["world"], World> = {
  farm: {
    ground: "#2E2015",
    detail(ctx, x, y, s, cx, cy) {
      // Crop rows: a darker furrow along the bottom of every row, and a sprout in some cells.
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x, y + s * 0.8, s, s * 0.14);
      if (cellHash(cx, cy) % 6 === 0) {
        ctx.strokeStyle = "rgba(92,170,80,0.45)";
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.5, y + s * 0.78);
        ctx.lineTo(x + s * 0.5, y + s * 0.5);
        ctx.moveTo(x + s * 0.5, y + s * 0.6);
        ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.5, x + s * 0.28, y + s * 0.42);
        ctx.moveTo(x + s * 0.5, y + s * 0.6);
        ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.5, x + s * 0.72, y + s * 0.42);
        ctx.stroke();
      }
    },
  },
  park: {
    ground: "#143222",
    detail(ctx, x, y, s, cx, cy) {
      const h = cellHash(cx, cy);
      if (h % 4 === 0) {
        // A grass tuft.
        ctx.strokeStyle = "rgba(120,200,110,0.35)";
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        for (const dx of [-0.12, 0, 0.12]) {
          ctx.moveTo(x + s * (0.5 + dx), y + s * 0.75);
          ctx.lineTo(x + s * (0.5 + dx * 1.8), y + s * 0.45);
        }
        ctx.stroke();
      } else if (h % 11 === 1) {
        // A small gold flower.
        ctx.fillStyle = "rgba(242,183,5,0.5)";
        ctx.beginPath();
        ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  market: {
    ground: "#271B2E",
    detail(ctx, x, y, s, cx, cy) {
      // Floor tiles in a soft checker pattern.
      if ((cx + cy) % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.035)";
        ctx.fillRect(x, y, s, s);
      }
    },
  },
  city: {
    ground: "#1E1F26",
    detail(ctx, x, y, s, cx, cy) {
      // Paving slabs, and now and then a drain cover.
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84);
      if (cellHash(cx, cy) % 17 === 3) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4);
      }
    },
  },
  road: {
    ground: "#3A2A1C",
    detail(ctx, x, y, s, cx, cy) {
      // Red-earth roadside with a few stones.
      if (cellHash(cx, cy) % 7 === 2) {
        ctx.fillStyle = "rgba(255,230,200,0.12)";
        ctx.beginPath();
        ctx.arc(x + s * 0.35, y + s * 0.6, s * 0.07, 0, Math.PI * 2);
        ctx.arc(x + s * 0.62, y + s * 0.45, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  lab: {
    ground: "#15252B",
    detail(ctx, x, y, s, cx, cy) {
      // Large floor tiles, two cells to a tile.
      ctx.strokeStyle = "rgba(247,238,220,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (cx % 2 === 0) {
        ctx.moveTo(x + 0.5, y);
        ctx.lineTo(x + 0.5, y + s);
      }
      if (cy % 2 === 0) {
        ctx.moveTo(x, y + 0.5);
        ctx.lineTo(x + s, y + 0.5);
      }
      ctx.stroke();
    },
  },
  maze: {
    ground: "#2A2412",
    detail(ctx, x, y, s, cx, cy) {
      // A packed earth path with a few footprints of sand.
      if (cellHash(cx, cy) % 9 === 4) {
        ctx.fillStyle = "rgba(242,183,5,0.1)";
        ctx.beginPath();
        ctx.ellipse(x + s * 0.4, y + s * 0.55, s * 0.12, s * 0.07, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  ocean: {
    ground: "#0E2A3A",
    detail(ctx, x, y, s, cx, cy) {
      // Small wave crests here and there.
      if (cellHash(cx, cy) % 5 === 1) {
        ctx.strokeStyle = "rgba(247,238,220,0.14)";
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.2, y + s * 0.6);
        ctx.quadraticCurveTo(x + s * 0.35, y + s * 0.45, x + s * 0.5, y + s * 0.6);
        ctx.quadraticCurveTo(x + s * 0.65, y + s * 0.45, x + s * 0.8, y + s * 0.6);
        ctx.stroke();
      }
    },
  },
  village: {
    ground: "#33251A",
    detail(ctx, x, y, s, cx, cy) {
      // Swept earth, with now and then a fallen thread in kente colors.
      const h = cellHash(cx, cy);
      if (h % 13 === 5) {
        ctx.strokeStyle = [K.gold, K.green, K.red][h % 3];
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.2, y + s * 0.7);
        ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.3, x + s * 0.8, y + s * 0.6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  },
};

/** How each world draws its obstacles. */
const OBSTACLES: Partial<Record<LevelDef["world"], typeof drawStall>> = {
  city: drawBuilding,
  lab: drawBench,
  maze: drawReedWall,
  ocean: drawCanoe,
  village: drawLoom,
};

export interface Layout {
  /** Canvas size in CSS pixels (the canvas is square). */
  size: number;
  frame: number;
  cell: number;
}

export function layoutFor(size: number, level: LevelDef): Layout {
  const frame = Math.max(6, Math.round(size * 0.035));
  return { size, frame, cell: (size - frame * 2) / level.width };
}

/**
 * The parts of the board that never move during a run, drawn once per level and size and then
 * copied onto the board each frame. `back` is everything under the currents, `front` is the walls
 * and obstacles, which sit on top of them.
 */
export interface Scenery {
  level: LevelDef;
  obstacles: Set<string>;
  pixels: number;
  size: number;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
}

/** Holds the scenery between frames. The game keeps one per board. */
export type SceneryCache = { scenery?: Scenery };

function layer(ctx: CanvasRenderingContext2D): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = ctx.canvas.width;
  canvas.height = ctx.canvas.height;
  const c = canvas.getContext("2d")!;
  c.setTransform(ctx.getTransform());
  return [canvas, c];
}

function sceneryFor(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout, cache: SceneryCache): Scenery {
  const { level } = state;
  const old = cache.scenery;
  if (old && old.level === level && old.obstacles === state.obstacles && old.pixels === ctx.canvas.width && old.size === layout.size) {
    return old;
  }
  const { size, frame, cell } = layout;
  const world = WORLDS[level.world];
  const [back, b] = layer(ctx);
  drawFrame(b, size, frame);

  // Ground and scenery.
  b.fillStyle = world.ground;
  b.fillRect(frame, frame, size - frame * 2, size - frame * 2);
  for (let cy = 0; cy < level.height; cy++) {
    for (let cx = 0; cx < level.width; cx++) world.detail(b, frame + cx * cell, frame + cy * cell, cell, cx, cy);
  }

  // Faint thread lines for the grid, like the warp of a loom.
  b.strokeStyle = "rgba(242,183,5,0.08)";
  b.lineWidth = 1;
  b.beginPath();
  for (let i = 1; i < level.width; i++) {
    const p = Math.round(frame + i * cell) + 0.5;
    b.moveTo(p, frame);
    b.lineTo(p, size - frame);
  }
  for (let i = 1; i < level.height; i++) {
    const p = Math.round(frame + i * cell) + 0.5;
    b.moveTo(frame, p);
    b.lineTo(size - frame, p);
  }
  b.stroke();
  for (const v of level.vehicles ?? []) drawLane(b, v, layout, level);

  const [front, f] = layer(ctx);
  if (level.edges === "walls") drawWalls(f, layout);
  const drawObstacle = OBSTACLES[level.world] ?? drawStall;
  for (const k of state.obstacles) {
    const [cx, cy] = k.split(",").map(Number);
    drawObstacle(f, frame + cx * cell, frame + cy * cell, cell, state.obstacles.has(`${cx},${cy - 1}`), cx, cy, state.obstacles);
  }
  cache.scenery = { level, obstacles: state.obstacles, pixels: ctx.canvas.width, size, back, front };
  return cache.scenery;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  time: number,
  still: boolean,
  cache: SceneryCache = {},
) {
  const { level } = state;
  const { size, frame, cell } = layout;
  const scenery = sceneryFor(ctx, state, layout, cache);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(scenery.back, 0, 0, size, size);
  for (const [k, dir] of state.currents) {
    const [cx, cy] = k.split(",").map(Number);
    drawCurrent(ctx, frame + cx * cell, frame + cy * cell, cell, dir, still ? 0 : time);
  }
  ctx.drawImage(scenery.front, 0, 0, size, size);

  if (state.powerUp) drawPowerUp(ctx, state.powerUp, state.moves, layout, time, still);

  if (state.food) {
    const pulse = still ? 1 : 1 + 0.06 * Math.sin(time / 220);
    drawCowrie(ctx, frame + state.food.x * cell, frame + state.food.y * cell, cell, pulse);
  }

  // The snake, drawn tail first so the head sits on top.
  for (let i = state.snake.length - 1; i >= 0; i--) {
    const c = state.snake[i];
    const x = frame + c.x * cell;
    const y = frame + c.y * cell;
    if (i === 0) drawHead(ctx, x, y, cell, state.dir);
    else drawWoven(ctx, x, y, cell, i % 2);
  }
  // A green ring round the head while the snake has a pass through its own tail.
  if (state.passes > 0 && state.status !== "over") {
    const h = state.snake[0];
    ctx.strokeStyle = K.green;
    ctx.lineWidth = Math.max(2, cell * 0.1);
    ctx.setLineDash([cell * 0.18, cell * 0.12]);
    ctx.beginPath();
    ctx.arc(frame + (h.x + 0.5) * cell, frame + (h.y + 0.5) * cell, cell * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Vehicles go on top of everything else on the board, so a collision is easy to see.
  const count = { trotro: 0, taxi: 0 };
  level.vehicles?.forEach((v, i) => drawVehicle(ctx, v, vehicleCells(v, level, state.vehicles[i]), layout, count[v.kind]++));

  // In slow motion the board gets a pale gold veil at its edges.
  if (isSlow(state) && state.status !== "over") {
    ctx.strokeStyle = "rgba(242,183,5,0.35)";
    ctx.lineWidth = cell * 0.5;
    ctx.strokeRect(frame + cell * 0.25, frame + cell * 0.25, size - frame * 2 - cell * 0.5, size - frame * 2 - cell * 0.5);
  }

  if (state.status === "over" && state.crashAt) drawCrash(ctx, state.crashAt, layout);
}

/** A border of kente blocks around the board. */
function drawFrame(ctx: CanvasRenderingContext2D, size: number, f: number) {
  ctx.fillStyle = K.black;
  ctx.fillRect(0, 0, size, size);
  const colors = [K.gold, K.green, K.gold, K.red, K.gold, K.black];
  const block = f * 1.6;
  const strip = (x: number, y: number, w: number, h: number, horizontal: boolean) => {
    const length = horizontal ? w : h;
    for (let i = 0, p = 0; p < length; i++, p += block) {
      ctx.fillStyle = colors[i % colors.length];
      const len = Math.min(block - 1, length - p);
      if (horizontal) ctx.fillRect(x + p, y + 1, len, h - 2);
      else ctx.fillRect(x + 1, y + p, w - 2, len);
    }
  };
  strip(0, 0, size, f, true);
  strip(0, size - f, size, f, true);
  strip(0, f, f, size - f * 2, false);
  strip(size - f, f, f, size - f * 2, false);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * One block of the snake's body, drawn like a small square of kente: bands of thread that cross,
 * with some passing over and some under. Neighboring blocks alternate between two patterns.
 */
function drawWoven(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, variant: number, radius = 0.16) {
  const pad = s * 0.06;
  const w = s - pad * 2;
  const x0 = x + pad;
  const y0 = y + pad;
  ctx.save();
  roundRect(ctx, x0, y0, w, w, w * radius);
  ctx.clip();

  const vertical = (from: number, to: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x0 + w * from, y0, w * (to - from), w);
  };
  const horizontal = (from: number, to: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0 + w * from, w, w * (to - from));
  };
  // Where a crossing thread passes over, redraw a short piece of it on top.
  const over = (vFrom: number, vTo: number, hFrom: number, hTo: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x0 + w * vFrom, y0 + w * hFrom, w * (vTo - vFrom), w * (hTo - hFrom));
  };

  if (variant === 0) {
    ctx.fillStyle = K.gold;
    ctx.fillRect(x0, y0, w, w);
    horizontal(0.2, 0.28, K.black);
    horizontal(0.72, 0.8, K.black);
    vertical(0.1, 0.3, K.green);
    vertical(0.44, 0.56, K.red);
    vertical(0.7, 0.9, K.green);
    over(0.44, 0.56, 0.2, 0.28, K.black);
    over(0.1, 0.3, 0.72, 0.8, K.black);
    over(0.7, 0.9, 0.72, 0.8, K.black);
  } else {
    ctx.fillStyle = K.green;
    ctx.fillRect(x0, y0, w, w);
    vertical(0.22, 0.3, K.black);
    vertical(0.7, 0.78, K.black);
    horizontal(0.12, 0.32, K.gold);
    horizontal(0.46, 0.54, K.red);
    horizontal(0.68, 0.88, K.gold);
    over(0.22, 0.3, 0.46, 0.54, K.black);
    over(0.7, 0.78, 0.12, 0.32, K.black);
    over(0.7, 0.78, 0.68, 0.88, K.black);
  }
  ctx.restore();

  roundRect(ctx, x0, y0, w, w, w * radius);
  ctx.strokeStyle = K.black;
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.stroke();
}

const EYES: Record<Direction, [number, number][]> = {
  right: [[0.66, 0.3], [0.66, 0.7]],
  left: [[0.34, 0.3], [0.34, 0.7]],
  up: [[0.3, 0.34], [0.7, 0.34]],
  down: [[0.3, 0.66], [0.7, 0.66]],
};
const LOOK: Record<Direction, [number, number]> = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

/** The head: a woven block with rounder corners and two eyes looking the way the snake moves. */
function drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: Direction) {
  drawWoven(ctx, x, y, s, 0, 0.36);
  const [lx, ly] = LOOK[dir];
  for (const [ex, ey] of EYES[dir]) {
    ctx.fillStyle = K.cream;
    ctx.strokeStyle = K.black;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.arc(x + s * ex, y + s * ey, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = K.black;
    ctx.beginPath();
    ctx.arc(x + s * ex + lx * s * 0.04, y + s * ey + ly * s * 0.04, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A cowrie shell: a pale oval with a toothed slit down the middle. */
function drawCowrie(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, scale: number) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const rx = s * 0.32 * scale;
  const ry = s * 0.42 * scale;
  ctx.fillStyle = K.cream;
  ctx.strokeStyle = "#5A3A1E";
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry * 0.7);
  ctx.bezierCurveTo(cx - rx * 0.25, cy - ry * 0.2, cx + rx * 0.25, cy + ry * 0.2, cx, cy + ry * 0.7);
  for (let i = -2; i <= 2; i++) {
    const ty = cy + i * ry * 0.22;
    ctx.moveTo(cx - rx * 0.28, ty);
    ctx.lineTo(cx + rx * 0.28, ty);
  }
  ctx.stroke();
}

/**
 * The box one cell of a stall or bench fills. A side that touches another cell of the same piece
 * reaches the edge of the cell, so a stall or bench several cells big reads as one piece.
 */
function pieceBox(x: number, y: number, s: number, cx: number, cy: number, obstacles: Set<string> | undefined, pad: number) {
  const has = (dx: number, dy: number) => obstacles?.has(`${cx + dx},${cy + dy}`) ?? false;
  const sides = { left: has(-1, 0), right: has(1, 0), up: has(0, -1), down: has(0, 1) };
  const l = x + (sides.left ? 0 : pad);
  const t = y + (sides.up ? 0 : pad);
  const r = x + s - (sides.right ? 0 : pad);
  const b = y + s - (sides.down ? 0 : pad);
  return { l, t, r, b, sides };
}

/** Draws only the outer edges of a piece's cell, the ones with no neighbor on the other side. */
function outerEdges(ctx: CanvasRenderingContext2D, box: ReturnType<typeof pieceBox>) {
  const { l, t, r, b, sides } = box;
  ctx.beginPath();
  if (!sides.up) {
    ctx.moveTo(l, t);
    ctx.lineTo(r, t);
  }
  if (!sides.down) {
    ctx.moveTo(l, b);
    ctx.lineTo(r, b);
  }
  if (!sides.left) {
    ctx.moveTo(l, t);
    ctx.lineTo(l, b);
  }
  if (!sides.right) {
    ctx.moveTo(r, t);
    ctx.lineTo(r, b);
  }
  ctx.stroke();
}

/** A market stall: a striped kente awning over a wooden crate, or produce in a stall's back row. */
function drawStall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, backRow: boolean, cx = 0, cy = 0, obstacles?: Set<string>) {
  const pad = s * 0.04;
  const box = pieceBox(x, y, s, cx, cy, obstacles, pad);
  ctx.fillStyle = "#7A4E2D";
  ctx.fillRect(box.l, box.t, box.r - box.l, box.b - box.t);
  ctx.strokeStyle = "#4A2E18";
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  for (const f of [0.6, 0.8]) {
    ctx.moveTo(box.l, y + s * f);
    ctx.lineTo(box.r, y + s * f);
  }
  ctx.stroke();
  if (backRow) {
    // Produce piled on the crate: yams, peppers and limes.
    const fruit = [K.gold, K.red, K.green];
    fruit.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + s * (0.28 + i * 0.22), y + s * 0.36, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = K.black;
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.stroke();
    });
  } else {
    const stripes = [K.red, K.gold, K.green, K.gold];
    const band = (s - pad * 2) / stripes.length;
    stripes.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + pad + i * band, y + pad, band, s * 0.38);
    });
    // A scalloped edge along the bottom of the awning.
    ctx.fillStyle = K.gold;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + pad + band * (i + 0.5), y + pad + s * 0.38, band / 2, 0, Math.PI);
      ctx.fill();
    }
  }
  ctx.strokeStyle = K.black;
  ctx.lineWidth = Math.max(1, s * 0.06);
  outerEdges(ctx, box);
}

/**
 * A city building seen from above: a dark roof with a kente-colored band along its front edge and
 * lit windows. The colors change from block to block.
 */
function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, backRow: boolean, cx = 0, cy = 0) {
  const h = cellHash(cx, cy);
  ctx.fillStyle = ["#3B3540", "#463A33", "#33403A"][h % 3];
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (!backRow) {
    const stripes = [K.gold, K.green, K.red];
    stripes.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y + s * (0.04 + i * 0.07), s, s * 0.07);
    });
  }
  // Two rows of windows, some lit.
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const lit = (h >> (r * 2 + c)) & 1;
      ctx.fillStyle = lit ? "rgba(242,183,5,0.75)" : "rgba(247,238,220,0.12)";
      ctx.fillRect(x + s * (0.2 + c * 0.38), y + s * (backRow ? 0.2 : 0.38) + r * s * 0.3, s * 0.22, s * 0.18);
    }
  }
}

/** A strip of tarmac along a vehicle's lane, with a dashed center line. */
function drawLane(ctx: CanvasRenderingContext2D, v: VehicleDef, layout: Layout, level: LevelDef) {
  const { frame, cell } = layout;
  const long = (v.axis === "row" ? level.width : level.height) * cell;
  const across = frame + v.lane * cell;
  ctx.fillStyle = "#26252A";
  if (v.axis === "row") ctx.fillRect(frame, across, long, cell);
  else ctx.fillRect(across, frame, cell, long);
  ctx.strokeStyle = "rgba(247,238,220,0.35)";
  ctx.lineWidth = Math.max(1, cell * 0.06);
  ctx.setLineDash([cell * 0.4, cell * 0.35]);
  ctx.beginPath();
  if (v.axis === "row") {
    ctx.moveTo(frame, across + cell / 2);
    ctx.lineTo(frame + long, across + cell / 2);
  } else {
    ctx.moveTo(across + cell / 2, frame);
    ctx.lineTo(across + cell / 2, frame + long);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A red line just inside the kente frame, so walled levels look different from wrap-around ones. */
function drawWalls(ctx: CanvasRenderingContext2D, layout: Layout) {
  const { frame, size, cell } = layout;
  const w = Math.max(2, cell * 0.14);
  ctx.strokeStyle = K.red;
  ctx.lineWidth = w;
  ctx.strokeRect(frame + w / 2, frame + w / 2, size - frame * 2 - w, size - frame * 2 - w);
}

/**
 * Trotro paint jobs: a body color and the kente band down its side. Two trotros on one board get
 * different paint, and no trotro shares a body color with a taxi. No body is red, so the red
 * corner lights every vehicle carries always show.
 */
export const TROTRO_PAINT: { body: string; band: string[] }[] = [
  { body: "#F7EEDC", band: [K.green, K.red, K.green] },
  { body: "#2E8B57", band: [K.gold, K.red, K.gold] },
  { body: "#3D7CC9", band: [K.gold, K.green, K.gold] },
  { body: "#B8BCC2", band: [K.green, K.red, K.green] },
];

/**
 * Taxi paint jobs: the body, the outline and the windscreen. A black taxi gets a cream outline and
 * a pale windscreen, so it still stands out on the dark road.
 */
export const TAXI_PAINT: { body: string; outline: string; glass: string }[] = [
  { body: K.gold, outline: K.black, glass: "rgba(20,16,16,0.75)" },
  { body: K.black, outline: K.cream, glass: "rgba(247,238,220,0.6)" },
  { body: "#E8742A", outline: K.black, glass: "rgba(20,16,16,0.75)" },
  { body: "#7B4FA0", outline: K.black, glass: "rgba(20,16,16,0.75)" },
  { body: "#1E9E9A", outline: K.black, glass: "rgba(20,16,16,0.75)" },
];

/**
 * A vehicle seen from above, with a red light at each corner like the taxis in Accra. A trotro is a
 * minibus painted cream, green, blue or silver with a kente band down its side. A taxi is smaller,
 * painted gold, black, orange, purple or teal. A vehicle that wraps around the edge of the board is
 * drawn in two pieces. `index` counts the trotros or the taxis on the board, so each one gets its own paint.
 */
function drawVehicle(ctx: CanvasRenderingContext2D, v: VehicleDef, cells: Cell[], layout: Layout, index = 0) {
  const paint = TROTRO_PAINT[index % TROTRO_PAINT.length];
  const taxi = TAXI_PAINT[index % TAXI_PAINT.length];
  const { frame, cell } = layout;
  // Split the cells into runs that sit side by side on the board.
  const runs: Cell[][] = [];
  for (const c of cells) {
    const last = runs[runs.length - 1]?.[runs[runs.length - 1].length - 1];
    if (last && Math.abs(last.x - c.x) + Math.abs(last.y - c.y) === 1) runs[runs.length - 1].push(c);
    else runs.push([c]);
  }
  const forward = v.axis === "row" ? (v.dir === 1 ? "right" : "left") : v.dir === 1 ? "down" : "up";
  runs.forEach((run, r) => {
    const xs = run.map((c) => c.x);
    const ys = run.map((c) => c.y);
    const x = frame + Math.min(...xs) * cell;
    const y = frame + Math.min(...ys) * cell;
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * cell;
    const h = (Math.max(...ys) - Math.min(...ys) + 1) * cell;
    const pad = cell * 0.08;
    const bx = x + pad;
    const by = y + pad;
    const bw = w - pad * 2;
    const bh = h - pad * 2;
    // Wheels.
    ctx.fillStyle = K.black;
    const wheel = cell * 0.18;
    if (v.axis === "row") {
      for (const fx of [0.18, 0.82]) {
        ctx.fillRect(bx + bw * fx - wheel / 2, by - pad * 0.6, wheel, pad * 1.2);
        ctx.fillRect(bx + bw * fx - wheel / 2, by + bh - pad * 0.6, wheel, pad * 1.2);
      }
    } else {
      for (const fy of [0.18, 0.82]) {
        ctx.fillRect(bx - pad * 0.6, by + bh * fy - wheel / 2, pad * 1.2, wheel);
        ctx.fillRect(bx + bw - pad * 0.6, by + bh * fy - wheel / 2, pad * 1.2, wheel);
      }
    }
    // Body.
    ctx.fillStyle = v.kind === "trotro" ? paint.body : taxi.body;
    roundRect(ctx, bx, by, bw, bh, cell * 0.18);
    ctx.fill();
    if (v.kind === "trotro") {
      // A kente band along the side.
      paint.band.forEach((color, i) => {
        ctx.fillStyle = color;
        if (v.axis === "row") ctx.fillRect(bx, by + bh * (0.62 + i * 0.08), bw, bh * 0.08);
        else ctx.fillRect(bx + bw * (0.62 + i * 0.08), by, bw * 0.08, bh);
      });
    }
    // A red light at each corner.
    ctx.fillStyle = K.red;
    const c = cell * 0.22;
    ctx.fillRect(bx, by, c, c);
    ctx.fillRect(bx + bw - c, by, c, c);
    ctx.fillRect(bx, by + bh - c, c, c);
    ctx.fillRect(bx + bw - c, by + bh - c, c, c);
    // A windscreen on the front piece.
    if (r === 0) {
      ctx.fillStyle = v.kind === "trotro" ? "rgba(20,16,16,0.75)" : taxi.glass;
      const g = cell * 0.22;
      if (forward === "right") ctx.fillRect(bx + bw - g * 1.6, by + bh * 0.18, g, bh * 0.64);
      if (forward === "left") ctx.fillRect(bx + g * 0.6, by + bh * 0.18, g, bh * 0.64);
      if (forward === "down") ctx.fillRect(bx + bw * 0.18, by + bh - g * 1.6, bw * 0.64, g);
      if (forward === "up") ctx.fillRect(bx + bw * 0.18, by + g * 0.6, bw * 0.64, g);
    }
    ctx.strokeStyle = v.kind === "trotro" ? K.black : taxi.outline;
    ctx.lineWidth = Math.max(1, cell * 0.07);
    roundRect(ctx, bx, by, bw, bh, cell * 0.18);
    ctx.stroke();
  });
}

/** Marks the cell the snake crashed into with a cross on a pale ring, readable without color. */
function drawCrash(ctx: CanvasRenderingContext2D, at: Cell, layout: Layout) {
  const { frame, cell, size } = layout;
  const inside = Math.min(Math.max(at.x, -0.5), (size - frame * 2) / cell - 0.5);
  const cx = frame + (inside + 0.5) * cell;
  const cy = frame + (Math.min(Math.max(at.y, -0.5), (size - frame * 2) / cell - 0.5) + 0.5) * cell;
  const r = cell * 0.45;
  ctx.fillStyle = "rgba(247,238,220,0.92)";
  ctx.strokeStyle = K.black;
  ctx.lineWidth = Math.max(1.5, cell * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = K.red;
  ctx.lineWidth = Math.max(2, cell * 0.12);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
  ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
  ctx.moveTo(cx + r * 0.5, cy - r * 0.5);
  ctx.lineTo(cx - r * 0.5, cy + r * 0.5);
  ctx.stroke();
}

/**
 * A lab bench seen from above: a pale worktop with a flask or test tubes in kente colors on each
 * cell. Benches come in several sizes, and a bench several cells big is drawn as one worktop.
 */
function drawBench(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, _backRow: boolean, cx = 0, cy = 0, obstacles?: Set<string>) {
  const pad = s * 0.04;
  const box = pieceBox(x, y, s, cx, cy, obstacles, pad);
  ctx.fillStyle = "#C9C2B4";
  ctx.fillRect(box.l, box.t, box.r - box.l, box.b - box.t);
  ctx.strokeStyle = K.black;
  ctx.lineWidth = Math.max(1, s * 0.06);
  outerEdges(ctx, box);
  const h = cellHash(cx, cy);
  const colors = [K.green, K.red, K.gold];
  if (h % 2 === 0) {
    // A round flask.
    ctx.fillStyle = colors[h % 3];
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.56, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.stroke();
    ctx.fillStyle = K.cream;
    ctx.fillRect(x + s * 0.44, y + s * 0.16, s * 0.12, s * 0.2);
    ctx.strokeRect(x + s * 0.44, y + s * 0.16, s * 0.12, s * 0.2);
  } else {
    // A rack of three test tubes.
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + s * (0.2 + i * 0.22), y + s * 0.2, s * 0.14, s * 0.6);
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.strokeRect(x + s * (0.2 + i * 0.22), y + s * 0.2, s * 0.14, s * 0.6);
    });
  }
}

/** A maze wall made of woven reeds: gold and brown strands in a basket weave. */
function drawReedWall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, _backRow: boolean, cx = 0, cy = 0) {
  ctx.fillStyle = "#8A6420";
  ctx.fillRect(x, y, s, s);
  const flip = (cx + cy) % 2 === 0;
  ctx.fillStyle = "#C8962A";
  for (let i = 0; i < 3; i++) {
    if (flip) ctx.fillRect(x + s * (0.06 + i * 0.32), y + s * 0.06, s * 0.24, s * 0.88);
    else ctx.fillRect(x + s * 0.06, y + s * (0.06 + i * 0.32), s * 0.88, s * 0.24);
  }
  ctx.strokeStyle = "rgba(20,16,16,0.6)";
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

/**
 * A power-up: a cream disc with a black ring and an icon. Slow motion is a gold hourglass, shrink
 * is two red arrows pointing in, and a pass is a green loop. It blinks when it is about to go.
 */
function drawPowerUp(ctx: CanvasRenderingContext2D, p: PowerUp, moves: number, layout: Layout, time: number, still: boolean) {
  const { frame, cell } = layout;
  if (!still && p.until - moves <= 12 && Math.floor(time / 180) % 2 === 0) return;
  const cx = frame + (p.at.x + 0.5) * cell;
  const cy = frame + (p.at.y + 0.5) * cell;
  const r = cell * 0.44;
  ctx.fillStyle = K.cream;
  ctx.strokeStyle = K.black;
  ctx.lineWidth = Math.max(1.5, cell * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = Math.max(1, cell * 0.06);
  if (p.kind === "slow") {
    ctx.fillStyle = K.gold;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.45, cy - r * 0.55);
    ctx.lineTo(cx - r * 0.45, cy + r * 0.55);
    ctx.lineTo(cx + r * 0.45, cy + r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === "shrink") {
    ctx.strokeStyle = K.red;
    ctx.lineWidth = Math.max(1.5, cell * 0.09);
    ctx.beginPath();
    for (const d of [-1, 1]) {
      ctx.moveTo(cx + d * r * 0.7, cy);
      ctx.lineTo(cx + d * r * 0.12, cy);
      ctx.moveTo(cx + d * r * 0.36, cy - r * 0.26);
      ctx.lineTo(cx + d * r * 0.12, cy);
      ctx.lineTo(cx + d * r * 0.36, cy + r * 0.26);
    }
    ctx.stroke();
  } else {
    ctx.strokeStyle = K.green;
    ctx.lineWidth = Math.max(1.5, cell * 0.1);
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.22, cy, r * 0.3, r * 0.42, 0, 0, Math.PI * 2);
    ctx.moveTo(cx + r * 0.38, cy);
    ctx.ellipse(cx + r * 0.22, cy, r * 0.3, r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

const ARROW: Record<Direction, [number, number]> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

/**
 * A current: a lighter strip of water with a chevron pointing the way it pushes. The chevrons
 * drift slowly in that direction, unless the player asked for less motion.
 */
function drawCurrent(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: Direction, time: number) {
  ctx.fillStyle = "rgba(90,170,200,0.28)";
  ctx.fillRect(x, y, s, s);
  const [dx, dy] = ARROW[dir];
  const drift = ((time / 900) % 1) * 0.3 - 0.15;
  const cx = x + s * (0.5 + dx * drift);
  const cy = y + s * (0.5 + dy * drift);
  const a = s * 0.2;
  ctx.strokeStyle = "rgba(247,238,220,0.7)";
  ctx.lineWidth = Math.max(1.5, s * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  // Two arms that meet at the tip, pointing in the push direction.
  ctx.moveTo(cx - dx * a - dy * a, cy - dy * a - dx * a);
  ctx.lineTo(cx + dx * a * 0.6, cy + dy * a * 0.6);
  ctx.lineTo(cx - dx * a + dy * a, cy - dy * a + dx * a);
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** Canoe paint jobs: the hull color and the stripe along its side. Each canoe on the board gets its own. */
export const CANOE_PAINT: { hull: string; band: string }[] = [
  { hull: "#8A5A32", band: K.gold },
  { hull: "#2F6FA8", band: K.gold },
  { hull: "#C8372D", band: K.gold },
  { hull: "#2E8B57", band: K.red },
  { hull: "#E9DFC8", band: K.red },
];

/**
 * Which paint a canoe gets: its place among all the canoes on the board, counted from the top left.
 * A canoe is a run of cells in one row, and it starts at the cell with nothing on its left.
 */
export function canoeIndex(cx: number, cy: number, obstacles?: Set<string>) {
  if (!obstacles) return 0;
  let start = cx;
  while (obstacles.has(`${start - 1},${cy}`)) start--;
  const starts = [...obstacles]
    .map((k) => k.split(",").map(Number))
    .filter(([x, y]) => !obstacles.has(`${x - 1},${y}`))
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return Math.max(0, starts.findIndex(([x, y]) => x === start && y === cy));
}

/**
 * A fishing canoe seen from above, pointed at both ends, with a painted stripe. A canoe three
 * cells long is drawn as one boat: the end pieces are the bow and stern, the middle is the hull.
 * Every canoe on the board has a different hull color, like the painted canoes on Ghana's beaches.
 */
function drawCanoe(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, _backRow: boolean, cx = 0, cy = 0, obstacles?: Set<string>) {
  const left = obstacles?.has(`${cx - 1},${cy}`) ?? false;
  const right = obstacles?.has(`${cx + 1},${cy}`) ?? false;
  const paint = CANOE_PAINT[canoeIndex(cx, cy, obstacles) % CANOE_PAINT.length];
  const top = y + s * 0.22;
  const bottom = y + s * 0.78;
  ctx.fillStyle = paint.hull;
  ctx.strokeStyle = K.black;
  ctx.lineWidth = Math.max(1, s * 0.06);
  const mid = y + s * 0.5;
  // The hull: a pointed end where the canoe stops, and a straight cut where it goes on into the next cell.
  ctx.beginPath();
  ctx.moveTo(left ? x : x + s * 0.05, left ? top : mid);
  if (!left) ctx.quadraticCurveTo(x + s * 0.2, top, x + s * 0.5, top);
  ctx.lineTo(right ? x + s : x + s * 0.5, top);
  if (right) ctx.lineTo(x + s, bottom);
  else {
    ctx.quadraticCurveTo(x + s * 0.8, top, x + s * 0.95, mid);
    ctx.quadraticCurveTo(x + s * 0.8, bottom, x + s * 0.5, bottom);
  }
  ctx.lineTo(left ? x : x + s * 0.5, bottom);
  if (!left) ctx.quadraticCurveTo(x + s * 0.2, bottom, x + s * 0.05, mid);
  ctx.closePath();
  ctx.fill();
  // The outline skips the straight cuts, so a canoe three cells long reads as one boat.
  ctx.beginPath();
  ctx.moveTo(left ? x : x + s * 0.5, top);
  ctx.lineTo(right ? x + s : x + s * 0.5, top);
  ctx.moveTo(left ? x : x + s * 0.5, bottom);
  ctx.lineTo(right ? x + s : x + s * 0.5, bottom);
  if (!left) {
    ctx.moveTo(x + s * 0.5, top);
    ctx.quadraticCurveTo(x + s * 0.2, top, x + s * 0.05, mid);
    ctx.quadraticCurveTo(x + s * 0.2, bottom, x + s * 0.5, bottom);
  }
  if (!right) {
    ctx.moveTo(x + s * 0.5, top);
    ctx.quadraticCurveTo(x + s * 0.8, top, x + s * 0.95, mid);
    ctx.quadraticCurveTo(x + s * 0.8, bottom, x + s * 0.5, bottom);
  }
  ctx.stroke();
  // One painted stripe along the side, so most of the hull shows its color.
  ctx.fillStyle = paint.band;
  ctx.fillRect(x + (left ? 0 : s * 0.3), y + s * 0.44, s - (left ? 0 : s * 0.3) - (right ? 0 : s * 0.3), s * 0.12);
}

/**
 * A kente loom seen from above: a wooden frame with a strip of cloth half woven on it, gold, green
 * and red. The pattern changes from loom to loom.
 */
function drawLoom(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, _backRow: boolean, cx = 0, cy = 0) {
  const pad = s * 0.06;
  ctx.fillStyle = "#5A3A1E";
  ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
  const colors = [K.gold, K.green, K.red, K.gold, K.black];
  const shift = cellHash(cx, cy) % colors.length;
  const strip = s * 0.5;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[(i + shift) % colors.length];
    ctx.fillRect(x + (s - strip) / 2, y + pad + i * ((s - pad * 2) / 5), strip, (s - pad * 2) / 5);
  }
  // Warp threads running past the cloth.
  ctx.strokeStyle = "rgba(247,238,220,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const f of [0.3, 0.42, 0.58, 0.7]) {
    ctx.moveTo(x + s * f, y + pad);
    ctx.lineTo(x + s * f, y + s - pad);
  }
  ctx.stroke();
  ctx.strokeStyle = K.black;
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
}
