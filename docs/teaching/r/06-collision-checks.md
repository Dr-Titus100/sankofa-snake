# Lesson 6: Collision checks (R)

Students learn how the R version decides whether the snake's next cell is safe, why the order of the checks matters, why the snake can follow its own tail, and how `%in%` and vectorized comparisons do the checking.

## Start by playing

Play the City, level 4, in the Shiny app and run into the edge. Then play the Market and run into a stall, and finally steer the snake into its own body. Each run ends with a different message. Now try something else on the Farm. Make a small loop and chase your own tail. A snake of four cells can go round a 2 by 2 square forever.

## One cell at a time

On every move, the head steps into one new cell. A collision check asks a single question about that cell: is anything already there? The snake never moves more than one cell in a move, so the game never needs to check the cells in between.

The checks live in `move_once` in `R/game.R`. In order:

```r
outside <- nx < 0 || ny < 0 || nx >= level$width || ny >= level$height
if (outside && level$edges == "walls") return(fail("wall"))
w <- wrap_xy(nx, ny, level)
nx <- w[1]
ny <- w[2]

if (key(nx, ny) %in% state$obstacles) return(fail("obstacle"))
vehicle <- vehicle_at(level, state$vehicles, nx, ny)
if (!is.null(vehicle)) return(fail("vehicle", vehicle))
```

1. **The edge.** A cell off the board ends the run on a level with walls. On a level that wraps, `wrap_xy` brings the head back in on the other side.
2. **Obstacles.** Stalls, buildings, benches, maze walls, canoes and looms sit in `state$obstacles`, a character vector of keys such as `"7,12"`. `key(nx, ny) %in% state$obstacles` asks whether the head's key is one of them.
3. **Vehicles.** `vehicle_at` looks along each vehicle's lane for the head's cell.
4. **The snake itself**, which comes next.

The edge check has to come before `wrap_xy`. Once `wrap_xy` has moved the cell, it is back on the board, and the game can no longer tell that it was off the edge.

`||` and `&&` look at one `TRUE` or `FALSE` at a time and stop as soon as they know the answer. That suits a single cell. The next check uses `&` instead, which works on whole vectors.

## Following your own tail

```r
eating <- !is.null(state$food) && state$food[1] == nx && state$food[2] == ny
tail_moves <- !eating && state$grow == 0
n <- length(state$sx)
bx <- if (tail_moves) state$sx[-n] else state$sx
by <- if (tail_moves) state$sy[-n] else state$sy
passes <- state$passes
if (any(bx == nx & by == ny)) {
  if (passes == 0) return(fail("self"))
  passes <- passes - 1
}
```

On most moves the tail leaves its cell at the same moment the head arrives somewhere new. So the game checks the head against the body without its last cell, `state$sx[-n]`. That is why the snake can chase its own tail.

`bx == nx` compares every body cell's `x` with the head's `x` at once, and gives one `TRUE` or `FALSE` for each body cell. `by == ny` does the same for `y`. `&` combines the two vectors item by item, so a `TRUE` means a body cell matches on both. `any` asks whether there is at least one. This is how R code usually searches a vector, with no loop written out.

When the head lands on a cowrie, the tail stays put on that same move, so the snake is one cell longer straight away. The `grow` field can also hold extra cells for the snake to grow, and while it is above 0 the tail stays put on every move. Then the last cell counts, and running into it ends the run.

This check also handles the Lab's pass power-up. With a pass, the snake goes through its body once and keeps going.

## How fast is `%in%`?

`%in%` is a short way to call `match`. Each call looks at the whole vector of obstacle keys, so its work grows with the number of obstacles. A board has at most a few hundred, so this is fast enough. The TypeScript and Python versions keep obstacles in a set or a dict, where a lookup takes about the same time however many obstacles there are. An R version could do the same with a named logical vector or an environment, at the cost of a little more code.

## What a crash returns

Every failed check calls `crash`, which returns a new state with `status = "over"`, the cause and the cell where it happened. The server reads the cause to show the right message, and the browser draws a cross on that cell. In practice mode `crash` returns a state with `status = "ready"`, so the snake stops and waits.

Vehicles move first, before the snake, on the same beat. A vehicle waits while the snake is in its way, so only the snake's head can ever hit a vehicle.

## Questions on paper

1. A snake of 4 cells has eaten nothing for a while. Its head is about to move into the cell where its tail is now. Does the run end? What if it ate a cowrie on the move before? What if `grow` is 1?
2. Why must the edge check come before `wrap_xy`?
3. The game checks obstacles before it checks the snake's body. Could a cell ever hold both? What does that tell you about whether this order matters?
4. The body check uses `&`, but the edge check uses `||`. What would go wrong if the body check used `&&`?
5. Why does the game turn each obstacle into a key such as `"7,12"` instead of keeping two vectors of `x` and `y`, the way it keeps the snake?

## At the console

Add these tests to `tests/testthat/test-lesson.R`.

1. An obstacle straight ahead ends the run. The test gives the Farm a single obstacle right in front of the head:

   ```r
   test_that("crashes into an obstacle straight ahead", {
     game <- create_game(LEVELS[[1]], 1) # the Farm, facing right
     game$obstacles <- key(game$sx[1] + 1, game$sy[1])
     game <- tick(turn(game, "right"))$state
     expect_equal(game$status, "over")
     expect_equal(game$crash, "obstacle")
   })
   ```

2. A snake can chase its own tail. Build a snake of four cells in a 2 by 2 square, with the head about to step into the tail's cell:

   ```r
   test_that("lets the head follow the tail", {
     game <- create_game(LEVELS[[1]], 1)
     game$sx <- c(5, 5, 6, 6)
     game$sy <- c(5, 6, 6, 5)
     game$dir <- "up"
     game$last_step <- "up"
     game$food <- c(15, 15)
     game <- tick(turn(game, "right"))$state
     expect_equal(game$status, "running")
     expect_equal(c(game$sx[1], game$sy[1]), c(6, 5))
   })
   ```

3. Copy the second test and add `game$grow <- 1` before the move. Predict what happens before you run it, then check your prediction.
4. At the console, set `bx <- c(5, 5, 6)` and `by <- c(5, 6, 6)` and work out `bx == 5`, `by == 6`, `bx == 5 & by == 6` and `any(bx == 5 & by == 6)`.

## Notes for the teacher

1. No, the run goes on, because the tail leaves its cell on the same move. Eating on the move before changes nothing. The cowrie added its cell on that move, so `grow` is still 0 and the tail moves away as usual. Only with `grow` at 1 does the tail stay, and then the run ends with `crash` set to `"self"`. Console exercise 3 checks this.
2. After `wrap_xy`, a cell off the right edge becomes a cell on the left edge, which is on the board. The check would never see it as outside.
3. No. The snake can never move into an obstacle, so the two never share a cell. The order still decides which message a player sees when two kinds of collision could happen, so read it carefully when you add a new kind.
4. `&&` wants a single `TRUE` or `FALSE` on each side. Given vectors, R 4.3 stops with an error, "'length = 3' in coercion to 'logical(1)'". Older versions of R used only the first item, so the check looked at the head's neck and missed the rest of the body.
5. Obstacles never move, and the game only ever asks whether one cell is an obstacle. One vector of text keys answers that with a single `%in%`. The snake changes every move, and the game adds and drops cells at its ends, which is simpler with two number vectors.

For console exercise 3, the run ends with `crash` set to `"self"`, because a snake with cells left to grow keeps its tail cell. In exercise 4 the answers are `TRUE TRUE FALSE`, `FALSE TRUE TRUE`, `FALSE TRUE FALSE` and `TRUE`.

A good extension is to ask students where they would add a new kind of obstacle, such as a puddle that only slows the snake down, and which checks it would need to come before or after.
