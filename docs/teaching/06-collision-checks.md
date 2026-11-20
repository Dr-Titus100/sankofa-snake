# Lesson 6: Collision checks

Students learn how the game decides whether the snake's next cell is safe, why the order of the checks matters, and why the snake can follow its own tail.

## Start by playing

Play the City, level 4, and run into the edge. Then play the Market and run into a stall, and finally steer the snake into its own body. Each run ends with a different message. Now try something else on the Farm: make a small loop and chase your own tail. A snake of four cells can go round a 2 by 2 square forever.

## One cell at a time

On every move, the head steps into one new cell. A collision check asks a single question about that cell: is anything already there? The snake never moves more than one cell in a move, so the game never needs to check the cells in between.

The checks live in `moveOnce` in `packages/core/src/game.ts`. In order:

```ts
const outside = next.x < 0 || next.y < 0 || next.x >= level.width || next.y >= level.height;
if (outside && level.edges === "walls") return fail("wall");
next = wrapCell(next, level);

if (state.obstacles.has(key(next))) return fail("obstacle");
const vehicle = vehicleAt(level, state.vehicles, next);
if (vehicle) return fail("vehicle", vehicle);
```

1. **The edge.** A cell off the board ends the run on a level with walls. On a level that wraps, `wrapCell` brings the head back in on the other side.
2. **Obstacles.** Stalls, buildings, benches, maze walls, canoes and looms sit in a set of text keys such as `"7,12"`. The `key` function turns a cell into its key, and `has` answers in the same time however many obstacles there are.
3. **Vehicles.** `vehicleAt` looks along each vehicle's lane for the head's cell.
4. **The snake itself**, which comes next.

The edge check has to come before `wrapCell`. Once the cell is wrapped, it is back on the board, and the game can no longer tell that it was off the edge.

## Following your own tail

```ts
const eating = state.food !== null && sameCell(next, state.food);
const tailMoves = !eating && state.grow === 0;
const body = tailMoves ? state.snake.slice(0, -1) : state.snake;
if (body.some((c) => sameCell(c, next))) {
  if (passes === 0) return fail("self");
  passes -= 1;
}
```

On most moves the tail leaves its cell at the same moment the head arrives somewhere new. So the game checks the head against the body without its last cell, `slice(0, -1)`. That is why the snake can chase its own tail.

When the snake eats a cowrie, or is still growing from one, the tail stays put. Then the last cell counts, and running into it ends the run.

The Lab's pass power-up is checked here too. With a pass, the snake goes through its body once instead of crashing.

## What a crash returns

Every failed check calls `crash`, which returns a new state with `status: "over"`, the cause and the cell where it happened. The web game reads the cause to show the right message and the cell to draw a cross on the board. In practice mode `crash` returns a state with `status: "ready"` instead, so the snake stops and waits.

Vehicles move first, before the snake, on the same beat. A vehicle waits while the snake is in its way, so only the snake's head can ever hit a vehicle, never the other way round.

## Questions on paper

1. A snake of 4 cells has eaten nothing for a while. Its head is about to move into the cell where its tail is now. Does the run end? What if it ate a cowrie on the move before?
2. Why must the edge check come before `wrapCell`?
3. The game checks obstacles before it checks the snake's body. Could a cell ever hold both? What does that tell you about whether this order matters?
4. Why does the game store obstacles as text keys like `"7,12"` in a set, instead of as `{ x: 7, y: 12 }` objects in a list?
5. A vehicle is about to drive into the snake's body. What happens, and where in the code would you look to check?

## At the keyboard

Add these tests to `packages/core/test/lesson.test.ts`.

1. An obstacle straight ahead ends the run:

   ```ts
   import { expect, it } from "vitest";
   import { LEVELS, createGame, key, tick, turn } from "../src";

   it("crashes into an obstacle straight ahead", () => {
     let game = createGame(LEVELS[0], 1); // the Farm, facing right
     const head = game.snake[0];
     game = { ...game, obstacles: new Set([key({ x: head.x + 1, y: head.y })]) };
     game = tick(turn(game, "right")).state;
     expect(game.status).toBe("over");
     expect(game.crash).toBe("obstacle");
   });
   ```

2. A snake can chase its own tail. Build a snake of four cells in a 2 by 2 square, with the head about to step into the tail's cell:

   ```ts
   it("lets the head follow the tail", () => {
     let game = createGame(LEVELS[0], 1);
     game = {
       ...game,
       snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }],
       dir: "up",
       lastStep: "up",
       food: { x: 15, y: 15 },
     };
     game = tick(turn(game, "right")).state;
     expect(game.status).toBe("running");
     expect(game.snake[0]).toEqual({ x: 6, y: 5 });
   });
   ```

3. Copy the second test and set `grow: 1` on the game before the move. Predict what happens before you run it, then check your prediction with `expect`.

## Notes for the teacher

1. No, the run goes on, because the tail leaves its cell on the same move. If the snake ate on the move before, it is still growing, so the tail stays and the run ends with `crash: "self"`.
2. After `wrapCell`, a cell off the right edge becomes a cell on the left edge, which is on the board. The check would never see it as outside.
3. No. The snake can never move into an obstacle, so the two never share a cell. The order still decides which message a player sees when two kinds of collision could happen, so it's worth reading carefully when adding a new kind.
4. Two objects with the same numbers are still different objects, so a set of objects can't find `{ x: 7, y: 12 }` from a new object. The text `"7,12"` is the same text however it was made, so `has` finds it at once.
5. The vehicle waits. `moveVehicles` in `game.ts` doesn't move a vehicle into a cell the snake is in, which is why only the head can hit a vehicle.

For keyboard exercise 3, the run ends with `crash: "self"`, because a growing snake keeps its tail cell.

A good extension is to ask students where they would add a new kind of obstacle, such as a puddle that only slows the snake down, and which checks it would need to come before or after.
