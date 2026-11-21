# Teaching with Sankofa Snake in R

These guides teach programming with the R Shiny version of the game, in `ports/shiny`. They follow the same six lessons as the [TypeScript guides](../README.md), but every code sample comes from the R port, and every exercise runs with `testthat`. Each lesson also points out where R behaves differently from JavaScript, because the port had to deal with each of those differences.

The lessons suit students who have written a little R before, for example in a statistics or data science course. They work for an upper secondary class, a first university course or a coding club. The R port has no frame loop, no objects with methods and no unsigned integers, so the lessons also show a whole game built from plain lists, vectors and functions.

## The lessons

| Lesson | What students learn | Time |
| --- | --- | --- |
| [1. The grid and how the snake moves](01-grid-and-movement.md) | The snake as two vectors, counting from 1, and how R's `%%` handles negative numbers | 45 minutes |
| [2. Rules as functions](02-rules-as-functions.md) | A list for the game state, copy on modify, functions that return a new state, and unit tests | 60 minutes |
| [3. Levels as data](03-levels-as-data.md) | JSON files as nested lists, vectorized map reading, and a flood fill on a logical matrix | 60 minutes |
| [4. Randomness and seeds](04-randomness-and-seeds.md) | Pseudo-random numbers, seeds, 32-bit arithmetic with doubles, closures, and the daily challenge | 45 minutes |
| [5. The game loop and timing](05-game-loop-and-timing.md) | A loop driven by Shiny's `invalidateLater`, moves on a clock, and why the port needs its own rounding | 45 minutes |
| [6. Collision checks](06-collision-checks.md) | Checking one cell a move, the order of the checks, `%in%` and vectorized comparisons | 45 minutes |

Each lesson has questions to answer on paper, exercises at the console, and notes for the teacher with the answers.

## Getting ready

Students need R 4.1 or newer, the shiny, jsonlite and testthat packages, and a copy of the repository.

```sh
git clone https://github.com/Dr-Titus100/sankofa-snake.git
```

For these lessons, R's working directory should be the `ports/shiny` folder inside the clone. In RStudio, choose File, New Project, Existing Directory and pick `sankofa-snake/ports/shiny`. In any other R session, run `setwd()` with that folder's path. `getwd()` shows which folder R is in. Then run:

```r
install.packages(c("shiny", "jsonlite", "testthat"))
shiny::runApp(".")
```

The last line starts the game and prints an address to open in a browser. The rules in `R/` don't need Shiny, so students can do every exercise even without it.

To try the rules at the console, load every file in `R/` from `ports/shiny`:

```r
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f)
```

Students write their tests in a new file, `ports/shiny/tests/testthat/test-lesson.R`. Each exercise adds a `test_that()` block to it. testthat loads the game's R files first, through `helper-load.R`. To run only that file, from `ports/shiny`:

```sh
Rscript -e 'testthat::test_file("tests/testthat/test-lesson.R")'
```

The port's own tests run with `Rscript -e 'testthat::test_dir("tests/testthat")'`.

## Using the game in class

- Practice mode suits demonstrations. The snake moves slowly, and running into something only stops it, so you can steer while you talk without the run ending.
- Add `?seed=42` to the app's address to put the cowries, stalls, roads and currents in the same places for everyone. Add `?layout=fixed` to play every level exactly as its file draws it.
- M turns the sound off, which helps in a quiet room.
- Students with the web game open can compare it with the Shiny version side by side. The same seed gives the same board in both.

## Project ideas

- Play 1,000 runs with a simple computer player that steers toward the cowrie, store each run's level, score and cause of crash in a data frame, and summarise them by level. This fits a statistics class well.
- Plot a run. Keep the head's cell after every move and draw the path with `plot()` or ggplot2, coloured by move number.
- Read `tests/testthat/test-reference.R`, which replays 61 runs recorded from the TypeScript rules. Add a check of your own to it, such as the score after every move.
- Pick one exercise from these lessons and write it again in TypeScript, using the [TypeScript guides](../README.md). Compare the two versions line by line and list what each language made easier.
