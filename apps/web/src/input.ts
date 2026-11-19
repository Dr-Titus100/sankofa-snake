// Turns key presses and swipes into game commands.
import type { Direction } from "../../../packages/core/src";

export type Command = { type: "turn"; dir: Direction } | { type: "pause" };

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

export function commandForKey(e: KeyboardEvent): Command | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  const dir = KEYS[e.key];
  if (dir) return { type: "turn", dir };
  if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") return { type: "pause" };
  return null;
}

/** The shortest finger movement, in CSS pixels, that counts as a swipe rather than a tap. */
const SWIPE = 24;

/**
 * Listens for swipes and taps on an element. A swipe steers. A tap pauses or resumes.
 * The element should have `touch-action: none` so the page doesn't scroll while playing.
 */
export function listenForTouch(el: HTMLElement, onCommand: (c: Command) => void): void {
  let start: { x: number; y: number; id: number } | null = null;
  // True once a long swipe has already steered, so lifting the finger doesn't count as a tap.
  let moved = false;
  el.addEventListener(
    "touchstart",
    (e) => {
      // Taps on buttons drawn over the board are button presses, not game taps.
      if ((e.target as Element).closest("button")) return;
      const t = e.changedTouches[0];
      start = { x: t.clientX, y: t.clientY, id: t.identifier };
    },
    { passive: true },
  );
  el.addEventListener(
    "touchmove",
    (e) => {
      if (!start) return;
      e.preventDefault();
      // Steer as soon as the finger has moved far enough, so long swipes feel quick.
      const t = [...e.changedTouches].find((c) => c.identifier === start!.id);
      if (!t) return;
      const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y);
      if (dir) {
        onCommand({ type: "turn", dir });
        start = { x: t.clientX, y: t.clientY, id: t.identifier };
        moved = true;
      }
    },
    { passive: false },
  );
  el.addEventListener("touchend", (e) => {
    if (!start) return;
    const t = [...e.changedTouches].find((c) => c.identifier === start!.id);
    if (t && !moved) {
      const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y);
      onCommand(dir ? { type: "turn", dir } : { type: "pause" });
    }
    start = null;
    moved = false;
  });
  el.addEventListener("touchcancel", () => {
    start = null;
    moved = false;
  });
}

export function swipeDirection(dx: number, dy: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
