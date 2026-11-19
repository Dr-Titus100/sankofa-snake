# Lesson 2: Rules as functions

Students learn how the game keeps everything about a run in one value, how each rule is a function that returns a new value, and how that makes the rules easy to test.

## Start by looking at the folders

```text
packages/core/   the rules: where the snake goes, what it eats, when a run ends
apps/web/        the drawing, the keyboard and touch screen, the sounds
```

Nothing in `packages/core` draws anything or reads a key. The website, the phone app that comes later and the unit tests all use the same rules from this folder.

## Everything about a run is one value

`GameState` in `packages/core/src/types.ts` holds the whole run. These are some of its fields:

| Field | What it holds |
| --- | --- |
| `snake` | the snake's cells, head first |
| `dir` | the way the snake is heading |
| `queue` | turns the player pressed that haven't happened yet |
| `food` | the cell with the cowrie on it |
| `eaten`, `score` | how many cowries so far, and the score |
| `status` | `"ready"`, `"running"`, `"paused"`, `"over"` or `"cleared"` |
| `rng` | where the random number generator has got to (lesson 4) |

If you saved this one value, you could pick the run up again later exactly where it was.

## Rules return a new state

Three functions do most of the work:

- `createGame(level, seed)` returns the state at the start of a level.
- `turn(state, dir)` returns the state after the player presses a direction.
- `tick(state)` moves the snake one cell and returns `{ state, events }`.

None of them changes the state it is given. Each one builds a new state and returns it. The code does this with the spread syntax, which copies an object and changes only the fields you name:

```ts
return { ...state, status: "paused" };
```

The `events` list says what happened during the move, such as `{ type: "ate", ... }` or `{ type: "crash", cause: "wall" }`. The website listens for events to update the score, speak to screen readers, play a sound and buzz the phone. The rules never need to know about any of that.

## Why work this way?

A rule that only takes a value and returns a value is easy to test. A test can build a state, call the rule and check the result, with no screen, no keyboard and no waiting. The game has more than fifty such tests in `packages/core/test/`.

It also means the old state is still there after a move. A replay, an undo button or a computer player that tries moves ahead all become simple.

## Questions on paper

1. A snake is heading right and the player presses left. What should `turn` return, and why?
2. Practice mode stops the snake when it runs into something, where the normal game ends the run. Only one function in `game.ts` changes for practice. Which one do you think it is? Find it and check.
3. Why might a game keep turns in a queue instead of using only the last key pressed? Think about pressing up and then right very quickly.

## At the keyboard

Add these tests to `packages/core/test/lesson.test.ts`.

1. A turn back into the neck is ignored:

   ```ts
   import { expect, it } from "vitest";
   import { LEVELS, createGame, tick, turn } from "../src";

   it("ignores a turn back into the neck", () => {
     const start = createGame(LEVELS[0], 1); // facing right
     const after = turn(start, "left");
     expect(after.status).toBe("ready");
   });
   ```

2. A move leaves the old state alone. Copy the snake before the move, call `tick`, and check that the old state's snake still equals the copy:

   ```ts
   it("leaves the old state alone", () => {
     const before = turn(createGame(LEVELS[0], 1), "up");
     const copy = structuredClone(before.snake);
     tick(before);
     expect(before.snake).toEqual(copy);
   });
   ```

3. Write a test that runs the City (`LEVELS[3]`, where the edge is a wall) straight up until the run ends. Check that `status` is `"over"` and `crash` is `"wall"`. How many ticks does it take?

## Notes for the teacher

1. It returns the same state it was given, so nothing changes and the snake keeps going right. Turning left would put the head on the neck.
2. `crash`. In practice it returns a state with `status: "ready"` and a `bump`, so the game waits for a new direction.
3. With only the last key, a quick up then right would lose the up, and the snake would turn right without first going up. The queue keeps up to two turns, `MAX_QUEUED_TURNS`, so quick presses happen in order.

For keyboard exercise 3, the City's snake starts at row 10 in an open column. Ten moves reach row 0 and the 11th hits the wall, so it takes 11 ticks.

A good extension is to ask students to break a rule on purpose, for example by deleting the line in `turn` that checks for the neck, and watch which tests fail. Then they undo the change.
