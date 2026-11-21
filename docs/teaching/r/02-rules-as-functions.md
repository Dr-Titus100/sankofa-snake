# Lesson 2: Rules as functions (R)

Students learn how the R version keeps everything about a run in one list, how each rule is a function that returns a new list, why R's copy on modify keeps old states safe, and how that makes the rules easy to test.

## Start by looking at the folders

```text
R/        the rules: where the snake goes, what it eats, when a run ends
app.R     the Shiny server: the screens, the timing of every move, and what it sends to the browser
www/      the browser side, which draws what R sends and sends back key presses
```

Nothing in `R/game.R` draws anything or reads a key. The Shiny app and the unit tests both use the same rules from this folder.

## Everything about a run is one list

`create_game` in `R/game.R` builds the whole run as one named list:

```r
state <- list(
  level = level,
  sx = ...,
  sy = ...,
  dir = st$dir,
  last_step = st$dir,
  queue = character(0),
  food = NULL,
  ...
  status = "ready",
  rng = u32(seed),
  ...
)
```

These are some of its fields:

| Field | What it holds |
| --- | --- |
| `sx`, `sy` | the snake's cells, head first |
| `dir` | the way the snake is heading |
| `queue` | turns the player pressed that haven't happened yet |
| `food` | the cell with the cowrie on it, as `c(x, y)` |
| `eaten`, `score` | how many cowries so far, and the score |
| `status` | `"ready"`, `"running"`, `"paused"`, `"over"` or `"cleared"` |
| `rng` | where the random number generator has got to (lesson 4) |

## Rules return a new state

Three functions do most of the work:

- `create_game(level, seed)` returns the state at the start of a level.
- `turn(state, dir)` returns the state after the player presses a direction.
- `tick(state)` moves the snake one cell and returns `list(state = ..., events = ...)`.

None of them changes the state you pass in. Look at `toggle_pause`:

```r
toggle_pause <- function(state) {
  if (state$status == "running") state$status <- "paused"
  else if (state$status == "paused") state$status <- "running"
  state
}
```

It seems to change `state` and then return it. It doesn't change the caller's list, because R uses copy on modify. When a function changes a list passed in to it, R makes a copy first, and the change goes into the copy. The caller's list stays as it was. The same happens outside functions. After `b <- a`, both names share one list until one of them changes, and then that one gets its own copy.

The TypeScript version has to build each new state with `{ ...state }`, and the Python version uses a frozen dataclass. In R, plain lists already behave this way, so the port needs no extra code to keep old states safe.

The `events` list says what happened during the move, such as `list(type = "ate", ...)` or `list(type = "crash", cause = "wall")`. The server in `app.R` reads the events to save your progress, tell the browser which sound to play, and give screen readers something to say. The rules never need to know about any of that.

## Why work this way?

A rule that only takes a value and returns a value is easy to test. A test can build a state, call the rule and check the result, with no browser, no keyboard and no waiting.

It also means the old state is still there after a move. A replay, an undo button or a computer player that tries moves ahead all become simple. The port's own tests depend on this. `tests/testthat/test-reference.R` replays 61 runs recorded from the TypeScript rules and compares the state after every single move.

## Questions on paper

1. A snake is heading right and the player presses left. What should `turn` return, and why?
2. Practice mode stops the snake when it runs into something, where the normal game ends the run. Only one function in `game.R` changes for practice. Which one do you think it is? Find it and check.
3. Why might a game keep turns in a queue instead of using only the last key pressed? Think about pressing up and then right very quickly.
4. The Shiny server in `app.R` keeps the current game in `game <- new.env()`, and its functions change `game$state` directly. Why does that work there, when changing a list inside a function doesn't reach the caller?

## At the console

Add these tests to `tests/testthat/test-lesson.R`.

1. `turn` ignores a turn back into the neck. It hands back a state identical to the one you gave it:

   ```r
   test_that("ignores a turn back into the neck", {
     start <- create_game(LEVELS[[1]], 1) # facing right
     after <- turn(start, "left")
     expect_identical(after, start)
     expect_equal(after$status, "ready")
   })
   ```

2. Changing a copy leaves the original alone:

   ```r
   test_that("changing a copy leaves the original alone", {
     a <- create_game(LEVELS[[1]], 1)
     b <- a
     b$status <- "paused"
     expect_equal(a$status, "ready")
     expect_equal(b$status, "paused")
   })
   ```

3. A move leaves the old state alone. Keep the snake's `sy` from before the move, call `tick`, and check that the old state still has it:

   ```r
   test_that("leaves the old state alone", {
     before <- turn(create_game(LEVELS[[1]], 1), "up")
     sy <- before$sy
     tick(before)
     expect_equal(before$sy, sy)
   })
   ```

4. Write a test that runs the City (`LEVELS[[4]]`, where the edge is a wall) straight up until the run ends. Check that `status` is `"over"` and `crash` is `"wall"`. How many ticks does it take? A `while` loop that counts suits this.

## Notes for the teacher

1. It returns the state you passed in, so nothing changes and the snake keeps going right. Turning left would put the head on the neck.
2. `crash`. In practice it returns a state with `status = "ready"` and a `bump`, so the game waits for a new direction.
3. With only the last key, a quick up then right would lose the up, and the snake would turn right without first going up. The queue keeps up to two turns, `MAX_QUEUED_TURNS`, so quick presses happen in order.
4. `new.env()` makes an environment, and R doesn't copy environments. Every function that gets `game` gets the same environment, so a change made in one function is seen everywhere. That is what the server needs for the one live game. The rules use plain lists so that they never share state by accident.

For keyboard exercise 3, ask students why the test passes even though `tick(before)` throws its result away. The answer is that `tick` changes only its own copy. For exercise 4, the City's snake starts at row 10 in an open column. Ten moves reach row 0 and the 11th hits the wall, so it takes 11 ticks.

A good extension is to ask students to break a rule on purpose, for example by deleting the line in `turn` that checks for the neck, and watch which tests fail, both theirs and the ones in `test-reference.R`. Then they undo the change.
