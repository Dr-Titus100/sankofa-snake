# Lesson 1: The grid and how the snake moves (R)

Students learn how the R version stores the board and the snake, how one move works, and how the snake comes back on the other side of the board.

## Start by playing

Run `shiny::runApp(".")` from `ports/shiny` and play the first level, the Farm, for a few minutes. Steer the snake off the right edge of the board and watch where it comes back. Then try the City, where the edge is a wall.

## The board is a grid

The board is a grid of square cells, 20 across and 20 down in most levels. Every cell has two numbers:

- `x` counts across from the left, starting at 0.
- `y` counts down from the top, starting at 0.

So the top left cell is `(0, 0)` and the bottom right cell of a 20 by 20 board is `(19, 19)`. In maths class `y` usually grows upward. On screens it grows downward, because screens draw from the top.

The game counts cells from 0, the way the web game does, so that a level file means the same thing in every version. R counts the items in a vector from 1. Keep both in mind: a cell's `x` can be 0, but the first item of a vector is `v[1]`.

## The snake is two vectors

The TypeScript version keeps the snake as a list of cell objects. The R version keeps it as two numeric vectors in the game state, `sx` for the `x` of each cell and `sy` for the `y`, head first. When the Farm starts, the snake is three cells long, facing right, with its head at `(5, 10)`:

```r
state$sx  # 5 4 3
state$sy  # 10 10 10
```

So the head is `state$sx[1]` and `state$sy[1]`. Keeping the two numbers apart suits R, because R works on whole vectors at once. `create_game` in `R/game.R` builds the starting snake in one line for each vector, with no loop:

```r
i <- seq_len(st$length) - 1
sx = (st$x + back[1] * i) %% level$width,
sy = (st$y + back[2] * i) %% level$height,
```

`i` is `0 1 2`, and `back` is the step pointing behind the head, `c(-1, 0)` for a snake facing right. R multiplies and adds every item of `i` at once.

One move has two steps:

1. Add a new head one cell ahead of the old head.
2. Remove the last cell, the tail.

The snake looks like it slides forward, but the cells in the middle never change. When the head lands on a cowrie, the game skips step 2, so the snake grows by one cell.

Find this in `move_once` in `R/game.R`:

```r
tail_moves <- !eating && state$grow == 0
n <- length(state$sx)
bx <- if (tail_moves) state$sx[-n] else state$sx
by <- if (tail_moves) state$sy[-n] else state$sy
...
sx <- c(nx, bx)
sy <- c(ny, by)
```

A negative index in R means "everything except", so `state$sx[-n]` drops the last item. `c(nx, bx)` makes a new vector with the new head in front.

## Which way is ahead?

The game keeps a small list of steps, one for each direction:

```r
STEP <- list(up = c(0, -1), down = c(0, 1), left = c(-1, 0), right = c(1, 0))
```

The new head is the old head plus the step:

```r
nx <- state$sx[1] + STEP[[step]][1]
ny <- state$sy[1] + STEP[[step]][2]
```

`STEP[[step]]` picks the step by name, and `[1]` and `[2]` take its `x` and `y`. Going up subtracts 1 from `y`, because `y` counts down from the top.

## Wrapping around the edge

On the Farm, a snake that leaves the right edge at `x = 20` comes back at `x = 0`. R's remainder operator, `%%`, does this. `20 %% 20` is 0, and `21 %% 20` is 1.

Going off the left edge gives `x = -1`. In JavaScript, `-1 % 20` is `-1`, so the web game adds the width and takes the remainder a second time. R's `%%` gives an answer with the same sign as the number on its right, so `-1 %% 20` is already 19, the rightmost column. The R version needs only this:

```r
wrap_xy <- function(x, y, level) c(x %% level$width, y %% level$height)
```

This is the first of several places where the port had to think about how R and JavaScript differ. When you port code from one language to another, the lines that look the same are the ones to check most carefully.

## Questions on paper

1. The Farm's snake starts with `sx` = `5 4 3` and `sy` = `10 10 10`, facing right. Write down both vectors after three moves to the right with no cowries.
2. The head is at `(19, 4)` on a 20 by 20 Farm, moving right. Where is the head after the next move?
3. Work out `x %% 20` in R for `x = -1`, `x = 7` and `x = 20`. Which of the three gives a different answer in JavaScript?
4. Why does the game ignore a turn straight back the way the snake is heading?
5. What do `state$sx[0]` and `state$sx[-1]` give for the starting snake? Why does the code use `[1]` for the head?

## At the console

1. Type `-1 %% 20` at the R console. Then type `-1 %/% 20`, R's whole-number division. Check that `20 * (-1 %/% 20) + (-1 %% 20)` gives back -1.
2. Add this test to `tests/testthat/test-lesson.R` (see [Getting ready](README.md#getting-ready)) and run it:

   ```r
   test_that("wraps around the top of the Farm", {
     game <- create_game(LEVELS[[1]], 1)
     game <- turn(game, "up")
     for (i in 1:11) game <- tick(game)$state
     expect_equal(c(game$sx[1], game$sy[1]), c(5, 19))
   })
   ```

   Explain why 11 moves up from row 10 end in row 19. `tick` returns a list with the new state and a list of events, so the loop keeps only `$state`. `LEVELS[[1]]` is the first level, because R counts from 1.
3. Write a second test for question 1. Turn right, tick three times, and check `game$sx` and `game$sy` with `expect_equal`.

## Notes for the teacher

1. `sx` = `8 7 6` and `sy` = `10 10 10`. The middle cell of the new snake is a cell that was never part of the old one, which surprises some students. Ask them to draw it.
2. `(0, 4)`.
3. 19, 7 and 0. JavaScript gives `-1` for the first one.
4. The cell straight behind the head is the snake's neck, so the turn would end the run at once. The game drops that turn instead. The check is in `turn` in `game.R`.
5. `state$sx[0]` gives `numeric(0)`, an empty vector, because there is no item 0. `state$sx[-1]` gives `4 3`, everything except the first item. The head is item 1 because R counts from 1. Students coming from Python often write `[0]` and get an empty result with no error, which is worth a warning.

At the console, `-1 %/% 20` is -1, and `20 * -1 + 19` gives back -1, so the two operators always fit together. The head goes from row 10 to row 0 in 10 moves, and the 11th move goes to row -1, which wraps to row 19. A common mistake is to expect row 20.
