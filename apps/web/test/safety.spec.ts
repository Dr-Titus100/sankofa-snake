// Saved progress, the reset button, errors, the back action, removing the game, and network use.
import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "sankofa-snake/v1";

const seed = (page: Page, value: unknown) =>
  page.addInitScript(
    ([key, v]) => localStorage.setItem(key as string, typeof v === "string" ? v : JSON.stringify(v)),
    [SAVE_KEY, value],
  );

const readSave = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), SAVE_KEY);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

/**
 * A page with the game and no Content Security Policy, like a page on a site that has a weaker
 * one. The game's own page blocks inline scripts, so it can't show whether the game escapes text.
 */
async function plainPage(page: Page, script = "") {
  await page.route(/\/plain\.html/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><link rel="stylesheet" href="/sankofa-snake.css"><div id="game" data-sankofa-snake></div>
        <script type="module" src="/sankofa-snake.js"></script>${script}`,
    }),
  );
  await page.goto("/plain.html?seed=1&layout=fixed");
}

const HTML = `<img src=x onerror="window.pwned=(window.pwned||0)+1">`;

test.describe("a damaged or tampered save", () => {
  test("can't run script, and bad values are dropped", async ({ page }) => {
    const errors = watchErrors(page);
    await seed(page, {
      levels: {
        farm: { best: HTML, stars: 9, cleared: true },
        park: { best: 250.5, stars: -1, cleared: "yes" },
        [HTML]: { best: 1, stars: 1, cleared: true },
      },
      daily: { date: HTML, best: 1, cleared: true, streak: 2, bestStreak: 2 },
      free: { "farm-wrap": HTML, "park-walls": 12, [HTML]: 3 },
      settings: { sound: HTML, vibration: false },
    });
    await plainPage(page);
    await page.getByRole("button", { name: "Choose a level" }).click();
    // Farm keeps its clear, so the Park is open. The score and the impossible 9 stars are dropped.
    await expect(page.locator("[data-level='0']")).toContainText("Best 0");
    await expect(page.locator("[data-level='0'] .ss-stars")).toHaveAttribute("aria-label", "0 of 3 stars");
    await expect(page.locator("[data-level='1']")).toBeEnabled();
    await expect(page.locator("[data-level='2']")).toBeDisabled();
    await page.getByRole("button", { name: "Free play", exact: true }).click();
    await expect(page.locator("[data-level='0']")).toContainText("Best 0 cowries");
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Daily challenge" }).click();
    await expect(page.locator(".ss-streak")).toHaveText("Streak: 0 days. Longest: 0 days.");
    expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
    await expect(page.locator(".ss-root img")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a save that isn't JSON starts the game fresh", async ({ page }) => {
    const errors = watchErrors(page);
    await seed(page, "{not json");
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await expect(page.locator("[data-level='0']")).toContainText("Not played yet");
    expect(errors).toEqual([]);
  });

  test("a save from 0.6, with no version number, keeps all its progress", async ({ page }) => {
    await seed(page, { levels: { farm: { best: 300, stars: 2, cleared: true } }, settings: { sound: false, vibration: true } });
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await expect(page.locator("[data-level='0']")).toContainText("Best 300");
    await expect(page.locator("[data-level='1']")).toBeEnabled();
  });
});

test("every saved field survives a save and a reload", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 19, 9, 0) });
  const full = {
    levels: {
      farm: { best: 900, stars: 3, cleared: true },
      park: { best: 450, stars: 1, cleared: true },
      market: { best: 120, stars: 0, cleared: false },
    },
    daily: { date: "2026-11-19", best: 640, cleared: true, streak: 4, lastCleared: "2026-11-19", bestStreak: 6 },
    free: { "farm-wrap": 31, "park-walls": 12 },
    settings: { sound: true, vibration: false },
  };
  await seed(page, full);
  await page.goto("/?seed=1&layout=fixed");
  // Turning sound off and on again saves the whole progress twice.
  await page.getByRole("button", { name: "How to play" }).click();
  await page.getByRole("button", { name: "Sound", exact: true }).click();
  await page.getByRole("button", { name: "Sound", exact: true }).click();
  expect(await readSave(page)).toEqual({ version: 2, ...full });
  await page.reload();
  await page.getByRole("button", { name: "Daily challenge" }).click();
  await expect(page.locator(".ss-streak")).toHaveText("Streak: 4 days. Longest: 6 days.");
  await expect(page.getByText("Today's best 640")).toBeVisible();
});

test("Reset progress asks first, then deletes progress and keeps the switches", async ({ page }) => {
  await seed(page, {
    levels: { farm: { best: 300, stars: 2, cleared: true } },
    free: { "farm-wrap": 9 },
    settings: { sound: false, vibration: true },
  });
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "How to play" }).click();
  await page.getByRole("button", { name: "Reset progress" }).click();
  await expect(page.getByText(/This deletes your scores, stars, cleared levels/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect((await readSave(page)).levels.farm.best).toBe(300);

  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Delete my progress" }).click();
  await expect(page.getByText("Progress deleted.")).toBeVisible();
  expect(await readSave(page)).toEqual({ version: 2, levels: {}, settings: { sound: false, vibration: true } });
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Choose a level" }).click();
  await expect(page.locator("[data-level='1']")).toBeDisabled();
});

test("the game says so when the browser won't save progress", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const errors = watchErrors(page);
  await page.goto("/?seed=1&layout=fixed");
  await expect(page.locator('[data-screen="title"]').getByText(/This browser isn't letting the game save/)).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator('[data-hud="level"]')).toHaveText("Level 1: Farm");
  expect(errors).toEqual([]);
});

test("the board isn't redrawn while nothing moves", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { frames: number };
    w.frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      w.frames++;
      return raf(cb);
    };
  });
  const frames = () => page.evaluate(() => (window as unknown as { frames: number }).frames);
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(300);
  const waiting = await frames();
  await page.waitForTimeout(1500);
  expect(await frames()).toBe(waiting);

  // While the snake moves, frames run. Once paused, they stop again. A busy test machine can draw
  // slowly, so this waits for the frames to arrive instead of counting them after a fixed time.
  await page.keyboard.press("ArrowUp");
  await expect.poll(frames, { timeout: 3000 }).toBeGreaterThan(waiting + 5);
  await page.keyboard.press("p");
  await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
  await page.waitForTimeout(200);
  const paused = await frames();
  await page.waitForTimeout(1500);
  expect(await frames()).toBe(paused);
});

test("an error on the board shows a message with a way back to the title", async ({ page }) => {
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => {
    CanvasRenderingContext2D.prototype.drawImage = () => {
      throw new Error("broken drawing");
    };
  });
  await page.keyboard.press("ArrowUp");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Something went wrong");
  await alert.getByRole("button", { name: "Back to the title" }).click();
  await expect(page.getByRole("heading", { name: "Sankofa Snake", level: 2 })).toBeVisible();
});

type GameWindow = Window & { game: { back(): boolean; destroy(): void }; makeGame(): void };

test("back() pauses a run, then goes back one screen at a time, and says no on the title", async ({ page }) => {
  await plainPage(page);
  const back = () => page.evaluate(() => (document.getElementById("game") as unknown as { sankofaSnake: GameWindow["game"] }).sankofaSnake.back());
  expect(await back()).toBe(false);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("[data-overlay]")).toBeHidden();
  expect(await back()).toBe(true);
  await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
  expect(await back()).toBe(true);
  await expect(page.getByRole("heading", { name: "Levels" })).toBeVisible();
  expect(await back()).toBe(true);
  await expect(page.getByRole("heading", { name: "Sankofa Snake", level: 2 })).toBeVisible();
  expect(await back()).toBe(false);
});

test("leaving How to play with the reset question open cancels it, so back() still pauses a run", async ({ page }) => {
  await plainPage(page);
  const back = () => page.evaluate(() => (document.getElementById("game") as unknown as { sankofaSnake: GameWindow["game"] }).sankofaSnake.back());
  await page.getByRole("button", { name: "How to play" }).click();
  await page.getByRole("button", { name: "Reset progress" }).click();
  // back() answers the open question first.
  expect(await back()).toBe(true);
  await expect(page.getByRole("button", { name: "Delete my progress" })).toBeHidden();
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  expect(await back()).toBe(false);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.keyboard.press("ArrowUp");
  expect(await back()).toBe(true);
  await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).first().click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("button", { name: "Reset progress" })).toBeVisible();
});

test("destroy() removes the game cleanly, and a new one can start in its place", async ({ page }) => {
  const errors = watchErrors(page);
  await page.route(/\/module\.html/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><link rel="stylesheet" href="/sankofa-snake.css"><div id="game"></div>
        <script type="module">
          import { SankofaSnake } from "/sankofa-snake.js";
          window.makeGame = () => { window.game = new SankofaSnake(document.getElementById("game"), { seed: 1 }); };
          window.makeGame();
        </script>`,
    }),
  );
  await page.goto("/module.html");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.keyboard.press("ArrowUp");
  await page.evaluate(() => (window as unknown as GameWindow).game.destroy());
  await expect(page.locator("#game")).toBeEmpty();
  await expect(page.locator("#game")).not.toHaveClass(/ss-root/);
  // Keys and saves from elsewhere reach nothing now.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("m");
  await page.evaluate(() => window.dispatchEvent(new Event("sankofa-snake:saved")));
  await page.evaluate(() => (window as unknown as GameWindow).makeGame());
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.locator(".ss-root")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the game makes no network requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.resourceType()} ${new URL(r.url()).pathname}`));
  page.on("websocket", (ws) => requests.push(`websocket ${ws.url()}`));
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Back" }).first().click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Daily challenge" }).click();
  await page.getByRole("button", { name: "Play today's challenge" }).click();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(500);
  const allowed = ["document /", "script /sankofa-snake.js", "stylesheet /sankofa-snake.css", "image /sankofa-logo.svg", "other /sankofa-logo.svg"];
  expect(requests.filter((r) => !allowed.includes(r))).toEqual([]);
  // The page's Content Security Policy blocks a request even if some code tries one.
  const result = await page.evaluate(() => fetch("https://example.com/").then(() => "sent", () => "blocked"));
  expect(result).toBe("blocked");
});

test.describe("on a computer", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard play");

  test("the rules talk about keys, not swipes", async ({ page }) => {
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "How to play" }).click();
    const rules = page.locator(".ss-list");
    await expect(rules).toContainText("Steer with the arrow keys or W, A, S and D.");
    await expect(rules).toContainText("Press M to turn the sound off or on.");
    await expect(rules).not.toContainText("Swipe");
  });

  test("the How to play heading shows a focus ring only after keyboard use", async ({ page }) => {
    const ringed = () => page.evaluate(() => document.activeElement?.matches(".ss-heading:focus-visible") ?? false);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(page.getByRole("heading", { name: "How to play" })).toBeFocused();
    expect(await ringed()).toBe(false);
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "How to play" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "How to play" })).toBeFocused();
    expect(await ringed()).toBe(true);
  });
});

test.describe("in a British browser", () => {
  test.use({ locale: "en-GB" });

  test("the daily challenge writes the date the British way", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 10, 19, 9, 0) });
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Daily challenge" }).click();
    await expect(page.getByText(/^Thursday 19 November\./)).toBeVisible();
  });
});
