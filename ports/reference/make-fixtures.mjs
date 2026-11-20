// Records reference runs from the TypeScript rules in packages/core, so the Python and R ports
// can check that they play exactly the same game. Run it from the top of the repo:
//
//   node ports/reference/make-fixtures.mjs           writes ports/reference/fixtures.json
//   node ports/reference/make-fixtures.mjs --check   fails if fixtures.json is out of date
//
// Every run here is fixed by its seed. A run's turns come from a small autopilot written below and
// are saved with the run, so the ports only replay them and never need the autopilot themselves.
// After each move the state is written as one line of text (see stateLine) and hashed with
// seedFrom, the same hash the game uses for dates. A port that gets every hash right made every
// move the same way.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = `${root}ports/reference/fixtures.json`;

const bundle = await build({
  stdin: {
    contents: `export * from "./packages/core/src"; export { vehiclePaints } from "./apps/web/src/render";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const core = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const {
  LEVELS,
  createGame,
  dailyLevel,
  dailySeed,
  freePlayLevel,
  layoutSeed,
  newLayout,
  nextRandom,
  practiceLevel,
  seedFrom,
  tick,
  turn,
  togglePause,
  vehicleKeys,
  vehiclePaints,
} = core;

const cell = (c) => (c ? `${c.x},${c.y}` : "-");

/** A level's layout as one line: the map, the vehicles and the start. */
export function layoutLine(level) {
  const map = (level.map ?? []).join("/");
  const vehicles = (level.vehicles ?? []).map((v) => [v.kind, v.axis, v.lane, v.dir, v.length, v.every, v.start].join(",")).join(";");
  const s = level.start;
  return `${map}|${vehicles}|${s.x},${s.y},${s.dir},${s.length}`;
}

/** The whole game state as one line of text. The ports build exactly the same line. */
function stateLine(s) {
  const p = s.powerUp ? `${p_(s.powerUp)}` : "-";
  return [
    s.status,
    s.dir,
    s.lastStep,
    s.queue.join(","),
    s.snake.map(cell).join(" "),
    cell(s.food),
    s.eaten,
    s.score,
    s.speed,
    s.speedLevel,
    s.grow,
    Math.floor(s.elapsedMs),
    s.moves,
    s.vehicles.join(","),
    p,
    s.slowUntil,
    s.passes,
    s.crash ?? "-",
    s.crashVehicle ?? "-",
    s.bump ?? "-",
    s.crashPushed ? 1 : 0,
    cell(s.crashAt),
    s.rng,
  ].join("|");
}
function p_(p) {
  return `${p.kind}@${p.at.x},${p.at.y}<${p.until}`;
}

function eventText(e) {
  switch (e.type) {
    case "ate":
      return `ate:${e.at.x},${e.at.y}:${e.points}`;
    case "speedup":
      return `speedup:${e.speed}`;
    case "crash":
    case "bump":
      return `${e.type}:${e.cause}`;
    case "power":
      return `power:${e.kind}`;
    case "powerAppeared":
      return `powerAppeared:${e.kind}:${e.at.x},${e.at.y}`;
    case "current":
      return `current:${e.dir}`;
    case "cleared":
      return `cleared:${e.score}:${e.stars}:${e.timeBonus}`;
    default:
      return e.type;
  }
}

const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
const DIRS = ["up", "down", "left", "right"];
const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * Picks a turn: the first step of a shortest path to the cowrie over cells that look safe now,
 * or any safe step, and now and then a random press, so runs also crash, bump and queue turns.
 */
function autopilot(s, rand) {
  const level = s.level;
  const blocked = new Set(s.obstacles);
  for (const k of vehicleKeys(s)) blocked.add(k);
  // With a pass in hand, the autopilot drives through its own tail on purpose.
  if (s.passes === 0) s.snake.slice(0, -1).forEach((c) => blocked.add(cell(c)));
  const wrap = level.edges === "wrap";
  const stepFrom = (x, y, d) => {
    let nx = x + STEP[d][0];
    let ny = y + STEP[d][1];
    if (wrap) {
      nx = (nx + level.width) % level.width;
      ny = (ny + level.height) % level.height;
    } else if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) return null;
    return [nx, ny];
  };
  if (rand() < 0.012) return [DIRS[Math.floor(rand() * 4)]];
  const head = s.snake[0];
  // A power-up on the board comes first, so the runs pick up every kind.
  const target = s.powerUp?.at ?? s.food;
  if (target) {
    const seen = new Map([[cell(head), null]]);
    const queue = [[head.x, head.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === target.x && y === target.y) {
        let k = `${x},${y}`;
        let first = null;
        while (seen.get(k)) {
          first = seen.get(k).dir;
          k = seen.get(k).from;
        }
        if (first) return rand() < 0.04 ? [first, DIRS[Math.floor(rand() * 4)]] : [first];
        break;
      }
      for (const d of DIRS) {
        const n = stepFrom(x, y, d);
        if (!n) continue;
        const k = `${n[0]},${n[1]}`;
        if (seen.has(k) || blocked.has(k)) continue;
        seen.set(k, { from: `${x},${y}`, dir: seen.get(`${x},${y}`)?.dir ?? d });
        queue.push(n);
      }
    }
  }
  const safe = DIRS.filter((d) => {
    const n = stepFrom(head.x, head.y, d);
    return n && !blocked.has(`${n[0]},${n[1]}`);
  });
  return safe.length ? [safe[Math.floor(rand() * safe.length)]] : [];
}

/**
 * Plays one run from its seed with the autopilot and records it. The first step a path search
 * finds is stored as the turn, so a seen map keeps for each cell the first step on its path.
 */
function record(name, level, seed, maxMoves = 500) {
  let rs = seedFrom(`autopilot:${name}`);
  const rand = () => {
    const [r, next] = nextRandom(rs);
    rs = next;
    return r;
  };
  let s = createGame(level, seed);
  const start = stateLine(s);
  const inputs = [];
  const hashes = [];
  let lastLine = start;
  for (let i = 0; i < maxMoves && s.status !== "over" && s.status !== "cleared"; i++) {
    const presses = autopilot(s, rand);
    // Now and then a pause and a resume, which must leave the run exactly as it was.
    if (rand() < 0.02) presses.push("pause", "pause");
    for (const p of presses) s = p === "pause" ? togglePause(s) : turn(s, p);
    inputs.push(presses.join(","));
    const result = tick(s);
    s = result.state;
    lastLine = `${stateLine(s)}#${result.events.map(eventText).join(";")}`;
    for (const e of result.events) seenEvents[e.type] = (seenEvents[e.type] ?? 0) + 1;
    hashes.push(hex(seedFrom(lastLine)));
  }
  return { name, layout: layoutLine(level), seed, start, inputs: inputs.join(" "), hashes: hashes.join(""), last: lastLine };
}

const seenEvents = {};
const byId = (id) => LEVELS.find((l) => l.id === id);
const runs = [];
const layouts = [];
const paints = [];

for (const level of LEVELS) {
  for (const seed of [1, 2024, 777777]) {
    const made = newLayout(level, layoutSeed(seed));
    runs.push({ mode: "levels", level: level.id, ...record(`levels:${level.id}:${seed}`, made, seed) });
  }
  const practice = newLayout(practiceLevel(level), layoutSeed(5));
  runs.push({ mode: "practice", level: level.id, ...record(`practice:${level.id}`, practice, 5, 300) });
  // A few runs on the level exactly as its file draws it.
  runs.push({ mode: "fixed", level: level.id, ...record(`fixed:${level.id}`, level, 31337, 300) });
  for (let seed = 0; seed < 25; seed++) {
    const s = seed * 7919 + 3;
    const made = newLayout(level, s);
    const line = layoutLine(made);
    layouts.push({ level: level.id, seed: s, hash: hex(seedFrom(line)), ...(seed < 3 ? { line } : {}) });
    if (made.vehicles?.length) paints.push({ level: level.id, seed: s, paints: vehiclePaints(made) });
  }
}
for (const [id, edges] of [["farm", "walls"], ["market", "wrap"], ["village", "wrap"], ["road", "walls"]]) {
  const level = newLayout(freePlayLevel(byId(id), edges), layoutSeed(9));
  runs.push({ mode: "free", level: id, edges, ...record(`free:${id}:${edges}`, level, 9, 400) });
}

const dates = [];
for (let i = 0; i < 60; i++) {
  const d = new Date(2026, 10, 1 + i);
  dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
}
const daily = dates.map((date) => {
  const l = dailyLevel(date);
  return {
    date,
    id: l.id,
    world: l.world,
    challenge: l.challenge,
    edges: l.edges,
    speed: [l.speed.start, l.speed.step, l.speed.every, l.speed.max],
    powerUps: l.powerUps ? [l.powerUps.kinds.join(","), l.powerUps.every, l.powerUps.lasts] : null,
    seed: dailySeed(date),
  };
});
for (const date of dates.slice(0, 12)) {
  const seed = dailySeed(date);
  const level = newLayout(dailyLevel(date), layoutSeed(seed));
  runs.push({ mode: "daily", level: date, ...record(`daily:${date}`, level, seed, 400) });
}

const seeds = ["", "a", "2026-11-20", "sankofa-layout:1", "sankofa-daily:2026-11-20"].map((t) => ({ text: t, seed: seedFrom(t) }));
let r = 42;
const randoms = [];
for (let i = 0; i < 20; i++) {
  const [v, next] = nextRandom(r);
  randoms.push([v, next]);
  r = next;
}

const fixtures = { note: "Made by ports/reference/make-fixtures.mjs from packages/core. Do not edit by hand.", seeds, randoms, layouts, paints, daily, runs };
const text = JSON.stringify(fixtures, null, 1) + "\n";
if (process.argv.includes("--check")) {
  let old = "";
  try {
    old = readFileSync(out, "utf8");
  } catch {}
  if (old !== text) {
    console.error("ports/reference/fixtures.json is out of date. Run: node ports/reference/make-fixtures.mjs");
    process.exit(1);
  }
  console.log("ports/reference/fixtures.json is up to date.");
} else {
  writeFileSync(out, text);
  const moves = runs.reduce((n, run) => n + run.hashes.length / 8, 0);
  const ends = runs.reduce((m, run) => ((m[run.last.split("|")[0]] = (m[run.last.split("|")[0]] ?? 0) + 1), m), {});
  console.log(`Wrote ${runs.length} runs with ${moves} moves, ${layouts.length} layouts and ${daily.length} daily challenges.`, ends, seenEvents);
}
