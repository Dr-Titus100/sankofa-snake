import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "sankofa-snake/v1";

async function unlockAll(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ levels: { farm: { best: 300, stars: 2, cleared: true }, park: { best: 500, stars: 1, cleared: true } } }),
    );
  }, SAVE_KEY);
}

/** Marks every level before the given one as cleared, so the given level is open. */
async function openUpTo(page: Page, ids: string[]) {
  await page.addInitScript(
    ([key, list]) => {
      const levels = Object.fromEntries((list as string[]).map((id) => [id, { best: 300, stars: 1, cleared: true }]));
      localStorage.setItem(key as string, JSON.stringify({ levels }));
    },
    [SAVE_KEY, ids],
  );
}

/** Counts the notes the game plays and records each vibration, so a test can check them. */
async function listenForSound(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { notes: number; buzz: unknown[] };
    w.notes = 0;
    w.buzz = [];
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.notes++;
      return create.call(this);
    };
    Object.defineProperty(Navigator.prototype, "vibrate", {
      configurable: true,
      value: (pattern: unknown) => {
        w.buzz.push(pattern);
        return true;
      },
    });
  });
}

const soundLog = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { notes: number; buzz: unknown[] };
    return { notes: w.notes, buzz: w.buzz };
  });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("the title screen shows the logo and the four buttons", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/?seed=1&layout=fixed");
  await expect(page.getByRole("heading", { name: "Sankofa Snake", level: 2 })).toBeVisible();
  await expect(page.getByRole("img", { name: /Sankofa bird/ })).toBeVisible();
  for (const name of ["Play", "Daily challenge", "Choose a level", "How to play"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("the daily challenge is the same for everyone on a date and shows the streak", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 19, 9, 0) });
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ levels: {}, daily: { date: "2026-11-18", best: 400, cleared: true, streak: 3, lastCleared: "2026-11-18", bestStreak: 5 } }),
    );
  }, SAVE_KEY);
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Daily challenge" }).click();
  await expect(page.getByText(/Thursday, November 19\. Everyone gets the same challenge on the same date\./)).toBeVisible();
  // Yesterday's clear keeps the streak going until today's challenge is played.
  await expect(page.locator(".ss-streak")).toHaveText("Streak: 3 days. Longest: 5 days.");
  await expect(page.getByText("Today's best 0")).toBeVisible();
  const world = await page.locator(".ss-daily-card .ss-card-name").textContent();
  await page.getByRole("button", { name: "Play today's challenge" }).click();
  await expect(page.locator('[data-hud="level"]')).toHaveText(`Daily challenge: ${world}`);
  await page.locator(".ss-bar").getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Daily challenge" })).toBeVisible();
});

test("free play lists only the worlds already opened", async ({ page }) => {
  await unlockAll(page);
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Choose a level" }).click();
  await page.getByRole("button", { name: "Free play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Free play", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-level='2']")).toBeEnabled();
  await expect(page.locator("[data-level='3']")).toBeDisabled();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator("[data-level='8']")).toBeEnabled();
});

test("Choose a level and How to play turn gold under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "Phones have no hover.");
  await page.goto("/?seed=1&layout=fixed");
  for (const name of ["Choose a level", "How to play"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await button.hover();
    await expect(button).toHaveCSS("background-color", "rgb(242, 183, 5)");
    await expect(button).toHaveCSS("color", "rgb(20, 16, 16)");
  }
});

test("the tabs have solid edges like the other buttons and turn gold under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "Phones have no hover.");
  await page.goto("/?seed=1&layout=fixed");
  const plain = page.getByRole("button", { name: "Choose a level" });
  const edge = await plain.evaluate((el) => getComputedStyle(el).borderTopColor);
  await plain.click();
  for (const name of ["Free play", "Practice"]) {
    const tab = page.getByRole("button", { name, exact: true });
    await expect(tab).toHaveCSS("border-top-color", edge);
    await expect(tab).toHaveCSS("border-top-style", "solid");
    await tab.hover();
    await expect(tab).toHaveCSS("background-color", "rgb(242, 183, 5)");
    await expect(tab).toHaveCSS("color", "rgb(20, 16, 16)");
  }
  // The Sound switch has the same edge when it's off.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "How to play" }).click();
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect(sound).toHaveCSS("border-top-color", edge);
  await expect(page.getByRole("button", { name: "Reset progress" })).toHaveCSS("border-top-color", edge);
});

test("the sound and vibration switches start on and are remembered", async ({ page }) => {
  await listenForSound(page);
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "How to play" }).click();
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  const vibration = page.getByRole("button", { name: "Vibration", exact: true });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect(vibration).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await vibration.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("button", { name: "Sound", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Vibration", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".ss-bar").getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "false");
});

test("the Sound pill in the game bar starts on in gold and the player can switch it off", async ({ page }) => {
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const sound = page.locator(".ss-bar").getByRole("button", { name: "Sound" });
  const gold = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.color = getComputedStyle(document.querySelector(".ss-root")!).getPropertyValue("--ss-gold");
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await expect(sound).toHaveCSS("background-color", gold);
  await sound.click();
  await page.mouse.move(0, 0);
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect(sound).not.toHaveCSS("background-color", gold);
  await sound.click();
  await page.mouse.move(0, 0);
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect(sound).toHaveCSS("background-color", gold);
});

test("How to play opens with its heading in focus and a plain Back button", async ({ page }) => {
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("heading", { name: "How to play" })).toBeFocused();
  const back = page.getByRole("button", { name: "Back" });
  await expect(back).not.toHaveClass(/ss-primary/);
  await expect(back).not.toBeFocused();
});

/** A page with the game in one of its views, the way the website puts it on separate tabs. */
async function viewPage(page: Page, view: string) {
  await page.route(/\/view-test\.html/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><link rel="stylesheet" href="/sankofa-snake.css"><div data-sankofa-snake="${view}"></div><script type="module" src="/sankofa-snake.js"></script>`,
    }),
  );
  await page.goto("/view-test.html?seed=1&layout=fixed");
}

test("the play view leaves out How to play, and the help view shows only the rules and switches", async ({ page }) => {
  await viewPage(page, "play");
  for (const name of ["Play", "Daily challenge", "Choose a level"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "How to play" })).toHaveCount(0);
  await viewPage(page, "help");
  await expect(page.getByText("Eat 20 cowrie shells to clear a level")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sound", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
});

test("a play view and a help view on one page, or in two tabs, share switches and progress", async ({ page, context }) => {
  await page.route(/\/both-views\.html/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><link rel="stylesheet" href="/sankofa-snake.css"><div id="play" data-sankofa-snake="play"></div><div id="help" data-sankofa-snake="help"></div><script type="module" src="/sankofa-snake.js"></script>`,
    }),
  );
  await page.goto("/both-views.html?seed=1&layout=fixed");
  const help = page.locator("#help");
  const play = page.locator("#play");
  await help.getByRole("button", { name: "Sound", exact: true }).click();
  await expect(help.getByRole("button", { name: "Sound", exact: true })).toHaveAttribute("aria-pressed", "false");
  // The play view on the same page picks up the switch.
  await play.getByRole("button", { name: "Play", exact: true }).click();
  await expect(play.locator(".ss-bar").getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "false");

  // Another tab clears a level. Turning a switch here afterward keeps that progress.
  const other = await context.newPage();
  await other.goto("/?seed=1&layout=fixed");
  await other.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...saved, levels: { farm: { best: 300, stars: 2, cleared: true } } }));
  }, SAVE_KEY);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).levels.farm?.cleared, SAVE_KEY)).toBe(true);
  // Sound, since iPhones have no Vibration switch.
  await help.getByRole("button", { name: "Sound", exact: true }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(saved.levels.farm).toEqual({ best: 300, stars: 2, cleared: true });
  expect(saved.settings).toEqual({ sound: true, vibration: true });
});

test("only the first level is open on a first visit", async ({ page }) => {
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Choose a level" }).click();
  await expect(page.locator("[data-level='0']")).toBeEnabled();
  await expect(page.locator("[data-level='1']")).toBeDisabled();
  await expect(page.locator("[data-level='2']")).toContainText("Clear the Park to open this level");
});

test("a cleared level unlocks the next one", async ({ page }) => {
  await unlockAll(page);
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Choose a level" }).click();
  await expect(page.locator("[data-level='2']")).toBeEnabled();
  await expect(page.locator("[data-level='0']")).toContainText("Best 300");
});

test.describe("on a computer", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard play");

  test("the snake starts on an arrow key and pauses on Space", async ({ page }) => {
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator("[data-overlay]").getByText("Press an arrow key to start.")).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("[data-overlay]")).toBeHidden();
    await page.keyboard.press("p");
    await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).first().click();
    await expect(page.locator("[data-overlay]")).toBeHidden();
  });

  test("the game pauses when the tab is hidden", async ({ page }) => {
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.keyboard.press("ArrowUp");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
  });

  test("running into a market stall ends the run", async ({ page }) => {
    await page.clock.install();
    await unlockAll(page);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='2']").click();
    // The Market starts at 7 moves a second, about 143 ms a move. The head starts at column 5, row 10.
    // Two moves right reach column 7, and a stall stands two cells above that, in rows 7 and 8.
    await page.keyboard.press("ArrowRight");
    await page.clock.runFor(310);
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(600);
    await expect(page.locator("[data-overlay]").getByText("Game over")).toBeVisible();
    await expect(page.locator("[data-overlay]").getByText("The snake ran into a market stall.")).toBeVisible();
    await page.getByRole("button", { name: "Play again" }).click();
    await expect(page.locator("[data-overlay]").getByText("Press an arrow key to start.")).toBeVisible();
  });

  test("a crash plays a sound and buzzes, and M turns the sound off", async ({ page }) => {
    await listenForSound(page);
    await page.clock.install();
    await unlockAll(page);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='2']").click();
    // The same path as the market stall test above.
    await page.keyboard.press("ArrowRight");
    await page.clock.runFor(310);
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(600);
    await expect(page.locator("[data-overlay]").getByText("Game over")).toBeVisible();
    const first = await soundLog(page);
    expect(first.notes).toBeGreaterThan(0);
    expect(first.buzz).toContainEqual([90, 50, 160]);
    await page.keyboard.press("m");
    await expect(page.locator(".ss-bar").getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Play again" }).click();
    await page.keyboard.press("ArrowRight");
    await page.clock.runFor(310);
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(600);
    await expect(page.locator("[data-overlay]").getByText("Game over")).toBeVisible();
    expect((await soundLog(page)).notes).toBe(first.notes);
  });

  test("in the City, the edge of the board is a wall", async ({ page }) => {
    await page.clock.install();
    await openUpTo(page, ["farm", "park", "market"]);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='3']").click();
    // The City runs at 7 moves a second. The head starts at row 10 in an open column, so 11 moves up hit the top wall.
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(1900);
    await expect(page.locator("[data-overlay]").getByText("The snake hit the wall.")).toBeVisible();
  });

  test("on the Road, running into a taxi ends the run", async ({ page }) => {
    await page.clock.install();
    await openUpTo(page, ["farm", "park", "market", "city"]);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='4']").click();
    // The Road runs at 6 moves a second, about 167 ms a move. Six moves right and then three up
    // put the head on row 7 just as the taxi on that row reaches it.
    await page.keyboard.press("ArrowRight");
    await page.clock.runFor(1080);
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(700);
    await expect(page.locator("[data-overlay]").getByText("The snake ran into a taxi.")).toBeVisible();
  });

  test("the Lab explains its power-ups before the run starts", async ({ page }) => {
    await openUpTo(page, ["farm", "park", "market", "city", "road"]);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='5']").click();
    await expect(page.locator("[data-overlay]").getByText(/Power-ups appear on the board/)).toBeVisible();
    await expect(page.locator('[data-hud="power"]')).toBeAttached();
    await expect(page.locator('[data-hud="power"]')).not.toHaveAttribute("hidden");
  });

  test("in the Maze, running into a wall ends the run", async ({ page }) => {
    await page.clock.install();
    await openUpTo(page, ["farm", "park", "market", "city", "road", "lab"]);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='6']").click();
    // The Maze runs at 6 moves a second. The head starts at column 6, row 9, and a wall stands at column 10.
    await page.keyboard.press("ArrowRight");
    await page.clock.runFor(800);
    await expect(page.locator("[data-overlay]").getByText("The snake ran into a wall of the maze.")).toBeVisible();
  });

  test("in the Ocean, a current carries the snake past a canoe", async ({ page }) => {
    await page.clock.install();
    await openUpTo(page, ["farm", "park", "market", "city", "road", "lab", "maze"]);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='7']").click();
    // The head starts at column 5, row 10, heading up a column with a canoe in row 3. The current
    // on row 5 pushes it one column right, so it misses the canoe and reaches the top wall instead.
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(1800);
    await expect(page.locator("[data-overlay]").getByText("The snake hit the wall.")).toBeVisible();
  });

  test("in free play with walls, the run ends at the edge and counts the cowries", async ({ page }) => {
    await page.clock.install();
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.getByRole("button", { name: "Free play", exact: true }).click();
    await page.getByRole("button", { name: "Walls", exact: true }).click();
    await page.locator("[data-level='0']").click();
    await expect(page.locator('[data-hud="level"]')).toHaveText("Free play: Farm");
    // The Farm runs at 6 moves a second from column 5, row 10, so 11 moves up reach the top wall.
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(2300);
    await expect(page.locator("[data-overlay]").getByText("The snake hit the wall.")).toBeVisible();
    await expect(page.locator("[data-overlay]").getByText(/You collected \d+ cowries?\. Your best here is \d+\./)).toBeVisible();
    await page.locator("[data-overlay]").getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Free play" })).toBeVisible();
  });

  test("in practice, hitting the wall only stops the snake", async ({ page }) => {
    await page.clock.install();
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.getByRole("button", { name: "Practice", exact: true }).click();
    await page.locator("[data-level='3']").click();
    await expect(page.locator('[data-hud="level"]')).toHaveText("Practice: City");
    await expect(page.locator('[data-hud="best"]')).toBeHidden();
    // Practice runs the City at 4 moves a second, so 11 moves up from row 10 take under 3 seconds.
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(3200);
    await expect(page.locator("[data-overlay]").getByText("The snake bumped into the wall.", { exact: false })).toBeVisible();
    await expect(page.locator("[data-overlay]").getByText("Game over")).toHaveCount(0);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("[data-overlay]")).toBeHidden();
  });

  test("the Weaving village says it has every challenge at once", async ({ page }) => {
    await openUpTo(page, ["farm", "park", "market", "city", "road", "lab", "maze", "ocean"]);
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await expect(page.locator("[data-level='8']")).toBeEnabled();
    await page.locator("[data-level='8']").click();
    await expect(page.locator("[data-overlay]").getByText(/Every challenge at once/)).toBeVisible();
  });
});

/** The map of the run being played, read from the game the page keeps on its element. */
const runMap = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector("[data-sankofa-snake]") as HTMLElement & { sankofaSnake: { state: { level: { map?: string[] } } } };
    return el.sankofaSnake.state.level.map;
  });

test.describe("new layouts", () => {
  test("each run places the market stalls somewhere new, and ?layout=fixed keeps the map", async ({ page }) => {
    await unlockAll(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='2']").click();
    const first = await runMap(page);
    await page.getByRole("button", { name: "Back" }).click();
    await page.locator("[data-level='2']").click();
    const second = await runMap(page);
    expect(first).toHaveLength(20);
    expect(second).not.toEqual(first);
    // The same number of stall cells each time.
    const cells = (map?: string[]) => (map ?? []).join("").split("#").length - 1;
    expect(cells(second)).toBe(cells(first));

    await page.goto("/?layout=fixed");
    await page.getByRole("button", { name: "Choose a level" }).click();
    await page.locator("[data-level='2']").click();
    const fixed = await runMap(page);
    expect(fixed![2]).toBe("..###....##....####.");
  });

  test("a set seed gives the same layout every time", async ({ page }) => {
    await unlockAll(page);
    const maps = [];
    for (let i = 0; i < 2; i++) {
      await page.goto("/?seed=5");
      await page.getByRole("button", { name: "Choose a level" }).click();
      await page.locator("[data-level='2']").click();
      maps.push(await runMap(page));
    }
    expect(maps[1]).toEqual(maps[0]);
  });
});

test("choosing a level near the bottom of a long page keeps the game in view", async ({ page }) => {
  // The game sits in a page with a long section under it, the way it does on the website.
  await page.route(/\/long-page\.html/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><meta name="viewport" content="width=device-width">
        <link rel="stylesheet" href="/sankofa-snake.css">
        <h1 style="height:200px">Sankofa Snake</h1>
        <div data-sankofa-snake></div>
        <section style="height:3000px">Reviews</section>
        <script type="module" src="/sankofa-snake.js"></script>`,
    }),
  );
  await page.goto("/long-page.html?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Choose a level" }).click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  const last = page.locator("[data-level='8']");
  await last.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 400));
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(page.locator('[data-hud="level"]')).toHaveText("Practice: Weaving village");
  const top = await page.locator("[data-sankofa-snake]").evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(100);
});

test("there are no arrow buttons on a computer", async ({ page, isMobile }) => {
  test.skip(isMobile, "computers only");
  await page.goto("/?seed=1&layout=fixed");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("group", { name: "Steering" })).toHaveCount(0);
  await expect(page.locator(".ss-hint")).toBeVisible();
});

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "touch play");

  test("the page fits the screen without sideways scrolling", async ({ page }) => {
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  });

  test("pressing Play starts the sound, so swipes alone don't leave it silent", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { audioStarts: number };
      w.audioStarts = 0;
      const Base = window.AudioContext;
      window.AudioContext = class extends Base {
        constructor(options?: AudioContextOptions) {
          super(options);
          w.audioStarts++;
        }
      };
    });
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { audioStarts: number }).audioStarts)).toBe(1);
  });

  test("a swipe starts the snake and a tap pauses it", async ({ page }) => {
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator("[data-overlay]").getByText("Press an arrow or swipe to start.")).toBeVisible();
    const stage = page.locator("[data-stage]");
    const box = (await stage.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await swipe(page, cx, cy, cx, cy - 80);
    await expect(page.locator("[data-overlay]")).toBeHidden();
    await swipe(page, cx, cy, cx, cy);
    await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
  });

  test("the rules talk about the arrow buttons, swipes and taps, not keys", async ({ page }) => {
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "How to play" }).click();
    const rules = page.locator(".ss-list");
    await expect(rules).toContainText("Steer with the arrow buttons under the board, or swipe on the board");
    await expect(rules).toContainText("Tap the board to pause.");
    await expect(rules).not.toContainText("arrow keys");
    await expect(rules).not.toContainText("Space");
    await expect(rules).not.toContainText("Press M");
  });

  test("the arrow buttons steer the snake", async ({ page }) => {
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const pad = page.getByRole("group", { name: "Steering" });
    await expect(pad).toBeVisible();
    // The pad takes the place of the hint, so the board keeps its size.
    await expect(page.locator(".ss-hint")).toBeHidden();
    for (const name of ["Up", "Down", "Left", "Right"]) {
      const box = (await pad.getByRole("button", { name }).boundingBox())!;
      expect(box.width, name).toBeGreaterThanOrEqual(44);
      expect(box.height, name).toBeGreaterThanOrEqual(44);
    }
    // The snake starts heading right, so Up is a real turn.
    await pad.getByRole("button", { name: "Up" }).dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true, button: 0 });
    await expect(page.locator("[data-overlay]")).toBeHidden();
    // The whole game, pad included, fits on the screen.
    const height = page.viewportSize()!.height;
    const down = (await pad.getByRole("button", { name: "Down" }).boundingBox())!;
    expect(down.y + down.height).toBeLessThanOrEqual(height);
  });

  test("turned sideways, Pause, Sound, Back and the arrows stay on the screen", async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await page.goto("/?seed=1&layout=fixed");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    for (const name of ["Pause", "Sound", "Back"]) {
      const box = (await page.locator(".ss-bar").getByRole("button", { name }).boundingBox())!;
      expect(box.y + box.height, name).toBeLessThanOrEqual(360);
      expect(box.x + box.width, name).toBeLessThanOrEqual(740);
    }
    for (const name of ["Up", "Down", "Left", "Right"]) {
      const box = (await page.getByRole("group", { name: "Steering" }).getByRole("button", { name }).boundingBox())!;
      expect(box.y + box.height, name).toBeLessThanOrEqual(360);
      expect(box.x + box.width, name).toBeLessThanOrEqual(740);
    }
    const board = (await page.locator("canvas").boundingBox())!;
    expect(board.y + board.height).toBeLessThanOrEqual(360);
    expect(board.height).toBeGreaterThanOrEqual(200);
  });
});

/** A finger swipe on the page, sent as pointer events the way a touch screen sends them. */
async function swipe(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.locator("[data-stage]").evaluate(
    (el, [ax, ay, bx, by]) => {
      const send = (type: string, x: number, y: number) =>
        el.dispatchEvent(
          new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: y }),
        );
      send("pointerdown", ax, ay);
      send("pointermove", (ax + bx) / 2, (ay + by) / 2);
      send("pointerup", bx, by);
    },
    [x1, y1, x2, y2],
  );
}
