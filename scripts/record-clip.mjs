// Records the gameplay clip in the README, docs/media/gameplay.gif. A small computer player steers
// the snake to each cowrie on the Market while a browser films the page, and ffmpeg turns the film
// into a GIF. Run `npm run build` first, then `node scripts/record-clip.mjs`. It needs Python 3,
// ffmpeg, and Playwright's Chromium and film recorder (`npx playwright install chromium ffmpeg`).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "docs", "media", "gameplay.gif");
const port = 4174;
const server = spawn("python3", ["-m", "http.server", String(port), "--directory", join(root, "dist")], { stdio: "ignore" });
const films = mkdtempSync(join(tmpdir(), "sankofa-clip-"));

try {
  await new Promise((done) => setTimeout(done, 800));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 900, height: 780 },
    recordVideo: { dir: films, size: { width: 900, height: 780 } },
  });
  const page = await context.newPage();
  // Farm and Park cleared, so the Market is open.
  await page.addInitScript(() => {
    const cleared = { best: 600, stars: 3, cleared: true };
    localStorage.setItem("sankofa-snake/v1", JSON.stringify({ version: 2, levels: { farm: cleared, park: cleared } }));
  });
  await page.goto(`http://localhost:${port}/?seed=11`);
  await page.getByRole("button", { name: "Choose a level" }).click();
  await page.locator('[data-level="2"]').click();
  const box = await page.locator("[data-sankofa-snake]").boundingBox();
  // The computer player: before each move, a breadth-first search finds the shortest safe path to
  // the cowrie, and the player presses the arrow key for its first step.
  await page.evaluate(() => {
    const el = document.querySelector("[data-sankofa-snake]");
    const KEYS = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
    const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const BACK = { up: "down", down: "up", left: "right", right: "left" };
    const press = (dir) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: KEYS[dir], bubbles: true }));
    const plan = (s) => {
      const { width: w, height: h, edges } = s.level;
      const blocked = new Set(s.obstacles);
      for (const c of s.snake.slice(0, -1)) blocked.add(`${c.x},${c.y}`);
      const step = (x, y, d) => {
        let nx = x + STEP[d][0];
        let ny = y + STEP[d][1];
        if (edges === "wrap") [nx, ny] = [(nx + w) % w, (ny + h) % h];
        else if (nx < 0 || ny < 0 || nx >= w || ny >= h) return null;
        return blocked.has(`${nx},${ny}`) ? null : [nx, ny];
      };
      const first = new Map();
      const queue = [];
      for (const d of Object.keys(STEP)) {
        const n = d === BACK[s.dir] ? null : step(s.snake[0].x, s.snake[0].y, d);
        if (!n || first.has(n.join())) continue;
        first.set(n.join(), d);
        queue.push(n);
      }
      while (queue.length) {
        const [x, y] = queue.shift();
        if (s.food && x === s.food.x && y === s.food.y) return first.get(`${x},${y}`);
        for (const d of Object.keys(STEP)) {
          const n = step(x, y, d);
          if (!n || first.has(n.join())) continue;
          first.set(n.join(), first.get(`${x},${y}`));
          queue.push(n);
        }
      }
      return first.size ? first.values().next().value : s.dir;
    };
    let lastMove = -1;
    setInterval(() => {
      const s = el.sankofaSnake.state;
      if (s.status === "ready") return press(plan(s));
      if (s.status !== "running" || s.moves === lastMove) return;
      lastMove = s.moves;
      const d = plan(s);
      if (d !== s.dir) press(d);
    }, 8);
  });
  await page.waitForTimeout(13000);
  const video = page.video();
  await context.close();
  await browser.close();

  const film = await video.path();
  mkdirSync(join(root, "docs", "media"), { recursive: true });
  const crop = `crop=${Math.round(box.width)}:${Math.floor(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  const palette = "split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", "1", "-t", "11", "-i", film, "-vf", `${crop},fps=12,scale=400:-1:flags=lanczos,${palette}`, out]);
  console.log(`Wrote ${out}`);
} finally {
  server.kill();
  rmSync(films, { recursive: true, force: true });
}
