// The web game: the title screen, the level list, the board and the messages over it.
// The rules come from packages/core. This file connects them to the page.
import {
  LEVELS,
  createGame,
  moveMs,
  pause,
  tick,
  togglePause,
  turn,
  type GameEvent,
  type GameState,
} from "../../../packages/core/src";
import { commandForKey, listenForTouch, type Command } from "./input";
import { sankofaLogo } from "./logo";
import { draw, layoutFor, type Layout } from "./render";
import { loadProgress, recordRun, saveProgress, type Progress } from "./storage";

type Screen = "title" | "levels" | "help" | "game";

const CRASH_TEXT = {
  self: "The snake ran into its own tail.",
  wall: "The snake hit the wall.",
  obstacle: "The snake ran into a market stall.",
};

const starText = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

export interface Options {
  /** A fixed seed puts the cowries in the same places every time. The tests use it. */
  seed?: number;
}

export class SankofaSnake {
  private root: HTMLElement;
  private progress: Progress = loadProgress();
  private screen: Screen = "title";
  private levelIndex = 0;
  private state!: GameState;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private layout!: Layout;
  private frameId = 0;
  private lastTime = 0;
  private carry = 0;
  private lastClear: Extract<GameEvent, { type: "cleared" }> | null = null;
  private reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  constructor(root: HTMLElement, private options: Options = {}) {
    this.root = root;
    root.classList.add("ss-root");
    root.innerHTML = `
      <div class="ss-screen ss-title" data-screen="title"></div>
      <div class="ss-screen ss-levels" data-screen="levels" hidden></div>
      <div class="ss-screen ss-help" data-screen="help" hidden></div>
      <div class="ss-screen ss-game" data-screen="game" hidden></div>
      <p class="ss-sr" aria-live="polite" data-live></p>`;
    this.renderTitle();
    this.renderHelp();
    this.renderGameShell();
    window.addEventListener("keydown", (e) => this.onKey(e));
    // Pause when the player switches tabs or apps, so the snake never crashes unseen.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state) this.apply(pause(this.state));
    });
    window.addEventListener("blur", () => {
      if (this.screen === "game" && this.state) this.apply(pause(this.state));
    });
    new ResizeObserver(() => this.resize()).observe(root);
  }

  // Screens

  private show(screen: Screen) {
    this.screen = screen;
    this.root.querySelectorAll<HTMLElement>(".ss-screen").forEach((el) => {
      el.hidden = el.dataset.screen !== screen;
    });
    if (screen === "levels") this.renderLevels();
    if (screen !== "game") cancelAnimationFrame(this.frameId);
    const first = this.root.querySelector<HTMLElement>(`[data-screen="${screen}"] [data-focus]`);
    first?.focus();
  }

  private renderTitle() {
    const el = this.part("title");
    el.innerHTML = `
      <div class="ss-logo">${sankofaLogo(150, "Sankofa bird, the game's logo")}</div>
      <h2 class="ss-heading">Sankofa Snake</h2>
      <p class="ss-lead">Steer a snake of woven kente blocks around the board and collect cowrie shells. Each level adds a new world and one new rule.</p>
      <div class="ss-actions">
        <button class="ss-btn ss-primary" data-play data-focus>Play</button>
        <button class="ss-btn" data-go="levels">Choose a level</button>
        <button class="ss-btn" data-go="help">How to play</button>
      </div>
      <p class="ss-note">Sankofa is an Akan word from Ghana. It means "go back and get it."</p>`;
    el.querySelector("[data-play]")!.addEventListener("click", () => this.startLevel(this.nextLevelIndex()));
    this.wireNav(el);
  }

  private renderHelp() {
    const el = this.part("help");
    el.innerHTML = `
      <h2 class="ss-heading">How to play</h2>
      <ul class="ss-list">
        <li>Steer with the arrow keys or W, A, S and D. On a phone, swipe in the direction you want to go.</li>
        <li>Eat 20 cowrie shells to clear a level and open the next one. The snake grows longer with each shell.</li>
        <li>The run ends if the snake hits its own tail, a wall or a market stall.</li>
        <li>Pause with Space, P or Escape, or tap the board on a phone. The game also pauses when you switch tabs.</li>
        <li>Clearing a level earns one star. A high score and a fast finish earn up to two more.</li>
      </ul>
      <div class="ss-actions"><button class="ss-btn ss-primary" data-go="title" data-focus>Back</button></div>`;
    this.wireNav(el);
  }

  private renderLevels() {
    const el = this.part("levels");
    const cards = LEVELS.map((level, i) => {
      const p = this.progress.levels[level.id];
      const open = this.isUnlocked(i);
      const status = open
        ? p
          ? `<span class="ss-stars" aria-label="${p.stars} of 3 stars">${starText(p.stars)}</span><span>Best ${p.best}</span>`
          : `<span>Not played yet</span>`
        : `<span>Clear the ${LEVELS[i - 1].name} to open this level</span>`;
      return `
        <li>
          <button class="ss-card ss-world-${level.world}" data-level="${i}" ${open ? "" : "disabled"}>
            <span class="ss-card-top">Level ${level.number}</span>
            <span class="ss-card-name">${level.name}</span>
            <span class="ss-card-text">${level.challenge}</span>
            <span class="ss-card-status">${status}</span>
          </button>
        </li>`;
    }).join("");
    el.innerHTML = `
      <h2 class="ss-heading">Levels</h2>
      <ul class="ss-cards">${cards}</ul>
      <p class="ss-note">More worlds are on the way: City, Road, Lab, Maze, Ocean and the Weaving village.</p>
      <div class="ss-actions"><button class="ss-btn" data-go="title">Back</button></div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((b) => {
      b.addEventListener("click", () => this.startLevel(Number(b.dataset.level)));
    });
    el.querySelector<HTMLElement>("[data-level]:not([disabled])")?.setAttribute("data-focus", "");
    this.wireNav(el);
  }

  private renderGameShell() {
    const el = this.part("game");
    el.innerHTML = `
      <div class="ss-hud">
        <h2 class="ss-hud-level" data-hud="level"></h2>
        <dl class="ss-hud-stats">
          <div><dt>Cowries</dt><dd data-hud="eaten"></dd></div>
          <div><dt>Score</dt><dd data-hud="score"></dd></div>
          <div><dt>Best</dt><dd data-hud="best"></dd></div>
        </dl>
      </div>
      <div class="ss-stage" data-stage>
        <canvas class="ss-canvas" role="img" aria-label="Game board"></canvas>
        <div class="ss-overlay" data-overlay></div>
      </div>
      <div class="ss-actions ss-bar">
        <button class="ss-btn" data-pause>Pause</button>
        <button class="ss-btn" data-go="levels">Levels</button>
      </div>
      <p class="ss-note ss-hint">Arrow keys or W, A, S and D to steer. Space to pause. On a phone, swipe to steer and tap the board to pause.</p>`;
    this.canvas = el.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d")!;
    el.querySelector("[data-pause]")!.addEventListener("click", () => this.command({ type: "pause" }));
    listenForTouch(el.querySelector("[data-stage]")!, (c) => this.command(c));
    this.wireNav(el);
  }

  private part(name: Screen): HTMLElement {
    return this.root.querySelector(`[data-screen="${name}"]`)!;
  }

  private wireNav(el: HTMLElement) {
    el.querySelectorAll<HTMLElement>("[data-go]").forEach((b) =>
      b.addEventListener("click", () => this.show(b.dataset.go as Screen)),
    );
  }

  private isUnlocked(i: number) {
    return i === 0 || Boolean(this.progress.levels[LEVELS[i - 1].id]?.cleared);
  }

  /** The first unlocked level not yet cleared, or the last level when all are cleared. */
  private nextLevelIndex() {
    for (let i = 0; i < LEVELS.length; i++) {
      if (!this.isUnlocked(i)) return Math.max(0, i - 1);
      if (!this.progress.levels[LEVELS[i].id]?.cleared) return i;
    }
    return LEVELS.length - 1;
  }

  // Playing

  private startLevel(i: number) {
    this.levelIndex = i;
    const seed = this.options.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    this.state = createGame(LEVELS[i], seed);
    this.part("game").className = `ss-screen ss-game ss-world-${LEVELS[i].world}`;
    this.show("game");
    this.say(`Level ${LEVELS[i].number}, ${LEVELS[i].name}. ${LEVELS[i].challenge} Press an arrow key or swipe to start.`);
    this.updateHud();
    this.updateOverlay();
    this.resize();
    this.lastTime = 0;
    this.carry = 0;
    cancelAnimationFrame(this.frameId);
    this.frameId = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(time: number) {
    if (this.screen !== "game") return;
    const dt = this.lastTime ? Math.min(time - this.lastTime, 250) : 0;
    this.lastTime = time;
    if (this.state.status === "running") {
      this.carry += dt;
      // Catch up on missed moves after a slow frame, but never more than a few at once.
      for (let n = 0; n < 4 && this.carry >= moveMs(this.state) && this.state.status === "running"; n++) {
        this.carry -= moveMs(this.state);
        const result = tick(this.state);
        this.apply(result.state, result.events);
      }
    } else {
      this.carry = 0;
    }
    draw(this.ctx, this.state, this.layout, time, this.reduceMotion);
    this.frameId = requestAnimationFrame((t) => this.frame(t));
  }

  private onKey(e: KeyboardEvent) {
    if (this.screen !== "game") return;
    const target = e.target as HTMLElement | null;
    // Space and Enter on a focused button press that button.
    if (target?.closest("button") && (e.key === " " || e.key === "Enter")) return;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    const c = commandForKey(e);
    if (!c) return;
    e.preventDefault();
    this.command(c);
  }

  private command(c: Command) {
    if (!this.state) return;
    if (c.type === "turn") this.apply(turn(this.state, c.dir));
    else this.apply(togglePause(this.state));
  }

  private apply(next: GameState | undefined, events: GameEvent[] = []) {
    if (!next) return;
    const before = this.state.status;
    this.state = next;
    for (const e of events) this.onEvent(e);
    if (next.status !== before) {
      this.updateOverlay();
      if (next.status === "paused") this.say("Paused.");
      if (next.status === "running" && before === "paused") this.say("Playing.");
    }
    this.updateHud();
  }

  private onEvent(e: GameEvent) {
    const level = this.state.level;
    if (e.type === "ate") this.say(`Cowrie ${this.state.eaten} of ${level.goal}. Score ${this.state.score}.`);
    if (e.type === "speedup") this.say("The snake is faster now.");
    if (e.type === "crash") {
      this.progress = recordRun(this.progress, level.id, this.state.score, 0, false);
      saveProgress(this.progress);
      this.say(`${CRASH_TEXT[e.cause]} Score ${this.state.score}.`);
    }
    if (e.type === "cleared") {
      this.lastClear = e;
      this.progress = recordRun(this.progress, level.id, e.score, e.stars, true);
      saveProgress(this.progress);
      this.say(`Level cleared with ${e.stars} of 3 stars. Score ${e.score}.`);
    }
  }

  private updateHud() {
    const s = this.state;
    const el = this.part("game");
    const set = (name: string, text: string) => {
      const node = el.querySelector(`[data-hud="${name}"]`)!;
      if (node.textContent !== text) node.textContent = text;
    };
    set("level", `Level ${s.level.number}: ${s.level.name}`);
    set("eaten", `${s.eaten} of ${s.level.goal}`);
    set("score", String(s.score));
    set("best", String(Math.max(this.progress.levels[s.level.id]?.best ?? 0, s.score)));
    const pauseBtn = el.querySelector<HTMLButtonElement>("[data-pause]")!;
    pauseBtn.textContent = s.status === "paused" ? "Resume" : "Pause";
    pauseBtn.disabled = s.status !== "running" && s.status !== "paused";
  }

  private updateOverlay() {
    const s = this.state;
    const overlay = this.part("game").querySelector<HTMLElement>("[data-overlay]")!;
    const level = s.level;
    const hasNext = this.levelIndex < LEVELS.length - 1;
    let html = "";
    if (s.status === "ready") {
      html = `
        <p class="ss-overlay-title">Level ${level.number}: ${level.name}</p>
        <p>${level.challenge}</p>
        <p class="ss-overlay-hint">Press an arrow key or swipe to start.</p>`;
    } else if (s.status === "paused") {
      html = `
        <p class="ss-overlay-title">Paused</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-resume>Resume</button>
          <button class="ss-btn" data-go="levels">Levels</button>
        </div>`;
    } else if (s.status === "over") {
      html = `
        <p class="ss-overlay-title">Game over</p>
        <p>${CRASH_TEXT[s.crash ?? "self"]}</p>
        <p>You collected ${s.eaten} of ${level.goal} cowries. Score ${s.score}.</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-again>Play again</button>
          <button class="ss-btn" data-go="levels">Levels</button>
        </div>`;
    } else if (s.status === "cleared" && this.lastClear) {
      const { stars, timeBonus } = this.lastClear;
      const best = this.progress.levels[level.id]?.stars ?? stars;
      html = `
        <p class="ss-overlay-title">Level cleared</p>
        <p class="ss-stars ss-big" aria-label="${stars} of 3 stars">${starText(stars)}</p>
        <p>Score ${s.score}, including a time bonus of ${timeBonus}.${best > stars ? ` Your best on this level is ${best} stars.` : ""}</p>
        ${hasNext ? "" : `<p>You've cleared every level so far. More worlds are on the way.</p>`}
        <div class="ss-actions">
          ${hasNext ? `<button class="ss-btn ss-primary" data-next>Next level</button>` : ""}
          <button class="ss-btn${hasNext ? "" : " ss-primary"}" data-again>Play again</button>
          <button class="ss-btn" data-go="levels">Levels</button>
        </div>`;
    }
    overlay.innerHTML = html ? `<div class="ss-panel">${html}</div>` : "";
    overlay.hidden = s.status === "running";
    overlay.classList.toggle("ss-overlay-passive", s.status === "ready");
    overlay.querySelector("[data-resume]")?.addEventListener("click", () => this.command({ type: "pause" }));
    overlay.querySelector("[data-again]")?.addEventListener("click", () => this.startLevel(this.levelIndex));
    overlay.querySelector("[data-next]")?.addEventListener("click", () => this.startLevel(this.levelIndex + 1));
    this.wireNav(overlay);
    overlay.querySelector<HTMLElement>(".ss-primary")?.focus();
  }

  private resize() {
    if (!this.state || !this.canvas) return;
    const stage = this.part("game").querySelector<HTMLElement>("[data-stage]")!;
    const width = Math.min(stage.clientWidth || this.root.clientWidth, 560);
    // Leave room for the score line and buttons, so the whole board fits on a phone screen.
    const height = Math.max(260, window.innerHeight - 210);
    const size = Math.floor(Math.min(width, height));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = layoutFor(size, this.state.level);
    draw(this.ctx, this.state, this.layout, performance.now(), this.reduceMotion);
  }

  private say(text: string) {
    const live = this.root.querySelector<HTMLElement>("[data-live]")!;
    live.textContent = text;
  }
}
