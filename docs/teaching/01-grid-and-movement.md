# Lesson 1: The grid and how the snake moves

Students learn how the game stores the board and the snake, how one move works, and how the snake comes back on the other side of the board.

## Start by playing

Play the first level, the Farm, for a few minutes. Steer the snake off the right edge of the board and watch where it comes back. Then try the City, where the edge is a wall.

## The board is a grid

The board is a grid of square cells, 20 across and 20 down in most levels. Every cell has two numbers:

- `x` counts across from the left, starting at 0.
- `y` counts down from the top, starting at 0.

So the top left cell is `(0, 0)` and the bottom right cell of a 20 by 20 board is `(19, 19)`. In maths class `y` usually grows upward. On screens it grows downward, because screens draw from the top.

In the code, a cell is a small object:

```ts
interface Cell {
  x: number;
  y: number;
}
```

## The snake is a list of cells

The snake is a list of cells with the head first. When the Farm starts, the snake is three cells long, facing right, with its head at `(5, 10)`:

```ts
[{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }]
```

One move has two steps:

1. Add a new head one cell ahead of the old head.
2. Remove the last cell, the tail.

The snake looks like it slides forward, but the cells in the middle never change. When the head lands on a cowrie, the game skips step 2, so the snake grows by one cell.

Find this in `moveOnce` in `packages/core/src/game.ts`. Look for these lines:

```ts
const tailMoves = !eating && state.grow === 0;
const body = tailMoves ? state.snake.slice(0, -1) : state.snake;
let snake = [next, ...body];
```

`slice(0, -1)` makes a copy of the list without its last cell, and `[next, ...body]` makes a new list with the new head in front.

## Which way is ahead?

The game keeps a small table of steps, one for each direction:

```ts
const STEP = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
```

The new head is the old head plus the step: `{ x: head.x + STEP[dir].x, y: head.y + STEP[dir].y }`. Going up subtracts 1 from `y`, because `y` counts down from the top.

## Wrapping around the edge

On the Farm, a snake that leaves the right edge at `x = 20` comes back at `x = 0`. The remainder operator `%` does this. `20 % 20` is 0, and `21 % 20` is 1.

Going off the left edge gives `x = -1`, and here JavaScript has a surprise. `-1 % 20` is `-1`, so the remainder alone isn't enough. The game adds the width and takes the remainder again:

```ts
x: ((c.x % level.width) + level.width) % level.width
```

For `x = -1` that is `((-1) + 20) % 20`, which is 19, the rightmost column.

## Questions on paper

1. The Farm's snake starts at `(5, 10)`, `(4, 10)`, `(3, 10)`, facing right. Write down its cells after three moves to the right with no cowries.
2. The head is at `(19, 4)` on a 20 by 20 Farm, moving right. Where is the head after the next move?
3. On a 20 by 20 board, work out `((x % 20) + 20) % 20` for `x = -1`, `x = 7` and `x = 20`.
4. Why does the game ignore a turn straight back the way the snake is heading?

## At the keyboard

1. Open your browser's console (F12) and type `-1 % 20`. Then type `((-1 % 20) + 20) % 20`.
2. Create `packages/core/test/lesson.test.ts` with this test, and run it with `npx vitest run --dir packages lesson`:

   ```ts
   import { expect, it } from "vitest";
   import { LEVELS, createGame, tick, turn } from "../src";

   it("wraps around the top of the Farm", () => {
     let game = createGame(LEVELS[0], 1);
     game = turn(game, "up");
     for (let i = 0; i < 11; i++) game = tick(game).state;
     expect(game.snake[0]).toEqual({ x: 5, y: 19 });
   });
   ```

   Explain why 11 moves up from row 10 end in row 19.
3. Write a second test for question 1. Turn right, tick three times, and check the whole snake with `toEqual`.

## Notes for the teacher

1. `(8, 10)`, `(7, 10)`, `(6, 10)`. The middle cell of the new snake is a cell that was never part of the old one, which surprises some students. Ask them to draw it.
2. `(0, 4)`.
3. 19, 7 and 0.
4. The cell straight behind the head is the snake's neck, so the turn would end the run at once. The game drops that turn instead. You'll find the check in `turn` in `game.ts`.

At the keyboard, the head goes from row 10 to row 0 in 10 moves. The 11th move goes to row -1, which wraps to row 19. A common mistake is to expect row 20.
