# Lesson 5: The game loop and timing

Students learn how a game runs as a loop, why the screen and the snake keep different clocks, and how the game keeps time fair when a phone is slow.

## Start by playing

Play the Park, level 2. The snake starts slowly and speeds up every 5 cowries. Watch the cowrie shell while you play. It pulses smoothly the whole time, even though the snake only jumps from cell to cell a few times a second.

## Two clocks

The game runs on two clocks at once.

- The screen draws a new picture many times a second, usually 60. Each picture is a frame.
- The snake moves a set number of cells a second. The Park starts at 6 moves a second and rises to 10.

At 60 frames and 6 moves a second, the snake moves once every 10 frames or so. The frames in between redraw the same board, so the pulsing cowrie and the drifting currents stay smooth.

The rules give the length of one move in milliseconds with `moveMs` in `packages/core/src/game.ts`:

```ts
export const moveMs = (state: GameState) => 1000 / speedNow(state);
```

`speedNow` is the snake's speed in moves a second. In slow motion it is 60% of the speed, rounded, and never below 3. While the snake swims along a current, the way the current flows, it is 1.5 times that, rounded. While it swims against a current, it is half that, rounded.

## The loop

The browser calls `frame` in `apps/web/src/app.ts` before it draws each frame, and passes the time in milliseconds. The main part looks like this:

```ts
const dt = this.lastTime ? Math.min(time - this.lastTime, 250) : 0;
this.lastTime = time;
if (this.state.status === "running") {
  this.carry += dt;
  for (let n = 0; n < 4 && this.carry >= moveMs(this.state) && this.state.status === "running"; n++) {
    this.carry -= moveMs(this.state);
    const result = tick(this.state);
    this.apply(result.state, result.events);
  }
}
this.drawBoard(time);
```

Read it a line at a time.

1. `dt` is how long since the last frame, usually about 16.7 milliseconds.
2. `carry` saves up that time, like coins in a jar.
3. While the jar holds enough time for a whole move, the loop takes that much out and moves the snake one cell with `tick`.
4. Whatever is left stays in the jar for the next frame. Nothing is lost, so over a second the snake makes exactly as many moves as its speed says.
5. `drawBoard` draws the board, whether the snake moved or not.

Then `frame` asks the browser for the next frame with `requestAnimationFrame`, but only while the snake is moving. A paused or finished board stays as it is, which saves a phone's battery.

## Keeping time fair on a slow phone

A busy phone can miss frames. Two limits stop that from spoiling the run.

- `dt` is never more than 250 milliseconds. If the phone freezes for a moment, the snake doesn't jump a long way across the board when it wakes up.
- The loop makes at most 4 moves in one frame. If the phone falls behind, the snake catches up over a few frames.

The game also pauses itself when the player switches tabs or apps, so leaving the page never costs the player a run.

## Time inside the rules

The time bonus at the end of a level depends on how long the run took. The rules don't read a clock for this. Each `tick` adds the length of the move to `elapsedMs`:

```ts
const elapsedMs = state.elapsedMs + moveMs(state);
```

So a run's time counts only the moves the snake made. Time spent paused doesn't count, a slow phone gets the same time as a fast one for the same moves, and a test can check the time without waiting.

## Questions on paper

1. The snake moves 8 cells a second. How long is one move in milliseconds?
2. The screen draws 60 frames a second and the snake moves 6 cells a second. About how many frames pass between two moves?
3. The snake's speed is 10. What is `speedNow` in slow motion? What if the speed is 4?
4. The phone freezes for a whole second while the snake moves 8 cells a second. How many moves happen in the next frame, and why?
5. Why does the game count a run's time by adding up `moveMs`, instead of reading the clock at the start and at the end?

## At the keyboard

Add these tests to `packages/core/test/lesson.test.ts`.

1. The Farm moves 6 cells a second, so one move takes a sixth of a second:

   ```ts
   import { expect, it } from "vitest";
   import { LEVELS, createGame, moveMs, tick, turn } from "../src";

   it("takes a sixth of a second for one move on the Farm", () => {
     const game = createGame(LEVELS[0], 1);
     expect(moveMs(game)).toBeCloseTo(1000 / 6);
   });
   ```

2. Ten moves add ten move lengths to the run's time:

   ```ts
   it("counts the run's time in moves", () => {
     let game = turn(createGame(LEVELS[0], 1), "up");
     for (let i = 0; i < 10; i++) game = tick(game).state;
     expect(game.elapsedMs).toBeCloseTo((10 * 1000) / 6);
   });
   ```

3. Write the loop yourself. Finish this function so that it plays frames of `frameMs` milliseconds for one second and returns how many moves the snake made. Then check that it makes 6 moves at 60 frames a second, and still 6 at 30 frames a second.

   ```ts
   function movesInOneSecond(frameMs: number): number {
     let game = turn(createGame(LEVELS[0], 1), "up");
     let carry = 0;
     let moves = 0;
     for (let time = 0; time < 1000; time += frameMs) {
       // Add frameMs to carry. While carry holds a whole move, take it out, tick, and count the move.
     }
     return moves;
   }
   ```

## Notes for the teacher

1. 1000 / 8 = 125 milliseconds.
2. About 10. A frame takes 1000 / 60, about 16.7 milliseconds, and a move takes 1000 / 6, about 166.7.
3. 6, since 10 × 0.6 = 6. At speed 4, 4 × 0.6 = 2.4 rounds to 2, which is below the floor of 3, so it is 3.
4. 2 moves. The loop caps `dt` at 250 milliseconds, and a move takes 125, so the jar holds exactly two moves. Without the cap it would hold 8, and the snake would jump 8 cells at once.
5. Paused time would count against the player, and a slow phone that drops frames would get a different time from a fast one. Counting moves also makes the time the same every time a player makes the same moves, which the tests rely on.

For keyboard exercise 3, the body of the loop is:

```ts
carry += frameMs;
while (carry >= moveMs(game)) {
  carry -= moveMs(game);
  game = tick(game).state;
  moves++;
}
```

At 30 frames a second the snake moves on every fifth frame instead of every tenth, so the count is still 6. Ask students to try frames of 16, 17 and 20 milliseconds as well. The count stays at 6 because the leftover time stays in `carry` for the next frame. Then ask what would happen if the loop threw the leftover away and set `carry` back to 0 after each move.

A good extension is to add the 250 millisecond cap and the limit of 4 moves a frame to the student's loop, then call it with one frame of 2000 milliseconds and count the moves.
