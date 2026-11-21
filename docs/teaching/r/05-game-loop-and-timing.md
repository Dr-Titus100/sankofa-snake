# Lesson 5: The game loop and timing (R)

Students learn how a game keeps time when R runs on a server and a browser draws the picture, why the screen and the snake keep different clocks, how the game keeps time fair when things are slow, and why the port needs its own way of rounding.

## Start by playing

Play the Park, level 2, in the Shiny app. The snake starts slowly and speeds up every 5 cowries. Watch the cowrie shell while you play. It pulses smoothly the whole time, even though the snake only jumps from cell to cell a few times a second.

## Two clocks in two places

The game runs on two clocks at once.

- The browser draws a new picture many times a second, usually 60. Each picture is a frame.
- The snake moves a set number of cells a second. The Park starts at 6 moves a second and rises to 10.

In the Shiny version the two clocks live in different places. R, on the server, owns the rules and decides when the snake moves. The browser owns the drawing. After each move, R sends the new state to the browser, and the browser keeps drawing it 60 times a second, so the pulsing cowrie and the drifting currents stay smooth between moves. The browser's drawing code is the web game's own, copied into `www/` by `ports/build-assets.mjs`.

The rules give the length of one move in milliseconds with `move_ms` in `R/game.R`:

```r
move_ms <- function(state) 1000 / speed_now(state)
```

`speed_now` is the snake's speed in moves a second. In slow motion it is 60% of the speed, rounded, and never below 3. While the snake swims along a current, the way the current flows, it is 1.5 times that, rounded.

## A loop with no frames

R has no frame clock. A Shiny server waits for something to happen, such as a key press from the browser, and reacts to it. So the game loop in `app.R` is an observer that asks Shiny to run it again when the next move is due:

```r
observe({
  loop()
  s <- game$state
  if (is.null(s) || s$status != "running" || isolate(screen()) != "game") return()
  now <- as.numeric(Sys.time()) * 1000
  dt <- if (is.null(game$last)) 0 else min(now - game$last, 250)
  game$last <- now
  game$carry <- game$carry + dt
  events <- list()
  n <- 0
  while (n < 4 && game$carry >= move_ms(game$state) && game$state$status == "running") {
    game$carry <- game$carry - move_ms(game$state)
    r <- tick(game$state)
    apply_state(r$state, r$events)
    events <- c(events, r$events)
    n <- n + 1
  }
  if (n > 0) send_frame(events)
  if (game$state$status == "running") invalidateLater(max(5, ceiling(move_ms(game$state) - game$carry)))
})
```

Read it a line at a time.

1. `loop()` is a reactive value. Reading it here means the observer runs again whenever the server bumps it, for example when a run starts.
2. `dt` is how long since the last run of the observer, from `Sys.time()`.
3. `carry` saves up that time, like coins in a jar.
4. While the jar holds enough time for a whole move, the loop takes that much out and moves the snake one cell with `tick`.
5. Whatever is left stays in the jar for next time. Nothing is lost, so over a second the snake makes exactly as many moves as its speed says.
6. `send_frame` sends the new state to the browser, once, even if the snake moved more than once.
7. `invalidateLater` asks Shiny to run the observer again after the given number of milliseconds. The code works out how long until the jar will hold a whole move, so R wakes up about when the next move is due and no sooner.

While the snake isn't running, the observer returns early and asks for no more runs, so the server does no work at all on a paused game.

## Keeping time fair when things are slow

A busy server or a slow network can delay the observer. Two limits stop that from spoiling the run.

- `min(now - game$last, 250)` never adds more than 250 milliseconds at once. If the server stalls for a moment, the snake doesn't jump a long way across the board afterward.
- The loop makes at most 4 moves in one run. If R falls behind, the snake catches up over a few runs.

The browser also tells R to pause when the player switches tabs, so switching away never costs the player a run.

## Rounding the JavaScript way

`speed_now` doesn't use R's `round`. It uses a function the port defines itself:

```r
js_round <- function(x) floor(x + 0.5)
```

R's `round` sends a number that ends in exactly .5 to the nearest even whole number, so `round(2.5)` is 2 and `round(3.5)` is 4. JavaScript's `Math.round` always sends .5 up, so it gives 3 and 4. The difference shows up in the game. The Ocean starts at 7 moves a second, and a current makes that 7 × 1.5 = 10.5. JavaScript rounds that to 11, and R's `round` would give 10. The R snake would swim slower than the web game's, and the reference tests would catch it.

## Time inside the rules

The time bonus at the end of a level depends on how long the run took. The rules don't read a clock for this. Each `tick` adds the length of the move to `elapsed_ms`:

```r
elapsed <- state$elapsed_ms + move_ms(state)
```

So a run's time counts only the moves the snake made. Time spent paused doesn't count, a slow server gets the same time as a fast one for the same moves, and a test can check the time without waiting.

## Questions on paper

1. The snake moves 8 cells a second. How long is one move in milliseconds?
2. The browser draws 60 frames a second and the snake moves 6 cells a second. About how many frames does the browser draw between two moves? How many times does R send a new state in that time?
3. The snake's speed is 10. What is `speed_now` in slow motion? What if the speed is 4?
4. The server stalls for a whole second while the snake moves 8 cells a second. How many moves happen in the next run of the observer, and why?
5. `carry` is 50 and a move takes 125 milliseconds. How long does `invalidateLater` wait?

## At the console

Add these tests to `tests/testthat/test-lesson.R`.

1. The Farm moves 6 cells a second, so one move takes a sixth of a second:

   ```r
   test_that("takes a sixth of a second for one move on the Farm", {
     game <- create_game(LEVELS[[1]], 1)
     expect_equal(move_ms(game), 1000 / 6)
   })
   ```

2. Ten moves add ten move lengths to the run's time:

   ```r
   test_that("counts the run's time in moves", {
     game <- turn(create_game(LEVELS[[1]], 1), "up")
     for (i in 1:10) game <- tick(game)$state
     expect_equal(game$elapsed_ms, 10 * 1000 / 6)
   })
   ```

3. Write the loop yourself. Finish this function so that it plays frames of `frame_ms` milliseconds for one second and returns how many moves the snake made. Then check that it makes 6 moves at 60 frames a second, and still 6 at 30 frames a second.

   ```r
   moves_in_one_second <- function(frame_ms) {
     game <- turn(create_game(LEVELS[[1]], 1), "up")
     carry <- 0
     moves <- 0
     time <- 0
     while (time < 1000) {
       # Add frame_ms to carry. While carry holds a whole move, take it out, tick, and count the move.
       time <- time + frame_ms
     }
     moves
   }
   ```

4. Write a test that checks `js_round(2.5)` is 3 while `round(2.5)` is 2.

## Notes for the teacher

1. 1000 / 8 = 125 milliseconds.
2. About 10 frames. A frame takes 1000 / 60, about 16.7 milliseconds, and a move takes 1000 / 6, about 166.7. R sends one new state in that time, after the move.
3. 6, since 10 × 0.6 = 6. At speed 4, 4 × 0.6 = 2.4 rounds to 2, which is below the floor of 3, so it is 3.
4. 2 moves. The observer adds at most 250 milliseconds, and a move takes 125, so the jar holds exactly two moves. Without the cap it would hold 8, and the snake would jump 8 cells at once.
5. 75 milliseconds, `ceiling(125 - 50)`. The `max(5, ...)` only matters when the jar is already almost full.

For console exercise 3, the body of the loop is:

```r
carry <- carry + frame_ms
while (carry >= move_ms(game)) {
  carry <- carry - move_ms(game)
  game <- tick(game)$state
  moves <- moves + 1
}
```

At 30 frames a second the snake moves on every fifth frame instead of every tenth, so the count is still 6. Ask students to try frames of 16, 17 and 20 milliseconds as well. The count stays at 6 because the leftover time stays in `carry` for the next frame. Then ask what would happen if the loop threw the leftover away and set `carry` back to 0 after each move.

A good extension is to compare this loop with the web game's, in [lesson 5 of the TypeScript guide](../05-game-loop-and-timing.md). The web game's loop runs once per frame in the browser. The Shiny loop runs once per move on the server, and the browser fills in the frames.
