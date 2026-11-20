// Made by ports/build-assets.mjs from apps/web/src/render.ts, sound.ts, logo.ts and input.ts. Do not edit by hand.
var SankofaBoard = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // <stdin>
  var stdin_exports = {};
  __export(stdin_exports, {
    KENTE: () => KENTE,
    Sound: () => Sound,
    draw: () => draw,
    inputKind: () => inputKind,
    layoutFor: () => layoutFor,
    listenForSwipes: () => listenForSwipes,
    sankofaLogo: () => sankofaLogo,
    swipeDirection: () => swipeDirection
  });

  // packages/core/src/game.ts
  var isSlow = (state) => state.moves < state.slowUntil;
  function vehicleCells(v, level, front) {
    const laneLength = v.axis === "row" ? level.width : level.height;
    const cells = [];
    for (let i = 0; i < v.length; i++) {
      const along = ((front - v.dir * i) % laneLength + laneLength) % laneLength;
      cells.push(v.axis === "row" ? { x: along, y: v.lane } : { x: v.lane, y: along });
    }
    return cells;
  }

  // apps/web/src/logo.ts
  var KENTE = {
    gold: "#F2B705",
    green: "#1E8A3E",
    red: "#C8102E",
    black: "#141010",
    cream: "#F7EEDC"
  };
  var logoCount = 0;
  function sankofaLogo(size = 120, title = "Sankofa bird") {
    const k = KENTE;
    const clip = `ss-body-${++logoCount}`;
    const label = title.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const px = Math.max(1, Math.round(Number(size) || 120));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}" role="img" aria-label="${label}">
  <defs>
    <clipPath id="${clip}"><path d="M28 60C28 44 46 36 63 42C77 47 82 60 74 70C66 79 45 81 34 74C30 71 28 66 28 60Z"/></clipPath>
  </defs>
  <path d="M33 56L11 46L16 60L10 74L33 70Z" fill="${k.gold}" stroke="${k.black}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M28 60C28 44 46 36 63 42C77 47 82 60 74 70C66 79 45 81 34 74C30 71 28 66 28 60Z" fill="${k.gold}"/>
  <g clip-path="url(#${clip})">
    <rect x="20" y="55" width="70" height="5" fill="${k.green}"/>
    <rect x="20" y="60" width="70" height="3" fill="${k.red}"/>
    <rect x="20" y="63" width="70" height="5" fill="${k.green}"/>
    <rect x="44" y="40" width="3" height="40" fill="${k.black}"/>
    <rect x="58" y="40" width="3" height="40" fill="${k.black}"/>
  </g>
  <path d="M28 60C28 44 46 36 63 42C77 47 82 60 74 70C66 79 45 81 34 74C30 71 28 66 28 60Z" fill="none" stroke="${k.black}" stroke-width="2.5"/>
  <path d="M64 45C72 33 70 21 61 19C55 18 51 22 50 27" fill="none" stroke="${k.black}" stroke-width="10" stroke-linecap="round"/>
  <path d="M64 45C72 33 70 21 61 19C55 18 51 22 50 27" fill="none" stroke="${k.gold}" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="49" cy="29" r="7.5" fill="${k.gold}" stroke="${k.black}" stroke-width="2.5"/>
  <circle cx="51" cy="27" r="1.8" fill="${k.black}"/>
  <path d="M43.5 30L36 38.5L46 35Z" fill="${k.red}" stroke="${k.black}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="34" cy="41" rx="4.6" ry="5.4" transform="rotate(-25 34 41)" fill="${k.cream}" stroke="${k.black}" stroke-width="2"/>
  <path d="M50 78L51 91M51 91L58 91M62 77L65 91M65 91L72 91" fill="none" stroke="${k.black}" stroke-width="3" stroke-linecap="round"/>
</svg>`;
  }

  // apps/web/src/render.ts
  var cellHash = (x, y) => {
    let h = x * 374761393 + y * 668265263 >>> 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return (h ^ h >>> 16) >>> 0;
  };
  var WORLDS = {
    farm: {
      ground: "#2E2015",
      detail(ctx, x, y, s, cx, cy) {
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
      }
    },
    park: {
      ground: "#143222",
      detail(ctx, x, y, s, cx, cy) {
        const h = cellHash(cx, cy);
        if (h % 4 === 0) {
          ctx.strokeStyle = "rgba(120,200,110,0.35)";
          ctx.lineWidth = Math.max(1, s * 0.05);
          ctx.beginPath();
          for (const dx of [-0.12, 0, 0.12]) {
            ctx.moveTo(x + s * (0.5 + dx), y + s * 0.75);
            ctx.lineTo(x + s * (0.5 + dx * 1.8), y + s * 0.45);
          }
          ctx.stroke();
        } else if (h % 11 === 1) {
          ctx.fillStyle = "rgba(242,183,5,0.5)";
          ctx.beginPath();
          ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    market: {
      ground: "#271B2E",
      detail(ctx, x, y, s, cx, cy) {
        if ((cx + cy) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.035)";
          ctx.fillRect(x, y, s, s);
        }
      }
    },
    city: {
      ground: "#1E1F26",
      detail(ctx, x, y, s, cx, cy) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84);
        if (cellHash(cx, cy) % 17 === 3) {
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4);
        }
      }
    },
    road: {
      ground: "#3A2A1C",
      detail(ctx, x, y, s, cx, cy) {
        if (cellHash(cx, cy) % 7 === 2) {
          ctx.fillStyle = "rgba(255,230,200,0.12)";
          ctx.beginPath();
          ctx.arc(x + s * 0.35, y + s * 0.6, s * 0.07, 0, Math.PI * 2);
          ctx.arc(x + s * 0.62, y + s * 0.45, s * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    lab: {
      ground: "#15252B",
      detail(ctx, x, y, s, cx, cy) {
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
      }
    },
    maze: {
      ground: "#2A2412",
      detail(ctx, x, y, s, cx, cy) {
        if (cellHash(cx, cy) % 9 === 4) {
          ctx.fillStyle = "rgba(242,183,5,0.1)";
          ctx.beginPath();
          ctx.ellipse(x + s * 0.4, y + s * 0.55, s * 0.12, s * 0.07, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    ocean: {
      ground: "#0E2A3A",
      detail(ctx, x, y, s, cx, cy) {
        if (cellHash(cx, cy) % 5 === 1) {
          ctx.strokeStyle = "rgba(247,238,220,0.14)";
          ctx.lineWidth = Math.max(1, s * 0.05);
          ctx.beginPath();
          ctx.moveTo(x + s * 0.2, y + s * 0.6);
          ctx.quadraticCurveTo(x + s * 0.35, y + s * 0.45, x + s * 0.5, y + s * 0.6);
          ctx.quadraticCurveTo(x + s * 0.65, y + s * 0.45, x + s * 0.8, y + s * 0.6);
          ctx.stroke();
        }
      }
    },
    village: {
      ground: "#33251A",
      detail(ctx, x, y, s, cx, cy) {
        const h = cellHash(cx, cy);
        if (h % 13 === 5) {
          ctx.strokeStyle = [KENTE.gold, KENTE.green, KENTE.red][h % 3];
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = Math.max(1, s * 0.04);
          ctx.beginPath();
          ctx.moveTo(x + s * 0.2, y + s * 0.7);
          ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.3, x + s * 0.8, y + s * 0.6);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  };
  var OBSTACLES = {
    city: drawBuilding,
    lab: drawBench,
    maze: drawReedWall,
    ocean: drawCanoe,
    village: drawLoom
  };
  function layoutFor(size, level) {
    const frame = Math.max(6, Math.round(size * 0.035));
    return { size, frame, cell: (size - frame * 2) / level.width };
  }
  function layer(ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = ctx.canvas.width;
    canvas.height = ctx.canvas.height;
    const c = canvas.getContext("2d");
    c.setTransform(ctx.getTransform());
    return [canvas, c];
  }
  function sceneryFor(ctx, state, layout, cache) {
    const { level } = state;
    const old = cache.scenery;
    if (old && old.level === level && old.obstacles === state.obstacles && old.pixels === ctx.canvas.width && old.size === layout.size) {
      return old;
    }
    const { size, frame, cell } = layout;
    const world = WORLDS[level.world];
    const [back, b] = layer(ctx);
    drawFrame(b, size, frame);
    b.fillStyle = world.ground;
    b.fillRect(frame, frame, size - frame * 2, size - frame * 2);
    for (let cy = 0; cy < level.height; cy++) {
      for (let cx = 0; cx < level.width; cx++) world.detail(b, frame + cx * cell, frame + cy * cell, cell, cx, cy);
    }
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
  function draw(ctx, state, layout, time, still, cache = {}) {
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
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const c = state.snake[i];
      const x = frame + c.x * cell;
      const y = frame + c.y * cell;
      if (i === 0) drawHead(ctx, x, y, cell, state.dir);
      else drawWoven(ctx, x, y, cell, i % 2);
    }
    if (state.passes > 0 && state.status !== "over") {
      const h = state.snake[0];
      ctx.strokeStyle = KENTE.green;
      ctx.lineWidth = Math.max(2, cell * 0.1);
      ctx.setLineDash([cell * 0.18, cell * 0.12]);
      ctx.beginPath();
      ctx.arc(frame + (h.x + 0.5) * cell, frame + (h.y + 0.5) * cell, cell * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const paints = vehiclePaints(level);
    level.vehicles?.forEach((v, i) => drawVehicle(ctx, v, vehicleCells(v, level, state.vehicles[i]), layout, paints[i]));
    if (isSlow(state) && state.status !== "over") {
      ctx.strokeStyle = "rgba(242,183,5,0.35)";
      ctx.lineWidth = cell * 0.5;
      ctx.strokeRect(frame + cell * 0.25, frame + cell * 0.25, size - frame * 2 - cell * 0.5, size - frame * 2 - cell * 0.5);
    }
    if (state.status === "over" && state.crashAt) drawCrash(ctx, state.crashAt, layout);
  }
  function drawFrame(ctx, size, f) {
    ctx.fillStyle = KENTE.black;
    ctx.fillRect(0, 0, size, size);
    const colors = [KENTE.gold, KENTE.green, KENTE.gold, KENTE.red, KENTE.gold, KENTE.black];
    const block = f * 1.6;
    const strip = (x, y, w, h, horizontal) => {
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
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawWoven(ctx, x, y, s, variant, radius = 0.16) {
    const pad = s * 0.06;
    const w = s - pad * 2;
    const x0 = x + pad;
    const y0 = y + pad;
    ctx.save();
    roundRect(ctx, x0, y0, w, w, w * radius);
    ctx.clip();
    const vertical = (from, to, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x0 + w * from, y0, w * (to - from), w);
    };
    const horizontal = (from, to, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x0, y0 + w * from, w, w * (to - from));
    };
    const over = (vFrom, vTo, hFrom, hTo, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x0 + w * vFrom, y0 + w * hFrom, w * (vTo - vFrom), w * (hTo - hFrom));
    };
    if (variant === 0) {
      ctx.fillStyle = KENTE.gold;
      ctx.fillRect(x0, y0, w, w);
      horizontal(0.2, 0.28, KENTE.black);
      horizontal(0.72, 0.8, KENTE.black);
      vertical(0.1, 0.3, KENTE.green);
      vertical(0.44, 0.56, KENTE.red);
      vertical(0.7, 0.9, KENTE.green);
      over(0.44, 0.56, 0.2, 0.28, KENTE.black);
      over(0.1, 0.3, 0.72, 0.8, KENTE.black);
      over(0.7, 0.9, 0.72, 0.8, KENTE.black);
    } else {
      ctx.fillStyle = KENTE.green;
      ctx.fillRect(x0, y0, w, w);
      vertical(0.22, 0.3, KENTE.black);
      vertical(0.7, 0.78, KENTE.black);
      horizontal(0.12, 0.32, KENTE.gold);
      horizontal(0.46, 0.54, KENTE.red);
      horizontal(0.68, 0.88, KENTE.gold);
      over(0.22, 0.3, 0.46, 0.54, KENTE.black);
      over(0.7, 0.78, 0.12, 0.32, KENTE.black);
      over(0.7, 0.78, 0.68, 0.88, KENTE.black);
    }
    ctx.restore();
    roundRect(ctx, x0, y0, w, w, w * radius);
    ctx.strokeStyle = KENTE.black;
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.stroke();
  }
  var EYES = {
    right: [[0.66, 0.3], [0.66, 0.7]],
    left: [[0.34, 0.3], [0.34, 0.7]],
    up: [[0.3, 0.34], [0.7, 0.34]],
    down: [[0.3, 0.66], [0.7, 0.66]]
  };
  var LOOK = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
  function drawHead(ctx, x, y, s, dir) {
    drawWoven(ctx, x, y, s, 0, 0.36);
    const [lx, ly] = LOOK[dir];
    for (const [ex, ey] of EYES[dir]) {
      ctx.fillStyle = KENTE.cream;
      ctx.strokeStyle = KENTE.black;
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath();
      ctx.arc(x + s * ex, y + s * ey, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = KENTE.black;
      ctx.beginPath();
      ctx.arc(x + s * ex + lx * s * 0.04, y + s * ey + ly * s * 0.04, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawCowrie(ctx, x, y, s, scale) {
    const cx = x + s / 2;
    const cy = y + s / 2;
    const rx = s * 0.32 * scale;
    const ry = s * 0.42 * scale;
    ctx.fillStyle = KENTE.cream;
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
  function pieceBox(x, y, s, cx, cy, obstacles, pad) {
    const has = (dx, dy) => obstacles?.has(`${cx + dx},${cy + dy}`) ?? false;
    const sides = { left: has(-1, 0), right: has(1, 0), up: has(0, -1), down: has(0, 1) };
    const l = x + (sides.left ? 0 : pad);
    const t = y + (sides.up ? 0 : pad);
    const r = x + s - (sides.right ? 0 : pad);
    const b = y + s - (sides.down ? 0 : pad);
    return { l, t, r, b, sides };
  }
  function outerEdges(ctx, box) {
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
  function drawStall(ctx, x, y, s, backRow, cx = 0, cy = 0, obstacles) {
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
      const fruit = [KENTE.gold, KENTE.red, KENTE.green];
      fruit.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + s * (0.28 + i * 0.22), y + s * 0.36, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = KENTE.black;
        ctx.lineWidth = Math.max(1, s * 0.035);
        ctx.stroke();
      });
    } else {
      const stripes = [KENTE.red, KENTE.gold, KENTE.green, KENTE.gold];
      const band = (s - pad * 2) / stripes.length;
      stripes.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(x + pad + i * band, y + pad, band, s * 0.38);
      });
      ctx.fillStyle = KENTE.gold;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + pad + band * (i + 0.5), y + pad + s * 0.38, band / 2, 0, Math.PI);
        ctx.fill();
      }
    }
    ctx.strokeStyle = KENTE.black;
    ctx.lineWidth = Math.max(1, s * 0.06);
    outerEdges(ctx, box);
  }
  function drawBuilding(ctx, x, y, s, backRow, cx = 0, cy = 0) {
    const h = cellHash(cx, cy);
    ctx.fillStyle = ["#3B3540", "#463A33", "#33403A"][h % 3];
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    if (!backRow) {
      const stripes = [KENTE.gold, KENTE.green, KENTE.red];
      stripes.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y + s * (0.04 + i * 0.07), s, s * 0.07);
      });
    }
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const lit = h >> r * 2 + c & 1;
        ctx.fillStyle = lit ? "rgba(242,183,5,0.75)" : "rgba(247,238,220,0.12)";
        ctx.fillRect(x + s * (0.2 + c * 0.38), y + s * (backRow ? 0.2 : 0.38) + r * s * 0.3, s * 0.22, s * 0.18);
      }
    }
  }
  function drawLane(ctx, v, layout, level) {
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
  function drawWalls(ctx, layout) {
    const { frame, size, cell } = layout;
    const w = Math.max(2, cell * 0.14);
    ctx.strokeStyle = KENTE.red;
    ctx.lineWidth = w;
    ctx.strokeRect(frame + w / 2, frame + w / 2, size - frame * 2 - w, size - frame * 2 - w);
  }
  var TROTRO_PAINT = [
    { body: "#F7EEDC", band: [KENTE.green, KENTE.red, KENTE.green] },
    { body: "#2E8B57", band: [KENTE.gold, KENTE.red, KENTE.gold] },
    { body: "#3D7CC9", band: [KENTE.gold, KENTE.green, KENTE.gold] },
    { body: "#B8BCC2", band: [KENTE.green, KENTE.red, KENTE.green] }
  ];
  var TAXI_PAINT = [
    { body: KENTE.gold, outline: KENTE.black, glass: "rgba(20,16,16,0.75)" },
    { body: KENTE.black, outline: KENTE.cream, glass: "rgba(247,238,220,0.6)" },
    { body: "#E8742A", outline: KENTE.black, glass: "rgba(20,16,16,0.75)" },
    { body: "#7B4FA0", outline: KENTE.black, glass: "rgba(20,16,16,0.75)" },
    { body: "#1E9E9A", outline: KENTE.black, glass: "rgba(20,16,16,0.75)" }
  ];
  function vehiclePaints(level) {
    const vehicles = level.vehicles ?? [];
    let h = 2166136261;
    for (const v of vehicles) {
      for (const n of [v.axis === "row" ? 1 : 2, v.lane, v.start, v.dir, v.length]) h = Math.imul(h ^ n & 255, 16777619);
    }
    const next = () => {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      return (h >>> 0) / 4294967296;
    };
    const order = (size) => {
      const list = [...Array(size).keys()];
      for (let i = size - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    const picks = { trotro: order(TROTRO_PAINT.length), taxi: order(TAXI_PAINT.length) };
    const count = { trotro: 0, taxi: 0 };
    return vehicles.map((v) => picks[v.kind][count[v.kind]++ % picks[v.kind].length]);
  }
  function drawVehicle(ctx, v, cells, layout, index = 0) {
    const paint = TROTRO_PAINT[index % TROTRO_PAINT.length];
    const taxi = TAXI_PAINT[index % TAXI_PAINT.length];
    const { frame, cell } = layout;
    const runs = [];
    for (const c of cells) {
      const last = runs[runs.length - 1]?.[runs[runs.length - 1].length - 1];
      if (last && Math.abs(last.x - c.x) + Math.abs(last.y - c.y) === 1) runs[runs.length - 1].push(c);
      else runs.push([c]);
    }
    const forward = v.axis === "row" ? v.dir === 1 ? "right" : "left" : v.dir === 1 ? "down" : "up";
    runs.forEach((run, r) => {
      const xs = run.map((c2) => c2.x);
      const ys = run.map((c2) => c2.y);
      const x = frame + Math.min(...xs) * cell;
      const y = frame + Math.min(...ys) * cell;
      const w = (Math.max(...xs) - Math.min(...xs) + 1) * cell;
      const h = (Math.max(...ys) - Math.min(...ys) + 1) * cell;
      const pad = cell * 0.08;
      const bx = x + pad;
      const by = y + pad;
      const bw = w - pad * 2;
      const bh = h - pad * 2;
      ctx.fillStyle = KENTE.black;
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
      ctx.fillStyle = v.kind === "trotro" ? paint.body : taxi.body;
      roundRect(ctx, bx, by, bw, bh, cell * 0.18);
      ctx.fill();
      if (v.kind === "trotro") {
        paint.band.forEach((color, i) => {
          ctx.fillStyle = color;
          if (v.axis === "row") ctx.fillRect(bx, by + bh * (0.62 + i * 0.08), bw, bh * 0.08);
          else ctx.fillRect(bx + bw * (0.62 + i * 0.08), by, bw * 0.08, bh);
        });
      }
      ctx.fillStyle = KENTE.red;
      const c = cell * 0.22;
      ctx.fillRect(bx, by, c, c);
      ctx.fillRect(bx + bw - c, by, c, c);
      ctx.fillRect(bx, by + bh - c, c, c);
      ctx.fillRect(bx + bw - c, by + bh - c, c, c);
      if (r === 0) {
        ctx.fillStyle = v.kind === "trotro" ? "rgba(20,16,16,0.75)" : taxi.glass;
        const g = cell * 0.22;
        if (forward === "right") ctx.fillRect(bx + bw - g * 1.6, by + bh * 0.18, g, bh * 0.64);
        if (forward === "left") ctx.fillRect(bx + g * 0.6, by + bh * 0.18, g, bh * 0.64);
        if (forward === "down") ctx.fillRect(bx + bw * 0.18, by + bh - g * 1.6, bw * 0.64, g);
        if (forward === "up") ctx.fillRect(bx + bw * 0.18, by + g * 0.6, bw * 0.64, g);
      }
      ctx.strokeStyle = v.kind === "trotro" ? KENTE.black : taxi.outline;
      ctx.lineWidth = Math.max(1, cell * 0.07);
      roundRect(ctx, bx, by, bw, bh, cell * 0.18);
      ctx.stroke();
    });
  }
  function drawCrash(ctx, at, layout) {
    const { frame, cell, size } = layout;
    const inside = Math.min(Math.max(at.x, -0.5), (size - frame * 2) / cell - 0.5);
    const cx = frame + (inside + 0.5) * cell;
    const cy = frame + (Math.min(Math.max(at.y, -0.5), (size - frame * 2) / cell - 0.5) + 0.5) * cell;
    const r = cell * 0.45;
    ctx.fillStyle = "rgba(247,238,220,0.92)";
    ctx.strokeStyle = KENTE.black;
    ctx.lineWidth = Math.max(1.5, cell * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = KENTE.red;
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
    ctx.moveTo(cx + r * 0.5, cy - r * 0.5);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.5);
    ctx.stroke();
  }
  function drawBench(ctx, x, y, s, _backRow, cx = 0, cy = 0, obstacles) {
    const pad = s * 0.04;
    const box = pieceBox(x, y, s, cx, cy, obstacles, pad);
    ctx.fillStyle = "#C9C2B4";
    ctx.fillRect(box.l, box.t, box.r - box.l, box.b - box.t);
    ctx.strokeStyle = KENTE.black;
    ctx.lineWidth = Math.max(1, s * 0.06);
    outerEdges(ctx, box);
    const h = cellHash(cx, cy);
    const colors = [KENTE.green, KENTE.red, KENTE.gold];
    if (h % 2 === 0) {
      ctx.fillStyle = colors[h % 3];
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y + s * 0.56, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.stroke();
      ctx.fillStyle = KENTE.cream;
      ctx.fillRect(x + s * 0.44, y + s * 0.16, s * 0.12, s * 0.2);
      ctx.strokeRect(x + s * 0.44, y + s * 0.16, s * 0.12, s * 0.2);
    } else {
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(x + s * (0.2 + i * 0.22), y + s * 0.2, s * 0.14, s * 0.6);
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.strokeRect(x + s * (0.2 + i * 0.22), y + s * 0.2, s * 0.14, s * 0.6);
      });
    }
  }
  function drawReedWall(ctx, x, y, s, _backRow, cx = 0, cy = 0) {
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
  function drawPowerUp(ctx, p, moves, layout, time, still) {
    const { frame, cell } = layout;
    if (!still && p.until - moves <= 12 && Math.floor(time / 180) % 2 === 0) return;
    const cx = frame + (p.at.x + 0.5) * cell;
    const cy = frame + (p.at.y + 0.5) * cell;
    const r = cell * 0.44;
    ctx.fillStyle = KENTE.cream;
    ctx.strokeStyle = KENTE.black;
    ctx.lineWidth = Math.max(1.5, cell * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = Math.max(1, cell * 0.06);
    if (p.kind === "slow") {
      ctx.fillStyle = KENTE.gold;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.45, cy - r * 0.55);
      ctx.lineTo(cx - r * 0.45, cy + r * 0.55);
      ctx.lineTo(cx + r * 0.45, cy + r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (p.kind === "shrink") {
      ctx.strokeStyle = KENTE.red;
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
      ctx.strokeStyle = KENTE.green;
      ctx.lineWidth = Math.max(1.5, cell * 0.1);
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.22, cy, r * 0.3, r * 0.42, 0, 0, Math.PI * 2);
      ctx.moveTo(cx + r * 0.38, cy);
      ctx.ellipse(cx + r * 0.22, cy, r * 0.3, r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  var ARROW = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
  function drawCurrent(ctx, x, y, s, dir, time) {
    ctx.fillStyle = "rgba(90,170,200,0.28)";
    ctx.fillRect(x, y, s, s);
    const [dx, dy] = ARROW[dir];
    const drift = time / 900 % 1 * 0.3 - 0.15;
    const cx = x + s * (0.5 + dx * drift);
    const cy = y + s * (0.5 + dy * drift);
    const a = s * 0.2;
    ctx.strokeStyle = "rgba(247,238,220,0.7)";
    ctx.lineWidth = Math.max(1.5, s * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - dx * a - dy * a, cy - dy * a - dx * a);
    ctx.lineTo(cx + dx * a * 0.6, cy + dy * a * 0.6);
    ctx.lineTo(cx - dx * a + dy * a, cy - dy * a + dx * a);
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  var CANOE_PAINT = [
    { hull: "#8A5A32", band: KENTE.gold },
    { hull: "#2F6FA8", band: KENTE.gold },
    { hull: "#C8372D", band: KENTE.gold },
    { hull: "#2E8B57", band: KENTE.red },
    { hull: "#E9DFC8", band: KENTE.red }
  ];
  function canoeIndex(cx, cy, obstacles) {
    if (!obstacles) return 0;
    let start = cx;
    while (obstacles.has(`${start - 1},${cy}`)) start--;
    const starts = [...obstacles].map((k) => k.split(",").map(Number)).filter(([x, y]) => !obstacles.has(`${x - 1},${y}`)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return Math.max(0, starts.findIndex(([x, y]) => x === start && y === cy));
  }
  function drawCanoe(ctx, x, y, s, _backRow, cx = 0, cy = 0, obstacles) {
    const left = obstacles?.has(`${cx - 1},${cy}`) ?? false;
    const right = obstacles?.has(`${cx + 1},${cy}`) ?? false;
    const paint = CANOE_PAINT[canoeIndex(cx, cy, obstacles) % CANOE_PAINT.length];
    const top = y + s * 0.22;
    const bottom = y + s * 0.78;
    ctx.fillStyle = paint.hull;
    ctx.strokeStyle = KENTE.black;
    ctx.lineWidth = Math.max(1, s * 0.06);
    const mid = y + s * 0.5;
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
    ctx.fillStyle = paint.band;
    ctx.fillRect(x + (left ? 0 : s * 0.3), y + s * 0.44, s - (left ? 0 : s * 0.3) - (right ? 0 : s * 0.3), s * 0.12);
  }
  function drawLoom(ctx, x, y, s, _backRow, cx = 0, cy = 0) {
    const pad = s * 0.06;
    ctx.fillStyle = "#5A3A1E";
    ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
    const colors = [KENTE.gold, KENTE.green, KENTE.red, KENTE.gold, KENTE.black];
    const shift = cellHash(cx, cy) % colors.length;
    const strip = s * 0.5;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = colors[(i + shift) % colors.length];
      ctx.fillRect(x + (s - strip) / 2, y + pad + i * ((s - pad * 2) / 5), strip, (s - pad * 2) / 5);
    }
    ctx.strokeStyle = "rgba(247,238,220,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const f of [0.3, 0.42, 0.58, 0.7]) {
      ctx.moveTo(x + s * f, y + pad);
      ctx.lineTo(x + s * f, y + s - pad);
    }
    ctx.stroke();
    ctx.strokeStyle = KENTE.black;
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
  }

  // apps/web/src/sound.ts
  var SCALE = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319];
  var freq = (pitch) => pitch > 50 ? pitch : SCALE[Math.max(0, Math.min(SCALE.length - 1, pitch))];
  var VOICES = {
    farm: { name: "gyil, a wooden xylophone", wave: "sine", octave: 1, partials: [[1, 0.9, 1], [3.9, 0.25, 0.3]], attack: 6e-3, bend: 1 },
    park: { name: "atenteben, a bamboo flute", wave: "sine", octave: 2, partials: [[1, 0.7, 1], [2, 0.1, 0.8]], attack: 0.04, bend: 1 },
    market: { name: "an iron bell", wave: "sine", octave: 1.5, partials: [[1, 0.6, 1], [2.76, 0.3, 0.5], [5.4, 0.12, 0.25]], attack: 3e-3, bend: 1 },
    city: { name: "a palm-wine guitar string", wave: "triangle", octave: 1, partials: [[1, 0.8, 0.8], [2, 0.3, 0.4]], attack: 4e-3, bend: 1 },
    road: { name: "a trotro horn", wave: "square", octave: 0.5, partials: [[1, 0.2, 0.7], [1.01, 0.16, 0.7]], attack: 0.01, bend: 1 },
    lab: { name: "a glass chime", wave: "sine", octave: 2, partials: [[1, 0.55, 1], [2.4, 0.25, 0.6], [4.2, 0.08, 0.3]], attack: 2e-3, bend: 1 },
    maze: { name: "a low log drum", wave: "sine", octave: 0.5, partials: [[1, 1, 0.8], [3.9, 0.3, 0.3]], attack: 6e-3, bend: 1 },
    ocean: { name: "a water drop", wave: "sine", octave: 1, partials: [[1, 0.8, 1]], attack: 4e-3, bend: 1.5 },
    village: { name: "a gyil and an iron bell together", wave: "sine", octave: 1, partials: [[1, 0.8, 1], [2.76, 0.25, 0.4], [3.9, 0.2, 0.3]], attack: 5e-3, bend: 1 }
  };
  var BUZZ = {
    ate: 12,
    power: [20, 40, 20],
    bump: 40,
    crash: [90, 50, 160],
    cleared: [40, 40, 40, 40, 140]
  };
  var Sound = class _Sound {
    constructor(soundOn, vibrationOn) {
      __publicField(this, "soundOn", soundOn);
      __publicField(this, "vibrationOn", vibrationOn);
      __publicField(this, "ctx", null);
      __publicField(this, "master", null);
      /** The world of the run being played, which picks the instrument. */
      __publicField(this, "world", "farm");
    }
    /** Whether this device can vibrate. Most phones can, but iPhones can't from a web page. */
    static get canVibrate() {
      return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
    }
    /**
     * Browsers start sound only after the player presses something, so the game calls this on
     * each key press and tap. It creates the audio on the first one and wakes it if it was asleep.
     */
    unlock() {
      if (!this.soundOn) return;
      try {
        if (!this.ctx) {
          const Ctx = window.AudioContext ?? window.webkitAudioContext;
          if (!Ctx) return;
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.22;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") void this.ctx.resume();
      } catch {
        this.ctx = null;
      }
    }
    /** Closes the audio, for when the game is removed from the page. A later unlock opens it again. */
    close() {
      const ctx = this.ctx;
      this.ctx = null;
      this.master = null;
      if (ctx) void ctx.close().catch(() => {
      });
    }
    /** Plays the sound and the vibration for one game event. `eaten` sets the pitch of the cowrie note. */
    play(e, eaten = 0) {
      if (this.vibrationOn && _Sound.canVibrate) {
        const buzz = BUZZ[e.type];
        if (buzz !== void 0) {
          try {
            navigator.vibrate(buzz);
          } catch {
          }
        }
      }
      if (!this.soundOn) return;
      const notes = cue(e, eaten);
      if (notes.length) this.notes(notes);
      if (e.type === "current") this.swish();
      if (e.type === "crash") this.thud(0.22);
      if (e.type === "bump") this.thud(0.12);
    }
    notes(list) {
      this.unlock();
      const ctx = this.ctx;
      const out = this.master;
      if (!ctx || !out) return;
      const now = ctx.currentTime + 0.01;
      for (const n of list) {
        const start = now + n.at;
        const length = n.length ?? 0.35;
        const volume = n.volume ?? 1;
        const voice = VOICES[this.world] ?? VOICES.farm;
        for (const [ratio, level, share] of voice.partials) {
          const decay = length * share;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = voice.wave;
          const pitch = freq(n.pitch) * voice.octave * ratio;
          osc.frequency.setValueAtTime(pitch, start);
          if (voice.bend !== 1) osc.frequency.exponentialRampToValueAtTime(pitch * voice.bend, start + Math.min(0.12, decay));
          gain.gain.setValueAtTime(1e-4, start);
          gain.gain.exponentialRampToValueAtTime(level * volume, start + voice.attack);
          gain.gain.exponentialRampToValueAtTime(1e-4, start + Math.max(decay, voice.attack + 0.02));
          osc.connect(gain).connect(out);
          osc.start(start);
          osc.stop(start + decay + 0.05);
        }
      }
    }
    /** A short burst of filtered noise, like water rushing past. */
    swish() {
      this.unlock();
      const ctx = this.ctx;
      const out = this.master;
      if (!ctx || !out) return;
      const length = 0.25;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.2;
      const start = ctx.currentTime + 0.01;
      filter.frequency.setValueAtTime(500, start);
      filter.frequency.exponentialRampToValueAtTime(1800, start + length);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1e-4, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(1e-4, start + length);
      src.connect(filter).connect(gain).connect(out);
      src.start(start);
    }
    /** A low drum hit for a crash or a bump. */
    thud(volume) {
      this.unlock();
      const ctx = this.ctx;
      const out = this.master;
      if (!ctx || !out) return;
      const start = ctx.currentTime + 0.01;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, start);
      osc.frequency.exponentialRampToValueAtTime(55, start + 0.25);
      gain.gain.setValueAtTime(1e-4, start);
      gain.gain.exponentialRampToValueAtTime(volume * 4, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(1e-4, start + 0.3);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + 0.35);
    }
  };
  function cue(e, eaten) {
    switch (e.type) {
      case "ate":
        return [{ pitch: 2 + (eaten - 1) % 5, at: 0, length: 0.3 }];
      case "speedup":
        return [
          { pitch: 5, at: 0.12, length: 0.15, volume: 0.6 },
          { pitch: 7, at: 0.2, length: 0.2, volume: 0.6 }
        ];
      case "powerAppeared":
        return [{ pitch: 9, at: 0, length: 0.25, volume: 0.4 }];
      case "power":
        return [
          { pitch: 4, at: 0, length: 0.15 },
          { pitch: 6, at: 0.07, length: 0.15 },
          { pitch: 8, at: 0.14, length: 0.3 }
        ];
      case "passed":
        return [
          { pitch: 7, at: 0, length: 0.15, volume: 0.7 },
          { pitch: 5, at: 0.08, length: 0.2, volume: 0.7 }
        ];
      case "crash":
        return [
          { pitch: 3, at: 0.05, length: 0.25, volume: 0.7 },
          { pitch: 1, at: 0.17, length: 0.25, volume: 0.7 },
          { pitch: 0, at: 0.29, length: 0.5, volume: 0.7 }
        ];
      case "cleared":
        return [
          { pitch: 0, at: 0, length: 0.2 },
          { pitch: 2, at: 0.12, length: 0.2 },
          { pitch: 4, at: 0.24, length: 0.2 },
          { pitch: 5, at: 0.36, length: 0.2 },
          { pitch: 7, at: 0.48, length: 0.6 }
        ];
      default:
        return [];
    }
  }

  // apps/web/src/input.ts
  var SWIPE = 24;
  function listenForSwipes(el, onCommand, signal) {
    let start = null;
    let moved = false;
    const on = (type, fn) => el.addEventListener(type, fn, { signal });
    on("pointerdown", (e) => {
      if (start || !e.isPrimary || e.target.closest("button")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      moved = false;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
      }
    });
    on("pointermove", (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y);
      if (dir) {
        onCommand({ type: "turn", dir });
        start = { x: e.clientX, y: e.clientY, id: e.pointerId };
        moved = true;
      }
    });
    on("pointerup", (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!moved) {
        const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y);
        if (dir) onCommand({ type: "turn", dir });
        else if (e.pointerType !== "mouse") onCommand({ type: "pause" });
      }
      start = null;
      moved = false;
    });
    on("pointercancel", (e) => {
      if (start && e.pointerId === start.id) start = null;
      moved = false;
    });
  }
  function swipeDirection(dx, dy) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  }
  function inputKind() {
    return window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "keys";
  }
  return __toCommonJS(stdin_exports);
})();
