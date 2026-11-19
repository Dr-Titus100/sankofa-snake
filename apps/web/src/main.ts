// Starts the game in every element marked with data-sankofa-snake.
// Add ?seed=123 to the page address to place the cowries the same way every time.
// data-sankofa-snake="play" leaves out the How to play button, and data-sankofa-snake="help" shows
// only the rules and the sound and vibration switches. A page can use both to put the rules on a tab of its own.
import { SankofaSnake } from "./app";

function start() {
  const param = new URLSearchParams(location.search).get("seed");
  const seed = param !== null && /^\d+$/.test(param) ? Number(param) : undefined;
  document.querySelectorAll<HTMLElement>("[data-sankofa-snake]").forEach((el) => {
    if (!el.dataset.ssStarted) {
      el.dataset.ssStarted = "true";
      const view = el.dataset.sankofaSnake;
      new SankofaSnake(el, { seed, view: view === "play" || view === "help" ? view : "full" });
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
