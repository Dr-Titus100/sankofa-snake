# Checks the Shiny server: the screens, the controls, the run and the saved progress.
# testServer runs the server without a browser, so these tests read the server's own variables.

app <- shiny::shinyAppDir(app_dir)

client <- function(saved = NULL) list(touch = FALSE, canVibrate = FALSE, canSave = TRUE, saved = saved, today = "2026-11-20", longDate = "Friday 20 November")
act <- function(name, arg = NULL) list(act = name, arg = arg, today = "2026-11-20", longDate = "Friday 20 November")

test_that("Play starts the first level and the snake waits for a key", {
  shiny::testServer(app, {
    session$setInputs(client = client())
    session$setInputs(act = act("play"))
    expect_equal(screen(), "game")
    expect_equal(game$state$level$id, "farm")
    expect_equal(game$state$status, "ready")
    session$setInputs(cmd = list(type = "turn", dir = "up"))
    expect_equal(game$state$status, "running")
    expect_equal(game$state$queue, "up")
    session$setInputs(cmd = list(type = "pause"))
    expect_equal(game$state$status, "paused")
    session$setInputs(cmd = list(type = "pause"))
    session$setInputs(cmd = list(type = "hide"))
    expect_equal(game$state$status, "paused")
  })
})

test_that("saved progress opens the next level and locked levels stay shut", {
  saved <- '{"version":2,"levels":{"farm":{"best":320,"stars":3,"cleared":true}},"settings":{"sound":false}}'
  shiny::testServer(app, {
    session$setInputs(client = client(saved))
    expect_true(is_unlocked(2))
    expect_false(is_unlocked(3))
    expect_equal(next_level_index(), 2)
    expect_false(settings_of(game$progress)$sound)
  })
})

test_that("a crash is saved and Play again starts over", {
  shiny::testServer(app, {
    session$setInputs(client = client())
    # The City has walls, so heading up always ends the run.
    start_run("levels", 4)
    session$setInputs(cmd = list(type = "turn", dir = "up"))
    for (i in 1:40) {
      if (game$state$status != "running") break
      r <- tick(game$state)
      apply_state(r$state, r$events)
    }
    expect_equal(game$state$status, "over")
    expect_true(!is.null(game$progress$levels$city))
    session$setInputs(act = act("again"))
    expect_equal(game$state$status, "ready")
    expect_equal(game$state$level$world, "city")
  })
})

test_that("practice opens every level and bumps instead of crashing", {
  shiny::testServer(app, {
    session$setInputs(client = client())
    session$setInputs(act = act("levels"))
    session$setInputs(act = act("tab", "practice"))
    session$setInputs(act = act("level", "9"))
    expect_true(isTRUE(game$state$level$practice))
    expect_equal(game$state$level$world, "village")
  })
})

test_that("the daily challenge uses the player's date", {
  shiny::testServer(app, {
    session$setInputs(client = client())
    session$setInputs(act = act("daily"))
    expect_equal(game$state$level$id, "daily-2026-11-20")
    expect_equal(LEVELS[[game$level_index]]$world, game$state$level$world)
  })
})

test_that("Reset progress asks first and keeps the switches", {
  saved <- '{"levels":{"farm":{"best":320,"stars":3,"cleared":true}},"settings":{"sound":false,"vibration":true}}'
  shiny::testServer(app, {
    session$setInputs(client = client(saved))
    session$setInputs(act = act("go", "help"))
    session$setInputs(act = act("reset"))
    expect_true(game$confirm)
    expect_equal(length(game$progress$levels), 1)
    session$setInputs(act = act("confirm"))
    expect_equal(length(game$progress$levels), 0)
    expect_false(settings_of(game$progress)$sound)
    expect_true(game$reset_done)
  })
})

test_that("damaged saves are cleaned", {
  p <- parse_progress('{"levels":{"farm":{"best":-5,"stars":9},"nope":{}},"daily":{"date":"2026-02-30"},"free":{"farm-wrap":7,"farm-sideways":3}}')
  expect_equal(p$levels$farm, list(best = 0, stars = 0, cleared = FALSE))
  expect_null(p$levels$nope)
  expect_null(p$daily)
  expect_equal(p$free, list(`farm-wrap` = 7))
  expect_equal(parse_progress("not json"), empty_progress())
  expect_match(progress_json(empty_progress()), '"levels":\\{\\}')
})

test_that("streaks grow on days in a row and lapse after a gap", {
  p <- empty_progress()
  p <- record_daily(p, "2026-11-19", 300, TRUE)
  p <- record_daily(p, "2026-11-20", 200, TRUE)
  expect_equal(current_streak(p, "2026-11-20"), 2)
  expect_equal(current_streak(p, "2026-11-22"), 0)
})
