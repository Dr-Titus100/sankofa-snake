// Draws the board on a canvas: the kente frame, the scenery of each world, the market stalls,
// the cowrie and the snake made of woven blocks. Nothing here changes the game.
import type { Cell, Direction, GameState, LevelDef } from "../../../packages/core/src";
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

export function draw(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout, time: number, still: boolean) {
  const { level } = state;
  const { size, frame, cell } = layout;
  const world = WORLDS[level.world];
  ctx.clearRect(0, 0, size, size);
  drawFrame(ctx, size, frame);

  // Ground and scenery.
  ctx.fillStyle = world.ground;
  ctx.fillRect(frame, frame, size - frame * 2, size - frame * 2);
  for (let cy = 0; cy < level.height; cy++) {
    for (let cx = 0; cx < level.width; cx++) world.detail(ctx, frame + cx * cell, frame + cy * cell, cell, cx, cy);
  }

  // Faint thread lines for the grid, like the warp of a loom.
  ctx.strokeStyle = "rgba(242,183,5,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < level.width; i++) {
    const p = Math.round(frame + i * cell) + 0.5;
    ctx.moveTo(p, frame);
    ctx.lineTo(p, size - frame);
  }
  for (let i = 1; i < level.height; i++) {
    const p = Math.round(frame + i * cell) + 0.5;
    ctx.moveTo(frame, p);
    ctx.lineTo(size - frame, p);
  }
  ctx.stroke();

  for (const k of state.obstacles) {
    const [cx, cy] = k.split(",").map(Number);
    drawStall(ctx, frame + cx * cell, frame + cy * cell, cell, state.obstacles.has(`${cx},${cy - 1}`));
  }

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

/** A market stall: a striped kente awning over a wooden crate, or produce in a stall's back row. */
function drawStall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, backRow: boolean) {
  const pad = s * 0.04;
  ctx.fillStyle = "#7A4E2D";
  ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
  ctx.strokeStyle = "#4A2E18";
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  for (const f of [0.6, 0.8]) {
    ctx.moveTo(x + pad, y + s * f);
    ctx.lineTo(x + s - pad, y + s * f);
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
  ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
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
