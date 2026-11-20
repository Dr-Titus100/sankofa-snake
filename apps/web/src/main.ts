// Starts the game in every element marked with data-sankofa-snake.
// Add ?seed=123 to the page address to place the cowries the same way every time.
// The module also exports SankofaSnake and start(), and each element keeps its game as
// element.sankofaSnake, so a page or app can call game.back() or game.destroy().
// data-sankofa-snake="play" leaves out the How to play button, and data-sankofa-snake="help" shows
// only the rules and the sound and vibration switches. A page can use both to put the rules on a tab of its own.
import { SankofaSnake } from "./app";

export { SankofaSnake };
export type { Options } from "./app";

/** Starts the game in every element marked with data-sankofa-snake that doesn't have one yet. */
export function start() {
  const param = new URLSearchParams(location.search).get("seed");
  const seed = param !== null && /^\d+$/.test(param) ? Number(param) : undefined;
  document.querySelectorAll<HTMLElement>("[data-sankofa-snake]").forEach((el) => {
    if (!el.dataset.ssStarted) {
      el.dataset.ssStarted = "true";
      const view = el.dataset.sankofaSnake;
      // The element keeps its game, so a page or app can call back() or destroy() on it.
      (el as HTMLElement & { sankofaSnake?: SankofaSnake }).sankofaSnake = new SankofaSnake(el, {
        seed,
        view: view === "play" || view === "help" ? view : "full",
      });
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
