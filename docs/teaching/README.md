# Teaching with Sankofa Snake

These guides use the game's own code to teach programming. Each lesson starts from something students can see while they play, such as the snake wrapping around the edge or the cowries landing in the same places every time, and then opens the file where that happens.

The lessons suit students who have written a little code before, in any language. They work for an upper secondary class, a first university course or a coding club. The code here is TypeScript. The same six lessons also come in [Python, with the Pygame version](python/README.md), and in [R, with the R Shiny version](r/README.md). Each of those uses the port's own code and tests, and points out where the language behaves differently from JavaScript.

## The lessons

| Lesson | What students learn | Time |
| --- | --- | --- |
| [1. The grid and how the snake moves](01-grid-and-movement.md) | Coordinates on a grid, lists of cells, and the remainder operator for wrap-around edges | 45 minutes |
| [2. Rules as functions](02-rules-as-functions.md) | Game state, functions that return a new state, and unit tests | 60 minutes |
| [3. Levels as data](03-levels-as-data.md) | JSON files, maps made of characters, and checking data for mistakes | 60 minutes |
| [4. Randomness and seeds](04-randomness-and-seeds.md) | Pseudo-random numbers, seeds, and why the daily challenge is the same for everyone | 45 minutes |
| [5. The game loop and timing](05-game-loop-and-timing.md) | Frames and moves as two clocks, saving up leftover time, and keeping time fair on a slow phone | 45 minutes |
| [6. Collision checks](06-collision-checks.md) | Checking one cell a move, why the order of checks matters, and why the snake can follow its own tail | 45 minutes |

Each lesson has questions to answer on paper, exercises at the keyboard, and notes for the teacher with the answers.

## Getting ready

Students need Node.js 22 and a copy of the repository.

```sh
git clone https://github.com/Dr-Titus100/sankofa-snake.git
cd sankofa-snake
npm install
npm test        # runs the unit tests. They should all pass before you start.
npm run dev     # plays the game at http://localhost:5173 and rebuilds after every change
```

Students write their own tests in a new file such as `packages/core/test/lesson.test.ts`. To run only that file:

```sh
npx vitest run --dir packages lesson
```

If installing software isn't possible, students can still play the game at [titusnyarkonde.com/games/sankofa-snake](https://titusnyarkonde.com/games/sankofa-snake/) and read the code on GitHub. The paper questions in each lesson need nothing else.

## Using the game in class

- Practice mode suits demonstrations. The snake moves slowly, and running into something only stops it, so you can steer while you talk without the run ending.
- The daily challenge makes a quick warm-up. Everyone gets the same board that day, so students can compare scores and strategies.
- A fixed seed puts the cowries, stalls, roads and currents in the same places for everyone. Add `?seed=42` to the game's address, and every student sees the same board. Add `?layout=fixed` to play every level exactly as its file draws it.
- You can turn the sound off with the M key or on the How to play screen, which helps in a quiet room.

## Project ideas

When students finish the lessons, these make good longer projects.

- Design a tenth level with its own map and rules, and add it to the game.
- Invent a new power-up. Add its name to `PowerKind` in `packages/core/src/types.ts`, give it an effect in `moveOnce` in `packages/core/src/game.ts`, and write tests for it first.
- Keep a record of every move in a run and replay it afterward. Because the rules are functions with no hidden state, the seed and the list of turns, each with the move it came on, are enough to replay a whole run.
- Write a simple computer player that steers toward the cowrie, and measure how often it clears each level.
