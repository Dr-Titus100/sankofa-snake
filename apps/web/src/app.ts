// The web game: the title screen, the level list, the daily challenge, free play, practice, the
// board and the messages over it.
// The rules come from packages/core. This file connects them to the page. The words come from text.ts.
import {
  LEVELS,
  createGame,
  dailyLevel,
  dailySeed,
  dateKey,
  freePlayLevel,
  isSlow,
  layoutSeed,
  moveMs,
  newLayout,
  pause,
  tick,
  togglePause,
  practiceLevel,
  turn,
  type Direction,
  type Edges,
  type GameEvent,
  type LevelDef,
  type GameState,
} from "../../../packages/core/src";
import { commandForKey, inputKind, listenForSwipes, type Command } from "./input";
import { sankofaLogo } from "./logo";
import { draw, layoutFor, type Layout, type SceneryCache } from "./render";
import { Sound } from "./sound";
import {
  canSave,
  cleanProgress,
  currentStreak,
  loadProgress,
  recordDaily,
  recordFree,
  recordRun,
  resetProgress,
  saveProgress,
  PROGRESS_KEY,
  SAVED_EVENT,
  settingsOf,
  type Progress,
  type Settings,
} from "./storage";
import { TEXT, bumpText, crashText, esc, longDate, type Input } from "./text";

type Screen = "title" | "levels" | "daily" | "help" | "game";

/** The ways to play. "levels" is the nine levels in order. */
type Mode = "levels" | "daily" | "free" | "practice";

const starText = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

/** On a phone turned sideways, the board sits beside the score and buttons instead of above them. */
const SIDEWAYS = "(orientation: landscape) and (max-height: 500px)";

let copies = 0;

export interface Options {
  /** A fixed seed puts the cowries in the same places every time. The tests use it. */
  seed?: number;
  /**
   * "full" is the whole game. "play" is the game without its How to play button, for a page that
   * shows the rules on a tab of its own. "help" shows only the rules and the sound and vibration
   * switches, for that tab.
   */
  view?: "full" | "play" | "help";
  /**
   * "fixed" keeps every level exactly as its file draws it. Otherwise each run places the
   * obstacles, currents and roads somewhere new, and the Maze is a new maze.
   */
  layout?: "new" | "fixed";
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
  private scenery: SceneryCache = {};
  private frameId = 0;
  private lastTime = 0;
  private carry = 0;
  private lastClear: Extract<GameEvent, { type: "cleared" }> | null = null;
  private reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  private input: Input = inputKind();
  private sound: Sound;
  /** Removes every listener the game added to the window, the document and the board. */
  private listeners = new AbortController();
  private resizer: ResizeObserver | null = null;
  /** False when the browser won't keep progress, such as in some private windows. */
  private saving = canSave();
  private id = ++copies;
  private destroyed = false;

  constructor(root: HTMLElement, private options: Options = {}) {
    this.root = root;
    const settings = settingsOf(this.progress);
    this.sound = new Sound(settings.sound, settings.vibration);
    const signal = this.listeners.signal;
    root.classList.add("ss-root");
    // Phones and tablets get the arrow pad, and the layout makes room for it.
    root.classList.toggle("ss-touch", this.input === "touch");
    // A page can hold more than one copy of the game, such as a play view and a help view, and a player
    // can have the game open in two tabs. Each copy loads progress again whenever another one saves, so
    // a stale copy never writes over newer scores or switches.
    window.addEventListener(SAVED_EVENT, () => this.reload(), { signal });
    window.addEventListener(
      "storage",
      (e) => {
        if (e.key === null || e.key === PROGRESS_KEY) this.reload();
      },
      { signal },
    );
    if (options.view === "help") {
      // Only the rules and the switches. No board, so no keys or game listeners either.
      root.innerHTML = `
        <div class="ss-screen ss-help" data-screen="help"></div>
        <p class="ss-sr" aria-live="polite" data-live></p>`;
      this.screen = "help";
      this.renderHelp();
      return;
    }
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
    window.addEventListener("keydown", (e) => this.onKey(e), { signal });
    // Pause when the player switches tabs or apps, so the snake never crashes unseen.
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && this.state) this.guard(() => this.apply(pause(this.state)));
      },
      { signal },
    );
    window.addEventListener(
      "blur",
      () => {
        if (this.screen === "game" && this.state) this.guard(() => this.apply(pause(this.state)));
      },
      { signal },
    );
    this.resizer = new ResizeObserver(() => this.guard(() => this.resize()));
    this.resizer.observe(root);
  }

  /**
   * Goes back one step, the way the Android back button does: a run pauses first, then each press
   * goes back one screen. Returns false on the title screen, where the app itself should close.
   */
  back(): boolean {
    if (this.destroyed) return false;
    const confirm = this.screen === "help" && this.part("help").querySelector<HTMLElement>("[data-confirm]:not([hidden])");
    if (confirm) {
      this.closeConfirm();
      return true;
    }
    if (this.options.view === "help") return false;
    if (this.screen === "game") {
      if (this.state?.status === "running") this.guard(() => this.apply(pause(this.state)));
      else this.leaveRun();
      return true;
    }
    if (this.screen === "title") return false;
    this.show("title");
    return true;
  }

  /**
   * Removes the game from the page: stops the board, closes the sound and removes every listener.
   * The element can then hold a new copy of the game.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.listeners.abort();
    this.resizer?.disconnect();
    this.sound.close();
    this.root.innerHTML = "";
    this.root.classList.remove("ss-root", "ss-touch");
    delete this.root.dataset.ssStarted;
    delete (this.root as HTMLElement & { sankofaSnake?: unknown }).sankofaSnake;
  }

  // Screens

  private show(screen: Screen) {
    // Leaving How to play cancels an open Reset progress question, so it never waits unseen.
    if (this.screen === "help" && screen !== "help") this.closeConfirm(false);
    this.screen = screen;
    this.root.querySelectorAll<HTMLElement>(".ss-screen").forEach((el) => {
      el.hidden = el.dataset.screen !== screen;
    });
    if (screen === "levels") this.renderLevels();
    if (screen === "daily") this.renderDaily();
    if (screen !== "game") this.stopLoop();
    this.reveal();
    const first = this.root.querySelector<HTMLElement>(`[data-screen="${screen}"] [data-focus]`);
    first?.focus();
  }

  /**
   * A new screen can be much shorter than the one before. When the level list was scrolled down, the
   * page would then show whatever sits below the game. Scrolling back to the top of the game keeps
   * the new screen in view. A page with a sticky header can set --ss-scroll-margin to clear it.
   */
  private reveal() {
    if (this.root.getBoundingClientRect().top < 0) this.root.scrollIntoView({ block: "start" });
  }

  /** A note shown when the browser won't keep progress. */
  private saveWarning() {
    return this.saving ? "" : `<p class="ss-note ss-warn" role="status" data-cant-save>${esc(TEXT.cantSave)}</p>`;
  }

  private renderTitle() {
    const el = this.part("title");
    const b = TEXT.buttons;
    el.innerHTML = `
      <div class="ss-logo">${sankofaLogo(150, TEXT.logoLabel)}</div>
      <h2 class="ss-heading">${esc(TEXT.name)}</h2>
      <p class="ss-lead">${esc(TEXT.lead)}</p>
      <div class="ss-actions">
        <button class="ss-btn ss-primary" data-play data-focus>${esc(b.play)}</button>
        <button class="ss-btn" data-go="daily">${esc(b.daily)}</button>
        <button class="ss-btn" data-levels>${esc(b.chooseLevel)}</button>
        ${this.options.view === "play" ? "" : `<button class="ss-btn" data-go="help">${esc(b.howToPlay)}</button>`}
      </div>
      ${this.saveWarning()}
      <p class="ss-note">${esc(TEXT.sankofaNote)}</p>`;
    el.querySelector("[data-play]")!.addEventListener("click", () => this.startRun("levels", this.nextLevelIndex()));
    el.querySelector("[data-levels]")!.addEventListener("click", () => {
      this.listMode = "levels";
      this.show("levels");
    });
    this.wireNav(el);
  }

  private renderHelp() {
    const el = this.part("help");
    const alone = this.options.view === "help";
    const h = TEXT.help;
    const b = TEXT.buttons;
    const items = [h.steer[this.input], ...h.rules, h.pause[this.input], ...h.more];
    if (this.input === "keys") items.push(h.soundKey);
    const confirmId = `ss-confirm-${this.id}`;
    el.innerHTML = `
      ${alone ? "" : `<h2 class="ss-heading" tabindex="-1" data-focus>${esc(h.heading)}</h2>`}
      <ul class="ss-list">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <h3 class="ss-subheading">${esc(h.settings)}</h3>
      <div class="ss-tabs" role="group" aria-label="${esc(h.settingsLabel)}">
        <button class="ss-tab" data-setting="sound">${esc(b.sound)}</button>
        ${Sound.canVibrate ? `<button class="ss-tab" data-setting="vibration">${esc(b.vibration)}</button>` : ""}
      </div>
      <p class="ss-note ss-intro">${esc(h.goldMeansOn)} ${Sound.canVibrate ? esc(h.vibrationNote) : ""}</p>
      <h3 class="ss-subheading">${esc(h.progress)}</h3>
      <p class="ss-note ss-intro">${esc(h.progressNote)}</p>
      ${this.saveWarning()}
      <div class="ss-actions" data-reset-area>
        <button class="ss-btn" data-reset>${esc(b.reset)}</button>
      </div>
      <div class="ss-confirm" role="group" aria-labelledby="${confirmId}" data-confirm hidden>
        <p id="${confirmId}">${esc(h.confirm)}</p>
        <div class="ss-actions">
          <button class="ss-btn ss-danger" data-confirm-yes>${esc(b.confirmReset)}</button>
          <button class="ss-btn" data-confirm-no>${esc(b.cancel)}</button>
        </div>
      </div>
      <p class="ss-note ss-done" role="status" data-reset-done></p>
      ${alone ? "" : `<div class="ss-actions"><button class="ss-btn" data-go="title">${esc(b.back)}</button></div>`}`;
    el.querySelectorAll<HTMLButtonElement>("[data-setting]").forEach((btn) => {
      btn.addEventListener("click", () => this.toggleSetting(btn.dataset.setting as keyof Settings));
    });
    el.querySelector("[data-reset]")!.addEventListener("click", () => this.openConfirm());
    el.querySelector("[data-confirm-no]")!.addEventListener("click", () => this.closeConfirm());
    el.querySelector("[data-confirm-yes]")!.addEventListener("click", () => this.resetAll());
    this.syncSettings();
    this.wireNav(el);
  }

  private openConfirm() {
    const el = this.part("help");
    el.querySelector<HTMLElement>("[data-reset-area]")!.hidden = true;
    el.querySelector<HTMLElement>("[data-reset-done]")!.textContent = "";
    el.querySelector<HTMLElement>("[data-confirm]")!.hidden = false;
    // Cancel takes focus, so a stray Enter keeps the progress.
    el.querySelector<HTMLElement>("[data-confirm-no]")!.focus();
  }

  private closeConfirm(focus = true) {
    const el = this.part("help");
    el.querySelector<HTMLElement>("[data-confirm]")!.hidden = true;
    el.querySelector<HTMLElement>("[data-reset-area]")!.hidden = false;
    if (focus) el.querySelector<HTMLElement>("[data-reset]")!.focus();
  }

  private resetAll() {
    this.progress = resetProgress(this.progress);
    this.save();
    this.closeConfirm();
    this.part("help").querySelector<HTMLElement>("[data-reset-done]")!.textContent = TEXT.help.resetDone;
  }

  private renderLevels() {
    const el = this.part("levels");
    const mode = this.listMode;
    const t = TEXT.levels;
    const tab = (m: typeof mode, label: string) =>
      `<button class="ss-tab" data-tab="${m}" aria-pressed="${m === mode}">${esc(label)}</button>`;
    const edge = (e: Edges, label: string) =>
      `<button class="ss-tab" data-edges="${e}" aria-pressed="${e === this.freeEdges}">${esc(label)}</button>`;
    const cards = LEVELS.map((level, i) => {
      const p = this.progress.levels[level.id];
      const open = mode === "practice" || this.isUnlocked(i);
      let status: string;
      if (!open) status = `<span>${esc(t.locked(LEVELS[i - 1].name))}</span>`;
      else if (mode === "practice") status = `<span>${esc(t.practiceStatus)}</span>`;
      else if (mode === "free") status = `<span>${esc(t.freeBest(this.progress.free?.[this.freeKey(level)] ?? 0))}</span>`;
      else if (p) {
        status = `<span class="ss-stars" aria-label="${esc(TEXT.run.stars(p.stars))}">${starText(p.stars)}</span><span>${esc(t.best(p.best))}</span>`;
      } else status = `<span>${esc(t.notPlayed)}</span>`;
      return `
        <li>
          <button class="ss-card ss-world-${esc(level.world)}" data-level="${i}" ${open ? "" : "disabled"}>
            <span class="ss-card-top">${esc(t.card(level.number))}</span>
            <span class="ss-card-name">${esc(level.name)}</span>
            ${mode === "free" ? "" : `<span class="ss-card-text">${esc(level.challenge)}</span>`}
            <span class="ss-card-status">${status}</span>
          </button>
        </li>`;
    }).join("");
    el.innerHTML = `
      <h2 class="ss-heading">${esc(t.heading[mode])}</h2>
      <div class="ss-tabs" role="group" aria-label="${esc(t.tabsLabel)}">
        ${tab("levels", t.heading.levels)}${tab("free", t.heading.free)}${tab("practice", t.heading.practice)}
      </div>
      ${mode === "free" ? `<div class="ss-tabs ss-tabs-small" role="group" aria-label="${esc(t.edgesLabel)}">${edge("wrap", t.wrap)}${edge("walls", t.walls)}</div>` : ""}
      <p class="ss-note ss-intro">${esc(t.intro[mode])}</p>
      <ul class="ss-cards">${cards}</ul>
      <div class="ss-actions"><button class="ss-btn" data-go="title">${esc(TEXT.buttons.back)}</button></div>`;
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
    const t = TEXT.daily;
    const now = new Date();
    const today = dateKey(now);
    const level = dailyLevel(today);
    const d = this.progress.daily?.date === today ? this.progress.daily : undefined;
    const streak = t.streak(currentStreak(this.progress, today), this.progress.daily?.bestStreak ?? 0);
    el.innerHTML = `
      <h2 class="ss-heading">${esc(t.heading)}</h2>
      <p class="ss-lead">${esc(t.lead(longDate(now)))}</p>
      <div class="ss-card ss-daily-card ss-world-${esc(level.world)}">
        <span class="ss-card-top">${esc(t.world)}</span>
        <span class="ss-card-name">${esc(level.name)}</span>
        <span class="ss-card-text">${esc(t.goal(level.challenge, level.goal))}</span>
        <span class="ss-card-status">
          <span>${esc(d?.cleared ? t.clearedToday : t.notCleared)}</span>
          <span>${esc(t.todaysBest(d?.best ?? 0))}</span>
        </span>
      </div>
      <p class="ss-streak">${esc(streak.label)} <strong>${esc(streak.now)}</strong>. ${esc(streak.rest)}</p>
      <div class="ss-actions">
        <button class="ss-btn ss-primary" data-daily data-focus>${esc(TEXT.buttons.playDaily)}</button>
        <button class="ss-btn" data-go="title">${esc(TEXT.buttons.back)}</button>
      </div>`;
    el.querySelector("[data-daily]")!.addEventListener("click", () => this.startRun("daily", 0));
    this.wireNav(el);
  }

  private renderGameShell() {
    const el = this.part("game");
    const h = TEXT.hud;
    const b = TEXT.buttons;
    el.innerHTML = `
      <div class="ss-hud">
        <h2 class="ss-hud-level" data-hud="level"></h2>
        <dl class="ss-hud-stats">
          <div><dt>${esc(h.cowries)}</dt><dd data-hud="eaten"></dd></div>
          <div><dt>${esc(h.score)}</dt><dd data-hud="score"></dd></div>
          <div><dt>${esc(h.best)}</dt><dd data-hud="best"></dd></div>
        </dl>
        <p class="ss-hud-power" data-hud="power"></p>
      </div>
      <div class="ss-stage" data-stage>
        <canvas class="ss-canvas" role="img" aria-label="${esc(h.board)}"></canvas>
        <div class="ss-overlay" data-overlay></div>
      </div>
      <div class="ss-controls${this.input === "touch" ? " ss-with-pad" : ""}">
        <div class="ss-actions ss-bar">
          <button class="ss-btn" data-pause>${esc(b.pause)}</button>
          <button class="ss-btn ss-toggle" data-setting="sound">${esc(b.sound)}</button>
          <button class="ss-btn" data-back>${esc(b.back)}</button>
        </div>
        ${this.input === "touch" ? padHtml() : ""}
      </div>
      <p class="ss-note ss-hint">${esc(h.hint[this.input])}</p>`;
    const signal = this.listeners.signal;
    this.canvas = el.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d")!;
    el.querySelector("[data-pause]")!.addEventListener("click", () => this.command({ type: "pause" }));
    const stage = el.querySelector<HTMLElement>("[data-stage]")!;
    listenForSwipes(stage, (c) => this.command(c), signal);
    // A swipe steers during pointermove, which iPhones don't count as a press for sound. The end of the touch does count.
    stage.addEventListener("pointerup", () => this.sound.unlock(), { signal });
    el.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((button) => {
      const dir = button.dataset.dir as Direction;
      // The snake turns as soon as a finger touches an arrow, without waiting for it to lift.
      // preventDefault keeps a quick second tap from zooming the page.
      button.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.preventDefault();
          this.command({ type: "turn", dir });
        },
        { signal },
      );
      // A keyboard or a switch presses the button with a click that has no pointer before it.
      button.addEventListener("click", (e) => e.detail === 0 && this.command({ type: "turn", dir }), { signal });
      // iPhones allow sound only after the end of a touch.
      button.addEventListener("pointerup", () => this.sound.unlock(), { signal });
    });
    el.querySelector("[data-back]")!.addEventListener("click", () => this.leaveRun());
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

  /** Picks up progress and switches saved by another copy of the game. */
  private reload() {
    this.progress = loadProgress();
    const settings = settingsOf(this.progress);
    this.sound.soundOn = settings.sound;
    this.sound.vibrationOn = settings.vibration;
    this.syncSettings();
  }

  /** Saves progress, and tells the player once if the browser won't keep it. */
  private save() {
    // Saved values are checked on the way out too, so a bug can't write a save the game can't read.
    this.progress = cleanProgress(this.progress);
    if (saveProgress(this.progress) || !this.saving) return;
    this.saving = false;
    this.say(TEXT.cantSave);
    for (const name of ["title", "help"] as const) {
      const el = this.root.querySelector<HTMLElement>(`[data-screen="${name}"]`);
      if (el && !el.querySelector("[data-cant-save]")) {
        el.querySelector(".ss-actions")?.insertAdjacentHTML("afterend", this.saveWarning());
      }
    }
  }

  /** Turns sound or vibration off or on, saves the choice and updates every switch. */
  private toggleSetting(name: keyof Settings) {
    const settings = settingsOf(this.progress);
    settings[name] = !settings[name];
    this.progress = { ...this.progress, settings };
    this.save();
    this.sound.soundOn = settings.sound;
    this.sound.vibrationOn = settings.vibration;
    this.sound.unlock();
    this.syncSettings();
    this.say(TEXT.say.setting(name, settings[name]));
  }

  private syncSettings() {
    const settings = settingsOf(this.progress);
    this.root.querySelectorAll<HTMLButtonElement>("[data-setting]").forEach((b) => {
      b.setAttribute("aria-pressed", String(settings[b.dataset.setting as keyof Settings]));
    });
  }

  /** Leaves a run for the screen it was started from. */
  private leaveRun() {
    this.show(this.mode === "daily" ? "daily" : "levels");
  }

  private freeKey(level: LevelDef) {
    return `${level.id}-${this.freeEdges}`;
  }

  /** The heading over the board, such as "Level 3: Market" or "Daily challenge: Ocean". */
  private runTitle() {
    const level = LEVELS[this.levelIndex];
    const r = TEXT.run;
    if (this.mode === "daily") return r.daily(this.state.level.name);
    if (this.mode === "free") return r.free(level.name);
    if (this.mode === "practice") return r.practice(level.name);
    return r.level(level.number, level.name);
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
    // A new layout for every run. The daily challenge's seed comes from the date, so everyone
    // gets the same layout on the same day.
    if (this.options.layout !== "fixed") level = newLayout(level, layoutSeed(seed));
    this.levelIndex = i;
    this.stopLoop();
    this.state = createGame(level, seed);
    this.part("game").className = `ss-screen ss-game ss-world-${level.world}`;
    this.show("game");
    this.say(TEXT.say.runStart(this.runTitle(), level.challenge, TEXT.run.start[this.input]));
    // The power-up line keeps its space on levels with power-ups, so the board doesn't jump.
    this.part("game").querySelector<HTMLElement>('[data-hud="power"]')!.hidden = !level.powerUps;
    this.updateHud();
    this.updateOverlay();
    // The board is drawn once here. It is drawn again on every frame only while the snake moves.
    this.guard(() => this.resize());
  }

  /** Starts drawing frames. Frames run only while the snake moves, which saves battery. */
  private startLoop() {
    if (this.frameId || this.destroyed) return;
    this.lastTime = 0;
    this.carry = 0;
    this.frameId = requestAnimationFrame((t) => this.frame(t));
  }

  private stopLoop() {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  private frame(time: number) {
    this.frameId = 0;
    if (this.screen !== "game") return;
    this.guard(() => {
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
      }
      this.drawBoard(time);
      // A paused, waiting or finished board stays as it was drawn, so no more frames are needed.
      if (this.state.status === "running" && !this.frameId) {
        this.frameId = requestAnimationFrame((t) => this.frame(t));
      }
    });
  }

  private drawBoard(time = performance.now()) {
    if (!this.layout) return;
    draw(this.ctx, this.state, this.layout, time, this.reduceMotion, this.scenery);
  }

  /** Runs a step of the game, and shows a message with a way out if it fails. */
  private guard(step: () => void) {
    if (this.destroyed) return;
    try {
      step();
    } catch (error) {
      this.fail(error);
    }
  }

  /** Stops the board after an error and offers a way back to the title, instead of a frozen board. */
  private fail(error: unknown) {
    this.stopLoop();
    console.error("Sankofa Snake stopped because of an error.", error);
    const overlay = this.root.querySelector<HTMLElement>("[data-overlay]");
    if (!overlay) return;
    overlay.hidden = false;
    overlay.classList.remove("ss-overlay-passive");
    overlay.innerHTML = `
      <div class="ss-panel" role="alert">
        <p class="ss-overlay-title">${esc(TEXT.run.errorTitle)}</p>
        <p>${esc(TEXT.run.error)}</p>
        <div class="ss-actions"><button class="ss-btn ss-primary" data-go="title">${esc(TEXT.buttons.toTitle)}</button></div>
      </div>`;
    this.wireNav(overlay);
    overlay.querySelector<HTMLElement>(".ss-primary")?.focus();
    this.say(TEXT.run.errorTitle);
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
    if (!this.state || this.screen !== "game") return;
    this.sound.unlock();
    this.guard(() => {
      if (c.type === "turn") this.apply(turn(this.state, c.dir));
      else this.apply(togglePause(this.state));
    });
  }

  private apply(next: GameState | undefined, events: GameEvent[] = []) {
    if (!next) return;
    const before = this.state.status;
    this.state = next;
    for (const e of events) this.onEvent(e);
    if (next.status !== before) {
      this.updateOverlay();
      if (next.status === "paused") this.say(TEXT.say.paused);
      if (next.status === "running" && before === "paused") this.say(TEXT.say.playing);
      if (next.status === "running") this.startLoop();
    }
    this.updateHud();
  }

  private onEvent(e: GameEvent) {
    const level = this.state.level;
    const say = TEXT.say;
    this.sound.play(e, this.state.eaten);
    if (e.type === "ate") this.say(say.ate(this.state.eaten, this.state.score, this.mode === "free" ? undefined : level.goal));
    if (e.type === "bump") this.say(say.bump(bumpText(this.state)));
    if (e.type === "speedup") this.say(say.speedup);
    if (e.type === "powerAppeared") this.say(say.powerAppeared(TEXT.power.name[e.kind]));
    if (e.type === "power") this.say(TEXT.power.text[e.kind]);
    if (e.type === "passed") this.say(say.passed);
    if (e.type === "crash") {
      if (this.mode === "levels") this.progress = recordRun(this.progress, level.id, this.state.score, 0, false);
      if (this.mode === "daily") this.progress = recordDaily(this.progress, this.dailyDate, this.state.score, false);
      if (this.mode === "free") this.progress = recordFree(this.progress, this.freeKey(LEVELS[this.levelIndex]), this.state.eaten);
      this.save();
      this.say(say.crash(crashText(this.state), this.state.score));
    }
    if (e.type === "cleared") {
      this.lastClear = e;
      if (this.mode === "levels") this.progress = recordRun(this.progress, level.id, e.score, e.stars, true);
      if (this.mode === "daily") this.progress = recordDaily(this.progress, this.dailyDate, e.score, true);
      this.save();
      if (this.mode === "practice") this.say(say.practiceDone(e.score));
      else this.say(say.cleared(this.mode === "daily", e.stars, e.score));
    }
  }

  private updateHud() {
    const s = this.state;
    const el = this.part("game");
    const h = TEXT.hud;
    const set = (name: string, text: string) => {
      const node = el.querySelector(`[data-hud="${name}"]`)!;
      if (node.textContent !== text) node.textContent = text;
    };
    set("level", this.runTitle());
    set("eaten", h.eaten(s.eaten, this.mode === "free" ? undefined : s.level.goal));
    set("score", String(s.score));
    let best = 0;
    if (this.mode === "levels") best = this.progress.levels[s.level.id]?.best ?? 0;
    if (this.mode === "daily") best = this.progress.daily?.date === this.dailyDate ? this.progress.daily.best : 0;
    if (this.mode === "free") best = this.progress.free?.[this.freeKey(LEVELS[this.levelIndex])] ?? 0;
    // Free play keeps the most cowries in one run, so its best counts cowries.
    set("best", String(Math.max(best, this.mode === "free" ? s.eaten : s.score)));
    el.querySelector<HTMLElement>('[data-hud="best"]')!.parentElement!.hidden = this.mode === "practice";
    const power = [isSlow(s) ? h.slow(s.slowUntil - s.moves) : "", s.passes > 0 ? h.passes(s.passes) : ""]
      .filter(Boolean)
      .join(". ");
    set("power", power);
    const pauseBtn = el.querySelector<HTMLButtonElement>("[data-pause]")!;
    pauseBtn.textContent = s.status === "paused" ? TEXT.buttons.resume : TEXT.buttons.pause;
    pauseBtn.disabled = s.status !== "running" && s.status !== "paused";
  }

  private updateOverlay() {
    const s = this.state;
    const overlay = this.part("game").querySelector<HTMLElement>("[data-overlay]")!;
    const level = s.level;
    const mode = this.mode;
    const r = TEXT.run;
    const b = TEXT.buttons;
    const hasNext = mode === "levels" && this.levelIndex < LEVELS.length - 1;
    const back = `<button class="ss-btn" data-back>${esc(b.back)}</button>`;
    let html = "";
    if (s.status === "ready" && s.bump) {
      html = `
        <p class="ss-overlay-title">${esc(r.bumpTitle)}</p>
        <p>${esc(bumpText(s))} ${esc(r.bumpGo)}</p>`;
    } else if (s.status === "ready") {
      html = `
        <p class="ss-overlay-title">${esc(this.runTitle())}</p>
        <p>${esc(level.challenge)}</p>
        <p class="ss-overlay-hint">${esc(r.start[this.input])}</p>`;
    } else if (s.status === "paused") {
      html = `
        <p class="ss-overlay-title">${esc(r.paused)}</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-resume>${esc(b.resume)}</button>
          ${back}
        </div>`;
    } else if (s.status === "over") {
      const best = mode === "free" ? this.progress.free?.[this.freeKey(LEVELS[this.levelIndex])] ?? 0 : 0;
      const tally = mode === "free" ? r.freeTally(s.eaten, best) : r.tally(s.eaten, level.goal, s.score);
      html = `
        <p class="ss-overlay-title">${esc(r.over)}</p>
        <p>${esc(crashText(s))}</p>
        <p>${esc(tally)}</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-again>${esc(b.playAgain)}</button>
          ${back}
        </div>`;
    } else if (s.status === "cleared" && mode === "practice") {
      html = `
        <p class="ss-overlay-title">${esc(r.practiceDone)}</p>
        <p>${esc(r.practiceTally(level.goal, s.score))}</p>
        <div class="ss-actions">
          <button class="ss-btn ss-primary" data-again>${esc(b.practiceAgain)}</button>
          ${back}
        </div>`;
    } else if (s.status === "cleared" && this.lastClear) {
      const { stars, timeBonus } = this.lastClear;
      let note = "";
      if (mode === "daily") {
        note = `<p>${esc(r.dailyStreak(currentStreak(this.progress, this.dailyDate)))}</p>`;
      } else {
        const best = this.progress.levels[level.id]?.stars ?? stars;
        if (best > stars) note = `<p>${esc(r.bestStars(best))}</p>`;
        if (!hasNext) note += `<p>${esc(r.allCleared)}</p>`;
      }
      html = `
        <p class="ss-overlay-title">${esc(mode === "daily" ? r.dailyCleared : r.cleared)}</p>
        <p class="ss-stars ss-big" aria-label="${esc(r.stars(stars))}">${starText(stars)}</p>
        <p>${esc(r.bonus(s.score, timeBonus))}</p>
        ${note}
        <div class="ss-actions">
          ${hasNext ? `<button class="ss-btn ss-primary" data-next>${esc(b.nextLevel)}</button>` : ""}
          <button class="ss-btn${hasNext ? "" : " ss-primary"}" data-again>${esc(b.playAgain)}</button>
          ${back}
        </div>`;
    }
    overlay.innerHTML = html ? `<div class="ss-panel">${html}</div>` : "";
    overlay.hidden = s.status === "running";
    overlay.classList.toggle("ss-overlay-passive", s.status === "ready");
    overlay.querySelector("[data-resume]")?.addEventListener("click", () => this.command({ type: "pause" }));
    overlay.querySelector("[data-again]")?.addEventListener("click", () => this.startRun(mode, this.levelIndex));
    overlay.querySelector("[data-next]")?.addEventListener("click", () => this.startRun("levels", this.levelIndex + 1));
    overlay.querySelector("[data-back]")?.addEventListener("click", () => this.leaveRun());
    this.wireNav(overlay);
    overlay.querySelector<HTMLElement>(".ss-primary")?.focus();
  }

  private resize() {
    if (!this.state || !this.canvas || this.screen !== "game") return;
    const game = this.part("game");
    const stage = game.querySelector<HTMLElement>("[data-stage]")!;
    const width = Math.min(stage.clientWidth || this.root.clientWidth, 560);
    // Leave room for the score line, the buttons and the hint, so the whole game fits on the screen.
    // On a phone turned sideways they sit beside the board, so the board can use nearly the full height.
    let chrome = 48;
    if (!window.matchMedia?.(SIDEWAYS).matches) {
      for (const sel of [".ss-hud", ".ss-controls", ".ss-hint"]) chrome += game.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0;
      chrome += 40;
    }
    const height = Math.max(200, window.innerHeight - chrome);
    const size = Math.floor(Math.min(width, height));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = layoutFor(size, this.state.level);
    this.drawBoard();
  }

  private say(text: string) {
    const live = this.root.querySelector<HTMLElement>("[data-live]");
    if (live) live.textContent = text;
  }
}

const ARROW: Record<Direction, string> = {
  up: "M12 5 L20 17 H4 Z",
  down: "M12 19 L4 7 H20 Z",
  left: "M5 12 L17 4 V20 Z",
  right: "M19 12 L7 20 V4 Z",
};

/** The arrow buttons for phones and tablets, laid out as a cross. */
function padHtml(): string {
  const p = TEXT.pad;
  const button = (dir: Direction) => `
    <button class="ss-pad-btn ss-pad-${dir}" type="button" data-dir="${dir}" aria-label="${esc(p[dir])}">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ARROW[dir]}"/></svg>
    </button>`;
  return `<div class="ss-pad" role="group" aria-label="${esc(p.label)}">${(["up", "left", "right", "down"] as Direction[]).map(button).join("")}</div>`;
}
