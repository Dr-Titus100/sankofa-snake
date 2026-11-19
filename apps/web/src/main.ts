// Starts the game in every element marked with data-sankofa-snake.
// Add ?seed=123 to the page address to place the cowries the same way every time.
import { SankofaSnake } from "./app";

function start() {
  const param = new URLSearchParams(location.search).get("seed");
  const seed = param !== null && /^\d+$/.test(param) ? Number(param) : undefined;
  document.querySelectorAll<HTMLElement>("[data-sankofa-snake]").forEach((el) => {
    if (!el.dataset.ssStarted) {
      el.dataset.ssStarted = "true";
      new SankofaSnake(el, { seed });
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
