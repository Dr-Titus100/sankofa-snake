// The browser side of the Shiny app. R runs the game and sends what to draw. This file draws the
// board with the web game's own drawing code (SankofaBoard, from sankofa-board.js), plays its
// sounds, keeps progress in this browser, and sends key presses, taps and swipes back to R.
(function () {
  "use strict";
  const B = window.SankofaBoard;
  const KEY = "sankofa-snake/v1";
  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
  const SIDEWAYS = "(orientation: landscape) and (max-height: 500px), (orientation: landscape) and (pointer: coarse)";
  const touch = B.inputKind() === "touch";
  const reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  const sound = new B.Sound(true, true);
  const scenery = {};
  let root, game, canvas, ctx, layout;
  let level = null;
  let state = null;
  let screen = "title";
  let frameId = 0;
  let count = 0;

  const send = (name, value) => {
    if (window.Shiny && Shiny.setInputValue) Shiny.setInputValue(name, { ...value, n: ++count }, { priority: "event" });
  };
  const pad = (n) => String(n).padStart(2, "0");
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const longDate = () => new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const command = (type, extra) => {
    sound.unlock();
    send("cmd", { type, ...extra });
  };

  function storage(action, value) {
    try {
      if (action === "get") return localStorage.getItem(KEY);
      if (action === "set") localStorage.setItem(KEY, value);
      if (action === "probe") {
        localStorage.setItem(`${KEY}/probe`, "1");
        localStorage.removeItem(`${KEY}/probe`);
      }
      return true;
    } catch {
      return action === "get" ? null : false;
    }
  }

  function showScreen(name) {
    screen = name;
    root.querySelector('[data-screen="menu"]').hidden = name === "game";
    game.hidden = name !== "game";
    if (name !== "game") stopLoop();
    if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: "start" });
    if (name === "game") requestAnimationFrame(resize);
  }

  function focusFirst() {
    const el = root.querySelector('[data-screen="menu"] [data-focus]');
    if (el) el.focus();
  }

  function syncSettings(settings) {
    root.querySelectorAll("[data-setting]").forEach((b) => b.setAttribute("aria-pressed", String(Boolean(settings[b.dataset.setting]))));
  }

  function toState(s) {
    return {
      level,
      obstacles: level.obstacleSet,
      currents: level.currentMap,
      snake: s.snake,
      dir: s.dir,
      food: s.food || null,
      powerUp: s.powerUp || null,
      vehicles: s.vehicles,
      moves: s.moves,
      slowUntil: s.slowUntil,
      passes: s.passes,
      status: s.status,
      crashAt: s.crashAt || null,
    };
  }

  function draw(time) {
    if (!layout || !state) return;
    B.draw(ctx, state, layout, time === undefined ? performance.now() : time, reduceMotion, scenery);
  }

  // Frames run only while the snake moves, so the cowrie pulses and the currents drift between moves.
  function loop(time) {
    frameId = 0;
    if (screen !== "game" || !state) return;
    draw(time);
    if (state.status === "running") frameId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (!frameId) frameId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function resize() {
    if (!level || screen !== "game") return;
    const stage = game.querySelector("[data-stage]");
    const width = Math.min(stage.clientWidth || root.clientWidth, 560);
    let chrome = 48;
    if (!(window.matchMedia && window.matchMedia(SIDEWAYS).matches)) {
      for (const sel of [".ss-hud", ".ss-controls", ".ss-hint"]) {
        const el = game.querySelector(sel);
        chrome += el && el.offsetParent ? el.offsetHeight : 0;
      }
      chrome += 40;
    }
    const size = Math.floor(Math.min(width, Math.max(200, window.innerHeight - chrome)));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout = B.layoutFor(size, level);
    draw();
  }

  function setHud(hud) {
    for (const name of ["level", "eaten", "score", "best", "power"]) {
      const el = game.querySelector(`[data-hud="${name}"]`);
      if (el.textContent !== hud[name]) el.textContent = hud[name];
    }
    game.querySelector("[data-hud-best]").hidden = Boolean(hud.hideBest);
    const pause = game.querySelector('.ss-bar [data-cmd="pause"]');
    pause.textContent = hud.pause;
    pause.disabled = Boolean(hud.pauseDisabled);
  }

  function handlers() {
    Shiny.addCustomMessageHandler("screen", (m) => showScreen(m.name));
    Shiny.addCustomMessageHandler("settings", (m) => {
      sound.soundOn = Boolean(m.sound);
      sound.vibrationOn = Boolean(m.vibration);
      syncSettings(m);
    });
    Shiny.addCustomMessageHandler("save", (text) => {
      storage("set", text);
    });
    Shiny.addCustomMessageHandler("say", (text) => {
      root.querySelector("[data-live]").textContent = text;
    });
    Shiny.addCustomMessageHandler("run", (m) => {
      level = m.level;
      level.obstacleSet = new Set(Array.isArray(m.obstacles) ? m.obstacles : []);
      level.currentMap = new Map(Array.isArray(m.currents) ? [] : Object.entries(m.currents || {}));
      if (!Array.isArray(level.vehicles)) level.vehicles = level.vehicles ? [level.vehicles] : [];
      if (!Array.isArray(level.map)) level.map = level.map ? [level.map] : undefined;
      sound.world = level.world;
      game.className = `ss-screen ss-game ss-world-${level.world}`;
      game.querySelector('[data-hud="power"]').hidden = !m.powerUps;
      game.querySelector("[data-hint]").textContent = m.hint;
      stopLoop();
      requestAnimationFrame(resize);
    });
    Shiny.addCustomMessageHandler("frame", (m) => {
      if (!level) return;
      state = toState(m.state);
      for (const e of m.state.events || []) sound.play(e, m.state.eaten);
      setHud(m.hud);
      draw();
      if (state.status === "running") startLoop();
    });
    Shiny.addCustomMessageHandler("overlay", (m) => {
      const overlay = game.querySelector("[data-overlay]");
      overlay.innerHTML = m.html || "";
      overlay.hidden = Boolean(m.running);
      overlay.classList.toggle("ss-overlay-passive", Boolean(m.passive));
      const primary = overlay.querySelector(".ss-primary");
      if (primary) primary.focus();
    });
  }

  function listen() {
    // Every button: a menu action, a setting or the pause button.
    root.addEventListener("click", (e) => {
      const el = e.target.closest("button");
      if (!el || el.disabled) return;
      sound.unlock();
      if (el.dataset.act) send("act", { act: el.dataset.act, arg: el.dataset.arg || null, today: today(), longDate: longDate() });
      else if (el.dataset.setting) command(el.dataset.setting);
      else if (el.dataset.cmd) command(el.dataset.cmd);
      // A keyboard or a switch presses an arrow button with a click that has no pointer before it.
      else if (el.dataset.dir && e.detail === 0) command("turn", { dir: el.dataset.dir });
    });
    // The snake turns as soon as a finger touches an arrow, without waiting for it to lift.
    game.querySelectorAll("[data-dir]").forEach((button) => {
      button.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        command("turn", { dir: button.dataset.dir });
      });
      button.addEventListener("pointerup", () => sound.unlock());
    });
    const stage = game.querySelector("[data-stage]");
    B.listenForSwipes(stage, (c) => (c.type === "turn" ? command("turn", { dir: c.dir }) : command("pause")));
    stage.addEventListener("pointerup", () => sound.unlock());

    window.addEventListener("keydown", (e) => {
      if (screen !== "game") return;
      const target = e.target;
      if (target && target.closest && target.closest("button") && (e.key === " " || e.key === "Enter")) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "m" || e.key === "M") return command("sound");
      if (KEYS[e.key]) {
        e.preventDefault();
        return command("turn", { dir: KEYS[e.key] });
      }
      if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        command("pause");
      }
    });
    // Pause when the player switches tabs or apps, so the snake never crashes unseen.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && screen === "game") send("cmd", { type: "hide" });
    });
    window.addEventListener("blur", () => {
      if (screen === "game") send("cmd", { type: "hide" });
    });
    window.addEventListener("storage", (e) => {
      if (e.key === null || e.key === KEY) send("saved", { text: storage("get") });
    });
    new ResizeObserver(() => resize()).observe(root);
    // A new menu screen takes the focus on its first button, as in the web game.
    $(document).on("shiny:value", (e) => {
      if (e.name === "screen") setTimeout(focusFirst, 0);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    root = document.querySelector("[data-sankofa-root]");
    game = root.querySelector('[data-screen="game"]');
    canvas = game.querySelector("canvas");
    ctx = canvas.getContext("2d");
    root.classList.toggle("ss-touch", touch);
    // Phones and tablets get the arrow pad. Computers steer with the keys.
    const controls = game.querySelector("[data-controls]");
    controls.classList.toggle("ss-with-pad", touch);
    if (!touch) controls.querySelector("[data-pad]").remove();
    handlers();
    listen();
  });

  $(document).on("shiny:connected", () => {
    send("client", {
      touch,
      canVibrate: B.Sound.canVibrate,
      canSave: storage("probe"),
      saved: storage("get"),
      today: today(),
      longDate: longDate(),
    });
  });
})();
