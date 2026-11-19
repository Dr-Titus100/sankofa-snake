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

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("the title screen shows the logo and the three buttons", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/?seed=1");
  await expect(page.getByRole("heading", { name: "Sankofa Snake", level: 2 })).toBeVisible();
  await expect(page.getByRole("img", { name: /Sankofa bird/ })).toBeVisible();
  for (const name of ["Play", "Choose a level", "How to play"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("only the first level is open on a first visit", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.getByRole("button", { name: "Choose a level" }).click();
  await expect(page.locator("[data-level='0']")).toBeEnabled();
  await expect(page.locator("[data-level='1']")).toBeDisabled();
  await expect(page.locator("[data-level='2']")).toContainText("Clear the Park to unlock");
});

test("a cleared level unlocks the next one", async ({ page }) => {
  await unlockAll(page);
  await page.goto("/?seed=1");
  await page.getByRole("button", { name: "Choose a level" }).click();
  await expect(page.locator("[data-level='2']")).toBeEnabled();
  await expect(page.locator("[data-level='0']")).toContainText("Best 300");
});

test.describe("on a computer", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard play");

  test("the snake starts on an arrow key and pauses on Space", async ({ page }) => {
    await page.goto("/?seed=1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator("[data-overlay]").getByText("Press an arrow key or swipe to start.")).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("[data-overlay]")).toBeHidden();
    await page.keyboard.press("p");
    await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).first().click();
    await expect(page.locator("[data-overlay]")).toBeHidden();
  });

  test("the game pauses when the tab is hidden", async ({ page }) => {
    await page.goto("/?seed=1");
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
    await page.goto("/?seed=1");
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
    await expect(page.locator("[data-overlay]").getByText("Press an arrow key or swipe to start.")).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "touch play");

  test("the page fits the screen without sideways scrolling", async ({ page }) => {
    await page.goto("/?seed=1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  });

  test("a swipe starts the snake and a tap pauses it", async ({ page }) => {
    await page.goto("/?seed=1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const stage = page.locator("[data-stage]");
    const box = (await stage.boundingBox())!;
    const touch = (type: string, x: number, y: number) =>
      stage.dispatchEvent(type, {
        touches: type === "touchend" ? [] : [{ identifier: 1, clientX: x, clientY: y }],
        changedTouches: [{ identifier: 1, clientX: x, clientY: y }],
      });
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await touch("touchstart", cx, cy);
    await touch("touchend", cx, cy - 80);
    await expect(page.locator("[data-overlay]")).toBeHidden();
    await touch("touchstart", cx, cy);
    await touch("touchend", cx, cy);
    await expect(page.locator("[data-overlay]").getByText("Paused", { exact: true })).toBeVisible();
  });
});
