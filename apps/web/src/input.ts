// Turns key presses, swipes and taps into game commands.
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
 * Listens for swipes and taps on an element, with pointer events, which cover fingers, pens and
 * mice in one model. A swipe steers. A tap with a finger or pen pauses or resumes. A mouse click
 * doesn't pause, so clicking the board on a computer never stops a run by surprise.
 * The element should have `touch-action: none` so the page doesn't scroll while playing.
 * Aborting the signal removes every listener.
 */
export function listenForSwipes(el: HTMLElement, onCommand: (c: Command) => void, signal?: AbortSignal): void {
  let start: { x: number; y: number; id: number } | null = null;
  // True once a long swipe has already steered, so lifting the finger doesn't count as a tap.
  let moved = false;
  const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    el.addEventListener(type, fn, { signal });

  on("pointerdown", (e) => {
    // Presses on buttons drawn over the board are button presses, not game taps.
    if (start || !e.isPrimary || (e.target as Element).closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved = false;
    try {
      // Keeps the swipe going when the finger leaves the board.
      el.setPointerCapture(e.pointerId);
    } catch {
      // Not every pointer can be captured. The swipe still works while it stays on the board.
    }
  });
  on("pointermove", (e) => {
    if (!start || e.pointerId !== start.id) return;
    // Steer as soon as the finger has moved far enough, so long swipes feel quick.
    const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y);
    if (dir) {
      onCommand({ type: "turn", dir });
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      moved = true;
    }
  });
  on("pointerup", (e) => {
    if (!start || e.pointerId !== start.id) return;
    if (!moved) {
      const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y);
      if (dir) onCommand({ type: "turn", dir });
      else if (e.pointerType !== "mouse") onCommand({ type: "pause" });
    }
    start = null;
    moved = false;
  });
  on("pointercancel", (e) => {
    if (start && e.pointerId === start.id) start = null;
    moved = false;
  });
}

export function swipeDirection(dx: number, dy: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Whether the player mainly uses a touch screen, so the game shows swipe and tap text. */
export function inputKind(): "keys" | "touch" {
  return window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "keys";
}
