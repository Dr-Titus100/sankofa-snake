// The web game: the title screen, the level list, the daily challenge, free play, practice, the
// board and the messages over it.
// The rules come from packages/core. This file connects them to the page.
import {
  LEVELS,
  createGame,
  dailyLevel,
  dailySeed,
  dateKey,
  freePlayLevel,
  isSlow,
  moveMs,
  pause,
  tick,
  togglePause,
  practiceLevel,
  turn,
  type Edges,
  type GameEvent,
  type LevelDef,
  type GameState,
  type PowerKind,
} from "../../../packages/core/src";
import { commandForKey, listenForTouch, type Command } from "./input";
import { sankofaLogo } from "./logo";
import { draw, layoutFor, type Layout } from "./render";
import { Sound } from "./sound";
import {
  currentStreak,
  loadProgress,
  recordDaily,
  recordFree,
  recordRun,
  saveProgress,
  settingsOf,
  type Progress,
  type Settings,
} from "./storage";

type Screen = "title" | "levels" | "daily" | "help" | "game";

/** The ways to play. "levels" is the nine levels in order. */
type Mode = "levels" | "daily" | "free" | "practice";

/** What the obstacles are in each world, for the message after a crash. */
const OBSTACLE_NAME: Record<string, string> = {
  market: "a market stall",
  city: "a building",
  lab: "a lab bench",
  maze: "a wall of the maze",
  ocean: "a canoe",
  village: "a loom",
};

/** What the screen reader says when the snake picks up each power-up. */
const POWER_TEXT: Record<PowerKind, string> = {
  slow: "Slow motion. The snake moves slower for a while.",
  shrink: "Shrink. The snake is shorter now.",
  pass: "Pass. The snake can go through its own tail once.",
};

const POWER_NAME: Record<PowerKind, string> = { slow: "slow motion", shrink: "shrink", pass: "pass" };

/** What the snake ran into, as words for a sentence. */
function hitName(s: GameState, cause: GameState["crash"]): string {
  return {
    wall: "the wall",
    obstacle: OBSTACLE_NAME[s.level.world] ?? "an obstacle",
    vehicle: `a ${s.crashVehicle ?? "car"}`,
    self: "its own tail",
  }[cause ?? "self"];
}

/** One sentence saying what ended the run. */
function crashText(s: GameState): string {
  const what = hitName(s, s.crash);
  if (s.crashPushed) return `A current pushed the snake into ${what}.`;
  return s.crash === "wall" ? "The snake hit the wall." : `The snake ran into ${what}.`;
}

/** In practice, one sentence saying what stopped the snake. */
const bumpText = (s: GameState) => `The snake bumped into ${hitName(s, s.bump)}.`;

/** Today's date, written out for the daily challenge screen, such as "Thursday 19 November". */
const longDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

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
  private mode: Mode = "levels";
  /** Which list the level screen shows: the levels in order, free play or practice. */
  private listMode: Exclude<Mode, "daily"> = "levels";
  private freeEdges: Edges = "wrap";
  /** The date of the daily challenge being played. */
  private dailyDate = "";
  private state!: GameState;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private layout!: Layout;
  private frameId = 0;
  private lastTime = 0;
  private carry = 0;
  private lastClear: Extract<GameEvent, { type: "cleared" }> | null = null;
  private reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  private sound: Sound;

  constructor(root: HTMLElement, private options: Options = {}) {
    this.root = root;
    const settings = settingsOf(this.progress);
    this.sound = new Sound(settings.sound, settings.vibration);
    root.classList.add("ss-root");
    root.innerHTML = `
      <div class="ss-screen ss-title" data-screen="title"></div>
      <div class="ss-screen ss-levels" data-screen="levels" hidden></div>
      <div class="ss-screen ss-daily" data-screen="daily" hidden></div>
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
    if (screen === "daily") this.renderDaily();
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
        <button class="ss-btn" data-go="daily">Daily challenge</button>
        <button class="ss-btn" data-levels>Choose a level</button>
        <button class="ss-btn" data-go="help">How to play</button>
      </div>
      <p class="ss-note">Sankofa is an Akan word from Ghana. It means "go back and get it."</p>`;
    el.querySelector("[data-play]")!.addEventListener("click", () => this.startRun("levels", this.nextLevelIndex()));
    el.querySelector("[data-levels]")!.addEventListener("click", () => {
      this.listMode = "levels";
      this.show("levels");
    });
    this.wireNav(el);
  }

  private renderHelp() {
    const el = this.part("help");
    el.innerHTML = `
      <h2 class="ss-heading">How to play</h2>
      <ul class="ss-list">
        <li>Steer with the arrow keys or W, A, S and D. On a phone, swipe in the direction you want to go.</li>
        <li>Eat 20 cowrie shells to clear a level and open the next one. The snake grows longer with each shell.</li>
        <li>The run ends if the snake runs into its own tail, an obstacle or a vehicle. Vehicles stop for the snake, so cross the road in front of them or behind them. From the City on, the edge of the board is a wall too.</li>
        <li>In the Ocean and the Weaving village, currents push the snake one square the way their arrows point when it swims across them. Swimming along a current does nothing.</li>
        <li>In the Lab, the Maze and the Weaving village, power-ups appear on the board for a short time. The gold hourglass is slow motion, the red arrows shrink the snake, and the green loop lets the snake pass through its own tail once.</li>
        <li>Pause with Space, P or Escape, or tap the board on a phone. The game also pauses when you switch tabs.</li>
        <li>Clearing a level earns one star. A high score and a fast finish earn up to two more.</li>
        <li>The daily challenge mixes a world and its rules from the date, so everyone who plays that day gets the same one. Clear it on days in a row to build a streak.</li>
        <li>Free play is the classic game in any world you have opened, with wrap-around edges or walls. It goes on until the snake crashes.</li>
        <li>Practice opens every level at a slower speed. Running into something only stops the snake, so it suits a class demo.</li>
        <li>Press M to turn the sound off or on.</li>
      </ul>
      <h3 class="ss-subheading">Settings</h3>
      <div class="ss-tabs" role="group" aria-label="Settings">
        <button class="ss-tab" data-setting="sound">Sound</button>
        ${Sound.canVibrate ? `<button class="ss-tab" data-setting="vibration">Vibration</button>` : ""}
      </div>
      <p class="ss-note ss-intro">Gold means on. ${Sound.canVibrate ? "Vibration works on most Android phones." : ""}</p>
      <div class="ss-actions"><button class="ss-btn ss-primary" data-go="title" data-focus>Back</button></div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-setting]").forEach((b) => {
      b.addEventListener("click", () => this.toggleSetting(b.dataset.setting as keyof Settings));
    });
    this.syncSettings();
    this.wireNav(el);
  }

  private renderLevels() {
    const el = this.part("levels");
    const mode = this.listMode;
    const tab = (m: typeof mode, label: string) =>
      `<button class="ss-tab" data-tab="${m}" aria-pressed="${m === mode}">${label}</button>`;
    const edge = (e: Edges, label: string) =>
      `<button class="ss-tab" data-edges="${e}" aria-pressed="${e === this.freeEdges}">${label}</button>`;
    const cards = LEVELS.map((level, i) => {
      const p = this.progress.levels[level.id];
      const open = mode === "practice" || this.isUnlocked(i);
      let status: string;
      if (!open) status = `<span>Clear the ${LEVELS[i - 1].name} to open this level</span>`;
      else if (mode === "practice") status = `<span>Slower, and the run never ends</span>`;
      else if (mode === "free") status = `<span>Best ${this.progress.free?.[this.freeKey(level)] ?? 0} cowries</span>`;
      else if (p) status = `<span class="ss-stars" aria-label="${p.stars} of 3 stars">${starText(p.stars)}</span><span>Best ${p.best}</span>`;
      else status = `<span>Not played yet</span>`;
      return `
        <li>
          <button class="ss-card ss-world-${level.world}" data-level="${i}" ${open ? "" : "disabled"}>
            <span class="ss-card-top">Level ${level.number}</span>
            <span class="ss-card-name">${level.name}</span>
            ${mode === "free" ? "" : `<span class="ss-card-text">${level.challenge}</span>`}
            <span class="ss-card-status">${status}</span>
          </button>
        </li>`;
    }).join("");
    const intro = {
      levels: "Clear a level to open the next one.",
      free: "Play the classic game in any world you have opened, until the snake crashes.",
      practice: "Every level, at a slower speed. Running into something only stops the snake.",
    }[mode];
    el.innerHTML = `
      <h2 class="ss-heading">${{ levels: "Levels", free: "Free play", practice: "Practice" }[mode]}</h2>
      <div class="ss-tabs" role="group" aria-label="Way to play">
        ${tab("levels", "Levels")}${tab("free", "Free play")}${tab("practice", "Practice")}
      </div>
      ${mode === "free" ? `<div class="ss-tabs ss-tabs-small" role="group" aria-label="Edges">${edge("wrap", "Wrap-around edges")}${edge("walls", "Walls")}</div>` : ""}
      <p class="ss-note ss-intro">${intro}</p>
      <ul class="ss-cards">${cards}</ul>
      <div class="ss-actions"><button class="ss-btn" data-go="title">Back</button></div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((b) => {
      b.addEventListener("click", () => this.startRun(mode, Number(b.dataset.level)));
    });
    el.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        this.listMode = b.dataset.tab as typeof mode;
        this.renderLevels();
        el.querySelector<HTMLElement>(`[data-tab="${this.listMode}"]`)?.focus();
      });
    });
    el.querySelectorAll<HTMLButtonElement>("[data-edges]").forEach((b) => {
      b.addEventListener("click", () => {
        this.freeEdges = b.dataset.edges as Edges;
        this.renderLevels();
        el.querySelector<HTMLElement>(`[data-edges="${this.freeEdges}"]`)?.focus();
      });
    });
    el.querySelector<HTMLElement>("[data-level]:not([disabled])")?.setAttribute("data-focus", "");
    this.wireNav(el);
  }

  private renderDaily() {
    const el = this.part("daily");
    const now = new Date();
    const today = dateKey(now);
    const level = dailyLevel(today);
    const d = this.progress.daily?.date === today ? this.progress.daily : undefined;
    const streak = currentStreak(this.progress, today);
    const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
    el.innerHTML = `
      <h2 class="ss-heading">Daily challenge</h2>
      <p class="ss-lead">${longDate(now)}. Everyone who plays today gets the same challenge. A new one starts at midnight.</p>
      <div class="ss-card ss-daily-card ss-world-${level.world}">
        <span class="ss-card-top">Today's world</span>
        <span class="ss-card-name">${level.name}</span>
        <span class="ss-card-text">${level.challenge} Eat ${level.goal} cowries to clear it.</span>
        <span class="ss-card-status">
          <span>${d?.cleared ? "Cleared today" : "Not cleared yet today"}</span>
          <span>Today's best ${d?.best ?? 0}</span>
        </span>
      </div>
      <p class="ss-streak">Streak: <strong>${days(streak)}</strong>. Longest: ${days(this.progress.daily?.bestStreak ?? 0)}.</p>
      <div class="ss-actions">
        <button class="ss-btn ss-primary" data-daily data-focus>Play today's challenge</button>
        <button class="ss-btn" data-go="title">Back</button>
      </div>`;
    el.querySelector("[data-daily]")!.addEventListener("click", () => this.startRun("daily", 0));
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
        <p class="ss-hud-power" data-hud="power"></p>
      </div>
      <div class="ss-stage" data-stage>
        <canvas class="ss-canvas" role="img" aria-label="Game board"></canvas>
        <div class="ss-overlay" data-overlay></div>
      </div>
      <div class="ss-actions ss-bar">
        <button class="ss-btn" data-pause>Pause</button>
        <button class="ss-btn ss-toggle" data-setting="sound">Sound</button>
        <button class="ss-btn" data-back>Levels</button>
      </div>
      <p class="ss-note ss-hint">Arrow keys or W, A, S and D to steer. Space to pause and M for sound. On a phone, swipe to steer and tap the board to pause.</p>`;
    this.canvas = el.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d")!;
    el.querySelector("[data-pause]")!.addEventListener("click", () => this.command({ type: "pause" }));
    const stage = el.querySelector<HTMLElement>("[data-stage]")!;
    listenForTouch(stage, (c) => this.command(c));
    // A swipe steers during touchmove, which iPhones don't count as a press for sound. The end of the touch does count.
    stage.addEventListener("touchend", () => this.sound.unlock(), { passive: true });
    el.querySelector("[data-back]")!.addEventListener("click", () => this.back());
    el.querySelector("[data-setting]")!.addEventListener("click", () => this.toggleSetting("sound"));
    this.syncSettings();
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

  /** Turns sound or vibration off or on, saves the choice and updates every switch. */
  private toggleSetting(name: keyof Settings) {
    const settings = settingsOf(this.progress);
    settings[name] = !settings[name];
    this.progress = { ...this.progress, settings };
    saveProgress(this.progress);
    this.sound.soundOn = settings.sound;
    this.sound.vibrationOn = settings.vibration;
    this.sound.unlock();
    this.syncSettings();
    this.say(`${name === "sound" ? "Sound" : "Vibration"} ${settings[name] ? "on" : "off"}.`);
  }

  private syncSettings() {
    const settings = settingsOf(this.progress);
    this.root.querySelectorAll<HTMLButtonElement>("[data-setting]").forEach((b) => {
      b.setAttribute("aria-pressed", String(settings[b.dataset.setting as keyof Settings]));
    });
  }

  /** Leaves a run for the screen it was started from. */
  private back() {
    this.show(this.mode === "daily" ? "daily" : "levels");
  }

  private backLabel() {
    return this.mode === "daily" ? "Daily challenge" : this.mode === "levels" ? "Levels" : this.mode === "free" ? "Free play" : "Practice";
  }

  private freeKey(level: LevelDef) {
    return `${level.id}-${this.freeEdges}`;
  }

  /** The heading over the board, such as "Level 3: Market" or "Daily challenge: Ocean". */
  private runTitle() {
    const level = LEVELS[this.levelIndex];
    if (this.mode === "daily") return `Daily challenge: ${this.state.level.name}`;
    if (this.mode === "free") return `Free play: ${level.name}`;
    if (this.mode === "practice") return `Practice: ${level.name}`;
    return `Level ${level.number}: ${level.name}`;
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

  private startRun(mode: Mode, i: number) {
    // Every way into a run is a button press, which iPhones need before they allow sound.
    this.sound.unlock();
    this.mode = mode;
    if (mode !== "daily") this.listMode = mode;
    let level: LevelDef;
    let seed = this.options.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    if (mode === "daily") {
      this.dailyDate = dateKey(new Date());
      level = dailyLevel(this.dailyDate);
      seed = this.options.seed ?? dailySeed(this.dailyDate);
      i = LEVELS.findIndex((l) => l.world === level.world);
    } else if (mode === "free") level = freePlayLevel(LEVELS[i], this.freeEdges);
    else if (mode === "practice") level = practiceLevel(LEVELS[i]);
    else level = LEVELS[i];
    this.levelIndex = i;
    this.state = createGame(level, seed);
    this.part("game").className = `ss-screen ss-game ss-world-${level.world}`;
    this.show("game");
    this.say(`${this.runTitle()}. ${level.challenge} Press an arrow key or swipe to start.`);
    // The power-up line keeps its space on levels with power-ups, so the board doesn't jump.
    this.part("game").querySelector<HTMLElement>('[data-hud="power"]')!.hidden = !level.powerUps;
    this.part("game").querySelector<HTMLElement>("[data-back]")!.textContent = this.backLabel();
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
    if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.toggleSetting("sound");
      return;
    }
    const c = commandForKey(e);
    if (!c) return;
    e.preventDefault();
    this.command(c);
  }

  private command(c: Command) {
    if (!this.state) return;
    this.sound.unlock();
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
    this.sound.play(e, this.state.eaten);
    if (e.type === "ate") {
      const count = this.mode === "free" ? `Cowrie ${this.state.eaten}` : `Cowrie ${this.state.eaten} of ${level.goal}`;
      this.say(`${count}. Score ${this.state.score}.`);
    }
    if (e.type === "bump") this.say(`${bumpText(this.state)} Choose a new direction.`);
    if (e.type === "speedup") this.say("The snake is faster now.");
    if (e.type === "powerAppeared") this.say(`A ${POWER_NAME[e.kind]} power-up appeared.`);
    if (e.type === "power") this.say(POWER_TEXT[e.kind]);
    if (e.type === "passed") this.say("The snake passed through its tail.");
    if (e.type === "crash") {
      if (this.mode === "levels") this.progress = recordRun(this.progress, level.id, this.state.score, 0, false);
      if (this.mode === "daily") this.progress = recordDaily(this.progress, this.dailyDate, this.state.score, false);
      if (this.mode === "free") this.progress = recordFree(this.progress, this.freeKey(LEVELS[this.levelIndex]), this.state.eaten);
      saveProgress(this.progress);
      this.say(`${crashText(this.state)} Score ${this.state.score}.`);
    }
    if (e.type === "cleared") {
      this.lastClear = e;
      if (this.mode === "levels") this.progress = recordRun(this.progress, level.id, e.score, e.stars, true);
      if (this.mode === "daily") this.progress = recordDaily(this.progress, this.dailyDate, e.score, true);
      saveProgress(this.progress);
      if (this.mode === "practice") this.say(`Practice run complete. Score ${e.score}.`);
      else this.say(`${this.mode === "daily" ? "Daily challenge" : "Level"} cleared with ${e.stars} of 3 stars. Score ${e.score}.`);
    }
  }

  private updateHud() {
    const s = this.state;
    const el = this.part("game");
    const set = (name: string, text: string) => {
      const node = el.querySelector(`[data-hud="${name}"]`)!;
      if (node.textContent !== text) node.textContent = text;
    };
    set("level", this.runTitle());
    set("eaten", this.mode === "free" ? String(s.eaten) : `${s.eaten} of ${s.level.goal}`);
    set("score", String(s.score));
    let best = 0;
    if (this.mode === "levels") best = this.progress.levels[s.level.id]?.best ?? 0;
    if (this.mode === "daily") best = this.progress.daily?.date === this.dailyDate ? this.progress.daily.best : 0;
    if (this.mode === "free") best = this.progress.free?.[this.freeKey(LEVELS[this.levelIndex])] ?? 0;
    // Free play keeps the most cowries in one run, so its best counts cowries.
    set("best", String(Math.max(best, this.mode === "free" ? s.eaten : s.score)));
    el.querySelector<HTMLElement>('[data-hud="best"]')!.parentElement!.hidden = this.mode === "practice";
    const power = [
      isSlow(s) ? `Slow motion for ${s.slowUntil - s.moves} more moves` : "",
      s.passes > 0 ? (s.passes === 1 ? "One pass through the tail" : `${s.passes} passes through the tail`) : "",
    ].filter(Boolean).join(". ");
    set("power", power);
    const pauseBtn = el.querySelector<HTMLButtonElement>("[data-pause]")!;
    pauseBtn.textContent = s.status === "paused" ? "Resume" : "Pause";
    pauseBtn.disabled = s.status !== "running" && s.status !== "paused";
  }

  private updateOverlay() {
    const s = this.state;
    const overlay = this.part("game").querySelector<HTMLElement>("[data-overlay]")!;
    const level = s.level;
    const mode = this.mode;
    const hasNext = mode === "levels" && this.levelIndex < LEVELS.length - 1;
    const back = `<button class="ss-btn" data-back>${this.backLabel()}</button>`;
    let html = "";
    if (s.status === "ready" && s.bump) {
      html = `
        <p class="ss-overlay-title">Bump</p>
        <p>${bumpText(s)} Choose a new direction to keep going.</p>`;
    } else if (s.status === "ready") {
      html = `
        <p class="ss-overlay-title">${this.runTitle()}</p>
        <p>${level.challenge}</p>
        <p class="ss-overlay-hint">Press an arrow key or swipe to start.</p>`;
    } else if (s.status === "paused") {
      html = `
        <p class="ss-overlay-title">Paused</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-resume>Resume</button>
          ${back}
        </div>`;
    } else if (s.status === "over") {
      const best = mode === "free" ? this.progress.free?.[this.freeKey(LEVELS[this.levelIndex])] ?? 0 : 0;
      const tally =
        mode === "free"
          ? `You collected ${s.eaten} ${s.eaten === 1 ? "cowrie" : "cowries"}. Your best here is ${best}.`
          : `You collected ${s.eaten} of ${level.goal} cowries. Score ${s.score}.`;
      html = `
        <p class="ss-overlay-title">Game over</p>
        <p>${crashText(s)}</p>
        <p>${tally}</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-again>Play again</button>
          ${back}
        </div>`;
    } else if (s.status === "cleared" && mode === "practice") {
      html = `
        <p class="ss-overlay-title">Practice run complete</p>
        <p>You collected all ${level.goal} cowries. Score ${s.score}.</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-again>Practice again</button>
          ${back}
        </div>`;
    } else if (s.status === "cleared" && this.lastClear) {
      const { stars, timeBonus } = this.lastClear;
      let note = "";
      if (mode === "daily") {
        const n = currentStreak(this.progress, this.dailyDate);
        note = `<p>Your streak is ${n} ${n === 1 ? "day" : "days"}. Come back tomorrow for a new challenge.</p>`;
      } else {
        const best = this.progress.levels[level.id]?.stars ?? stars;
        if (best > stars) note = `<p>Your best on this level is ${best} stars.</p>`;
        if (!hasNext) note += `<p>You've cleared all nine levels.</p>`;
      }
      html = `
        <p class="ss-overlay-title">${mode === "daily" ? "Daily challenge cleared" : "Level cleared"}</p>
        <p class="ss-stars ss-big" aria-label="${stars} of 3 stars">${starText(stars)}</p>
        <p>Score ${s.score}, including a time bonus of ${timeBonus}.</p>
        ${note}
        <div class="ss-actions">
          ${hasNext ? `<button class="ss-btn ss-primary" data-next>Next level</button>` : ""}
          <button class="ss-btn${hasNext ? "" : " ss-primary"}" data-again>Play again</button>
          ${back}
        </div>`;
    }
    overlay.innerHTML = html ? `<div class="ss-panel">${html}</div>` : "";
    overlay.hidden = s.status === "running";
    overlay.classList.toggle("ss-overlay-passive", s.status === "ready");
    overlay.querySelector("[data-resume]")?.addEventListener("click", () => this.command({ type: "pause" }));
    overlay.querySelector("[data-again]")?.addEventListener("click", () => this.startRun(mode, this.levelIndex));
    overlay.querySelector("[data-next]")?.addEventListener("click", () => this.startRun("levels", this.levelIndex + 1));
    overlay.querySelector("[data-back]")?.addEventListener("click", () => this.back());
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
